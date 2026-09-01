/**
 * Dónde tiene que quedar el cursor cuando el archivo cambia por afuera.
 *
 * Capa 1, sin CodeMirror y sin DOM. `src/editor/cursorExterno.ts` lo conecta.
 *
 * ## El problema, medido
 *
 * Una escritura del plugin vuelve al editor como un cambio externo
 * (`userEvent: "set"`, §5.5 punto 5). Ese diff **no es mínimo**: medido con
 * `scripts/espia-cursor.js` en la tercera vuelta de verificación, un clic en el
 * ★ sobre la línea 376 deja el cursor en `376:41` y la transacción que trae la
 * escritura de vuelta lo manda a `376:0`, sin poner ninguna selección explícita:
 *
 * ```
 * #103 376:0 → 376:41  ← selección explícita  · doc +0  · select.pointer
 * #104 376:41 → 376:0                          · doc +30 · set
 * ```
 *
 * O sea que lo mueve el **mapeo**: el rango que Obsidian reemplaza arranca en el
 * comienzo de la línea, y `ChangeSet.mapPos` de una posición que queda adentro
 * de un rango reemplazado devuelve el comienzo del rango. Ahí Live Preview
 * desarma el `- [ ] `, que es el síntoma que se veía.
 *
 * La primera reproducción offline falló porque usaba un diff **mínimo**, carácter
 * a carácter. El de Obsidian es más grueso, y esa diferencia era todo.
 *
 * ## La regla
 *
 * La misma del invariante 10, aplicada al cursor: **una línea se identifica por
 * su texto, no por su número.** Lo que se compara es el texto **visible** —sin
 * el tramo oculto— porque es precisamente el tramo lo que la escritura cambia:
 * el token crece y el texto que el usuario ve queda igual.
 *
 * Y se hereda su prudencia: si ese texto no aparece, o aparece varias veces, **no
 * se toca nada** y manda el mapeo de CodeMirror. Nunca adivinar cuál de dos
 * líneas iguales era.
 *
 * ## El agujero que dejaba, encontrado usando el plugin
 *
 * **Reportado el 01/09/2026, al verificar el paso 6a:** al completar y archivar
 * una tarea con el cursor encima, el cursor se metía adentro del checkbox y
 * Live Preview desarmaba el `- [ ] `. O sea, exactamente el síntoma que este
 * módulo existe para evitar.
 *
 * El motivo es que la regla de arriba compara el texto **visible**, y completar
 * cambia justamente eso: `- [ ] tarea` pasa a `- [x] tarea`. La búsqueda no
 * encontraba nada, `reubicarCursor` devolvía `null` —«que decida
 * CodeMirror»— y CodeMirror mapeaba al comienzo del rango reemplazado, que es
 * la columna 0.
 *
 * No se notó antes porque la verificación de la sesión 5 fue sobre el ★, que
 * solo toca el **token**: ahí el visible no cambia y el mecanismo anda. Vale
 * para completar, para archivar y para reiniciar un grupo cíclico.
 *
 * **La corrección es una segunda pasada, y una sola.** Si el texto exacto no
 * aparece, se vuelve a buscar con **el estado del checkbox normalizado**, que
 * es el único carácter del texto visible que las escrituras de este plugin
 * cambian, está en una posición conocida, y no cambia el largo de la línea —así
 * que la columna sigue valiendo—.
 *
 * Eso **no** es aflojar la regla a una comparación difusa: la segunda pasada
 * sigue exigiendo una coincidencia exacta de todo lo demás, y sigue negándose
 * si hay dos. Lo único que se acepta es que la línea que buscamos sea la misma
 * tarea con el tilde cambiado, que es lo que la escritura acaba de hacer.
 *
 * No es una defensa contra el plugin: sirve igual para lo que llega por Sync
 * desde otro dispositivo, que es el otro origen de un cambio externo.
 */
import { visibleDe } from "./hiddenTail.js";
import { parseBullet, renderBullet } from "./linea.js";
import { seEncontro, ubicarLinea } from "./ubicar.js";

/** Una posición del cursor, en coordenadas de línea (0-based) y columna. */
export interface Ancla {
  linea: number;
  columna: number;
}

/**
 * Dónde queda el cursor después del cambio, o `null` si no se puede saber.
 *
 * `null` significa «que decida CodeMirror», no «al comienzo»: quien llama deja
 * pasar la transacción intacta.
 */
export function reubicarCursor(
  antes: readonly string[],
  cursor: Ancla,
  despues: readonly string[],
): Ancla | null {
  const texto = antes[cursor.linea];
  if (texto === undefined) return null;

  const visible = visibleDe(texto);
  // Una línea en blanco aparece decenas de veces en cualquier nota: buscarla por
  // texto siempre daría ambigua. Se corta antes, y sin gastar el recorrido.
  if (visible === "") return null;

  // El cursor no puede vivir adentro del tramo oculto —el rango atómico no lo
  // deja entrar—, pero puede estar en su borde. Se recorta ahí.
  const columna = Math.min(cursor.columna, visible.length);

  const linea = ubicar(despues, cursor.linea, visible);
  if (linea === null) return null;

  const nueva = visibleDe(despues[linea] ?? "");
  return { linea, columna: Math.min(columna, nueva.length) };
}

/**
 * En qué línea del documento nuevo quedó esta. Dos pasadas, y solo dos.
 *
 * La segunda no corre si la primera encontró algo, y no corre nunca sobre una
 * línea que no sea un checkbox: sin checkbox no hay nada que normalizar, y
 * volver a buscar lo mismo daría lo mismo.
 */
function ubicar(
  despues: readonly string[],
  sugerida: number,
  visible: string,
): number | null {
  const exacta = ubicarLinea(despues.map(visibleDe), sugerida, visible);
  if (seEncontro(exacta)) return exacta.linea;

  const clave = sinEstadoDelCheckbox(visible);
  if (clave === visible) return null;

  const laxa = ubicarLinea(
    despues.map((l) => sinEstadoDelCheckbox(visibleDe(l))),
    sugerida,
    clave,
  );
  return seEncontro(laxa) ? laxa.linea : null;
}

/**
 * La línea con el estado del checkbox borrado, y **el mismo largo**.
 *
 * El largo importa: la columna del cursor se mide sobre este texto, así que un
 * reemplazo que acortara la línea mandaría el cursor a otro lado. `[·]` mide lo
 * mismo que `[ ]` y que `[x]`, y `renderBullet(parseBullet(x)) === x` para todo
 * bullet, así que la normalización es exactamente un carácter.
 */
function sinEstadoDelCheckbox(visible: string): string {
  const b = parseBullet(visible);
  if (b === null || b.checkbox === null) return visible;
  return renderBullet({ ...b, checkbox: b.checkbox.replace(/\[.\]/, "[·]") });
}
