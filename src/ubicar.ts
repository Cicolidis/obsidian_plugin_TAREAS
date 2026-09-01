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
 * Por eso todo cambio lleva `antes`, y por eso nada se escribe sin verificarlo
 * contra lo que hay en el archivo **en el momento de escribir**:
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
 * ## Un tramo, no una línea (paso 6a)
 *
 * La versión anterior solo sabía reemplazar líneas, y su propio comentario
 * decía que el día que un plan insertara o borrara había que **rehacerlo, no
 * parchearlo**. Este es ese día: archivar y eliminar necesitan que un lote
 * pueda cambiar la cantidad de líneas.
 *
 * Se rehizo alrededor de **un solo tipo de cambio ubicado**, `bloque`, que
 * reemplaza un tramo de N líneas por M. Con eso alcanza para las tres cosas
 * que el paso 6a necesita, sin variantes de más:
 *
 * | Para qué | Cómo |
 * |---|---|
 * | **Borrar** un subárbol | `despues: []` |
 * | **Verificar sin tocar** | `despues` igual a `antes` |
 * | Reescribir varias líneas **como una unidad** | N por M |
 *
 * La tercera es la que hace que archivar sea todo o nada sobre el bloque
 * entero: las notas sin checkbox que se copian al LOG viajan adentro del
 * `antes` verificado, así que si alguna cambió, el lote se niega en vez de
 * archivar texto viejo.
 *
 * **`antes` vacío está prohibido.** Un cambio sin ancla no se puede verificar,
 * y eso es exactamente por qué la **inserción** no entra todavía: la del LOG no
 * la necesita —su posición es una función del contenido del LOG, así que se
 * recalcula adentro de `vault.process()` sobre los bytes frescos— y la del
 * paso 5 («crear tarea desde el workbench», §10) va a entrar como una variante
 * más de este mismo aplicador, con su ancla.
 *
 * ## Y el lote es todo o nada
 *
 * Completar una tarea madre son N líneas, y reiniciar un grupo cíclico son 23
 * de un tirón sobre un archivo en Sync. Si una no se puede ubicar, **no se
 * escribe ninguna**: media operación aplicada deja el árbol en un estado que el
 * usuario no pidió y que ningún botón deshace —`vault.process()` no pasa por el
 * editor, así que con la nota cerrada Ctrl-Z tampoco—.
 *
 * Todo acá es lógica pura y se prueba offline. Quien lo llama, adentro de
 * `vault.process()`, es `vault/escribir.ts`.
 */
import type { CambioDeLote } from "./documento.js";

/**
 * Dónde quedó una línea o un tramo.
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
  return ubicarBloque(lineas, sugerida, [antes]);
}

/**
 * Lo mismo para un tramo contiguo de líneas.
 *
 * Es la misma regla de `ubicarLinea` con la comparación estirada a N líneas, y
 * por eso `ubicarLinea` delega acá: dos implementaciones de la misma decisión
 * divergirían justo donde más caro sale. Hay una propiedad que fija que con un
 * bloque de una línea las dos dan lo mismo.
 *
 * Un tramo largo es **menos** ambiguo que una línea suelta —medido sobre el
 * corpus: de los 138 subárboles de más de una línea, 14 aparecen repetidos
 * verbatim, contra 24 de las 251 hojas—, así que verificar el bloque entero no
 * es solo más seguro: además se niega menos seguido.
 *
 * Un `antes` vacío no se ubica nunca: sin ancla no hay nada que verificar.
 */
export function ubicarBloque(
  lineas: readonly string[],
  sugerida: number,
  antes: readonly string[],
): Ubicacion {
  if (antes.length === 0) return { estado: "ausente" };
  if (coincideEn(lineas, sugerida, antes)) return { estado: "ok", linea: sugerida };

  const donde: number[] = [];
  for (let i = 0; i + antes.length <= lineas.length; i++) {
    if (coincideEn(lineas, i, antes)) donde.push(i);
  }

  if (donde.length === 0) return { estado: "ausente" };
  if (donde.length === 1) return { estado: "movida", linea: donde[0]!, sugerida };
  return { estado: "ambigua", lineas: donde };
}

/** ¿El tramo `antes` empieza exactamente en `i`? */
function coincideEn(lineas: readonly string[], i: number, antes: readonly string[]): boolean {
  if (i < 0 || i + antes.length > lineas.length) return false;
  for (let j = 0; j < antes.length; j++) if (lineas[i + j] !== antes[j]) return false;
  return true;
}

// ------------------------------------------- las dos caras de un cambio

/** Las líneas que el cambio espera encontrar. Nunca vacío. */
export function antesDe(cambio: CambioDeLote): readonly string[] {
  return cambio.tipo === "reemplazo" ? [cambio.antes] : cambio.antes;
}

/** Las líneas que el cambio deja escritas. Vacío significa **borrar**. */
export function despuesDe(cambio: CambioDeLote): readonly string[] {
  return cambio.tipo === "reemplazo" ? [cambio.despues] : cambio.despues;
}

/** Cuántas líneas del archivo original ocupa. Siempre ≥ 1. */
export function largoDe(cambio: CambioDeLote): number {
  return antesDe(cambio).length;
}

/** Un cambio con su destino ya resuelto. */
export interface Ubicado {
  cambio: CambioDeLote;
  ubicacion: Extract<Ubicacion, { linea: number }>;
}

/**
 * El lote entero, resuelto o rechazado. Nunca a medias.
 *
 * `colisión` es su propio estado y no una falla más porque el diagnóstico es
 * distinto: no es que una línea no se encontró, es que dos cambios reclaman el
 * mismo tramo. Pasa cuando dos líneas idénticas se corrieron, y la respuesta
 * correcta sigue siendo no escribir.
 */
export type ResultadoDeLote =
  | { estado: "ok"; ubicados: Ubicado[]; movidas: number }
  | { estado: "no-ubicada"; fallas: { cambio: CambioDeLote; ubicacion: Ubicacion }[] }
  | { estado: "colisión"; linea: number; cambios: CambioDeLote[] };

/**
 * Todos los cambios resueltos, o el motivo por el que no se escribe ninguno.
 *
 * **Se resuelve cada cambio contra el archivo original**, no contra el
 * resultado parcial de los anteriores, y ese es el punto entero del rediseño:
 * ninguna resolución corre a las que siguen porque **ninguna se aplica antes
 * que las otras**. El lote se aplica de una sola pasada, después de resolverlo
 * todo, así que el resultado no depende del orden en que vinieron los cambios.
 * Hay una propiedad que lo fija con permutaciones.
 *
 * Dos tramos que se solapan se rechazan enteros. Con reemplazos de una línea es
 * el caso viejo —dos cambios sobre la misma línea— y con bloques cubre además
 * el caso nuevo: un reemplazo adentro de un tramo que otro cambio borra. Los
 * dos son lotes que no se pueden aplicar, no una preferencia por uno.
 *
 * Se recorre todo aunque la primera falle: el aviso «no se pudieron ubicar 3 de
 * 23» es más útil que «no se pudo ubicar una», y cortar temprano no ahorra nada
 * medible sobre archivos de 400 líneas.
 */
export function ubicarLote(
  lineas: readonly string[],
  cambios: readonly CambioDeLote[],
): ResultadoDeLote {
  const ubicados: Ubicado[] = [];
  const fallas: { cambio: CambioDeLote; ubicacion: Ubicacion }[] = [];

  for (const cambio of cambios) {
    const ubicacion = ubicarBloque(lineas, cambio.linea, antesDe(cambio));
    if (seEncontro(ubicacion)) ubicados.push({ cambio, ubicacion });
    else fallas.push({ cambio, ubicacion });
  }
  if (fallas.length) return { estado: "no-ubicada", fallas };

  const orden = [...ubicados].sort((a, b) => a.ubicacion.linea - b.ubicacion.linea);
  for (let i = 1; i < orden.length; i++) {
    const previo = orden[i - 1]!;
    const actual = orden[i]!;
    const finPrevio = previo.ubicacion.linea + largoDe(previo.cambio);
    if (finPrevio > actual.ubicacion.linea) {
      return {
        estado: "colisión",
        linea: actual.ubicacion.linea,
        cambios: [previo.cambio, actual.cambio],
      };
    }
  }

  return {
    estado: "ok",
    ubicados,
    movidas: ubicados.filter((u) => u.ubicacion.estado === "movida").length,
  };
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
 * habla con Obsidian queda sin decisiones adentro.
 *
 * Con un lote vacío devuelve **el mismo texto**, sin partirlo ni rearmarlo. Es
 * la estabilidad del invariante 2 llevada al archivo entero: si no hay nada que
 * decir, no se toca un byte. (Con un lote de puras verificaciones también sale
 * idéntico, pero por la vía larga: `split` y `join` son exactos.)
 */
export function aplicarLote(
  texto: string,
  cambios: readonly CambioDeLote[],
): { texto: string; resultado: ResultadoDeLote } {
  if (cambios.length === 0) return { texto, resultado: { estado: "ok", ubicados: [], movidas: 0 } };

  const lineas = texto.split("\n");
  const resultado = ubicarLote(lineas, cambios);
  if (resultado.estado !== "ok") return { texto, resultado };

  // Una sola pasada sobre el original: al llegar al comienzo de un tramo se
  // emite lo que va en su lugar y se saltea lo que ocupaba. Nada se aplica
  // «encima» de nada, así que el orden del lote no puede cambiar el resultado.
  const porInicio = new Map(resultado.ubicados.map((u) => [u.ubicacion.linea, u]));
  const salida: string[] = [];
  for (let i = 0; i < lineas.length; ) {
    const u = porInicio.get(i);
    if (u) {
      salida.push(...despuesDe(u.cambio));
      i += largoDe(u.cambio);
    } else {
      salida.push(lineas[i]!);
      i++;
    }
  }
  return { texto: salida.join("\n"), resultado };
}

/**
 * El lote que deshace este lote.
 *
 * Cada cambio vuelve como un `bloque` con las dos caras al revés, y su línea
 * corregida por lo que los cambios anteriores agrandaron o achicaron el
 * archivo — por eso se recorren ordenados y se lleva un desplazamiento.
 *
 * **Un borrado no se puede deshacer desde acá**, y ante uno se devuelve el lote
 * vacío: el inverso de un borrado es una inserción, o sea un cambio con `antes`
 * vacío, que este módulo no sabe ubicar (ver la cabecera). Media inversa sería
 * peor que ninguna, porque se aplicaría sin avisar.
 */
export function loteInverso(resultado: ResultadoDeLote): CambioDeLote[] {
  if (resultado.estado !== "ok") return [];
  if (resultado.ubicados.some((u) => despuesDe(u.cambio).length === 0)) return [];

  const orden = [...resultado.ubicados].sort((a, b) => a.ubicacion.linea - b.ubicacion.linea);
  let desplazamiento = 0;
  return orden.map((u) => {
    const escrito = despuesDe(u.cambio);
    const habia = antesDe(u.cambio);
    const linea = u.ubicacion.linea + desplazamiento;
    desplazamiento += escrito.length - habia.length;
    return { tipo: "bloque", linea, antes: escrito, despues: habia };
  });
}
