/**
 * Cmd+clic sobre el checkbox: **completar y archivar** de un gesto (§12).
 *
 * Pedido al verificar el paso 6a, y es el complemento de
 * `completarAlTildar.ts`: aquel hace que tildar sea completar, este hace que
 * tildar **con un modificador** sea completar y archivar.
 *
 * ## Y acá sí se intercepta el clic, con lo que eso trae
 *
 * `completarAlTildar` no mira ningún gesto: reconoce el hecho de que una línea
 * cambió de tilde, y por eso anda con el mouse, con el teclado, con Outliner y
 * desde el teléfono. **Esto no puede hacer lo mismo**, y conviene decir por qué
 * en vez de que parezca una inconsistencia:
 *
 * 1. **Un modificador no deja rastro en la transacción.** `Cmd+clic` y `clic`
 *    producen exactamente el mismo cambio de documento, así que mirar el
 *    resultado no alcanza para distinguirlos. La única forma de saberlo es
 *    mirar el evento.
 * 2. **Archivar toca dos archivos**, y un `transactionFilter` escribe una sola
 *    transacción sobre un solo documento. No hay manera de hacerlo desde ahí.
 *
 * O sea que este mecanismo es **estructuralmente más frágil** que el otro: en
 * el teléfono no existe, depende de llegar antes que el handler de Obsidian, y
 * no se puede probar offline de punta a punta. Por eso tiene su propio
 * interruptor y por eso el ⋯ sigue siendo el camino que siempre funciona.
 *
 * ## Cómo llega antes
 *
 * En **fase de captura** sobre el `contentDOM`, que es lo único que garantiza
 * correr antes que un handler enganchado en el elemento o más arriba en
 * burbujeo. `EditorView.domEventHandlers` no sirve: registra en burbujeo.
 *
 * Se atajan los dos eventos. El `click` es el que hay que evitar —el toggle de
 * un `<input type="checkbox">` es su acción por omisión— y el `mousedown` va
 * también para que no quede a medio camino un foco o una selección.
 *
 * ## Y la línea sale de `posAtCoords`, medido
 *
 * No de `posAtDOM`. La sonda de hover de la verificación mostró que sobre el
 * checkbox `posAtCoords(…, false)` devuelve la línea correcta:
 *
 * ```
 * x=307 task-list-item-checkbox · pos 380
 * ```
 *
 * Es el mismo dato que arregló `lineaHover`, usado para lo mismo: preguntarle
 * al navegador dónde está el mouse en vez de deducirlo del DOM.
 */
import type { EditorState, Extension } from "@codemirror/state";
import { EditorView, ViewPlugin } from "@codemirror/view";

/** El checkbox que Obsidian dibuja en Live Preview. */
const CHECKBOX = "input.task-list-item-checkbox";

export interface OpcionesDeClicEnCheckbox {
  activo: (state: EditorState) => boolean;
  /**
   * ¿Este evento trae el modificador?
   *
   * Se inyecta porque cuál es depende del sistema —`Cmd` en macOS, `Ctrl` en el
   * resto— y eso lo sabe `main.ts`, que es el único que puede importar
   * `Platform`. Acá se prueba con cualquier predicado.
   */
  esModificador: (evento: MouseEvent) => boolean;
  /** Qué hacer con la tarea de esa línea. `linea` es 0-based. */
  alArchivar: (view: EditorView, linea: number, texto: string) => void;
}

export function archivarAlClic(opciones: OpcionesDeClicEnCheckbox): Extension {
  return ViewPlugin.define((view) => {
    const atajar = (e: MouseEvent): boolean => {
      if (e.button !== 0 || !opciones.esModificador(e)) return false;
      const destino = e.target as HTMLElement | null;
      if (!destino?.closest?.(CHECKBOX)) return false;
      return opciones.activo(view.state);
    };

    const enMousedown = (e: MouseEvent) => {
      if (!atajar(e)) return;
      e.preventDefault();
      e.stopPropagation();
    };

    const enClick = (e: MouseEvent) => {
      if (!atajar(e)) return;
      // Antes que nada: sin esto el checkbox se tilda igual y la escritura del
      // archivado se aplica encima de un documento que ya cambió.
      e.preventDefault();
      e.stopPropagation();

      const pos = view.posAtCoords({ x: e.clientX, y: e.clientY }, false);
      if (pos === null) return;
      const linea = view.state.doc.lineAt(pos);
      opciones.alArchivar(view, linea.number - 1, linea.text);
    };

    view.contentDOM.addEventListener("mousedown", enMousedown, true);
    view.contentDOM.addEventListener("click", enClick, true);
    return {
      destroy() {
        view.contentDOM.removeEventListener("mousedown", enMousedown, true);
        view.contentDOM.removeEventListener("click", enClick, true);
      },
    };
  });
}
