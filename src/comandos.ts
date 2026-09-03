/**
 * Los comandos de paleta: el camino de escritura de punta a punta.
 *
 * Es el mínimo para probar todo el paso 3 sin dibujar nada. Cada uno hace el
 * mismo recorrido:
 *
 *     cursor → clave → **el store** → plan → escribir → absorber → aviso
 *
 * ## Por qué van por el store y no por el editor
 *
 * El editor tiene la línea del cursor a mano y sería más corto usarla. Se va por
 * el store a propósito, por dos razones:
 *
 * 1. Es el camino que van a usar las vistas del paso 5, donde no hay editor
 *    ninguno: el workbench actúa sobre una posición que el store recuerda.
 * 2. Es el único que ejercita `ubicar.ts` de verdad. Con el editor, el número de
 *    línea es siempre fresco por construcción y el mecanismo que más importa de
 *    esta sesión no se probaría nunca en vivo.
 *
 * El cursor se usa solo para **elegir** la tarea; lo que se escribe sale del
 * documento que el store tiene, con su `antes`, y `ubicar.ts` lo verifica contra
 * el disco en el momento de escribir.
 */
import { Notice, type App, type Editor, type MarkdownFileInfo } from "obsidian";
import {
  conversionDeDue,
  dueParaLaLinea,
  elegirTarea,
  ilegiblesDelSubarbol,
  planDeArchivarEnLaNota,
  planDeCompletar,
  planDeEliminar,
  planDeFecha,
  planDePrioridad,
  planDeRecurrencia,
  planDeReinicioEnVarias,
  planDeWorkbench,
  yaEstaCompleta,
  type Eleccion,
} from "./acciones.js";
import {
  archivarPideConfirmacion,
  bloqueParaElLog,
  caminoDeArchivado,
  nodoDeTarea,
  nombreDeNota,
  planDeArchivado,
  yaEstaEnElLog,
} from "./archivado.js";
import { bajar, subir } from "./color.js";
import { formaDeDue, parseTaskToken, type Prioridad } from "./token.js";
import { parseDocumento, type CambioDeLote } from "./documento.js";
import type { StoreDeTareas } from "./store.js";
import { STRINGS } from "./strings.js";
import { prioridadEfectiva, type Clave } from "./tareas.js";
import { confirmar } from "./ui/confirmar.js";
import { elegirGrupo } from "./ui/elegirGrupo.js";
import {
  escribir,
  escribirArchivado,
  escribirEnVarias,
  type ResultadoDeEscritura,
} from "./vault/escribir.js";

/** Hoy, en `AAAA-MM-DD` y en hora local. */
export function hoy(fecha = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${fecha.getFullYear()}-${p(fecha.getMonth() + 1)}-${p(fecha.getDate())}`;
}

/** La tarea sobre la que va a actuar una acción, ya resuelta contra el índice. */
export interface Contexto {
  archivo: string;
  clave: Clave;
}

/** El aviso que corresponde a cada modo de fracaso de `elegirTarea`. */
function aviso(e: Exclude<Eleccion, { estado: "ok" }>): string {
  switch (e.estado) {
    case "fuera-de-la-lista":
      return STRINGS.avisos.fueraDeLaLista;
    case "sin-indice":
      return STRINGS.avisos.sinIndice;
    case "sin-tarea":
      return STRINGS.avisos.sinTarea;
    case "ausente":
      return STRINGS.avisos.lineaAusente;
    case "ambigua":
      return STRINGS.avisos.lineaAmbigua(e.veces);
  }
}

/**
 * La tarea que el cursor está eligiendo, o `null` con el aviso ya dado.
 *
 * Toda la decisión vive en `elegirTarea`, que es pura y está probada. Acá queda
 * lo que solo se puede hacer con Obsidian delante: sacarle al editor la línea
 * **y su texto**, y convertir el resultado en un cartel.
 *
 * Que se le pida el **texto** y no solo el número es el arreglo del bug de B5:
 * la línea del cursor es de ahora y el índice puede ser de hace un rato, así que
 * el número solo no alcanza para saber de qué tarea se está hablando.
 *
 * El segundo argumento se tipa como `MarkdownFileInfo` y no como `MarkdownView`
 * porque es lo que Obsidian pasa: el comando también se dispara desde un editor
 * embebido, que no es una vista. Lo único que se necesita —`file`— lo tienen los
 * dos.
 */
function tareaDelCursor(
  store: StoreDeTareas,
  editor: Editor,
  vista: MarkdownFileInfo,
  notas: readonly string[],
): Contexto | null {
  const linea = editor.getCursor().line;
  return elegirEnLinea(store, notas, vista.file?.path ?? null, linea, editor.getLine(linea));
}

/**
 * La tarea de esta línea, o `null` con el aviso ya dado.
 *
 * **Lo comparten la paleta y la fila de botones**, y tienen que compartirlo: es
 * el único lugar donde una coordenada del editor se traduce a una del índice, y
 * dos copias de esa traducción divergirían justo donde más caro sale (§8, e
 * invariante 10). La fila la llama con lo que `posAtDOM` le devuelve; la paleta,
 * con lo que dice el cursor. Para `elegirTarea` es lo mismo: un número de línea
 * de ahora y el texto de ahora.
 */
export function elegirEnLinea(
  store: StoreDeTareas,
  notas: readonly string[],
  archivo: string | null,
  linea: number,
  texto: string,
): Contexto | null {
  const eleccion = elegirTarea(
    archivo,
    notas,
    archivo ? store.documento(archivo) : null,
    archivo ? store.tareasDe(archivo) : [],
    { linea, texto },
  );

  if (eleccion.estado !== "ok") {
    new Notice(aviso(eleccion), 8000);
    return null;
  }
  return { archivo: archivo!, clave: eleccion.clave };
}

/**
 * Escribe el plan y actualiza el store con lo que quedó escrito.
 *
 * `exito` recibe cuántas líneas se escribieron para poder decirlo. El aviso de
 * fracaso lo da esta función, porque es siempre el mismo y siempre importa: una
 * escritura que no ocurrió y nadie avisó es indistinguible de un plugin roto.
 */
export async function aplicar(
  app: App,
  store: StoreDeTareas,
  archivo: string,
  cambios: readonly CambioDeLote[],
  exito: (n: number) => string | null,
): Promise<ResultadoDeEscritura> {
  const r = await escribir(app, archivo, cambios);

  if (r.estado === "escrito") {
    // Lo que devolvió `process` entra al store en el acto, sin esperar al
    // evento. El `changed` que llegue después trae lo mismo y no reparsea.
    store.absorber(archivo, r.contenido, "escritura");
    const texto = exito(r.lineas);
    // `null` es «esto no se anuncia»: la fila de botones se explica sola.
    // Un fracaso, en cambio, avisa siempre — una escritura que no ocurrió y
    // nadie avisó es indistinguible de un plugin roto.
    if (texto !== null) {
      new Notice(texto + (r.movidas > 0 ? STRINGS.avisos.movidas(r.movidas) : ""));
    }
  } else if (r.estado === "no-ubicada") {
    new Notice(STRINGS.avisos.noUbicada, 8000);
  } else if (r.estado === "sin-cambios") {
    new Notice(STRINGS.avisos.sinCambios);
  }
  return r;
}

/**
 * Fijar la prioridad de una tarea en un nivel concreto. **Una sola línea.**
 *
 * Es el camino que comparten los dos comandos de paleta y los tres ítems del ⋯,
 * y comparten también sus dos negativas, que costaron un bug cada una:
 *
 * - Se parte del nivel que **se ve**, no del propio: una hija sin `p=` se dibuja
 *   con la prioridad de su madre (§14), y actuar sobre su cero hacía que subirle
 *   la prioridad a una hija que heredaba «muy alta» la dejara en «alta».
 * - Se mira `deArriba` y no de dónde venía el nivel actual: una hija con `p=1`
 *   propio adentro de un bloque `p=2` **sí** tiene prioridad propia, y bajarla
 *   igual la deja heredando rojo. Para saber si bajar sirve de algo hay que
 *   mirar qué queda **después**, no de dónde viene lo de ahora.
 *
 * El agujero del modelo va dicho en vez de tapado: «normal» no escribe campo
 * (§5.2), y sin campo la hija vuelve a heredar. No hay forma de declararla
 * normal adentro de un bloque urgente sin un `p=0` explícito, que cambiaría el
 * formato del token. Callarlo sería un comando que no hace nada.
 */
export function fijarPrioridad(
  app: App,
  store: StoreDeTareas,
  ctx: Contexto,
  nueva: Prioridad,
): void {
  const tareas = store.tareasDe(ctx.archivo);
  const { nivel, deArriba } = prioridadEfectiva(tareas, ctx.clave);

  if (nueva === nivel) {
    new Notice(STRINGS.avisos.prioridadEnElTope(STRINGS.prioridades[nivel]));
    return;
  }
  if (nueva === 0 && deArriba !== 0) {
    new Notice(STRINGS.avisos.prioridadHeredada, 8000);
    return;
  }

  void aplicar(
    app,
    store,
    ctx.archivo,
    planDePrioridad(store.documento(ctx.archivo)!, tareas, ctx.clave, nueva),
    () => STRINGS.avisos.prioridad(STRINGS.prioridades[nueva]),
  );
}

/** El nivel que **se ve** en esta tarea. Lo usa el ⋯ para marcar el vigente. */
export function nivelVisible(store: StoreDeTareas, ctx: Contexto): Prioridad {
  return prioridadEfectiva(store.tareasDe(ctx.archivo), ctx.clave).nivel;
}

/**
 * Mandar la tarea a un workbench, o sacarla. **El árbol completo** (§9).
 *
 * El toggle lo decide la raíz y se aplica a todo el subárbol: mirar cada línea
 * por separado dejaría el árbol mitad adentro y mitad afuera de un clic, y el
 * indicador que se ve es el de la raíz.
 *
 * `exito` puede devolver `null` para no avisar nada. Es lo que hace la fila de
 * botones: el ★ que se rellena **es** el aviso, y llega solo — la escritura
 * vuelve al editor como cambio externo y el widget se reconstruye—. Un cartel
 * por cada clic sería ruido sobre la acción más frecuente del plugin.
 */
export function alternarWorkbench(
  app: App,
  store: StoreDeTareas,
  ctx: Contexto,
  wb: string,
  callado = false,
): void {
  const doc = store.documento(ctx.archivo)!;
  const tareas = store.tareasDe(ctx.archivo);
  const entra = !(store.buscar(ctx.archivo, ctx.clave)?.workbenches ?? []).includes(wb);

  void aplicar(
    app,
    store,
    ctx.archivo,
    // Los ids son de **todas** las notas: dos tareas con el mismo id serían la
    // misma para el workbench, que es peor que un error.
    planDeWorkbench(doc, tareas, ctx.clave, wb, store.idsEnUso()),
    (n) =>
      callado
        ? null
        : entra
          ? STRINGS.avisos.entraAlWorkbench(n, wb)
          : STRINGS.avisos.saleDelWorkbench(n, wb),
  );
}

/**
 * Completar y descartar (§12): marca `[x]`, escribe `done`, **no borra nada**.
 *
 * Baja por el subárbol entero, que es la §9. Avisa **antes** de escribir si hay
 * líneas con el token ilegible: saltearlas es lo correcto (§5.3), pero
 * saltearlas en silencio deja una madre en `[x]` y una hija en `[ ]` sin
 * explicación, que es peor que el token roto.
 */
export function completarTarea(
  app: App,
  store: StoreDeTareas,
  ctx: Contexto,
  hoyStr: string,
): void {
  const doc = store.documento(ctx.archivo)!;
  const tareas = store.tareasDe(ctx.archivo);
  if (yaEstaCompleta(tareas, ctx.clave)) {
    new Notice(STRINGS.avisos.yaCompleta);
    return;
  }

  const rotas = ilegiblesDelSubarbol(doc, tareas, ctx.clave);
  if (rotas.length) new Notice(STRINGS.avisos.ilegibles(rotas.length), 8000);

  void aplicar(
    app,
    store,
    ctx.archivo,
    planDeCompletar(doc, tareas, ctx.clave, hoyStr),
    STRINGS.avisos.completadas,
  );
}

/**
 * Completar y **archivar** (§12): el bloque va al historial y la tarea queda `[x]`.
 *
 * Es el único camino del plugin que toca **dos archivos**, y por eso es el
 * único que no puede cumplir «o todos los cambios o ninguno» de punta a punta.
 * El orden, el paso en seco y el porqué están en `vault/escribir.ts`; acá queda
 * lo de arriba: armar el bloque, mirar dónde caería, preguntar si hace falta, y
 * contar lo que pasó.
 *
 * **El historial se lee acá, fresco y solo para la confirmación.** No sale del
 * store: la §12 dice que el LOG se lee cuando se abre la vista, nunca al
 * arrancar, y `notasDeTrabajo` lo excluye. Lo que se escribe se recalcula
 * después, adentro de `process`, sobre los bytes de ese momento — así que entre
 * lo que dice el cartel y lo que se escribe puede haber **una** diferencia: si
 * otro dispositivo creó la sección en el medio, el cartel dice que la crea y
 * resulta que no hacía falta. Es la diferencia correcta: la otra —duplicar el
 * heading— es la que rompe el invariante 6.
 */
export async function archivarTarea(
  app: App,
  store: StoreDeTareas,
  ctx: Contexto,
  hoyStr: string,
  notaDeLog: string,
  pedirConfirmacion: boolean,
): Promise<void> {
  const doc = store.documento(ctx.archivo)!;
  const tareas = store.tareasDe(ctx.archivo);
  const tarea = store.buscar(ctx.archivo, ctx.clave);
  const nodo = tarea ? nodoDeTarea(doc, tarea.linea) : null;
  if (!tarea || !nodo) {
    new Notice(STRINGS.avisos.sinTarea);
    return;
  }

  const bloque = bloqueParaElLog(doc, nodo, hoyStr);
  const camino = caminoDeArchivado(ctx.archivo, tarea.proyecto);
  const cambios = planDeArchivarEnLaNota(doc, tareas, ctx.clave, hoyStr);

  // El historial, leído entero y ahora. Son 1,3 KB.
  const archivoDelLog = app.vault.getFileByPath(notaDeLog);
  if (!archivoDelLog) {
    new Notice(STRINGS.avisos.sinLog(notaDeLog), 10000);
    return;
  }
  const log = parseDocumento(await app.vault.cachedRead(archivoDelLog));
  const previo = planDeArchivado(log, camino, bloque);
  // Archivar de nuevo lo mismo no se impide, pero **siempre** se pregunta,
  // aunque el bloque sea de una línea: el umbral existe para no poner fricción
  // en el caso frecuente, y una entrada repetida no lo es.
  const repetida = yaEstaEnElLog(log, camino, bloque);

  // Igual que al completar: saltear una línea rota es lo correcto (§5.3), pero
  // saltearla en silencio deja una madre en `[x]` y una hija en `[ ]`.
  const rotas = ilegiblesDelSubarbol(doc, tareas, ctx.clave);
  if (rotas.length) new Notice(STRINGS.avisos.ilegibles(rotas.length), 8000);

  const escribirlo = () =>
    void escribirYAvisar(app, store, ctx, { archivo: notaDeLog, camino, bloque }, cambios);

  // El umbral por tamaño solo manda si el ajuste está encendido. Apagado —que
  // es lo de por omisión— archivar no pregunta nunca… salvo la repetida, que
  // pregunta igual: ahí el cartel evita una entrada de más, no agrega un paso.
  if (!repetida && !(pedirConfirmacion && archivarPideConfirmacion(bloque))) {
    escribirlo();
    return;
  }

  const completadas = planDeCompletar(doc, tareas, ctx.clave, hoyStr).length;
  const t = STRINGS.confirmar.archivar;
  confirmar(
    app,
    {
      titulo: t.titulo,
      detalle: [
        ...(repetida ? [t.yaEnElHistorial] : []),
        t.alLog(bloque.length, camino.join(" / ")),
        ...(previo.headingsNuevos.length ? [t.creaSeccion(camino.join(" / "))] : []),
        completadas === 0
          ? t.yaEstabaCompleta(nombreDeNota(ctx.archivo))
          : t.enLaNota(completadas, nombreDeNota(ctx.archivo)),
        t.deshacer,
      ],
      aceptar: t.aceptar,
    },
    escribirlo,
  );
}

/**
 * Escribe el archivado y traduce el resultado en un cartel.
 *
 * Los cuatro finales están separados porque cada uno se arregla distinto, y uno
 * de ellos —`media-operacion`— es el único estado a medias que el plugin puede
 * dejar. Ese aviso es largo a propósito: media operación que termina en
 * silencio es peor que una que no ocurrió.
 */
async function escribirYAvisar(
  app: App,
  store: StoreDeTareas,
  ctx: Contexto,
  log: { archivo: string; camino: readonly string[]; bloque: readonly string[] },
  cambios: readonly CambioDeLote[],
): Promise<void> {
  const r = await escribirArchivado(app, log, { archivo: ctx.archivo, cambios });

  switch (r.estado) {
    case "escrito":
      store.absorber(ctx.archivo, r.contenido, "escritura");
      new Notice(
        STRINGS.avisos.archivado(log.bloque.length, log.camino.join(" / ")) +
          (r.movidas > 0 ? " (se había corrido)" : ""),
      );
      break;
    case "no-ubicada":
      // El paso en seco: no se escribió nada, ni en el historial.
      new Notice(STRINGS.avisos.noUbicada, 8000);
      break;
    case "sin-archivo":
      new Notice(
        r.cual === "log" ? STRINGS.avisos.sinLog(log.archivo) : STRINGS.avisos.sinNota(ctx.archivo),
        10000,
      );
      break;
    case "media-operacion":
      new Notice(STRINGS.avisos.mediaOperacion(r.alLog), 0);
      break;
  }
}

/**
 * El descarte físico de la §12: **borra** la tarea y su subárbol.
 *
 * Es la única acción del plugin que pierde texto, así que confirma **siempre**,
 * sin umbral: el umbral del archivado existe porque archivar no pierde nada
 * (§12 — la tarea queda `[x]` en su lugar y el bloque queda en el historial), y
 * acá esa razón no aplica.
 */
export function eliminarTarea(
  app: App,
  store: StoreDeTareas,
  ctx: Contexto,
  pedirConfirmacion: boolean,
): void {
  const doc = store.documento(ctx.archivo)!;
  const plan = planDeEliminar(doc, store.tareasDe(ctx.archivo), ctx.clave);
  const cuantas = plan.length === 1 ? plan[0]!.antes.length : 0;
  if (cuantas === 0) {
    new Notice(STRINGS.avisos.sinTarea);
    return;
  }

  const borrar = () =>
    void aplicar(app, store, ctx.archivo, plan, () => STRINGS.avisos.eliminado(cuantas));

  if (!pedirConfirmacion) {
    borrar();
    return;
  }

  const t = STRINGS.confirmar.eliminar;
  confirmar(
    app,
    {
      titulo: t.titulo,
      detalle: [t.borra(cuantas, nombreDeNota(ctx.archivo)), t.noArchiva, t.deshacer],
      aceptar: t.aceptar,
      peligrosa: true,
    },
    borrar,
  );
}

// --------------------------------------- fecha y recurrencia (§5.2, §11)

/** El texto de la línea de esta tarea, tal como el store lo tiene. */
function textoDe(store: StoreDeTareas, ctx: Contexto): string | null {
  const t = store.buscar(ctx.archivo, ctx.clave);
  if (!t) return null;
  return store.documento(ctx.archivo)?.lineas[t.linea]?.texto ?? null;
}

/**
 * Fijar —o sacar— la fecha de vencimiento. **Una sola línea.**
 *
 * El aviso dice **qué forma escribió**, y eso no es adorno: `due` guarda una
 * fecha en una tarea normal y un día del mes en una cíclica (§11), el token
 * está oculto, y sin el cartel no hay forma de saber cuál de las dos quedó.
 * Quién decide la forma es `dueParaLaLinea`, la misma función que usa el plan:
 * si el cartel lo decidiera por su cuenta, mentiría el día que una cambie.
 */
export function fijarFecha(
  app: App,
  store: StoreDeTareas,
  ctx: Contexto,
  due: string | null,
): void {
  const texto = textoDe(store, ctx);
  if (texto === null) {
    new Notice(STRINGS.avisos.sinTarea);
    return;
  }
  const escrito = dueParaLaLinea(texto, due);

  void aplicar(
    app,
    store,
    ctx.archivo,
    planDeFecha(store.documento(ctx.archivo)!, store.tareasDe(ctx.archivo), ctx.clave, due),
    () =>
      escrito === null
        ? STRINGS.avisos.fechaSacada
        : formaDeDue(escrito) === "dia"
          ? STRINGS.avisos.fechaPuestaEnCiclica(escrito)
          : STRINGS.avisos.fechaPuesta(escrito),
  );
}

/**
 * Etiquetar —o desetiquetar— una tarea cíclica. **Una sola línea** (§11).
 *
 * Los dos avisos de más son la parte que importa, y los dos hablan del `due`:
 *
 * - Al **poner** `rec` sobre una tarea con fecha absoluta, la fecha se convierte
 *   en el día del mes y se pierden el año y el mes. Es lo correcto —la §11 dice
 *   que una cíclica guarda el día— pero es una pérdida, y una pérdida en
 *   silencio es la que no se puede revisar.
 * - Al **sacarlo** de una que tenía `due=10`, el `10` se queda y ahora significa
 *   otra cosa que antes: sigue resolviéndose contra el reloj, pero ya no adentro
 *   de un ciclo. Convertirlo al revés tendría que inventar un mes.
 *
 * Se lee de la línea y no del índice por lo mismo que `planDeRecurrencia`: es la
 * fuente más fresca, y la que decide tiene que ser la que se reescribe.
 */
export function fijarRecurrencia(
  app: App,
  store: StoreDeTareas,
  ctx: Contexto,
  rec: string | null,
): void {
  const texto = textoDe(store, ctx);
  if (texto === null) {
    new Notice(STRINGS.avisos.sinTarea);
    return;
  }
  const a = parseTaskToken(texto);
  if (a.estado === "ilegible") {
    new Notice(STRINGS.avisos.tokenIlegible, 8000);
    return;
  }
  const dueAntes = a.meta.due;

  void aplicar(
    app,
    store,
    ctx.archivo,
    planDeRecurrencia(store.documento(ctx.archivo)!, store.tareasDe(ctx.archivo), ctx.clave, rec),
    () => {
      if (rec === null) {
        if (formaDeDue(dueAntes) === "dia") {
          new Notice(STRINGS.avisos.dueQuedaEnDia(dueAntes!), 8000);
        }
        return STRINGS.avisos.noEsCiclica;
      }
      const convertido = conversionDeDue(dueAntes);
      if (convertido !== null) {
        new Notice(STRINGS.avisos.dueConvertido(dueAntes!, convertido), 10000);
      }
      return STRINGS.avisos.recurrencia(rec);
    },
  );
}

// ------------------------------------------- reiniciar un grupo (§11)

/**
 * Reiniciar un grupo cíclico: destildar y borrar el `done`, en **N notas**.
 *
 * Es la escritura más repartida del plugin, y la única que **confirma siempre**.
 * Archivar y eliminar quedaron sin confirmación por decisión del usuario
 * —pesaba más la fricción— y acá la razón es otra y no se puede apagar: toca
 * varias notas a la vez, y el historial de deshacer solo existe en las que
 * están abiertas. Con la nota cerrada `vault.process()` no pasa por el editor.
 *
 * **La razón no es el tamaño.** La §11 decía «23 líneas de un tirón en
 * `tareas_MES`, medido», y eso contaba lo que *se esperaba* etiquetar: contado
 * el 02/09/2026, un reinicio sobre el corpus de hoy tocaría a lo sumo **16
 * líneas en todo el vault**. El número se corrigió en la spec; la confirmación
 * se queda por lo de arriba.
 *
 * Lo que hace que acá vuelva a valer «o todas o ninguna» es que el paso en seco
 * de `escribirEnVarias` corre sobre **todas** antes de escribir en ninguna, y
 * eso lo dice el aviso: con el índice atrasado no se escribe en una sola nota.
 */
export function reiniciarGrupo(
  app: App,
  store: StoreDeTareas,
  grupo: string,
): void {
  const lotes = planDeReinicioEnVarias(
    store.cargadas().map((archivo) => ({
      archivo,
      doc: store.documento(archivo)!,
      tareas: store.tareasDe(archivo),
    })),
    grupo,
  );

  if (lotes.length === 0) {
    new Notice(STRINGS.avisos.sinQueReiniciar(grupo), 8000);
    return;
  }

  const tareas = lotes.reduce((n, l) => n + l.cambios.length, 0);
  const nombres = lotes.map((l) => nombreDeNota(l.archivo)).sort();
  const t = STRINGS.confirmar.reiniciar;

  confirmar(
    app,
    {
      titulo: t.titulo,
      detalle: [
        t.destilda(tareas, lotes.length),
        t.notas(nombres),
        t.soloEtiquetadas,
        t.noArchiva,
        t.deshacer,
      ],
      aceptar: t.aceptar,
    },
    () => void escribirReinicio(app, store, lotes),
  );
}

/**
 * Escribe el reinicio y traduce el resultado en un cartel.
 *
 * Los cuatro finales están separados porque cada uno se arregla distinto, y el
 * que importa es `no-ubicada`: **no se escribió en ninguna**, que es la
 * garantía que el paso en seco sobre todas las notas compra y que el archivado
 * —dos archivos con orden fijo— no puede dar.
 */
async function escribirReinicio(
  app: App,
  store: StoreDeTareas,
  lotes: readonly { archivo: string; cambios: readonly CambioDeLote[] }[],
): Promise<void> {
  const r = await escribirEnVarias(app, lotes);

  switch (r.estado) {
    case "escrito": {
      for (const n of r.escritas) store.absorber(n.archivo, n.contenido, "escritura");
      const lineas = r.escritas.reduce((n, e) => n + e.lineas, 0);
      new Notice(STRINGS.avisos.reiniciado(lineas, r.escritas.length));
      break;
    }
    case "no-ubicada":
      new Notice(STRINGS.avisos.reinicioNoUbicado(r.fallas.map((f) => nombreDeNota(f.archivo))), 10000);
      break;
    case "sin-cambios":
      new Notice(STRINGS.avisos.sinCambios);
      break;
    case "sin-archivo":
      new Notice(STRINGS.avisos.sinNota(r.cuales.join(", ")), 10000);
      break;
    case "media-operacion":
      // El estado a medias, que acá es por nota. Aviso sin cierre automático:
      // media operación que termina en silencio es peor que una que no ocurrió.
      for (const n of r.escritas) store.absorber(n.archivo, n.contenido, "escritura");
      new Notice(
        STRINGS.avisos.reinicioAMedias(
          r.escritas.map((e) => nombreDeNota(e.archivo)),
          r.fallas.map(nombreDeNota),
        ),
        0,
      );
      break;
  }
}

/**
 * Subir o bajar la prioridad de la tarea del cursor.
 *
 * `subir` y `bajar` topan en vez de dar la vuelta, así que hay un caso en que no
 * hay nada que escribir. Lo dice `fijarPrioridad`, porque un comando que no hace
 * nada y no avisa es indistinguible de un comando roto.
 */
function moverPrioridad(
  dep: DependenciasDeComandos,
  editor: Editor,
  vista: MarkdownFileInfo,
  mover: (p: Prioridad) => Prioridad,
): void {
  const ctx = tareaDelCursor(dep.store, editor, vista, dep.notas());
  if (!ctx) return;
  fijarPrioridad(dep.app, dep.store, ctx, mover(nivelVisible(dep.store, ctx)));
}

export interface DependenciasDeComandos {
  app: App;
  store: StoreDeTareas;
  /** La lista efectiva, leída en el momento: los ajustes cambian sin recargar. */
  notas: () => readonly string[];
  workbench: () => string;
  /** A dónde archiva. Se lee en el momento: el ajuste cambia sin recargar. */
  notaDeLog: () => string;
  confirmarAlArchivar: () => boolean;
  confirmarAlEliminar: () => boolean;
  ahora?: () => string;
}

/** Los comandos, con la forma que `Plugin.addCommand` espera. */
export function comandos(dep: DependenciasDeComandos) {
  const fecha = dep.ahora ?? (() => hoy());

  return [
    {
      id: "completar-tarea-del-cursor",
      name: STRINGS.comandos.completar,
      editorCallback: (editor: Editor, vista: MarkdownFileInfo) => {
        const ctx = tareaDelCursor(dep.store, editor, vista, dep.notas());
        if (ctx) completarTarea(dep.app, dep.store, ctx, fecha());
      },
    },
    {
      id: "asignar-workbench-favorito",
      name: STRINGS.comandos.workbench,
      editorCallback: (editor: Editor, vista: MarkdownFileInfo) => {
        const ctx = tareaDelCursor(dep.store, editor, vista, dep.notas());
        if (ctx) alternarWorkbench(dep.app, dep.store, ctx, dep.workbench());
      },
    },
    {
      id: "completar-y-archivar-la-tarea-del-cursor",
      name: STRINGS.comandos.archivar,
      editorCallback: (editor: Editor, vista: MarkdownFileInfo) => {
        const ctx = tareaDelCursor(dep.store, editor, vista, dep.notas());
        if (ctx) {
          void archivarTarea(
            dep.app,
            dep.store,
            ctx,
            fecha(),
            dep.notaDeLog(),
            dep.confirmarAlArchivar(),
          );
        }
      },
    },
    {
      id: "eliminar-la-tarea-del-cursor",
      name: STRINGS.comandos.eliminar,
      editorCallback: (editor: Editor, vista: MarkdownFileInfo) => {
        const ctx = tareaDelCursor(dep.store, editor, vista, dep.notas());
        if (ctx) eliminarTarea(dep.app, dep.store, ctx, dep.confirmarAlEliminar());
      },
    },
    {
      id: "subir-prioridad-del-cursor",
      name: STRINGS.comandos.subirPrioridad,
      editorCallback: (editor: Editor, vista: MarkdownFileInfo) =>
        moverPrioridad(dep, editor, vista, subir),
    },
    {
      id: "bajar-prioridad-del-cursor",
      name: STRINGS.comandos.bajarPrioridad,
      editorCallback: (editor: Editor, vista: MarkdownFileInfo) =>
        moverPrioridad(dep, editor, vista, bajar),
    },
    {
      // **Sin `editorCallback`**, que es el único de la lista. Un grupo de
      // reinicio es global (§11) y puede estar entero en notas cerradas: pedir
      // un editor con el cursor sobre una tarea lo volvería inalcanzable justo
      // cuando hace falta, que es cuando todo el grupo está completado.
      id: "reiniciar-grupo-ciclico",
      name: STRINGS.comandos.reiniciar,
      callback: () => {
        const grupos = dep.store.gruposEnUso();
        if (grupos.length === 0) {
          new Notice(STRINGS.avisos.sinGrupos, 10000);
          return;
        }
        elegirGrupo(dep.app, grupos, STRINGS.comandos.reiniciar, (grupo) =>
          reiniciarGrupo(dep.app, dep.store, grupo),
        );
      },
    },
  ];
}
