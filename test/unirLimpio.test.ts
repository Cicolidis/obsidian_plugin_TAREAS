import { describe, expect, it } from "vitest";
import { EditorState, Prec, type ChangeSpec } from "@codemirror/state";
import { checkboxAutomatico } from "../src/editor/autoCheckbox.js";
import { protegerTramo } from "../src/editor/protegerTramo.js";
import { unirLimpio } from "../src/editor/unirLimpio.js";
import { inicioDelTramo, parsea } from "../src/hiddenTail.js";

const TOKEN = "%%t:id=a3f2;wb=foco%%";
const OTRO = "%%t:id=b4g3%%";

const solo = (doc: string, activo: (s: EditorState) => boolean = () => true) =>
  EditorState.create({ doc, extensions: [unirLimpio(activo)] });

/** Los tres filtros con las precedencias con que los registra `main.ts`. */
const todos = (doc: string) =>
  EditorState.create({
    doc,
    extensions: [
      Prec.lowest(unirLimpio(() => true)),
      Prec.low(protegerTramo(() => true)),
      checkboxAutomatico(() => true),
    ],
  });

const texto = (st: EditorState, cambio: ChangeSpec) =>
  st.update({ changes: cambio }).state.doc.toString();

/**
 * Las cinco formas de la **misma** unión, las mismas que en
 * `protegerTramo.test.ts`. La regla tiene que dar lo mismo con las cinco: la
 * forma de una edición depende de qué plugins haya instalados, y enumerarlas es
 * una lista siempre incompleta.
 */
const UNIONES: Record<string, (s: EditorState) => ChangeSpec> = {
  "CodeMirror con el rango atómico: borra desde el tramo": (s) => ({
    from: s.doc.line(1).from + inicioDelTramo(s.doc.line(1).text),
    to: s.doc.line(2).from,
    insert: "",
  }),
  "CodeMirror sin el rango atómico: borra solo el salto": (s) => ({
    from: s.doc.line(1).to,
    to: s.doc.line(2).from,
    insert: "",
  }),
  "Outliner: del fin de arriba al comienzo del contenido de abajo": (s) => ({
    from: s.doc.line(1).to,
    to: s.doc.line(2).from + 6,
    insert: "",
  }),
  "Outliner: reemplaza las dos líneas por una": (s) => {
    const a = s.doc.line(1), b = s.doc.line(2);
    return { from: a.from, to: b.to, insert: a.text + b.text.slice(6) };
  },
  "Outliner: reemplaza desde el contenido de arriba": (s) => {
    const a = s.doc.line(1), b = s.doc.line(2);
    return { from: a.from + 6, to: b.to, insert: a.text.slice(6) + b.text.slice(6) };
  },
};

describe("unir dos tareas deja una línea limpia", () => {
  for (const [nombre, forma] of Object.entries(UNIONES)) {
    it(`sin tokens — ${nombre}`, () => {
      const st = solo("- [ ] comprar\n- [ ] pan");
      expect(texto(st, forma(st))).toBe("- [ ] comprar pan");
    });
  }

  it("el marcador de la absorbida no sobrevive: dejó de ser un ítem", () => {
    const st = solo("- [ ] comprar\n\t\t- [x] pan");
    expect(texto(st, { from: 13, to: 14, insert: "" })).toBe("- [ ] comprar pan");
  });

  it("el cursor queda en la costura", () => {
    const st = solo("- [ ] comprar\n- [ ] pan");
    const tr = st.update({ changes: { from: 13, to: 14, insert: "" } });
    expect(tr.state.selection.main.head).toBe("- [ ] comprar".length);
  });

  /**
   * La de abajo no tiene por qué ser un ítem de lista, y hay dos casos reales
   * donde no lo es: texto suelto debajo de una tarea, y una tarea a la que el
   * usuario ya le borró el checkbox a mano antes de unir —que es lo que pasa al
   * unir con Backspace y `stickCursor`—. En los dos falta el espacio igual.
   */
  it("con texto suelto abajo también se separa", () => {
    const st = solo("- [ ] comprar\ntexto suelto");
    expect(texto(st, { from: 13, to: 14, insert: "" })).toBe("- [ ] comprar texto suelto");
  });

  it("con una tarea a la que ya le borraron el checkbox", () => {
    const st = solo("- [ ] comprar\npan");
    expect(texto(st, { from: 13, to: 14, insert: "" })).toBe("- [ ] comprar pan");
  });

  it("la sangría de la línea suelta no se arrastra", () => {
    const st = solo("- [ ] comprar\n\t\ttexto");
    expect(texto(st, { from: 13, to: 14, insert: "" })).toBe("- [ ] comprar texto");
  });

  it("una tarea vacía arriba también se une bien", () => {
    const st = solo("- [ ] \n- [ ] pan");
    expect(texto(st, { from: 6, to: 7, insert: "" })).toBe("- [ ] pan");
  });
});

describe("lo que no se toca", () => {
  it("si la de arriba no es un ítem de lista", () => {
    const st = solo("texto suelto\n- [ ] pan");
    expect(texto(st, { from: 12, to: 13, insert: "" })).toBe("texto suelto- [ ] pan");
  });

  it("si la de abajo no tiene contenido", () => {
    const st = solo("- [ ] comprar\n- [ ] ");
    expect(texto(st, { from: 13, to: 14, insert: "" })).toBe("- [ ] comprar- [ ] ");
  });

  // La condición que distingue unir de borrar: los dos textos tienen que haber
  // sobrevivido enteros, cada uno en su punta.
  it("si el borrado además se comió texto", () => {
    // Borra «rar\n- [ ] »: la unión ocurre, pero el texto de arriba ya no está
    // entero, así que no hay una unión limpia que normalizar.
    const st = solo("- [ ] comprar\n- [ ] pan");
    expect(texto(st, { from: 10, to: 20, insert: "" })).toBe("- [ ] comppan");
  });

  it("si ya estaba limpia", () => {
    const doc = "- [ ] comprar\n- [ ] pan";
    const st = solo(doc);
    const tr = st.update({ changes: { from: 13, to: 19, insert: " " } });
    expect(tr.state.doc.toString()).toBe("- [ ] comprar pan");
  });

  it("un cambio externo no se toca", () => {
    const doc = "- [ ] comprar\n- [ ] pan";
    const st = solo(doc);
    const salida = st.update({ changes: { from: 13, to: 14, insert: "" }, userEvent: "set" });
    expect(salida.state.doc.toString()).toBe("- [ ] comprar- [ ] pan");
  });

  it("apagado, se une como antes", () => {
    const st = solo("- [ ] comprar\n- [ ] pan", () => false);
    expect(texto(st, { from: 13, to: 14, insert: "" })).toBe("- [ ] comprar- [ ] pan");
  });

  it("no toca una partición", () => {
    const st = solo("- [ ] comprar pan");
    expect(texto(st, { from: 13, to: 13, insert: "\n- [ ] " })).toBe(
      "- [ ] comprar\n- [ ]  pan",
    );
  });
});

describe("los tres filtros juntos", () => {
  for (const [nombre, forma] of Object.entries(UNIONES)) {
    it(`el texto queda limpio y el token al final — ${nombre}`, () => {
      const st = todos(`- [ ] comprar ${TOKEN}\n- [ ] pan`);
      const salida = texto(st, forma(st));
      expect(salida).toBe(`- [ ] comprar pan ${TOKEN}`);
      expect(parsea(salida)).toBe(true);
    });

    it(`con token en las dos, sobrevive el de arriba — ${nombre}`, () => {
      const st = todos(`- [ ] comprar ${TOKEN}\n- [ ] pan ${OTRO}`);
      const salida = texto(st, forma(st));
      expect(salida).toBe(`- [ ] comprar pan ${TOKEN}`);
      expect(salida.match(/%%t:/g)).toHaveLength(1);
    });
  }

  it("y partir sigue funcionando con los tres puestos", () => {
    const doc = `- [ ] comprar ${TOKEN}`;
    const st = todos(doc);
    const fin = inicioDelTramo(doc);
    expect(texto(st, { from: fin, to: fin, insert: "\n- " })).toBe(`${doc}\n- [ ] `);
  });
});
