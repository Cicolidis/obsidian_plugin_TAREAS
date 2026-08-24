/**
 * Dónde escribir de verdad, cuando el archivo ya no es el que se planeó.
 *
 * Este módulo existe por un riesgo que ninguna otra parte del plugin cubre.
 * «Nunca reescribir el archivo entero» (§8) está resuelto en la capa 1: se
 * escribe por rango. Pero un rango es un **número de línea**, y el número de
 * línea de un plan se calcula sobre el documento que el store tiene en memoria,
 * que puede ser de hace un rato:
 *
 * > El store dice que la tarea está en la línea 42; para cuando se escribe, ya
 * > no lo está, porque el usuario tecleó arriba.
 *
 * Escribir en la 42 igual no falla ni avisa: **pisa otra tarea**. Es la clase de
 * error más cara que puede cometer este plugin, porque no se ve.
 *
 * ## La regla
 *
 * Por eso todo `CambioDeLinea` lleva `antes`, y por eso nada se escribe sin
 * verificarlo contra lo que hay en el archivo **en el momento de escribir**:
 *
 * 1. Si la línea sugerida coincide con `antes`, se escribe ahí. Punto —aunque
 *    ese mismo texto aparezca en otro lado. Buscar es el camino de excepción.
 * 2. Si no coincide, se busca ese texto exacto en el archivo.
 *    - Aparece **una sola vez** → se escribe ahí. La línea se corrió.
 *    - **Cero o varias** → no se escribe, y se avisa.
 *
 * **Nunca adivinar cuál de dos líneas iguales era.** Se podría inferir por
 * desplazamiento relativo —«las dos se corrieron 5 líneas»— y es tentador
 * porque resolvería el caso frecuente. No se hace: cuando esa inferencia falla,
 * falla escribiendo en la línea equivocada, que es exactamente lo que este
 * módulo vino a impedir. Un aviso es recuperable; una tarea pisada, no.
 *
 * ## Y el lote es todo o nada
 *
 * Completar una tarea madre son N líneas, y reiniciar un grupo cíclico son 23
 * de un tirón sobre un archivo en Sync. Si una no se puede ubicar, **no se
 * escribe ninguna**: media operación aplicada deja el árbol en un estado que el
 * usuario no pidió y que ningún botón deshace —`vault.process()` no pasa por el
 * editor, así que Ctrl-Z tampoco—.
 *
 * Todo acá es lógica pura y se prueba offline. Quien lo llama, adentro de
 * `vault.process()`, es `vault/escribir.ts`.
 */
import type { CambioDeLinea } from "./documento.js";

/**
 * Dónde quedó una línea.
 *
 * `ok` y `movida` se distinguen aunque para escribir den lo mismo: que una
 * escritura haya tenido que buscar es información —el store venía atrasado— y
 * quien llama puede querer decirlo. Que se distingan también obliga a que la
 * diferencia esté probada.
 */
export type Ubicacion =
  | { estado: "ok"; linea: number }
  | { estado: "movida"; linea: number; sugerida: number }
  | { estado: "ausente" }
  | { estado: "ambigua"; lineas: number[] };

/** ¿Esta ubicación alcanza para escribir? */
export function seEncontro(u: Ubicacion): u is Extract<Ubicacion, { linea: number }> {
  return u.estado === "ok" || u.estado === "movida";
}

/**
 * En qué línea escribir este cambio, o por qué no se puede.
 *
 * `sugerida` fuera del documento no es un error: es el caso normal cuando el
 * archivo se acortó. Se trata como «no coincide» y se pasa a buscar.
 *
 * Una advertencia sobre `antes` vacío: la línea en blanco aparece decenas de
 * veces en cualquier nota, así que un cambio con `antes: ""` cuya línea se
 * corrió va a dar `ambigua` y no se va a escribir. Es correcto y es deliberado
 * —no hay forma de saber cuál de treinta líneas vacías era—, pero explica por
 * qué ningún plan de `acciones.ts` produce cambios sobre líneas en blanco.
 */
export function ubicarLinea(
  lineas: readonly string[],
  sugerida: number,
  antes: string,
): Ubicacion {
  if (lineas[sugerida] === antes) return { estado: "ok", linea: sugerida };

  const donde: number[] = [];
  for (let i = 0; i < lineas.length; i++) if (lineas[i] === antes) donde.push(i);

  if (donde.length === 0) return { estado: "ausente" };
  if (donde.length === 1) return { estado: "movida", linea: donde[0]!, sugerida };
  return { estado: "ambigua", lineas: donde };
}

/** Un cambio con su destino ya resuelto. */
export interface Ubicado {
  cambio: CambioDeLinea;
  ubicacion: Extract<Ubicacion, { linea: number }>;
}

/**
 * El lote entero, resuelto o rechazado. Nunca a medias.
 *
 * `colisión` es su propio estado y no una falla más porque el diagnóstico es
 * distinto: no es que una línea no se encontró, es que dos cambios reclaman la
 * misma. Pasa cuando dos líneas idénticas se corrieron, y la respuesta correcta
 * sigue siendo no escribir.
 */
export type ResultadoDeLote =
  | { estado: "ok"; ubicados: Ubicado[]; movidas: number }
  | { estado: "no-ubicada"; fallas: { cambio: CambioDeLinea; ubicacion: Ubicacion }[] }
  | { estado: "colisión"; linea: number; cambios: CambioDeLinea[] };

/**
 * Todos los cambios resueltos, o el motivo por el que no se escribe ninguno.
 *
 * Se resuelve cada cambio **contra el archivo original**, no contra el resultado
 * parcial de los anteriores. Es legítimo porque un lote solo reemplaza líneas
 * —no inserta ni borra—, así que ninguna resolución corre a las que siguen. Si
 * algún día un plan insertara líneas, esto hay que rehacerlo, no parchearlo.
 *
 * Se recorre todo aunque la primera falle: el aviso «no se pudieron ubicar 3 de
 * 23» es más útil que «no se pudo ubicar una», y cortar temprano no ahorra nada
 * medible sobre archivos de 400 líneas.
 */
export function ubicarLote(
  lineas: readonly string[],
  cambios: readonly CambioDeLinea[],
): ResultadoDeLote {
  const ubicados: Ubicado[] = [];
  const fallas: { cambio: CambioDeLinea; ubicacion: Ubicacion }[] = [];

  for (const cambio of cambios) {
    const ubicacion = ubicarLinea(lineas, cambio.linea, cambio.antes);
    if (seEncontro(ubicacion)) ubicados.push({ cambio, ubicacion });
    else fallas.push({ cambio, ubicacion });
  }
  if (fallas.length) return { estado: "no-ubicada", fallas };

  // Dos cambios sobre la misma línea es un lote que no se puede aplicar: el
  // segundo pisaría al primero y el resultado dependería del orden.
  const porLinea = new Map<number, CambioDeLinea[]>();
  for (const u of ubicados) {
    const lista = porLinea.get(u.ubicacion.linea) ?? [];
    lista.push(u.cambio);
    porLinea.set(u.ubicacion.linea, lista);
  }
  for (const [linea, lista] of porLinea) {
    if (lista.length > 1) return { estado: "colisión", linea, cambios: lista };
  }

  return { estado: "ok", ubicados, movidas: ubicados.filter((u) => u.ubicacion.estado === "movida").length };
}

/**
 * El texto con el lote aplicado, o el texto **intacto** y el motivo.
 *
 * Es la función que corre adentro de `vault.process()`, donde `fn` es síncrona
 * y ve el contenido de disco del momento: el único lugar sin carrera entre
 * verificar y escribir.
 *
 * Vive acá y no en `vault/escribir.ts` a propósito. Es lo único de la escritura
 * que tiene lógica, así que puesta acá se prueba entera offline y el módulo que
 * habla con Obsidian queda de quince líneas sin decisiones adentro.
 *
 * Con un lote vacío devuelve **el mismo texto**, sin partirlo ni rearmarlo. Es
 * la estabilidad del invariante 2 llevada al archivo entero: si no hay nada que
 * decir, no se toca un byte.
 */
export function aplicarLote(
  texto: string,
  cambios: readonly CambioDeLinea[],
): { texto: string; resultado: ResultadoDeLote } {
  if (cambios.length === 0) return { texto, resultado: { estado: "ok", ubicados: [], movidas: 0 } };

  const lineas = texto.split("\n");
  const resultado = ubicarLote(lineas, cambios);
  if (resultado.estado !== "ok") return { texto, resultado };

  for (const { cambio, ubicacion } of resultado.ubicados) lineas[ubicacion.linea] = cambio.despues;
  return { texto: lineas.join("\n"), resultado };
}

/** El lote que deshace este lote: mismo destino, `antes` y `despues` al revés. */
export function loteInverso(resultado: ResultadoDeLote): CambioDeLinea[] {
  if (resultado.estado !== "ok") return [];
  return resultado.ubicados.map(({ cambio, ubicacion }) => ({
    linea: ubicacion.linea,
    antes: cambio.despues,
    despues: cambio.antes,
  }));
}
