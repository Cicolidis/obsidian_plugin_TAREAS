import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { EditorSelection, EditorState, Prec } from "@codemirror/state";
import { reubicarCursor } from "../src/cursor.js";
import { cursorExterno } from "../src/editor/cursorExterno.js";
import { decoraciones } from "../src/editor/decoraciones.js";
import { protegerTramo } from "../src/editor/protegerTramo.js";

const TOKEN = "%%t:id=t9rn;wb=mensual;p=2;done=2026-08-24%%";

/**
 * El caso que reportó la tercera vuelta de verificación, con el número del
 * espía:
 *
 * ```
 * #103 376:0 → 376:41  ← selección explícita  · doc +0  · select.pointer
 * #104 376:41 → 376:0                          · doc +30 · set
 * ```
 *
 * El clic deja el cursor en la columna 41 y la escritura, al volver como cambio
 * externo, lo manda a la 0 — donde Live Preview desarma el `- [ ] `.
 *
 * **La primera reproducción offline falló** porque usaba un diff mínimo,
 * carácter a carácter: ahí el cambio empieza adentro del token, después del
 * cursor, y no lo mueve. El de Obsidian arranca en el comienzo de la línea, y
 * `mapPos` de una posición adentro de un rango reemplazado devuelve el comienzo
 * del rango. Esa diferencia era todo, y por eso el diff de acá es el grueso.
 */
const externo = (
  st: EditorState,
  desdeLinea: number,
  hastaLinea: number,
  reemplazo: string,
) =>
  st.update({
    changes: {
      from: st.doc.line(desdeLinea).from,
      to: st.doc.line(hastaLinea).to,
      insert: reemplazo,
    },
    userEvent: "set",
  }).state;

const estado = (doc: string, activo = true) =>
  EditorState.create({
    doc,
    extensions: [
      Prec.low(protegerTramo(() => true)),
      cursorExterno(() => activo),
      decoraciones(() => true),
    ],
  });

const donde = (st: EditorState) => {
  const l = st.doc.lineAt(st.selection.main.head);
  return `${l.number}:${st.selection.main.head - l.from}`;
};

describe("el cursor no se mueve cuando vuelve nuestra propia escritura", () => {
  it("el caso de la tercera vuelta: el token crece y el cursor se queda", () => {
    const texto = "- [ ] armar un listado de tipos de ejercicios IB";
    let st = estado(`- [ ] antes\n${texto} ${TOKEN}\n- [ ] después`);
    st = st.update({ selection: EditorSelection.cursor(st.doc.line(2).from + 41) }).state;
    expect(donde(st)).toBe("2:41");

    // La escritura agrega un workbench: el token crece y el texto visible no.
    const nuevo = `${texto} %%t:id=t9rn;wb=mensual,foco;p=2;done=2026-08-24%%`;
    expect(donde(externo(st, 2, 2, nuevo))).toBe("2:41");
  });

  it("sin el filtro, ese mismo cambio lo manda a la columna 0", () => {
    const texto = "- [ ] armar un listado de tipos de ejercicios IB";
    let st = estado(`- [ ] antes\n${texto} ${TOKEN}\n- [ ] después`, false);
    st = st.update({ selection: EditorSelection.cursor(st.doc.line(2).from + 41) }).state;
    // Es la comprobación de que el test mide lo que dice medir: apagado, falla.
    expect(donde(externo(st, 2, 2, `${texto} ${TOKEN}x`))).toBe("2:0");
  });

  // `planDeWorkbench` baja por el subárbol entero (§9), así que el diff abarca
  // varias líneas. Es el caso que reportó el usuario: pasa con workbench y no
  // con prioridad, que escribe una sola línea.
  it("también cuando la escritura toca el subárbol entero", () => {
    const madre = "- [ ] madre";
    const hija = "\t- [ ] hija";
    let st = estado(`${madre} ${TOKEN}\n${hija}\n- [ ] ajena`);
    st = st.update({ selection: EditorSelection.cursor(st.doc.line(1).from + 8) }).state;

    const nuevo =
      `${madre} %%t:id=t9rn;wb=mensual,foco;p=2;done=2026-08-24%%\n` +
      `${hija} %%t:id=aaaa;wb=foco%%`;
    expect(donde(externo(st, 1, 2, nuevo))).toBe("1:8");
  });

  it("el cursor en otra línea tampoco se mueve", () => {
    const st0 = estado(`- [ ] una\n- [ ] otra ${TOKEN}\n- [ ] tercera`);
    const st = st0.update({ selection: EditorSelection.cursor(st0.doc.line(3).from + 5) }).state;
    expect(donde(externo(st, 2, 2, `- [ ] otra ${TOKEN}x`))).toBe("3:5");
  });
});

describe("cuándo el filtro no interviene", () => {
  it("un cambio que trae selección explícita se respeta", () => {
    const st0 = estado(`- [ ] una\n- [ ] otra ${TOKEN}`);
    const st = st0.update({ selection: EditorSelection.cursor(st0.doc.line(2).from + 8) }).state;
    const r = st.update({
      changes: { from: st.doc.line(2).from, to: st.doc.line(2).to, insert: "- [ ] otra X" },
      selection: EditorSelection.cursor(0),
      userEvent: "set",
    }).state;
    expect(donde(r)).toBe("1:0");
  });

  it("una edición del usuario no se toca", () => {
    const st0 = estado(`- [ ] una\n- [ ] otra ${TOKEN}`);
    const st = st0.update({ selection: EditorSelection.cursor(st0.doc.line(2).from + 8) }).state;
    const r = st.update({
      changes: { from: st.doc.line(2).from, to: st.doc.line(2).to, insert: "- [ ] otra X" },
      userEvent: "input.type",
    }).state;
    expect(donde(r)).toBe("2:0"); // el mapeo de CodeMirror, sin intervención
  });

  it("apagado no hace nada", () => {
    const st0 = estado(`- [ ] una\n- [ ] otra ${TOKEN}`, false);
    const st = st0.update({ selection: EditorSelection.cursor(st0.doc.line(2).from + 8) }).state;
    expect(donde(externo(st, 2, 2, `- [ ] otra ${TOKEN}x`))).toBe("2:0");
  });

  it("una selección de varias líneas no se toca", () => {
    const st0 = estado(`- [ ] una\n- [ ] otra ${TOKEN}`);
    const st = st0.update({
      selection: EditorSelection.range(2, st0.doc.line(2).from + 8),
    }).state;
    const r = externo(st, 2, 2, `- [ ] otra ${TOKEN}x`);
    expect(r.selection.main.empty).toBe(false);
  });
});

// ------------------------------------------------------------ la capa pura

describe("reubicarCursor", () => {
  it("se guía por el texto visible, no por el número de línea", () => {
    const antes = ["a", "- [ ] tarea %%t:id=aaaa%%", "b"];
    const despues = ["x", "y", "- [ ] tarea %%t:id=aaaa;wb=foco%%", "b"];
    expect(reubicarCursor(antes, { linea: 1, columna: 8 }, despues)).toEqual({
      linea: 2,
      columna: 8,
    });
  });

  /**
   * La prudencia de `ubicarLinea`, heredada: **nunca adivinar cuál de dos
   * líneas iguales era.** `null` es «que decida CodeMirror», y quien llama deja
   * pasar la transacción intacta.
   *
   * La primera versión de este test también esperaba `null` cuando el texto
   * aparece dos veces **y una de ellas es la línea sugerida**. Estaba mal el
   * test, no el código: la regla 1 de `ubicar.ts` dice que si la línea sugerida
   * coincide, se usa esa, punto, aunque el texto esté repetido en otro lado. Es
   * la respuesta correcta y además la que hace que el caso frecuente —el token
   * crece y la línea no se movió— no dependa de que el texto sea único.
   */
  it("con el texto ausente devuelve null", () => {
    expect(reubicarCursor(["- [ ] a"], { linea: 0, columna: 3 }, ["- [ ] b"])).toBeNull();
  });

  it("repetido y movido devuelve null: no se adivina cuál era", () => {
    expect(
      reubicarCursor(["x", "- [ ] a"], { linea: 1, columna: 3 }, ["- [ ] a", "y", "- [ ] a"]),
    ).toBeNull();
  });

  it("repetido pero quieto se resuelve en su propia línea", () => {
    expect(
      reubicarCursor(["- [ ] a", "- [ ] a"], { linea: 1, columna: 3 }, ["- [ ] a", "- [ ] a"]),
    ).toEqual({ linea: 1, columna: 3 });
  });

  // Una línea en blanco aparece decenas de veces en cualquier nota: buscarla
  // por texto siempre daría ambigua.
  it("una línea vacía devuelve null sin recorrer nada", () => {
    expect(reubicarCursor(["", "x"], { linea: 0, columna: 0 }, ["", "x"])).toBeNull();
  });

  it("la columna se recorta al texto visible, nunca cae adentro del tramo", () => {
    const linea = `- [ ] a ${TOKEN}`;
    const r = reubicarCursor([linea], { linea: 0, columna: linea.length }, [linea]);
    expect(r).toEqual({ linea: 0, columna: "- [ ] a".length });
  });
});

describe("propiedades", () => {
  const lineaDeTarea = fc
    .tuple(
      fc.constantFrom("- [ ] ", "\t- [x] ", "  * [ ] "),
      fc.constantFrom("comprar pan", "llamar a la escuela", "revisar el informe"),
    )
    .map(([m, t]) => `${m}${t}`);

  /**
   * La afirmación que sostiene todo: **agregarle o sacarle el token a una línea
   * no mueve el cursor de su texto visible.** Es lo único que hace una escritura
   * de este plugin sobre una tarea, así que si esto vale, ninguna escritura
   * mueve el cursor.
   */
  it("crecer o encoger el token no mueve el cursor", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(lineaDeTarea, { minLength: 1, maxLength: 6 }),
        fc.nat(),
        fc.nat(),
        (visibles, cual, col) => {
          const i = cual % visibles.length;
          const antes = visibles.map((v, n) => (n === i ? `${v} %%t:id=aaaa%%` : v));
          const despues = visibles.map((v, n) => (n === i ? `${v} %%t:id=aaaa;wb=foco%%` : v));
          const columna = col % (visibles[i]!.length + 1);

          expect(reubicarCursor(antes, { linea: i, columna }, despues)).toEqual({
            linea: i,
            columna,
          });
          // Y al revés: sacarlo tampoco.
          expect(reubicarCursor(despues, { linea: i, columna }, antes)).toEqual({
            linea: i,
            columna,
          });
        },
      ),
    );
  });
});
