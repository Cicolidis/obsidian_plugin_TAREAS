import type { EditorState, Extension, Range } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { filaDe, type Boton, type Favoritos, type Fila } from "../botones.js";

/**
 * La fila de botones sobre cada línea de tarea (§13.0, paso 4b).
 *
 * ```
 * [✓]  texto de la tarea …                    [★] [◐] [→] [⋯]
 * ```
 *
 * ## Por qué un `ViewPlugin`, y por qué eso **no** contradice la §5.5
 *
 * La §5.5 manda las decoraciones a un `StateField` porque el mapa de alturas
 * descarta las que llegan como función, que es como las aporta un `ViewPlugin`.
 * Esa regla tiene un límite exacto, y está leído dentro del
 * `obsidian-1.13.7.asar` instalado —no en `node_modules`, y no deducido—. El
 * constructor del mapa:
 *
 * ```js
 * e.prototype.point=function(e,t,n){
 *   if(e<t||n.heightRelevant){ … } else t>e&&this.span(e,t); … }
 * ```
 *
 * y el getter:
 *
 * ```js
 * get heightRelevant(){ return this.block ||
 *   !!this.widget && (this.widget.estimatedHeight>=5 || this.widget.lineBreaks>0) }
 * ```
 *
 * Un widget **inline, de ancho cero, sin `estimatedHeight` y sin `lineBreaks`**
 * tiene `from === to` y `heightRelevant === false`: `point` cae en el `else`,
 * `t > e` es falso, y no pasa nada. Lo mismo en `heightRelevantDecoChanges`.
 * O sea que **el mapa de alturas no lo ve venga de donde venga**, y entonces no
 * hay nada que ganar recorriendo el documento entero: en `tareas_COLE` son 290
 * tareas de las que se ven cuarenta, y las otras 250 serían DOM de más.
 *
 * El `Decoration.replace` del token es el caso opuesto —tiene `from < to`, así
 * que alimenta `line.collapsed`— y por eso sigue en su `StateField`.
 *
 * > **La trampa que esto deja armada:** el día que alguien le ponga
 * > `estimatedHeight` a este widget o lo haga `block`, vuelve a ser relevante
 * > para el mapa, y desde acá el mapa lo descarta — que es el bug de la §5.5
 * > entrando por la puerta de al lado. `test/filaDeBotones.test.ts` falla ese
 * > mismo día.
 *
 * ## El ancla va en `line.from`, no al final
 *
 * Dos razones, las dos medidas:
 *
 * 1. **No suma ancho al renglón.** El ancla es de ancho cero y la fila va
 *    `position: absolute; right: 0` sobre la línea. Medido en la sesión 4: el
 *    glifo de prioridad, que sí suma ancho, empuja el corte de línea unas tres
 *    letras — y dónde corta el renglón es lo que alimenta el bucle de medición
 *    de la §5.5.
 * 2. **El final de la línea está adentro del `Decoration.replace` del token**, y
 *    un widget adentro de un rango reemplazado se descarta. Ese rango ya costó
 *    tres bugs; no se le mete nada más adentro.
 *
 * `side: -1` no es decorativo: ordena el widget **antes** de cualquier
 * `Decoration.replace` que arranque en `line.from` —el que Obsidian usa para
 * dibujar el checkbox de Live Preview— y así no queda adentro de ninguno.
 */

/** Lo que recibe quien maneja un clic. Todo pedido fresco en el momento. */
export interface ClicEnFila {
  view: EditorView;
  /** Número de línea **0-based**, como el `Documento` del plugin. */
  linea: number;
  /** El texto de esa línea, ahora. Es el dato duro del invariante 10. */
  texto: string;
  boton: Boton;
  /** La línea tiene el token roto: no se escribe (§5.3). */
  ilegible: boolean;
  /** Para anclar el menú donde está el botón. */
  elemento: HTMLElement;
  evento: MouseEvent;
}

export type AlClicEnFila = (clic: ClicEnFila) => void;

export interface OpcionesDeFila {
  /** Los dos botones fijos, leídos en el momento de construir. */
  favoritos: () => Favoritos;
  alClic: AlClicEnFila;
  /**
   * Cómo se dibuja un ícono. Se inyecta porque `setIcon` viene de `obsidian`,
   * que es un paquete de **solo tipos** (`"main": ""`) y no se puede importar
   * en un test. Es el mismo patrón que `activo` en `decoraciones.ts`.
   */
  dibujarIcono: (el: HTMLElement, icono: string) => void;
}

/**
 * El widget: un ancla de ancho cero de la que cuelga la fila.
 *
 * **No declara altura**: no sobreescribe `estimatedHeight` (que por omisión es
 * `-1`) ni `lineBreaks` (que es `0`). Ver el bloque de arriba: de eso depende
 * que este `ViewPlugin` sea legítimo.
 */
export class FilaWidget extends WidgetType {
  /**
   * Todo lo que este widget **dibuja**, en una cadena. Es lo que compara `eq`.
   *
   * Lo que no está acá es tan importante como lo que sí: **el número de línea
   * no entra**. Incluirlo tiraría y reharía el DOM de todas las filas en cada
   * tecla de cualquier línea de más arriba —se perdería el hover en el medio
   * del gesto y se pagaría en cada pulsación—. Por eso la posición no se
   * guarda: se le pide a CodeMirror al hacer clic. Ver `resolver`.
   */
  private readonly clave: string;

  constructor(
    private readonly fila: Fila,
    private readonly opciones: OpcionesDeFila,
  ) {
    super();
    this.clave =
      fila.botones
        .map((b) => `${b.accion}:${b.workbench ?? ""}:${b.activo ? "1" : "0"}`)
        .join("|") + (fila.ilegible ? "|roto" : "");
  }

  override eq(otro: FilaWidget): boolean {
    return otro.clave === this.clave;
  }

  /**
   * Que el editor no trate los eventos de acá como suyos.
   *
   * Sin esto —y sin el `preventDefault` de abajo— un clic en un botón mueve el
   * cursor y empieza una selección. Está resuelto igual en el `CheckboxWidget`
   * de Anotaciones.
   */
  override ignoreEvent(): boolean {
    return true;
  }

  override toDOM(view: EditorView): HTMLElement {
    const ancla = document.createElement("span");
    ancla.className = "tareas-fila-ancla";

    /**
     * El `mousedown` se ataja en el **ancla**, no solo en cada botón.
     *
     * Reportado en la verificación de la sesión 5 como una falla errática: a
     * veces, al asignar un workbench, el cursor saltaba al comienzo de la línea
     * —antes del checkbox— y Live Preview desarmaba el `- [ ] `.
     *
     * Leído en `@codemirror/view` 6.38.6, no supuesto:
     * `skipAtomsForSelection` solo corre desde `applyDOMChange` cuando el
     * `userEvent` es `select.pointer`, o sea **cuando el navegador movió el
     * caret y CodeMirror lo lee de vuelta**. El widget es una isla
     * `contentEditable="false"` anclada en `line.from`; un clic que cae adentro
     * de la fila **pero no en un botón** —el relleno de la izquierda, el hueco
     * entre dos— no encontraba ningún `preventDefault`, el navegador ponía el
     * caret al lado de la isla, y `posFromDOM` lo resuelve exactamente en
     * `line.from`. De ahí el «a veces»: dependía de dónde cayera el clic.
     *
     * Con el guardia en el ancla no queda ningún píxel del widget sin cubrir.
     * Los botones conservan el suyo igual: son dos capas y la de adentro es la
     * que corre primero.
     */
    ancla.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    const fila = document.createElement("span");
    fila.className = "tareas-fila";
    if (this.fila.ilegible) fila.classList.add("is-ilegible");
    ancla.appendChild(fila);

    for (const b of this.fila.botones) {
      const boton = document.createElement("button");
      boton.type = "button";
      boton.className = `tareas-boton tareas-boton-${b.accion}`;
      if (b.activo) boton.classList.add("is-activo");
      // La fila es solo íconos: sin esto no tiene nombre para el teclado ni
      // para un lector de pantalla, y el tooltip es lo único que dice a qué
      // workbench manda cada uno.
      boton.setAttribute("aria-label", b.etiqueta);
      boton.setAttribute("title", b.etiqueta);
      if (b.workbench !== null) boton.setAttribute("aria-pressed", String(b.activo));
      // Inerte, no ausente: se sigue pudiendo enfocar y el tooltip explica por
      // qué no hace nada. `disabled` lo sacaría del recorrido del teclado y
      // dejaría la tarea sin ninguna forma de enterarse.
      if (this.fila.ilegible) boton.setAttribute("aria-disabled", "true");
      this.opciones.dibujarIcono(boton, b.icono);

      // `mousedown` y `click` por separado: el primero es el que empezaría la
      // selección, y `stopPropagation` acá es además lo que impide que el clic
      // llegue al `mousedown` de `clicAlFinal`, registrado sobre el
      // `contentDOM` y por lo tanto más afuera en el burbujeo.
      boton.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      boton.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const donde = resolver(view, ancla);
        if (donde === null) return;
        this.opciones.alClic({
          view,
          linea: donde.linea,
          texto: donde.texto,
          boton: b,
          ilegible: this.fila.ilegible,
          elemento: boton,
          evento: e,
        });
      });

      fila.appendChild(boton);
    }

    return ancla;
  }
}

/**
 * En qué línea está este widget **ahora**, preguntándoselo a CodeMirror.
 *
 * Es el invariante 10 en su forma más barata: la coordenada no se guarda al
 * construir el widget, se pide en el momento de usarla. Y está leído en
 * `@codemirror/view` 6.38.6, no supuesto:
 *
 * ```js
 * posFromDOM(node, offset) { return nearest(node).localPosFromDOM(node, offset)
 *                                   + view.posAtStart }
 * ```
 *
 * `WidgetView` no sobreescribe `localPosFromDOM`, así que usa la genérica de
 * `ContentView` — y para un widget de **longitud cero y sin hijos** todos sus
 * caminos devuelven `0` (`this.length` es 0 y `this.children` está vacío). O
 * sea que el resultado es exactamente `posAtStart`, y como el ancla está en
 * `line.from` con `side: -1`, eso es el comienzo de la línea.
 *
 * De ahí sale el texto de ahora, que es lo que `elegirTarea` necesita para
 * traducir la coordenada del editor a la del índice.
 */
function resolver(view: EditorView, ancla: HTMLElement): { linea: number; texto: string } | null {
  let pos: number;
  try {
    pos = view.posAtDOM(ancla);
  } catch {
    // `posFromDOM` tira si el nodo ya no está en el documento. Pasa si el
    // widget se destruyó entre el `mousedown` y el `click`; no es un error.
    return null;
  }
  const linea = view.state.doc.lineAt(pos);
  // CodeMirror numera desde 1 y el `Documento` del plugin desde 0.
  return { linea: linea.number - 1, texto: linea.text };
}

/**
 * El set de decoraciones para estos rangos. **Puro sobre un `EditorState`.**
 *
 * Vive separado del `ViewPlugin` para poder probarlo y **medirlo** sin DOM, que
 * es lo que hace `test/corpus/costo-fila.test.ts`: un `ViewPlugin` necesita una
 * vista de verdad, y esto no.
 */
export function decoracionesDeFila(
  state: EditorState,
  rangos: readonly { from: number; to: number }[],
  opciones: OpcionesDeFila,
): DecorationSet {
  const favoritos = opciones.favoritos();
  const salida: Range<Decoration>[] = [];

  for (const { from, to } of rangos) {
    let n = state.doc.lineAt(from).number;
    const ultima = state.doc.lineAt(to).number;
    for (; n <= ultima; n++) {
      const linea = state.doc.line(n);
      const fila = filaDe(linea.text, favoritos);
      if (fila === null) continue;
      salida.push(
        Decoration.widget({ widget: new FilaWidget(fila, opciones), side: -1 }).range(linea.from),
      );
    }
  }

  return Decoration.set(salida, true);
}

/**
 * La extensión.
 *
 * @param activo Si hay que dibujar acá: nota de la lista, interruptor encendido
 *   y Live Preview. Se inyecta por lo mismo que en `decoraciones.ts`.
 * @param alMedir Cuánto costó construir el set, y sobre cuántas líneas. El
 *   costo de decorar el documento entero es de 0,65 ms en el peor caso realista,
 *   medido; esto se compara contra eso.
 */
export function filaDeBotones(
  activo: (state: EditorState) => boolean,
  opciones: OpcionesDeFila,
  alMedir?: (ms: number, lineas: number) => void,
): Extension {
  return ViewPlugin.fromClass(
    class {
      deco: DecorationSet;

      constructor(view: EditorView) {
        this.deco = construir(view, activo, opciones, alMedir);
      }

      update(u: ViewUpdate): void {
        // También con una transacción que no cambia el documento: es lo que
        // hace que tocar un ajuste —el nombre de un favorito— tenga efecto sin
        // recargar. `main.ts` despacha una vacía al guardar.
        if (u.docChanged || u.viewportChanged || u.transactions.length > 0) {
          this.deco = construir(u.view, activo, opciones, alMedir);
        }
      }
    },
    { decorations: (v) => v.deco },
  );
}

function construir(
  view: EditorView,
  activo: (s: EditorState) => boolean,
  opciones: OpcionesDeFila,
  alMedir?: (ms: number, lineas: number) => void,
): DecorationSet {
  if (!activo(view.state)) return Decoration.none;
  const t0 = typeof performance === "undefined" ? Date.now() : performance.now();

  const deco = decoracionesDeFila(view.state, view.visibleRanges, opciones);

  if (alMedir) {
    let lineas = 0;
    for (const { from, to } of view.visibleRanges) {
      lineas += view.state.doc.lineAt(to).number - view.state.doc.lineAt(from).number + 1;
    }
    alMedir((typeof performance === "undefined" ? Date.now() : performance.now()) - t0, lineas);
  }
  return deco;
}
