import type { EditorState, Extension } from "@codemirror/state";
import { EditorView, GutterMarker, gutter } from "@codemirror/view";
import {
  claveDeFila,
  filaDe,
  type Boton,
  type ContextoDeFila,
  type Favoritos,
  type Fila,
} from "../botones.js";

/**
 * La fila de botones de cada tarea, en un **margen propio** (§13.0).
 *
 * ```
 * número de línea · [🔁][📅][🗑][⋯][→][◐][★] · filete · plegado · [ ] texto
 * ```
 *
 * `src/botones.ts` decide **qué** botones van y en qué estado —capa 1, sin DOM,
 * calculado del texto de la línea y no del store, que puede estar atrasado—, y
 * esto los dibuja.
 *
 * Hasta el 30/09/2026 la fila tenía además una forma **adentro** de la línea:
 * un widget de ancho cero en un `ViewPlugin`, con cinco lugares posibles. Se
 * eligió el margen y el widget se borró, con su `posAtDOM`, su guardia de
 * `mousedown` y la trampa del mapa de alturas que lo acompañaba. Toda esa
 * historia está en `informes/spec-13.0-frente-principal.md` y en
 * `informes/spec-5.5-rangos-atomicos-y-medicion.md`, puntos 12 a 24.
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
  /** ¿Va el quinto botón, el 🗑? Se lee en el momento: el ajuste cambia solo. */
  conEliminar: () => boolean;
  /** Los dos indicadores del paso 6c, cada uno con su interruptor. */
  indicadores: () => { fecha: boolean; recurrencia: boolean };
  /**
   * Hoy, en `AAAA-MM-DD`. Se inyecta por lo mismo que `dibujarIcono`: `botones.ts`
   * es capa 1 y no lee el reloj, y así el test se puede parar en cualquier día.
   */
  hoy: () => string;
  alClic: AlClicEnFila;
  /**
   * Cómo se dibuja un ícono. Se inyecta porque `setIcon` viene de `obsidian`,
   * que es un paquete de **solo tipos** (`"main": ""`) y no se puede importar
   * en un test. Es el mismo patrón que `activo` en `decoraciones.ts`.
   */
  dibujarIcono: (el: HTMLElement, icono: string) => void;
}

/**
 * Lo que `filaDe` necesita, leído **en el momento**: el margen lo pide por cada
 * línea visible, y así un ajuste que cambia tiene efecto en el próximo dibujo
 * sin que nadie tenga que acordarse de avisar. Son dos cierres y una fecha.
 */
export function contextoDe(opciones: OpcionesDeFila): ContextoDeFila {
  return {
    favoritos: opciones.favoritos(),
    conEliminar: opciones.conEliminar(),
    indicadores: opciones.indicadores(),
    hoy: opciones.hoy(),
  };
}

/**
 * El DOM de la fila.
 *
 * Se exporta para el test: es el único lugar donde se decide que el clic **sube**
 * hasta el margen, y eso no se puede mirar desde afuera.
 */
export function construirFila(fila: Fila, opciones: OpcionesDeFila): HTMLElement {
  const ancla = document.createElement("span");
  ancla.className = "tareas-fila-ancla";

  const grupo = document.createElement("span");
  grupo.className = "tareas-fila";
  if (fila.ilegible) grupo.classList.add("is-ilegible");
  ancla.appendChild(grupo);

  for (const b of fila.botones) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = `tareas-boton tareas-boton-${b.accion}`;
    if (b.activo) boton.classList.add("is-activo");
    // La fila es solo íconos: sin esto no tiene nombre para el teclado ni para
    // un lector de pantalla, y el tooltip es lo único que dice a qué workbench
    // manda cada uno.
    boton.setAttribute("aria-label", b.etiqueta);
    boton.setAttribute("title", b.etiqueta);
    if (b.workbench !== null) boton.setAttribute("aria-pressed", String(b.activo));
    // Inerte, no ausente: se sigue pudiendo enfocar y el tooltip explica por qué
    // no hace nada. `disabled` lo sacaría del recorrido del teclado.
    if (fila.ilegible) boton.setAttribute("aria-disabled", "true");
    opciones.dibujarIcono(boton, b.icono);

    // El `mousedown` se ataja: es lo que evita que un arrastre empiece una
    // selección. Cortarle la burbuja no le saca nada al margen, cuyo
    // `mousedown` solo devuelve `true` para hacer el mismo `preventDefault`.
    boton.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    // El `click`, en cambio, **no** se ataja: tiene que subir hasta el
    // `.cm-gutter`, que es quien sabe sobre qué línea fue. Cuando había además
    // una forma de la fila adentro de la línea, un `stopPropagation` pensado
    // para ella cortaba la burbuja y los botones del margen no hacían nada.

    grupo.appendChild(boton);
  }

  return ancla;
}

// ------------------------------------------------------------- el margen

/**
 * La fila en un **margen** de CodeMirror, a la derecha de los números de línea.
 *
 * Es la propuesta de la tercera vuelta de verificación del 4b, y el widget de
 * entonces no la podía dar: vivía adentro de `.cm-line`, así que solo podía
 * pararse en el espacio que la nota deja a los costados. Medido por el usuario: sin «longitud de línea
 * legible» ese espacio no existe y los botones quedan **recortados fuera de la
 * pantalla**; y con ella, la pastilla se dibuja **encima** de los números de
 * línea, porque son dos cosas que no saben una de la otra.
 *
 * Un `gutter` no tiene ninguno de los dos problemas: es una **columna de
 * verdad**, CodeMirror las acomoda una al lado de la otra, y el contenido se
 * corre solo. El orden que pedía la propuesta sale gratis:
 *
 *     número de línea · [★][◐][→][⋯] · filete · plegado · [ ] texto
 *
 * «El orden en que aparecen los márgenes lo decide la precedencia de su
 * extensión», así que va con `Prec.lowest` para quedar **después** del de
 * Obsidian.
 *
 * Y hay un tercer problema que resuelve de arriba: acá los botones están
 * **afuera de `.cm-content`**, así que el navegador no tiene dónde poner un
 * caret y toda la familia de fallas del cursor con el clic desaparece de raíz.
 *
 * ## Por qué el clic no usa `posAtDOM`
 *
 * Un marcador de margen no es parte del árbol de contenido, así que `posAtDOM`
 * no lo encuentra. En cambio `gutter` da algo mejor: sus `domEventHandlers`
 * reciben el `BlockInfo` de la línea, **fresco en el momento del evento**. Es la
 * misma garantía del invariante 10 por otra puerta, y encima más directa.
 */
export class FilaMarker extends GutterMarker {
  private readonly clave: string;

  constructor(
    private readonly fila: Fila,
    private readonly opciones: OpcionesDeFila,
  ) {
    super();
    this.clave = claveDeFila(fila);
  }

  override eq(otro: FilaMarker): boolean {
    return otro.clave === this.clave;
  }

  override toDOM(): Node {
    // El clic no se resuelve acá: lo hace el `domEventHandlers` del margen, que
    // recibe la línea fresca. Acá solo se marca cada botón para poder
    // reconocerlo desde allá.
    const orden = ordenDelMargen(this.fila.botones);
    const ancla = construirFila({ ...this.fila, botones: orden }, this.opciones);
    const botones = ancla.querySelectorAll("button");
    orden.forEach((b, i) => {
      botones[i]?.setAttribute("data-accion", b.accion);
      if (b.workbench !== null) botones[i]?.setAttribute("data-wb", b.workbench);
    });
    return ancla;
  }
}

/**
 * En el margen la fila se dibuja **al revés**, y eso lo decidió una medición.
 *
 * `filaDe` los devuelve en el orden de la §13.0 —`★ ◐ → ⋯ 🗑`—, que es el
 * correcto cuando la fila está **a la derecha** del texto: ahí el mouse llega
 * desde la izquierda y se encuentra primero con el ★, que es el que más se
 * aprieta, y último con el 🗑, que es el que borra.
 *
 * En el margen es exactamente al revés, y la sonda de hover de la verificación
 * lo muestra en coordenadas. El texto empieza cerca de `x=280` y los botones
 * caen así:
 *
 * ```
 * x=235 tareas-boton-eliminar        ← el primero que toca el mouse
 * x=214 tareas-boton-menu
 * x=193 tareas-boton-popover
 * x=173 tareas-boton-wb-secundario
 * x=153 tareas-boton-wb-primario     ← el más usado, el más lejos
 * ```
 *
 * O sea que el orden canónico, puesto en el margen, deja **el botón que borra
 * sin preguntar como el primero que uno se cruza** viniendo del texto, y el más
 * frecuente como el último. Es al revés de lo que hay que hacer.
 *
 * Se invierte el **arreglo**, no el CSS. Un `flex-direction: row-reverse` daría
 * lo mismo a la vista y dejaría el orden del teclado al revés del visual, que es
 * la clase de detalle que la §20 pide tener resuelto antes de compartir esto.
 */
function ordenDelMargen(botones: readonly Boton[]): Boton[] {
  return [...botones].reverse();
}

/**
 * El margen con la fila de botones.
 *
 * @param activo Si hay que dibujar acá: nota de la lista, interruptor encendido
 *   y Live Preview. Se inyecta por lo mismo que en `decoraciones.ts`.
 */
/**
 * El marcador de una línea, o `null` si no es una tarea. **Puro sobre el texto.**
 *
 * Es lo que corre el margen por cada línea visible, y está separado para poder
 * **medirlo** sin vista: lo usa `test/corpus/costo-fila.test.ts`.
 *
 * El marcador es puro dibujo, así que dos tareas en el mismo estado comparten
 * uno solo: la caché tiene cuatro o cinco objetos en toda la vida del plugin.
 */
export function marcadorDeLinea(
  texto: string,
  ctx: ContextoDeFila,
  opciones: OpcionesDeFila,
  cache: Map<string, FilaMarker>,
): FilaMarker | null {
  const fila = filaDe(texto, ctx);
  if (fila === null) return null;
  const clave = claveDeFila(fila);
  let m = cache.get(clave);
  if (!m) {
    m = new FilaMarker(fila, opciones);
    cache.set(clave, m);
  }
  return m;
}

export function filaEnElMargen(
  activo: (state: EditorState) => boolean,
  opciones: OpcionesDeFila,
): Extension {
  const marcadores = new Map<string, FilaMarker>();

  return gutter({
    class: "tareas-margen",
    // Sin esto CodeMirror dibuja un elemento por línea aunque no haya marcador,
    // y son cientos de nodos vacíos en una nota de 400 líneas.
    renderEmptyElements: false,

    lineMarker(view, linea) {
      if (!activo(view.state)) return null;
      return marcadorDeLinea(view.state.doc.lineAt(linea.from).text, contextoDe(opciones), opciones, marcadores);
    },

    // Los marcadores dependen del texto **y** de los ajustes, y un cambio de
    // ajuste no cambia el documento. `main.ts` despacha una transacción vacía al
    // guardar, y esto es lo que hace que llegue hasta acá.
    lineMarkerChange: (u) => u.transactions.length > 0,

    domEventHandlers: {
      mousedown() {
        // El margen está afuera del contenido, así que no hay caret que mover;
        // se ataja igual para que un arrastre no empiece una selección.
        return true;
      },
      click(view, linea, evento) {
        const destino = (evento.target as HTMLElement | null)?.closest?.("button[data-accion]");
        if (!(destino instanceof HTMLElement)) return false;
        const accion = destino.dataset["accion"] as Boton["accion"] | undefined;
        if (accion === undefined) return false;

        // La línea llega **fresca** del `BlockInfo` del evento: es la posición
        // de ahora, no la que tenía el marcador cuando se construyó.
        const l = view.state.doc.lineAt(linea.from);
        const fila = filaDe(l.text, contextoDe(opciones));
        const boton = fila?.botones.find((b) => b.accion === accion);
        if (!fila || !boton) return false;

        opciones.alClic({
          view,
          linea: l.number - 1,
          texto: l.text,
          boton,
          ilegible: fila.ilegible,
          elemento: destino,
          evento: evento as MouseEvent,
        });
        return true;
      },
    },
  });
}
