import type { EditorState, Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { inicioDelTramo } from "../hiddenTail.js";

/**
 * Que un clic en el vacío a la derecha de una tarea no salte a la línea de abajo.
 *
 * ## Por qué pasa
 *
 * El rango atómico del token va de donde empieza el tramo **hasta el salto de
 * línea inclusive**, y tiene que ir así: sin el salto, bajar de línea cuesta dos
 * flechas. Pero eso mismo rompe el clic, y está leído en el bundle de Obsidian
 * 1.13.7, no deducido. `skipAtomsForSelection` resuelve un cursor que cae
 * adentro de un rango atómico con **bias 0**:
 *
 * ```js
 * var side = moved || bias || (pos - from < to - pos ? -1 : 1);
 * ```
 *
 * Un clic en el vacío a la derecha del texto resuelve al final de la línea. Con
 * el rango `[inicio, fin+1]`, esa posición está a **un** carácter del borde de
 * abajo y a los cuarenta del token del de arriba: gana abajo, y el cursor se va
 * a la línea siguiente. Reportado en el uso: «no es fácil que el cursor se pose
 * en el final de la línea; tiende a posarse en la siguiente».
 *
 * El rango no se puede achicar, así que la corrección va **antes**, en el clic.
 *
 * ## El costo, dicho
 *
 * Arrastrar una selección **empezando adentro del tramo** deja de funcionar: ese
 * clic ahora coloca el cursor al final del texto y no empieza un arrastre. Es el
 * vacío invisible a la derecha de la tarea, donde arrastrar no significaba nada;
 * desde el texto visible sigue igual. Y solo se interviene en el clic simple: el
 * doble clic, el triple, y todo lo que lleve un modificador pasan de largo.
 */
export function clicAlFinal(activo: (state: EditorState) => boolean): Extension {
  return EditorView.domEventHandlers({
    mousedown(evento, view) {
      // Un clic simple del botón principal, sin modificadores. Cualquier otra
      // cosa —doble clic, Shift para extender, Opción para agregar un cursor—
      // tiene su propio significado y no se toca.
      if (evento.button !== 0 || evento.detail !== 1) return false;
      if (evento.shiftKey || evento.altKey || evento.ctrlKey || evento.metaKey) return false;
      if (!activo(view.state)) return false;

      const pos = view.posAtCoords({ x: evento.clientX, y: evento.clientY }, false);
      if (pos === null) return false;

      const linea = view.state.doc.lineAt(pos);
      const destino = destinoDelClic(linea.text, pos - linea.from);
      if (destino === null) return false;

      view.dispatch({ selection: { anchor: linea.from + destino }, userEvent: "select.pointer" });
      if (!view.hasFocus) view.focus();
      return true;
    },
  });
}

/**
 * A qué columna hay que mandar un clic que cayó en la columna `columna`, o
 * `null` si esa posición está bien donde está.
 *
 * Es la parte que se puede probar sin DOM: dado el texto de la línea y dónde
 * cayó el clic, decide. El pegamento con el mouse son quince líneas y no tiene
 * ninguna decisión adentro.
 *
 * Cae adentro del tramo **estrictamente**: un clic justo donde el tramo empieza
 * ya está en el lugar correcto —es el final del texto visible— y devolver algo
 * ahí sería reemplazar un gesto por sí mismo.
 */
export function destinoDelClic(texto: string, columna: number): number | null {
  const inicio = inicioDelTramo(texto);
  if (inicio >= texto.length) return null; // la línea no tiene nada oculto
  return columna > inicio ? inicio : null;
}
