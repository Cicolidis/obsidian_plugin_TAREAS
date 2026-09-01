import { describe, expect, it } from "vitest";
import { EditorState, Prec } from "@codemirror/state";
import { completarAlTildar } from "../src/editor/completarAlTildar.js";
import { protegerTramo } from "../src/editor/protegerTramo.js";
import { checkboxAutomatico } from "../src/editor/autoCheckbox.js";

/**
 * Tildar el checkbox **es** completar la tarea (§12).
 *
 * Lo que estos tests fijan no es «qué gesto se intercepta» —no se intercepta
 * ninguno— sino **qué hecho se reconoce**: una línea cuya única diferencia con
 * la de antes es el tilde. Todo lo demás pasa intacto.
 */
const HOY = "2026-09-01";

const estado = (doc: string, activo = true) =>
  EditorState.create({
    doc,
    extensions: [Prec.high(completarAlTildar(() => activo, () => HOY))],
  });

/** Tilda la línea `n` (1-based) como lo haría un clic en el checkbox. */
const tildar = (st: EditorState, n: number, estadoNuevo = "x") => {
  const linea = st.doc.line(n);
  const i = linea.text.indexOf("[");
  return st.update({
    changes: { from: linea.from + i + 1, to: linea.from + i + 2, insert: estadoNuevo },
    userEvent: "input",
  }).state.doc.toString();
};

describe("completarAlTildar — el hecho, no el gesto", () => {
  it("tildar escribe la fecha de completado", () => {
    const st = estado("- [ ] mandar el formulario");
    expect(tildar(st, 1)).toBe(`- [x] mandar el formulario %%t:done=${HOY}%%`);
  });

  it("y baja por el subárbol, como el ⋯ (§9)", () => {
    const st = estado("- [ ] madre\n\t- [ ] hija\n\t\t- [ ] nieta\n- [ ] otra");
    expect(tildar(st, 1)).toBe(
      `- [x] madre %%t:done=${HOY}%%\n` +
        `\t- [x] hija %%t:done=${HOY}%%\n` +
        `\t\t- [x] nieta %%t:done=${HOY}%%\n` +
        "- [ ] otra",
    );
  });

  it("no toca los bullets sin checkbox del subárbol (invariante 3)", () => {
    const st = estado("- [ ] madre\n\t- una nota   \n\t- [ ] hija");
    expect(tildar(st, 1)).toBe(
      `- [x] madre %%t:done=${HOY}%%\n\t- una nota   \n\t- [x] hija %%t:done=${HOY}%%`,
    );
  });

  it("conserva el token que ya estaba", () => {
    const st = estado("- [ ] tarea %%t:id=a3f2;wb=foco;p=1%%");
    expect(tildar(st, 1)).toBe(`- [x] tarea %%t:id=a3f2;wb=foco;p=1;done=${HOY}%%`);
  });

  it("una tarea que ya tenía `done` conserva **su** fecha", () => {
    // Pisarla convertiría «terminé esto el martes» en «terminé todo hoy».
    const st = estado("- [ ] madre\n\t- [x] hija %%t:done=2026-08-01%%");
    expect(tildar(st, 1)).toBe(
      `- [x] madre %%t:done=${HOY}%%\n\t- [x] hija %%t:done=2026-08-01%%`,
    );
  });

  it("una línea con el token ilegible queda intacta (invariante 7)", () => {
    const st = estado("- [ ] madre\n\t- [ ] rota %%t:zz=1%%");
    expect(tildar(st, 1)).toBe(`- [x] madre %%t:done=${HOY}%%\n\t- [ ] rota %%t:zz=1%%`);
  });
});

describe("completarAlTildar — lo que **no** dispara", () => {
  it("destildar no escribe nada", () => {
    const st = estado(`- [x] hecha %%t:done=${HOY}%%`);
    expect(tildar(st, 1, " ")).toBe(`- [ ] hecha %%t:done=${HOY}%%`);
  });

  it("editar el texto de una tarea ya tildada no le pone fecha", () => {
    // Es el falso positivo que importa: 29 tareas del corpus están en `[x]` sin
    // `done`, y tocarles una letra no significa que se completaron hoy.
    const st = estado("- [x] vieja sin fecha");
    const linea = st.doc.line(1);
    const despues = st.update({
      changes: { from: linea.to, to: linea.to, insert: "s" },
      userEvent: "input",
    }).state.doc.toString();
    expect(despues).toBe("- [x] vieja sin fechas");
  });

  it("tildar y escribir en la misma transacción no cuenta", () => {
    // Deliberadamente estrecho: si cambió algo más que el tilde, alguien está
    // editando, y escribirle encima es peor que no hacer nada.
    const st = estado("- [ ] tarea");
    const linea = st.doc.line(1);
    const despues = st.update({
      changes: { from: linea.from, to: linea.to, insert: "- [x] tarea nueva" },
      userEvent: "input",
    }).state.doc.toString();
    expect(despues).toBe("- [x] tarea nueva");
  });

  it("un cambio externo no dispara: es nuestra propia escritura volviendo", () => {
    const st = estado("- [ ] tarea");
    const linea = st.doc.line(1);
    const despues = st.update({
      changes: { from: linea.from, to: linea.to, insert: "- [x] tarea" },
      userEvent: "set",
    }).state.doc.toString();
    expect(despues).toBe("- [x] tarea");
  });

  it("deshacer no vuelve a completar", () => {
    const st = estado("- [ ] tarea");
    const linea = st.doc.line(1);
    const despues = st.update({
      changes: { from: linea.from + 3, to: linea.from + 4, insert: "x" },
      userEvent: "undo",
    }).state.doc.toString();
    expect(despues).toBe("- [x] tarea");
  });

  it("un `- [ ]` vacío tildado no es una tarea (invariante 8)", () => {
    const st = estado("- [ ] ");
    expect(tildar(st, 1)).toBe("- [x] ");
  });

  it("un bullet sin checkbox no tiene nada que completar", () => {
    const st = estado("- una nota");
    const linea = st.doc.line(1);
    expect(
      st.update({
        changes: { from: linea.to, to: linea.to, insert: "!" },
        userEvent: "input",
      }).state.doc.toString(),
    ).toBe("- una nota!");
  });

  it("con el ajuste apagado, tildar es solo tildar", () => {
    const st = estado("- [ ] tarea", false);
    expect(tildar(st, 1)).toBe("- [x] tarea");
  });

  it("fuera de una tarea, escribir no dispara nada", () => {
    const st = estado("# un heading\ntexto suelto");
    const linea = st.doc.line(2);
    expect(
      st.update({
        changes: { from: linea.to, to: linea.to, insert: " más" },
        userEvent: "input",
      }).state.doc.toString(),
    ).toBe("# un heading\ntexto suelto más");
  });
});

describe("completarAlTildar — el orden entre filtros", () => {
  it("corre **después** de `protegerTramo`: ve el token en su lugar", () => {
    // Los filtros se encadenan de menor a mayor precedencia (§5.5 punto 2). Si
    // este corriera antes, vería una línea a la que `protegerTramo` todavía no
    // le devolvió el token y escribiría sobre un token movido.
    const st = EditorState.create({
      doc: "- [ ] tarea %%t:id=a3f2%%",
      extensions: [
        Prec.low(protegerTramo(() => true)),
        checkboxAutomatico(() => true),
        Prec.high(completarAlTildar(() => true, () => HOY)),
      ],
    });
    expect(tildar(st, 1)).toBe(`- [x] tarea %%t:id=a3f2;done=${HOY}%%`);
  });

  it("con los tres filtros puestos, el checkbox automático sigue andando", () => {
    // La regresión que el orden puede producir: `autoCheckbox` deja de crear el
    // `- [ ] ` en toda tarea con token si algún filtro le mueve el texto.
    //
    // El Enter va en **la forma que Obsidian produce**: la continuación de
    // lista ya viene puesta —`\n- `— y lo que `autoCheckbox` hace es
    // ascenderla a `- [ ] `. La primera versión de este test insertaba un
    // `\n` pelado y fallaba **también sin el filtro nuevo**: no medía el
    // orden, medía un Enter que no existe.
    const st = EditorState.create({
      doc: "- [ ] tarea %%t:id=a3f2%%",
      extensions: [
        Prec.low(protegerTramo(() => true)),
        checkboxAutomatico(() => true),
        Prec.high(completarAlTildar(() => true, () => HOY)),
      ],
    });
    const linea = st.doc.line(1);
    const despues = st.update({
      changes: { from: linea.to, to: linea.to, insert: "\n- " },
      userEvent: "input",
    }).state.doc.toString();
    expect(despues.split("\n")[1]).toBe("- [ ] ");
  });
});
