import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { gutterLineClass, type GutterMarker } from "@codemirror/view";
import { fijarLineaConMouse, lineaConMouse, lineaHover } from "../src/editor/lineaHover.js";

/**
 * Lo que se puede probar sin mouse: el campo que guarda qué línea lo tiene
 * encima, y que esa línea se publique como clase para el elemento del margen.
 *
 * El oyente de `mousemove` necesita una vista de verdad y no está acá. Lo que sí
 * está es **lo que decide**, que es dónde se rompería en silencio: una pastilla
 * encendida sobre una línea que ya no es esa no se ve como un error, se ve como
 * un parpadeo.
 */
const estado = (doc: string, activo = true) =>
  EditorState.create({ doc, extensions: [lineaHover(() => activo)] });

/** Las clases que el campo publica para los elementos del margen. */
const clases = (st: EditorState) => {
  const salida: { from: number; clase: string | undefined }[] = [];
  for (const set of st.facet(gutterLineClass)) {
    const it = set.iter();
    while (it.value) {
      salida.push({ from: it.from, clase: (it.value as GutterMarker).elementClass });
      it.next();
    }
  }
  return salida;
};

const conMouseEn = (st: EditorState, from: number | null) =>
  st.update({ effects: fijarLineaConMouse.of(from) }).state;

describe("qué línea tiene el mouse encima", () => {
  it("arranca sin ninguna y no publica nada", () => {
    const st = estado("- [ ] a\n- [ ] b");
    expect(st.field(lineaConMouse)).toBeNull();
    expect(clases(st)).toEqual([]);
  });

  it("publica la clase sobre la línea que tiene el mouse", () => {
    const st = estado("- [ ] a\n- [ ] b");
    const r = conMouseEn(st, st.doc.line(2).from);
    expect(clases(r)).toEqual([{ from: st.doc.line(2).from, clase: "tareas-hover" }]);
  });

  /**
   * El campo tiene que sobrevivir a que el documento cambie debajo del mouse.
   * Es el mismo problema que el widget resuelve no guardando su posición: acá
   * no se puede no guardarla, así que se mapea.
   */
  it("la posición se corre cuando se inserta algo arriba", () => {
    const st = estado("- [ ] a\n- [ ] b");
    const conMouse = conMouseEn(st, st.doc.line(2).from);
    const corrido = conMouse.update({ changes: { from: 0, to: 0, insert: "nueva\n" } }).state;
    expect(corrido.field(lineaConMouse)).toBe(corrido.doc.line(3).from);
  });

  // Si la línea desaparece se apaga, en vez de quedar apuntando a otra cosa.
  it("si la línea se borra, se apaga", () => {
    const st = estado("- [ ] a\n- [ ] b\n- [ ] c");
    const conMouse = conMouseEn(st, st.doc.line(2).from);
    const borrada = conMouse.update({
      changes: { from: st.doc.line(2).from - 1, to: st.doc.line(2).to, insert: "" },
    }).state;
    expect(borrada.field(lineaConMouse)).toBeNull();
    expect(clases(borrada)).toEqual([]);
  });

  it("apagar el mouse limpia la clase", () => {
    const st = estado("- [ ] a\n- [ ] b");
    expect(clases(conMouseEn(conMouseEn(st, 0), null))).toEqual([]);
  });

  // Una edición que no toca la línea del mouse no la mueve: es el caso de cada
  // tecla, y si se apagara ahí la pastilla parpadearía al escribir.
  it("escribir en la misma línea no apaga nada", () => {
    const st = estado("- [ ] a\n- [ ] b");
    const conMouse = conMouseEn(st, st.doc.line(2).from);
    const escrito = conMouse.update({
      changes: { from: st.doc.line(2).to, to: st.doc.line(2).to, insert: "x" },
    }).state;
    expect(escrito.field(lineaConMouse)).toBe(st.doc.line(2).from);
  });
});
