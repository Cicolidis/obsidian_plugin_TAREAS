import {
  MapMode,
  RangeSet,
  StateEffect,
  StateField,
  type EditorState,
  type Extension,
} from "@codemirror/state";
import { EditorView, GutterMarker, gutterLineClass } from "@codemirror/view";

/**
 * Qué línea tiene el mouse encima, para que el margen lo sepa.
 *
 * ## Por qué hace falta, y por qué no lo puede resolver el CSS
 *
 * Con la fila adentro de la línea alcanzaba `.cm-line:hover .tareas-fila`: la
 * fila era descendiente de la línea. En el margen no lo es — un `gutter` es un
 * **hermano** de `.cm-content`, no un hijo de `.cm-line`— y `:hover` no cruza de
 * costado. Reportado en la cuarta vuelta de verificación: los botones solo
 * aparecían apuntando a la columna angosta del margen, no pasando el mouse por
 * la tarea, que es lo que se pidió.
 *
 * CodeMirror mantiene `.cm-activeLineGutter`, pero eso es la línea **del
 * cursor**, no la del mouse. La del mouse hay que llevarla.
 *
 * ## Y esto no contradice la §15 punto 1
 *
 * Aquella dice que el modo de revelación tiene que ser un **parámetro** y no un
 * `mouseenter` cableado adentro del componente. Sigue siéndolo: el modo viaja
 * como clase de `body` y la hoja de estilos decide si esta clase significa algo.
 * Lo que hay acá es **un** oyente para el editor entero —no uno por fila— que
 * solo publica un dato. En móvil no hay `mousemove` y esto nunca se enciende,
 * que es exactamente lo que la §15 quiere.
 *
 * Se despacha **solo cuando cambia la línea**, no en cada píxel: si no, sería
 * una transacción por movimiento del mouse.
 */
/**
 * Qué línea pasa a tener el mouse encima.
 *
 * Se exporta porque el campo no se puede mover de ninguna otra manera, y eso
 * incluye a los tests: un campo que solo se puede cambiar desde un `mousemove`
 * de verdad es un campo cuya lógica de mapeo no se prueba nunca.
 */
export const fijarLineaConMouse = StateEffect.define<number | null>();

/** La posición de comienzo de la línea con el mouse encima, o `null`. */
export const lineaConMouse = StateField.define<number | null>({
  create: () => null,
  update(valor, tr) {
    for (const e of tr.effects) if (e.is(fijarLineaConMouse)) return e.value;
    // El documento cambió debajo del mouse: la posición se mapea sola, y si la
    // línea desapareció se apaga en vez de quedar apuntando a otra cosa.
    if (!tr.docChanged || valor === null) return valor;
    // `MapMode.TrackDel`: si la línea que tenía el mouse encima se borró, esto
    // devuelve `null` en vez de una posición cercana que ya no es esa línea.
    return tr.changes.mapPos(valor, -1, MapMode.TrackDel);
  },
});

class MarcaDeHover extends GutterMarker {
  override elementClass = "tareas-hover";
}

const marca = new MarcaDeHover();

/**
 * @param activo Si hay que seguir el mouse acá. Con la fila apagada, o en una
 *   nota que no es de tareas, no se despacha nada.
 */
export function lineaHover(activo: (state: EditorState) => boolean): Extension {
  return [
    lineaConMouse,

    // La clase va sobre el elemento de margen de esa línea. `gutterLineClass`
    // la pone en **todos** los márgenes, incluido el de los números; la hoja de
    // estilos la usa solo en el nuestro, y sobre el otro no dibuja nada.
    gutterLineClass.compute([lineaConMouse], (state) => {
      const from = state.field(lineaConMouse);
      return from === null ? RangeSet.empty : RangeSet.of([marca.range(from)]);
    }),

    EditorView.domEventHandlers({
      mousemove(evento, view) {
        actualizar(view, activo, evento);
        return false;
      },
      mouseleave(_evento, view) {
        publicar(view, null);
        return false;
      },
    }),
  ];
}

function actualizar(
  view: EditorView,
  activo: (state: EditorState) => boolean,
  evento: MouseEvent,
): void {
  if (!activo(view.state)) {
    publicar(view, null);
    return;
  }
  // `false` es el modo no preciso: un punto a la derecha del texto igual
  // resuelve al final de esa línea, que es lo que se quiere para un hover.
  const pos = view.posAtCoords({ x: evento.clientX, y: evento.clientY }, false);
  publicar(view, pos === null ? null : view.state.doc.lineAt(pos).from);
}

function publicar(view: EditorView, from: number | null): void {
  if (view.state.field(lineaConMouse, false) === from) return;
  view.dispatch({ effects: fijarLineaConMouse.of(from) });
}
