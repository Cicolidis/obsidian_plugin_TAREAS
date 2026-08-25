import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";
import { decoraciones } from "../src/editor/decoraciones.js";

/**
 * Todo esto corre **sin DOM y sin Obsidian**. `@codemirror/view` se puede
 * importar en Node: `Decoration` y los `RangeSet` no tocan el documento, y el
 * `StateField` se calcula sobre un `EditorState` pelado. Es el mismo andamiaje
 * que `autoCheckbox.test.ts`.
 */
const estado = (doc: string, activo: (s: EditorState) => boolean = () => true) =>
  EditorState.create({ doc, extensions: [decoraciones(activo)] });

const rangos = (set: DecorationSet) => {
  const out: { from: number; to: number; spec: unknown }[] = [];
  const it = set.iter();
  while (it.value) {
    out.push({ from: it.from, to: it.to, spec: it.value.spec });
    it.next();
  }
  return out;
};

const deco = (st: EditorState) => rangos(st.facet(EditorView.decorations)[0] as DecorationSet);

/**
 * El facet de rangos atómicos guarda funciones de `view`. La nuestra solo lee
 * `view.state`, así que se la puede llamar con un objeto que tenga el estado:
 * no hace falta una vista de verdad para comprobar dónde quedaron los rangos.
 */
const atomicos = (st: EditorState) => {
  const fn = st.facet(EditorView.atomicRanges)[0]!;
  return rangos(fn({ state: st } as unknown as EditorView));
};

// ---------------------------------------------------------- la restricción

describe("la restricción de la §5.5", () => {
  /**
   * Este es el test que fija la decisión de arquitectura del paso 4.
   *
   * `EditorView.measure` hace
   * `state.facet(decorations).filter(d => typeof d != "function")` antes de
   * armar el mapa de alturas. Un `StateField` deja un objeto y entra; un
   * `ViewPlugin` deja una función y **el mapa lo descarta**, y ahí cada tarea
   * fuera de pantalla se estima un renglón más alta de lo que es.
   *
   * Si alguna vez alguien convierte esto en un `ViewPlugin`, no se va a ver
   * nada raro en pantalla: se va a ver el bucle de medición meses después. Este
   * test falla el mismo día.
   */
  it("las decoraciones llegan al facet como objeto, no como función", () => {
    const st = estado("- [ ] llamar %%t:id=a3f2%%");
    const aportes = st.facet(EditorView.decorations);
    expect(aportes).toHaveLength(1);
    expect(typeof aportes[0]).toBe("object");
    expect(aportes.filter((d) => typeof d === "function")).toHaveLength(0);
  });
});

// -------------------------------------------------------------- el token

describe("el token oculto", () => {
  it("se reemplaza desde el fin del texto hasta el fin de la línea", () => {
    const doc = "- [ ] llamar %%t:id=a3f2%%";
    expect(deco(estado(doc))).toEqual([
      { from: "- [ ] llamar".length, to: doc.length, spec: {} },
    ]);
  });

  it("el rango atómico llega hasta el salto de línea inclusive", () => {
    const doc = "- [ ] llamar %%t:id=a3f2%%\n- [ ] otra";
    const [r] = atomicos(estado(doc));
    expect(r!.from).toBe("- [ ] llamar".length);
    // Sin el +1 quedan dos posiciones dibujadas en el mismo punto y bajar de
    // línea cuesta dos flechas.
    expect(r!.to).toBe(doc.indexOf("\n") + 1);
  });

  it("en la última línea no hay salto que incluir", () => {
    const doc = "- [ ] otra\n- [ ] llamar %%t:id=a3f2%%";
    const [r] = atomicos(estado(doc));
    expect(r!.to).toBe(doc.length);
  });

  it("un token roto no se toca", () => {
    expect(deco(estado("- [ ] llamar %%t:id=A3F2%%"))).toEqual([]);
    expect(atomicos(estado("- [ ] llamar %%t:id=A3F2%%"))).toEqual([]);
  });
});

// ----------------------------------------------------------- la prioridad

describe("la prioridad", () => {
  it("pinta la línea de la tarea y filetea el subárbol", () => {
    const doc = ["- [ ] madre %%t:p=2%%", "\t- [ ] hija", "- [ ] ajena"].join("\n");
    const st = estado(doc);
    const lineas = deco(st).filter((r) => r.from === r.to);
    expect(lineas).toEqual([
      { from: 0, to: 0, spec: { class: "tareas-p2" } },
      { from: st.doc.line(2).from, to: st.doc.line(2).from, spec: { class: "tareas-hija-p2" } },
    ]);
  });

  it("la decoración de línea va antes que el reemplazo del token", () => {
    const r = deco(estado("- [ ] urgente %%t:p=1%%"));
    expect(r.map((x) => x.spec)).toEqual([{ class: "tareas-p1" }, {}]);
  });

  it("prioridad normal no deja ninguna decoración de línea", () => {
    expect(deco(estado("- [ ] normal %%t:id=a3f2%%")).filter((r) => r.from === r.to)).toEqual([]);
  });
});

// ------------------------------------------------------------- el interruptor

describe("cuándo se decora", () => {
  it("apagado no decora nada", () => {
    const st = estado("- [ ] llamar %%t:id=a3f2%%", () => false);
    expect(st.facet(EditorView.decorations)[0]).toBe(Decoration.none);
    expect(atomicos(st)).toEqual([]);
  });

  // Pasar de Live Preview a modo fuente no cambia el documento: cambia un campo
  // de estado. Sin mirar `activo` en cada transacción, el token se quedaría
  // escondido en modo fuente, que es justo donde hay que poder verlo.
  it("encenderlo redibuja aunque el documento no haya cambiado", () => {
    let on = false;
    const st = EditorState.create({
      doc: "- [ ] llamar %%t:id=a3f2%%",
      extensions: [decoraciones(() => on)],
    });
    expect(deco(st)).toEqual([]);
    on = true;
    const st2 = st.update({}).state;
    expect(deco(st2)).toHaveLength(1);
    on = false;
    expect(deco(st2.update({}).state)).toEqual([]);
  });

  it("un cambio de texto recalcula", () => {
    const st = estado("- [ ] llamar");
    expect(deco(st)).toEqual([]);
    const st2 = st.update({
      changes: { from: st.doc.length, to: st.doc.length, insert: " %%t:id=a3f2%%" },
    }).state;
    expect(deco(st2)).toHaveLength(1);
  });

  it("informa cuánto tardó y sobre cuántas líneas", () => {
    const medidas: { ms: number; lineas: number }[] = [];
    EditorState.create({
      doc: "- [ ] a %%t:id=a3f2%%\n- [ ] b",
      extensions: [decoraciones(() => true, (ms, lineas) => medidas.push({ ms, lineas }))],
    });
    expect(medidas).toHaveLength(1);
    expect(medidas[0]!.lineas).toBe(2);
    expect(medidas[0]!.ms).toBeGreaterThanOrEqual(0);
  });
});
