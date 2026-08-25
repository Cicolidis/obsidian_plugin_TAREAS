/**
 * El **tramo oculto** del final de una línea de tarea.
 *
 * ```
 * - [ ] llamar a Flow %%t:id=a3f2;wb=foco;due=2026-08-29;p=2%%
 *                    └────────────── el tramo ──────────────┘
 * ```
 *
 * Como no se ve, el cursor «al final del texto» queda **antes** de él, y
 * cualquier cosa que parta o una líneas ahí se lo lleva: la tarea pierde su
 * id, su workbench y su fecha. La definición del tramo vive en un solo lugar y
 * todo mecanismo que respete esa frontera la pide acá.
 *
 * ## Qué no se porta de Anotaciones
 *
 * Aquel `hiddenTail.ts` maneja **tres** piezas distintas al final de la línea
 * —block-id, token de color y vínculos de síntesis— combinables en cualquier
 * orden. Acá hay **una sola**, y su gramática ya vive en `src/token.ts`: se
 * reusa desde ahí (`TOKEN_SOURCE`) en vez de escribirla otra vez. Una gramática
 * repetida en dos archivos diverge.
 *
 * ## El tramo se lleva el espacio separador
 *
 * Arranca donde termina el texto visible **sin espacios finales**. Si arrancara
 * en el `%%`, al ocultarlo quedaría un espacio suelto colgando al final de cada
 * tarea, y el cursor tendría una posición de más que no corresponde a nada.
 *
 * ## Solo cuenta lo que parsea
 *
 * Un token ilegible **no** es tramo oculto: se ve, y está bien que se vea, que
 * es la única forma de que alguien lo arregle (invariante 7). De ahí sale la
 * garantía que usan las decoraciones y el filtro: si `inicioDelTramo` devuelve
 * algo menor que el largo de la línea, lo que hay ahí es un token que parsea.
 */
import { parseTaskToken, TOKEN_SOURCE } from "./token.js";

/**
 * Desde qué columna de la línea empieza lo oculto.
 *
 * Devuelve el largo de la línea cuando no hay nada que ocultar —o sea, «el
 * tramo está vacío y empieza donde termina todo»—, que es lo que hace que
 * `slice(0, inicio)` sea siempre el texto visible sin tener que preguntar
 * antes si hay token.
 */
export function inicioDelTramo(texto: string): number {
  const a = parseTaskToken(texto);
  if (a.estado !== "ok") return texto.length;
  return a.texto.replace(/[ \t]+$/, "").length;
}

/** El tramo, verbatim. `slice(0, inicioDelTramo(t)) + tramoDe(t) === t` siempre. */
export function tramoDe(texto: string): string {
  return texto.slice(inicioDelTramo(texto));
}

/** El texto visible: la línea sin su tramo oculto. */
export function visibleDe(texto: string): string {
  return texto.slice(0, inicioDelTramo(texto));
}

/**
 * La misma forma que `TOKEN_SOURCE`, en cualquier posición y con el espacio que
 * la precede. El grupo de captura viene heredado y no molesta.
 */
const TOKEN_SUELTO = new RegExp(`[ \\t]*${TOKEN_SOURCE}`, "g");

/**
 * El texto sin ningún token bien formado, esté donde esté.
 *
 * Sirve para limpiar lo que quedó de un corte o de una unión: cuando el token
 * cae en el medio de la línea ya no está al final, y ahí `stripTaskToken` no lo
 * ve —su gramática está anclada al final, como corresponde para leer—. Buscar
 * el tramo entero tampoco lo encuentra. Restaurar la línea y limpiar el resto
 * es más simple y no depende de dónde haya caído el corte.
 *
 * **No inventa cierres.** Un `%%t:` sin su `%%` queda donde está: no se puede
 * saber dónde termina, y borrar hasta el final de la línea se llevaría texto
 * del usuario. Quien llame a esto tiene que verificar el resultado.
 */
export function sinTokens(texto: string): string {
  return repararMarcador(texto.replace(TOKEN_SUELTO, ""));
}

/**
 * Un ítem de lista que quedó sin nada escrito **tiene que terminar en espacio**.
 *
 * El recorte se lleva el espacio que precede al token, y ese espacio puede ser
 * el que separa el marcador —o el checkbox— de lo que viene después. `- [ ]`
 * sin su espacio final sigue siendo un checkbox al final de línea, pero apenas
 * el usuario escribe una letra se convierte en `- [ ]texto`, que **no es una
 * tarea** para Obsidian, para Outliner ni para `linea.ts`. Y `-` pelado no es
 * ni siquiera un ítem.
 *
 * El bug se ve una tecla después del gesto que lo causó, que es la peor
 * distancia posible entre causa y síntoma.
 */
const ITEM_VACIO_RE = /^([ \t]*(?:[-*+]|\d+[.)])[ \t]*(?:\[[^[\]]\])?)[ \t]*$/;

function repararMarcador(texto: string): string {
  return texto.replace(ITEM_VACIO_RE, (_todo, item: string) => `${item.replace(/[ \t]+$/, "")} `);
}

/**
 * ¿Esta línea se puede escribir, o quedó con un token que no parsea?
 *
 * Es el guardia de toda corrección del filtro: **si el arreglo produciría una
 * línea ilegible, no se arregla**. Corregir hasta dejar algo peor de lo que
 * había es la forma más cara de ayudar (§5.3: nunca reparar a ciegas).
 */
export function parsea(texto: string): boolean {
  return parseTaskToken(texto).estado !== "ilegible";
}
