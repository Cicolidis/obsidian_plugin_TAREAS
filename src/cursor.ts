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
 * No es una defensa contra el plugin: sirve igual para lo que llega por Sync
 * desde otro dispositivo, que es el otro origen de un cambio externo.
 */
import { visibleDe } from "./hiddenTail.js";
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

  const u = ubicarLinea(
    despues.map(visibleDe),
    cursor.linea,
    visible,
  );
  if (!seEncontro(u)) return null;

  const nueva = visibleDe(despues[u.linea] ?? "");
  return { linea: u.linea, columna: Math.min(columna, nueva.length) };
}
