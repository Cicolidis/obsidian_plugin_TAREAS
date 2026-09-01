import { EditorState, Transaction, type Extension, type TransactionSpec } from "@codemirror/state";
import { reubicarCursor } from "../cursor.js";

/**
 * Que un cambio externo no le mueva el cursor al usuario.
 *
 * Un cambio externo llega como una transacción con `userEvent: "set"` —lo que el
 * plugin acaba de escribir, y también lo que llega por Sync desde otro
 * dispositivo (§5.5 punto 5)— y **su diff no es mínimo**. Medido en la tercera
 * vuelta de verificación con `scripts/espia-cursor.js`: el rango que Obsidian
 * reemplaza arranca en el comienzo de la línea, y `ChangeSet.mapPos` de una
 * posición que cae adentro de un rango reemplazado devuelve el comienzo del
 * rango. El cursor terminaba en la columna 0, donde Live Preview desarma el
 * `- [ ] `.
 *
 * La decisión de a dónde va vive en `src/cursor.ts` y es la del invariante 10:
 * la línea se identifica por su **texto visible**, no por su número. Acá queda
 * solo el pegamento.
 *
 * ## Tres cosas que este filtro **no** hace
 *
 * - **No corrige un cambio que trae selección explícita.** Si alguien la puso
 *   —Obsidian, otro plugin— sabe algo que este filtro no.
 * - **No toca una selección que no sea un cursor simple.** Reubicar los dos
 *   extremos de una selección de varias líneas es otro problema y no está medido.
 * - **No reescribe la transacción.** Devuelve `[tr, { selection }]`, o sea la
 *   transacción tal cual **más** una selección. Es la diferencia con
 *   `protegerTramo` y `unirLimpio`, que sí arman un spec nuevo porque corrigen
 *   los cambios; acá no hay nada que corregir en el documento.
 */
export function cursorExterno(activo: (state: EditorState) => boolean): Extension {
  return EditorState.transactionFilter.of((tr): TransactionSpec | readonly TransactionSpec[] => {
    if (!tr.docChanged || !tr.isUserEvent("set")) return tr;
    if (tr.selection) return tr;
    if (!activo(tr.startState)) return tr;

    const antes = tr.startState.selection.main;
    if (!antes.empty) return tr;

    const lineaAntes = tr.startState.doc.lineAt(antes.head);
    const destino = reubicarCursor(
      lineas(tr.startState.doc),
      { linea: lineaAntes.number - 1, columna: antes.head - lineaAntes.from },
      lineas(tr.newDoc),
    );
    if (destino === null) return tr;

    const linea = tr.newDoc.line(destino.linea + 1);
    const pos = linea.from + destino.columna;
    // Si CodeMirror ya lo iba a dejar ahí, no se agrega una selección de más:
    // una transacción con selección explícita se comporta distinto río abajo
    // —`autoCheckbox` y los otros filtros la miran— y no hay que cambiar eso
    // sin motivo.
    if (tr.changes.mapPos(antes.head) === pos) return tr;

    // **`sequential: true` no es opcional.** Cuando un `transactionFilter`
    // devuelve varios specs, `resolveTransaction` los combina contra el
    // documento **original**: sin esto, `pos` —que está en coordenadas del
    // documento nuevo— se interpretaría en las viejas y se mapearía otra vez.
    // Leído en `@codemirror/state` 6.5.0, `mergeTransaction`: con `sequential`,
    // el mapa de la segunda es vacío y su selección viaja tal cual.
    return [tr, { selection: { anchor: pos }, sequential: true }];
  });
}

/** Las líneas del documento, que es lo que la capa 1 sabe leer. */
function lineas(doc: Transaction["newDoc"]): string[] {
  const salida: string[] = [];
  for (let i = 1; i <= doc.lines; i++) salida.push(doc.line(i).text);
  return salida;
}
