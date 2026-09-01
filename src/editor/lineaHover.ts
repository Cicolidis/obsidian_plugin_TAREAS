import {
  MapMode,
  RangeSet,
  StateEffect,
  StateField,
  type EditorState,
  type Extension,
} from "@codemirror/state";
import { EditorView, GutterMarker, ViewPlugin, gutterLineClass } from "@codemirror/view";

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
 *
 * ## Por qué el oyente va en el **scroller** y no en el contenido
 *
 * Reportado al verificar el paso 6a: yendo del texto hacia la izquierda, los
 * botones desaparecían **antes** de llegar a ellos, y en una tarea anidada eso
 * es un recorrido largo. Molesto justamente donde más falta hace.
 *
 * La primera versión usaba `EditorView.domEventHandlers`, y la documentación de
 * `@codemirror/view` lo dice sin vueltas: «These are registered on the **content
 * element**». O sea que el `mousemove` solo llega sobre `.cm-content`, y salir
 * de ahí dispara su `mouseleave` y apaga la línea. Entre el borde del contenido
 * y el margen hay unos 40 px de `.cm-contentContainer` donde no hay ni una cosa
 * ni la otra: los botones ya se apagaron y el `:hover` del margen todavía no
 * los encendió.
 *
 * **Y lo que decidió el arreglo fue una medición, no un razonamiento.** La
 * sonda de hover en la consola de Obsidian mostró que `posAtCoords(…, false)`
 * devuelve **la línea correcta en todo el recorrido**, también sobre
 * `.cm-contentContainer` y sobre el propio `.cm-gutter`:
 *
 * ```
 * x=495 cm-hmd-list-indent …      · pos 330
 * x=280 cm-contentContainer       · pos 330
 * x=260 cm-gutter tareas-margen   · pos 330
 * x=238 tareas-fila               · pos 330
 * ```
 *
 * Nunca devuelve `null`. Así que no hacía falta inventar nada: alcanza con
 * escuchar donde el mouse efectivamente está, que es `scrollDOM` —el elemento
 * que contiene **a la vez** el contenido y los márgenes—. De ahí el
 * `ViewPlugin`: es la única forma de enganchar un oyente ahí.
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

    // No es una decoración: es un oyente y un `StateEffect`. La regla de la
    // §5.5 —las decoraciones van en un `StateField`— sigue cumpliéndose, porque
    // la clase la sigue poniendo el `gutterLineClass.compute` de arriba.
    ViewPlugin.define((view) => {
      const mover = (e: MouseEvent) => actualizar(view, activo, e);
      const salir = () => publicar(view, null);
      view.scrollDOM.addEventListener("mousemove", mover);
      view.scrollDOM.addEventListener("mouseleave", salir);
      return {
        destroy() {
          view.scrollDOM.removeEventListener("mousemove", mover);
          view.scrollDOM.removeEventListener("mouseleave", salir);
        },
      };
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
