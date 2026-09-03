/**
 * El **único** lugar del plugin que escribe en el vault (spec §8).
 *
 * Delgado a propósito: toda la lógica está en `ubicar.ts`, que se prueba
 * offline. Acá quedan las tres cosas que solo se pueden hacer con Obsidian
 * delante, y las tres tienen una razón medida o documentada.
 *
 * ## 1. Vaciar el buffer del editor antes de leer el disco
 *
 * `TextFileView.requestSave` está documentado como «Debounced save in 2 seconds
 * from now», y `vault.process` lee del disco. Medido el 24/08/2026 con
 * `scripts/espia-eventos.js`, con la nota abierta y el buffer recién ensuciado:
 *
 *   sin save()   disco 13354 · editor 13403   → process escribió 13393
 *   con save()   disco 13442 · editor 13491   → process escribió 13530
 *
 * Los dos números de la primera línea son el hallazgo: **13393 = 13354 + 39**.
 * O sea, `process` calculó sobre el disco viejo e ignoró los 49 bytes que el
 * usuario acababa de escribir. La ventana existe y `process` cae adentro.
 *
 * **Lo que la medición refutó:** yo esperaba que el volcado posterior del editor
 * pisara la escritura. No pasa. A los 2004 ms el editor guardó 13442 = 13403 +
 * 39, o sea que Obsidian **fusionó** el cambio externo en el buffer sucio. Nada
 * se perdió, ni lo tecleado ni lo escrito.
 *
 * **Por qué el `save()` se queda igual.** No por evitar una pérdida que no
 * ocurre, sino porque sin él `ubicar.ts` verifica contra una foto que no incluye
 * lo que el usuario acaba de teclear —exactamente el desfasaje del que este
 * módulo defiende— y la corrección del resultado pasa a depender de que la
 * fusión de Obsidian mapee bien los números de línea. Eso no está medido, es
 * caro de medir, y con `save()` no hay ninguna fusión: `process` ve la verdad y
 * la secuencia es lineal. Se paga 8 ms por escritura, medidos.
 *
 * (Una corrida por condición. Alcanza para refutar la hipótesis fuerte —un solo
 * caso donde no pisa basta— pero no para afirmar que nunca pisa.)
 *
 * ## 2. Verificar adentro de `fn`, no antes
 *
 * `vault.process(file, fn)` es lectura-modificación-escritura atómica y `fn` es
 * **síncrona**: ve el contenido de disco del momento. Verificar afuera y
 * escribir adentro sería exactamente la carrera que este paso vino a matar.
 *
 * Y cuando el lote no se puede ubicar, `fn` devuelve `data` **intacto**. Eso es
 * seguro y está medido: un `process` que devuelve lo mismo que recibió no
 * dispara `modify` ni `changed`, y deja el `mtime` igual. Sobre un vault en Sync
 * importa: una escritura idéntica igual sería un cambio que propagar.
 *
 * ## 3. Alimentar al store con lo que devuelve
 *
 * `process` devuelve **lo que quedó escrito**. Eso entra al store en el acto,
 * sin esperar al `changed`, que llega después y trae lo mismo.
 */
import { Notice, TFile, type App } from "obsidian";
import { archivarEnElLog } from "../archivado.js";
import type { CambioDeLote } from "../documento.js";
import { aplicarLote, ubicarLote, type ResultadoDeLote } from "../ubicar.js";

export type ResultadoDeEscritura =
  | { estado: "escrito"; contenido: string; movidas: number; lineas: number }
  | { estado: "sin-cambios"; contenido: string }
  | { estado: "sin-archivo" }
  | { estado: "no-ubicada"; lote: ResultadoDeLote };

/**
 * Aplica el lote sobre el archivo, o no escribe nada.
 *
 * **O se aplican todos los cambios del lote o ninguno**: media operación deja el
 * árbol en un estado que el usuario no pidió, y `vault.process()` no pasa por el
 * editor, así que con la nota cerrada no hay nada que lo deshaga.
 */
export async function escribir(
  app: App,
  archivo: string,
  cambios: readonly CambioDeLote[],
): Promise<ResultadoDeEscritura> {
  const file = app.vault.getFileByPath(archivo);
  if (!(file instanceof TFile)) return { estado: "sin-archivo" };
  if (cambios.length === 0) return { estado: "sin-cambios", contenido: await app.vault.cachedRead(file) };

  await volcarEditores(app, archivo);

  // `fn` no puede devolver nada más que el texto, así que el diagnóstico sale
  // por closure. Es el precio de que la verificación corra adentro de `process`,
  // que es el único lugar donde no hay carrera.
  // La caja es para que TypeScript no dé por sentado que sigue en `null`: no
  // ve que `fn` corre, y narrowear una variable suelta la dejaría en `never`.
  const salida: { lote?: ResultadoDeLote } = {};
  const contenido = await app.vault.process(file, (data) => {
    const r = aplicarLote(data, cambios);
    salida.lote = r.resultado;
    return r.texto;
  });

  const resultado = salida.lote;
  if (resultado === undefined) return { estado: "sin-archivo" }; // `fn` no corrió
  if (resultado.estado !== "ok") return { estado: "no-ubicada", lote: resultado };
  return {
    estado: "escrito",
    contenido,
    movidas: resultado.movidas,
    lineas: resultado.ubicados.length,
  };
}

// --------------------------------------------- archivar: dos archivos (§12)

export type ResultadoDeArchivado =
  | {
      estado: "escrito";
      /** El contenido que quedó en la **nota**, para el store. */
      contenido: string;
      alLog: number;
      headingsNuevos: number;
      movidas: number;
    }
  /** El paso en seco dijo que no. **No se escribió nada, en ningún archivo.** */
  | { estado: "no-ubicada"; lote: ResultadoDeLote }
  | { estado: "sin-archivo"; cual: "nota" | "log" }
  /** El LOG sí, la nota no. La mitad que se puede quedar a medias. */
  | { estado: "media-operacion"; alLog: number; lote: ResultadoDeLote };

/**
 * Archivar: escribe el bloque en el LOG **y** completa la tarea en su nota.
 *
 * Son dos archivos y `vault.process()` es de a uno, así que la regla «o se
 * aplican todos los cambios o ninguno» (§8) **no se puede cumplir entre
 * archivos**. Lo que sí se puede es elegir en qué orden se rompe y achicar la
 * ventana. Las dos decisiones:
 *
 * ## 1. Primero el LOG, después la nota
 *
 * Si falla la segunda queda una entrada de historial de una tarea que sigue
 * pendiente: **se ve, y se arregla**. Al revés queda una tarea completada sin
 * registro, que es una pérdida que **no se nota**. Es el mismo criterio con el
 * que el rango atómico del token eligió el daño reversible (§5.5 punto 1).
 *
 * Y media operación no puede terminar en silencio: `media-operacion` es su
 * propio estado justamente para que el aviso pueda decir qué quedó hecho.
 *
 * ## 2. Un paso en seco antes de tocar el LOG
 *
 * Antes de escribir nada se corre `process` sobre la **nota** devolviendo
 * `data` **intacto**, solo para preguntar si el lote se podría ubicar. No es
 * una escritura, y eso está medido y documentado arriba: un `process` que
 * devuelve lo mismo que recibió no dispara `modify` ni `changed` y deja el
 * `mtime` igual.
 *
 * Ataja la falla realista —`no-ubicada`: la línea se corrió o el bloque aparece
 * repetido, que sobre este corpus es el 9,8% de los subárboles cuando el índice
 * está atrasado— **antes** de tocar el LOG, y deja la ventana de media
 * operación en los microsegundos que hay entre las dos llamadas.
 *
 * ## Por qué el LOG no lleva un lote
 *
 * Porque su posición es una función de su propio contenido: la calcula
 * `archivarEnElLog` adentro de `process`, sobre los bytes frescos. Está
 * explicado entero ahí, y es lo único que evita duplicar un heading que otro
 * dispositivo acaba de crear.
 */
export async function escribirArchivado(
  app: App,
  log: { archivo: string; camino: readonly string[]; bloque: readonly string[] },
  nota: { archivo: string; cambios: readonly CambioDeLote[] },
): Promise<ResultadoDeArchivado> {
  // Escribir dos veces el mismo archivo con dos planes calculados por separado
  // lo corrompe: el segundo no vio lo que hizo el primero. No puede pasar —el
  // LOG no está en el store, así que no se puede elegir una tarea suya— pero un
  // ajuste mal puesto no tiene por qué costar una nota.
  if (log.archivo === nota.archivo) return { estado: "sin-archivo", cual: "log" };

  // Un lote vacío escribiría el historial y no completaría nada en la nota: es
  // media operación de entrada, y sin ningún error que la explique. No puede
  // pasar desde `archivarTarea`, y esta es la capa donde el daño se para.
  if (nota.cambios.length === 0) return { estado: "sin-archivo", cual: "nota" };

  const archivoDelLog = app.vault.getFileByPath(log.archivo);
  if (!(archivoDelLog instanceof TFile)) return { estado: "sin-archivo", cual: "log" };
  const archivoDeLaNota = app.vault.getFileByPath(nota.archivo);
  if (!(archivoDeLaNota instanceof TFile)) return { estado: "sin-archivo", cual: "nota" };

  // Los dos: el LOG casi nunca está abierto, pero si lo está su buffer sucio
  // pisaría la inserción igual que el de la nota.
  await volcarEditores(app, log.archivo);
  await volcarEditores(app, nota.archivo);

  const seco: { lote?: ResultadoDeLote } = {};
  await app.vault.process(archivoDeLaNota, (data) => {
    seco.lote = ubicarLote(data.split("\n"), nota.cambios);
    return data; // intacto: no es una escritura
  });
  if (seco.lote === undefined) return { estado: "sin-archivo", cual: "nota" };
  if (seco.lote.estado !== "ok") return { estado: "no-ubicada", lote: seco.lote };

  const alLog = { lineas: 0, headings: 0 };
  await app.vault.process(archivoDelLog, (data) => {
    const r = archivarEnElLog(data, log.camino, log.bloque);
    alLog.lineas = r.plan.lineas.length;
    alLog.headings = r.plan.headingsNuevos.length;
    return r.texto;
  });

  const salida: { lote?: ResultadoDeLote } = {};
  const contenido = await app.vault.process(archivoDeLaNota, (data) => {
    const r = aplicarLote(data, nota.cambios);
    salida.lote = r.resultado;
    return r.texto;
  });

  const resultado = salida.lote;
  if (resultado === undefined || resultado.estado !== "ok") {
    return {
      estado: "media-operacion",
      alLog: alLog.lineas,
      lote: resultado ?? { estado: "no-ubicada", fallas: [] },
    };
  }
  return {
    estado: "escrito",
    contenido,
    alLog: alLog.lineas,
    headingsNuevos: alLog.headings,
    movidas: resultado.movidas,
  };
}

/**
 * Fuerza el guardado de toda vista abierta de este archivo.
 *
 * Se recorren las hojas y no se usa `getActiveViewOfType`: la nota puede estar
 * abierta en un panel que no tiene el foco —o en dos—, y el buffer sin volcar de
 * cualquiera de ellos pisaría la escritura igual.
 *
 * Una vista que falla al guardar no puede impedir la operación entera, pero sí
 * tiene que dejar rastro: si esto falla, lo que sigue escribe sobre un disco
 * atrasado.
 */
async function volcarEditores(app: App, archivo: string): Promise<void> {
  const vistas = app.workspace.getLeavesOfType("markdown").filter((hoja) => {
    const vista = hoja.view as { file?: { path: string } | null };
    return vista.file?.path === archivo;
  });

  await Promise.all(
    vistas.map(async (hoja) => {
      const vista = hoja.view as unknown as { save?: () => Promise<void> };
      try {
        await vista.save?.();
      } catch (err) {
        console.error(`[tareas] no se pudo volcar el editor de ${archivo}:`, err);
        new Notice(`No se pudo guardar el editor de ${archivo} antes de escribir.`);
      }
    }),
  );
}

// ------------------------------------------ reiniciar: N archivos (§11)

/** Lo que quedó escrito en una nota. */
export interface NotaEscrita {
  archivo: string;
  /** El contenido que quedó, para el store. */
  contenido: string;
  movidas: number;
  lineas: number;
}

export type ResultadoDeVarias =
  | { estado: "escrito"; escritas: NotaEscrita[] }
  /** No había nada que escribir en ninguna. */
  | { estado: "sin-cambios" }
  /** El paso en seco dijo que no. **No se escribió nada, en ninguna nota.** */
  | { estado: "no-ubicada"; fallas: { archivo: string; lote: ResultadoDeLote }[] }
  | { estado: "sin-archivo"; cuales: string[] }
  /** Algunas sí y otras no. La mitad que se puede quedar a medias. */
  | { estado: "media-operacion"; escritas: NotaEscrita[]; fallas: string[] };

/**
 * Aplica un lote por nota sobre N notas, o no escribe en ninguna.
 *
 * Es `escribirArchivado` generalizado, y con una diferencia que cambia la
 * garantía. Aquel maneja **dos** archivos con un orden fijo y elegido —primero
 * el LOG, porque una entrada de historial de una tarea pendiente se ve y una
 * tarea completada sin registro no—, y su paso en seco corre sobre uno solo,
 * así que la ventana de media operación existe por diseño.
 *
 * Acá no hay orden privilegiado: las N notas valen lo mismo. Y como el paso en
 * seco corre sobre **todas antes de escribir en ninguna**, vuelve a valer la
 * regla completa de la §8: **o todas o ninguna**. La falla realista
 * —`no-ubicada`: una línea se corrió, o el bloque aparece repetido— se ataja
 * entera antes de tocar el disco.
 *
 * ## Lo que queda de ventana, y por qué no puede corromper nada
 *
 * Entre el paso en seco de la última nota y la escritura de la primera pasan
 * microsegundos, y en ese hueco Sync podría mover una línea. **Eso no escribe
 * nada mal**: `aplicarLote` vuelve a verificar adentro de `process`, sobre los
 * bytes de ese momento, así que la nota que se movió se niega. El modo de falla
 * es `media-operacion` —unas escritas y otras no— y nunca «escribió en la línea
 * de al lado», que es el error que el invariante 10 existe para impedir.
 *
 * ## Y el orden de escritura es alfabético, a propósito
 *
 * No porque una nota valga más que otra, sino porque una media operación tiene
 * que ser **reproducible**: con un orden estable, el aviso dice siempre las
 * mismas notas y volver a intentar retoma desde el mismo lugar. Con el orden
 * en que vinieron los lotes —que sale del `Map` del store— la misma falla
 * contaría una historia distinta cada vez.
 */
export async function escribirEnVarias(
  app: App,
  lotes: readonly { archivo: string; cambios: readonly CambioDeLote[] }[],
): Promise<ResultadoDeVarias> {
  const conCambios = lotes.filter((l) => l.cambios.length > 0);
  if (conCambios.length === 0) return { estado: "sin-cambios" };

  // Dos lotes sobre el mismo archivo se calcularon por separado, así que el
  // segundo no vio lo que hizo el primero: aplicarlos en fila lo corrompe. No
  // puede pasar desde el store —una nota es una entrada— pero esta es la capa
  // donde el daño se para.
  const rutas = new Set(conCambios.map((l) => l.archivo));
  if (rutas.size !== conCambios.length) return { estado: "sin-archivo", cuales: [...rutas] };

  const orden = [...conCambios].sort((a, b) => a.archivo.localeCompare(b.archivo));

  const archivos = new Map<string, TFile>();
  const faltan: string[] = [];
  for (const l of orden) {
    const f = app.vault.getFileByPath(l.archivo);
    if (f instanceof TFile) archivos.set(l.archivo, f);
    else faltan.push(l.archivo);
  }
  if (faltan.length) return { estado: "sin-archivo", cuales: faltan };

  await Promise.all(orden.map((l) => volcarEditores(app, l.archivo)));

  // El paso en seco, sobre **todas**. `process` devolviendo `data` intacto no
  // dispara `modify` ni `changed` y deja el `mtime` igual: está medido, y es lo
  // que lo hace legítimo sobre un vault en Sync.
  const fallas: { archivo: string; lote: ResultadoDeLote }[] = [];
  for (const l of orden) {
    const seco: { lote?: ResultadoDeLote } = {};
    await app.vault.process(archivos.get(l.archivo)!, (data) => {
      seco.lote = ubicarLote(data.split("\n"), l.cambios);
      return data;
    });
    const lote = seco.lote ?? { estado: "no-ubicada" as const, fallas: [] };
    if (lote.estado !== "ok") fallas.push({ archivo: l.archivo, lote });
  }
  // Se recorren todas aunque la primera falle: «no se pudieron ubicar 3 de 5»
  // es más útil que «no se pudo una», y son archivos de 400 líneas.
  if (fallas.length) return { estado: "no-ubicada", fallas };

  const escritas: NotaEscrita[] = [];
  const seCayeron: string[] = [];
  for (const l of orden) {
    const salida: { lote?: ResultadoDeLote } = {};
    const contenido = await app.vault.process(archivos.get(l.archivo)!, (data) => {
      const r = aplicarLote(data, l.cambios);
      salida.lote = r.resultado;
      return r.texto;
    });
    const lote = salida.lote;
    if (lote === undefined || lote.estado !== "ok") {
      seCayeron.push(l.archivo);
      continue;
    }
    escritas.push({
      archivo: l.archivo,
      contenido,
      movidas: lote.movidas,
      lineas: lote.ubicados.length,
    });
  }

  return seCayeron.length
    ? { estado: "media-operacion", escritas, fallas: seCayeron }
    : { estado: "escrito", escritas };
}
