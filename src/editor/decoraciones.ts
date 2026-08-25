import { StateField, type EditorState, type Extension, type Range } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";
import { claseDeHija, colorClass } from "../color.js";
import { documentoDeLineas } from "../documento.js";
import { marcasDe } from "../decorar.js";

/**
 * Las decoraciones sobre la nota: el token invisible y el color de la prioridad.
 *
 * ## Por qué un `StateField` y no un `ViewPlugin`
 *
 * Es **la** decisión de arquitectura de este paso, y está leída en el código,
 * no deducida. En `EditorView.measure`, tanto en `@codemirror/view` 6.38.6 como
 * dentro del bundle de Obsidian 1.13.7:
 *
 * ```js
 * this.stateDeco = state.facet(decorations).filter(d => typeof d != "function");
 * this.heightMap = this.heightMap.applyChanges(this.stateDeco, …);
 * ```
 *
 * **El mapa de alturas descarta las decoraciones que llegan como función**, que
 * es como las aporta un `ViewPlugin`. Un `StateField` aporta el `DecorationSet`
 * en persona, entra al mapa, y `addLineDeco` hace `line.collapsed += length`:
 * la estimación de altura de una línea que está fuera de pantalla **descuenta**
 * los ~40 caracteres del token.
 *
 * Con un `ViewPlugin` cada tarea de fuera de pantalla se estimaría un renglón
 * más alta de lo que es; al entrar en pantalla se mediría, se encogería, el
 * ancla de scroll se movería, y ahí arranca el bucle de `Measure loop
 * restarted` — amplificado, y esta vez causado por nosotros. Ver §5.5.
 *
 * Por eso `annotationDecorations.ts` de Anotaciones **no se copia**: usa
 * `ViewPlugin.fromClass` sobre `view.visibleRanges`. De ahí se hereda la
 * estructura —caché de decoraciones de línea, dos sets, el atómico aparte— y
 * no cómo se registra.
 *
 * ## El rango atómico incluye el salto de línea
 *
 * Sin eso quedan dos posiciones dibujadas en el mismo punto y bajar de línea
 * cuesta **dos** flechas. Y hay una segunda razón, verificada dentro del
 * `obsidian-1.13.7.asar` instalado (`deleteBy` → `skipAtomic`):
 *
 * ```js
 * function sH(e,t,n){ … r[i].between(t,t,function(e,i){ e<t && i>t && (t = n?i:e) }) … }
 * ```
 *
 * Un Backspace desde la línea de abajo apunta al salto de línea. Si el salto
 * está **adentro** del rango atómico, el objetivo se corre hasta el comienzo del
 * rango y se borra el token entero — feo pero recuperable (§5.4: se pierde la
 * estrella, no la tarea). Si el salto quedara **afuera**, el borrado se llevaría
 * solo el `\n` y dejaría dos `%%t:` en la línea unida: ilegible, y una línea
 * ilegible no se vuelve a escribir nunca (§5.3). De los dos daños, este rango
 * elige el reversible — y `protegerTramo.ts` evita los dos.
 *
 * ## El token se oculta siempre, también con el cursor encima
 *
 * Live Preview muestra el marcado en crudo cuando el cursor cae adentro de un
 * token, y acá no: el usuario **nunca** escribe el token (§5.1) y no tiene nada
 * que hacer adentro. El rango atómico además no lo deja entrar.
 *
 * @param activo Si hay que decorar este editor: nota de la lista, interruptor
 *   encendido y Live Preview. Se inyecta porque `editorLivePreviewField` viene
 *   de `obsidian`, que es un paquete de **solo tipos** (`"main": ""`) y no se
 *   puede importar en un test. Es el mismo patrón que `autoCheckbox`.
 * @param alMedir Cuánto costó recalcular. Sirve para medir en vez de suponer.
 */
export function decoraciones(
  activo: (state: EditorState) => boolean,
  alMedir?: (ms: number, lineas: number) => void,
): Extension {
  const campo = StateField.define<Decorado>({
    create: (state) => construir(state, activo, alMedir),
    update(valor, tr) {
      // El segundo término es lo que hace que pasar de Live Preview a modo
      // fuente redibuje: ahí no cambia el documento, cambia un campo de estado.
      if (!tr.docChanged && activo(tr.state) === valor.activo) return valor;
      return construir(tr.state, activo, alMedir);
    },
    provide: (f) => EditorView.decorations.from(f, (v) => v.deco),
  });

  return [
    campo,
    EditorView.atomicRanges.of(
      (view) => view.state.field(campo, false)?.atomicos ?? Decoration.none,
    ),
  ];
}

interface Decorado {
  /** Se guarda para saber cuándo el motivo del redibujo fue este y no el texto. */
  activo: boolean;
  deco: DecorationSet;
  /** Los rangos que el cursor cruza de un paso. Van aparte porque se estiran. */
  atomicos: DecorationSet;
}

const APAGADO: Decorado = { activo: false, deco: Decoration.none, atomicos: Decoration.none };

const OCULTO = Decoration.replace({});

/**
 * Las decoraciones de línea, memorizadas por clase.
 *
 * Son cuatro objetos en toda la vida del plugin y se piden en cada recálculo,
 * o sea en cada tecla. Es la caché de `annotationDecorations.ts`, que es lo que
 * sí se porta de allá.
 */
const cache = new Map<string, Decoration>();
function decoracionDeLinea(clase: string): Decoration {
  let d = cache.get(clase);
  if (!d) {
    d = Decoration.line({ class: clase });
    cache.set(clase, d);
  }
  return d;
}

function construir(
  state: EditorState,
  activo: (s: EditorState) => boolean,
  alMedir?: (ms: number, lineas: number) => void,
): Decorado {
  if (!activo(state)) return APAGADO;
  const t0 = typeof performance === "undefined" ? Date.now() : performance.now();

  // Las líneas salen de CodeMirror, no de partir el texto otra vez: con CRLF
  // las dos particiones dan columnas distintas. Ver `documentoDeLineas`.
  const lineas: string[] = [];
  for (let i = 1; i <= state.doc.lines; i++) lineas.push(state.doc.line(i).text);

  const deco: Range<Decoration>[] = [];
  const atomicos: Range<Decoration>[] = [];

  for (const m of marcasDe(documentoDeLineas(lineas))) {
    const linea = state.doc.line(m.linea + 1);
    if (m.tipo === "oculto") {
      const desde = linea.from + m.desde;
      deco.push(OCULTO.range(desde, linea.to));
      // Hasta el salto inclusive, salvo en la última línea, donde no hay.
      atomicos.push(OCULTO.range(desde, linea.to < state.doc.length ? linea.to + 1 : linea.to));
    } else {
      const clase = m.tipo === "prioridad" ? colorClass(m.nivel) : claseDeHija(m.nivel);
      deco.push(decoracionDeLinea(clase).range(linea.from));
    }
  }

  const valor: Decorado = {
    activo: true,
    deco: Decoration.set(deco, true),
    atomicos: Decoration.set(atomicos, true),
  };
  alMedir?.((typeof performance === "undefined" ? Date.now() : performance.now()) - t0, lineas.length);
  return valor;
}
