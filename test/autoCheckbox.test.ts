import { describe, expect, it } from "vitest";
import { EditorState, type ChangeSpec, type Line } from "@codemirror/state";
import { checkboxAutomatico } from "../src/editor/autoCheckbox.js";
import { columnaDelContenido, parseBullet } from "../src/linea.js";

const estado = (doc: string, activo: (s: EditorState) => boolean = () => true) =>
  EditorState.create({ doc, extensions: [checkboxAutomatico(activo)] });

/**
 * Lo que los dos motores escriben al continuar la lista, leído de su código:
 * la sangría, el marcador, y `[ ] ` **solo si la línea de origen lo tenía**.
 *
 * - Obsidian, `app.js`: `p && (w += "[ ] ")`
 * - Outliner, `main.js`: `oldLines[0].match(checkboxRe) ? "[ ] " : ""`
 */
function continuacion(texto: string): string {
  const b = parseBullet(texto)!;
  const ordinal = /^(\d+)([.)])$/.exec(b.marcador);
  const marcador = ordinal ? `${Number(ordinal[1]) + 1}${ordinal[2]}` : b.marcador;
  return `${b.indent}${marcador}${b.espacio}${b.checkbox ? "[ ] " : ""}`;
}

/**
 * Las cuatro formas que puede tener el **mismo** Enter.
 *
 * Ninguna es inventada:
 *
 * 1. Obsidian core reemplaza desde el carácter anterior al cursor
 *    (`r.charAt(i.ch-1)+"\n"+s+w`, verificado en `obsidian.asar`).
 * 2. Outliner reemplaza la línea entera: su `ChangesApplicator` recorta las
 *    líneas comunes por delante y por detrás hasta dejar la que cambió.
 * 3. La misma de Outliner pero empezando en el comienzo del contenido, porque
 *    su `changeFrom.ch` sale del rango de la raíz y el recorte solo mueve
 *    `.line`.
 * 4. La inserción pura del salto, que es lo que queda si algún día no hay
 *    ninguno de los dos.
 *
 * La regla tiene que dar lo mismo con las cuatro: enumerar formas es una lista
 * que siempre está incompleta (NOTAS §8).
 */
const FORMAS: Record<string, (linea: Line, pos: number, prefijo: string) => ChangeSpec> = {
  "Obsidian: reemplaza el carácter previo al cursor": (linea, pos, prefijo) => ({
    from: pos - 1,
    to: pos,
    insert: `${linea.text[pos - 1 - linea.from]}\n${prefijo}`,
  }),
  "Outliner: reemplaza la línea entera": (linea, _pos, prefijo) => ({
    from: linea.from,
    to: linea.to,
    insert: `${linea.text}\n${prefijo}`,
  }),
  "Outliner: desde el comienzo del contenido": (linea, _pos, prefijo) => {
    const col = columnaDelContenido(parseBullet(linea.text)!);
    return { from: linea.from + col, to: linea.to, insert: `${linea.text.slice(col)}\n${prefijo}` };
  },
  "sin ninguno de los dos: inserción pura del salto": (_linea, pos, prefijo) => ({
    from: pos,
    to: pos,
    insert: `\n${prefijo}`,
  }),
};

/** Enter al final de la última línea del documento, en la forma indicada. */
function enter(doc: string, forma: keyof typeof FORMAS, prefijo = continuacion(doc)): string {
  const st = estado(doc);
  const linea = st.doc.lineAt(st.doc.length);
  const cambio = FORMAS[forma]!(linea, linea.to, prefijo);
  return st.update({ changes: cambio }).state.doc.toString();
}

// ---------------------------------------------------------------- regla A

describe("regla A: el bullet que nace de un bullet nace tarea", () => {
  const casos: [string, string][] = [
    ["bullet suelto del corpus", "- pasar notas a la app"],
    ["bullet indentado", "\t- 1A"],
    ["bullet con markdown adentro", "- **primero**"],
    ["bullet con asterisco", "* con asterisco"],
    ["bullet numerado", "1. numerada"],
    ["bullet muy indentado", "\t\t\t- hondo"],
  ];

  for (const [nombre, doc] of casos) {
    for (const forma of Object.keys(FORMAS)) {
      it(`${nombre} — ${forma}`, () => {
        expect(enter(doc, forma)).toBe(`${doc}\n${continuacion(doc)}[ ] `);
      });
    }
  }
});

describe("regla A: lo que ya venía con checkbox no se toca dos veces", () => {
  // Es la idempotencia: los dos motores ya escriben `[ ] ` cuando el origen es
  // una tarea, así que la regla tiene que ver que no hay nada que hacer.
  for (const doc of ["- [ ] IB", "\t\t- [ ] temas:", "- [x] hecha"]) {
    for (const forma of Object.keys(FORMAS)) {
      it(`${doc} — ${forma}`, () => {
        const salida = enter(doc, forma);
        expect(salida).toBe(`${doc}\n${continuacion(doc)}`);
        expect(salida.split("\n")[1]).toMatch(/\[ \] $/);
        expect(salida.split("\n")[1]!.match(/\[ \]/g)).toHaveLength(1);
      });
    }
  }
});

describe("regla A: lo que no dispara", () => {
  it("texto libre: Enter no inventa una lista", () => {
    const st = estado("texto suelto");
    const pos = st.doc.length;
    expect(st.update({ changes: { from: pos, to: pos, insert: "\n" } }).state.doc.toString()).toBe(
      "texto suelto\n",
    );
  });

  it("línea vacía", () => {
    const st = estado("");
    expect(st.update({ changes: { from: 0, to: 0, insert: "\n" } }).state.doc.toString()).toBe("\n");
  });

  it("heading", () => {
    const doc = "## WORKBENCH | [[tareas_LOG]]";
    const st = estado(doc);
    const pos = st.doc.length;
    expect(st.update({ changes: { from: pos, to: pos, insert: "\n" } }).state.doc.toString()).toBe(
      `${doc}\n`,
    );
  });

  it("bullet vacío: Enter sigue sacándote de la lista", () => {
    // Obsidian borra el marcador entero; Outliner desindenta. En los dos casos
    // la línea nueva no es un bullet, así que la regla no tiene dónde poner
    // nada — y no queda un `- [ ] ` del que no se pueda salir.
    const st = estado("- ");
    expect(
      st.update({ changes: { from: 0, to: 2, insert: "" } }).state.doc.toString(),
    ).toBe("");
    const st2 = estado("\t\t- ");
    expect(
      st2.update({ changes: { from: 0, to: 4, insert: "\t- " } }).state.doc.toString(),
    ).toBe("\t- ");
  });

  it("Enter en medio de un bullet: eso mueve texto, no crea una línea", () => {
    const doc = "- pasar notas a la app";
    const st = estado(doc);
    const corte = "- pasar".length;
    const salida = st.update({
      changes: { from: corte - 1, to: corte, insert: `r\n- ` },
    }).state.doc.toString();
    expect(salida).toBe("- pasar\n-  notas a la app");
  });

  it("pegar varias líneas no se toca", () => {
    const doc = "- una";
    const st = estado(doc);
    expect(
      st.update({ changes: { from: 0, to: doc.length, insert: "a\nb\nc" } }).state.doc.toString(),
    ).toBe("a\nb\nc");
  });

  it("escribir una letra no se toca", () => {
    const doc = "- 1A";
    const st = estado(doc);
    expect(
      st.update({ changes: { from: doc.length, to: doc.length, insert: "x" } }).state.doc.toString(),
    ).toBe("- 1Ax");
  });

  it("fuera de las notas de tareas, o con el interruptor apagado, no pasa nada", () => {
    const doc = "- pasar notas a la app";
    const st = estado(doc, () => false);
    const linea = st.doc.lineAt(0);
    const cambio = FORMAS["Outliner: reemplaza la línea entera"]!(linea, linea.to, continuacion(doc));
    expect(st.update({ changes: cambio }).state.doc.toString()).toBe(`${doc}\n- `);
  });
});

describe("regla A: dónde queda el cursor", () => {
  for (const forma of Object.keys(FORMAS)) {
    it(`justo después del «- [ ] » recién puesto — ${forma}`, () => {
      const doc = "\t- 1A";
      const st = estado(doc);
      const linea = st.doc.lineAt(0);
      const tr = st.update({ changes: FORMAS[forma]!(linea, linea.to, continuacion(doc)) });
      expect(tr.state.doc.toString()).toBe("\t- 1A\n\t- [ ] ");
      expect(tr.state.selection.main.head).toBe(tr.state.doc.length);
    });
  }
});

// ---------------------------------------------------------------- regla B

/** Las dos formas del mismo Backspace sobre una tarea vacía. */
function backspace(doc: string, forma: "carácter" | "unión"): string {
  const st = estado(doc);
  const linea = st.doc.lineAt(st.doc.length);
  const cambio =
    forma === "carácter"
      ? { from: linea.to - 1, to: linea.to, insert: "" }
      : { from: st.doc.line(linea.number - 1).to, to: linea.to, insert: "" };
  return st.update({ changes: cambio }).state.doc.toString();
}

describe("regla B: también con texto escrito", () => {
  const borrarEnElComienzo = (doc: string) => {
    const st = estado(doc);
    const fin = columnaDelContenido(parseBullet(doc)!);
    return st.update({ changes: { from: fin - 1, to: fin, insert: "" } }).state.doc.toString();
  };

  /**
   * Pedido en el uso, y la razón es de coherencia: si borrar el checkbox de una
   * tarea recién nacida la convierte en bullet, borrar el de una con texto
   * tendría que hacer lo mismo. Sin esto, ahí el Backspace se pone a borrar `]`,
   * ` `, `[`… de a un carácter, que no es nada.
   */
  it("Backspace al comienzo del texto deja el bullet pelado", () => {
    expect(borrarEnElComienzo("- [ ] llamar a la escuela")).toBe("- llamar a la escuela");
  });

  it("con sangría, con `[x]` y con lista numerada también", () => {
    expect(borrarEnElComienzo("\t\t- [ ] hija")).toBe("\t\t- hija");
    expect(borrarEnElComienzo("- [x] hecha")).toBe("- hecha");
    expect(borrarEnElComienzo("\t1. [ ] numerada")).toBe("\t1. numerada");
  });

  /**
   * Pero un borrado que **cruza líneas** sobre una tarea con texto es una unión,
   * y convertirla en bullet sería cambiarle el gesto al usuario. En la tarea
   * vacía sí se convierte: ahí es Outliner uniendo, y sacar el checkbox es
   * justamente lo que se quiere.
   */
  it("un borrado que viene de la línea de arriba no la convierte", () => {
    const doc = "- [ ] madre\n- [ ] hija";
    const st = estado(doc);
    const abajo = st.doc.line(2);
    const fin = abajo.from + columnaDelContenido(parseBullet(abajo.text)!);
    expect(
      st.update({ changes: { from: st.doc.line(1).to, to: fin, insert: "" } }).state.doc.toString(),
    ).toBe("- [ ] madrehija");
  });
});

describe("regla B: Backspace sobre una tarea vacía le saca el checkbox", () => {
  const casos: [string, string, string][] = [
    ["tarea vacía al ras", "- [ ] tarea\n- [ ] ", "- [ ] tarea\n- "],
    ["tarea vacía indentada", "- [ ] tarea\n\t\t- [ ] ", "- [ ] tarea\n\t\t- "],
    ["sin espacio detrás del corchete", "- [ ] tarea\n- [ ]", "- [ ] tarea\n- "],
    ["debajo de un bullet sin checkbox", "- 1A\n- [ ] ", "- 1A\n- "],
  ];
  for (const [nombre, doc, esperado] of casos) {
    for (const forma of ["carácter", "unión"] as const) {
      it(`${nombre} — ${forma}`, () => {
        expect(backspace(doc, forma)).toBe(esperado);
      });
    }
  }

  it("el cursor queda donde estaba el checkbox", () => {
    const doc = "- [ ] tarea\n\t- [ ] ";
    const st = estado(doc);
    const linea = st.doc.lineAt(st.doc.length);
    const tr = st.update({ changes: { from: linea.to - 1, to: linea.to, insert: "" } });
    expect(tr.state.doc.toString()).toBe("- [ ] tarea\n\t- ");
    expect(tr.state.selection.main.head).toBe(tr.state.doc.length);
  });

  it("el segundo Backspace ya sí une con la línea de arriba", () => {
    // La consecuencia aceptada: unir una tarea vacía cuesta dos teclas.
    const st = estado("- [ ] tarea\n- ");
    const linea = st.doc.lineAt(st.doc.length);
    const tr = st.update({ changes: { from: st.doc.line(1).to, to: linea.to, insert: "" } });
    expect(tr.state.doc.toString()).toBe("- [ ] tarea");
  });
});

describe("regla B: lo que no dispara", () => {
  it("una tarea con texto: Backspace ahí es un borrado normal", () => {
    const doc = "- [ ] tarea\n- [ ] otra";
    const st = estado(doc);
    expect(
      st.update({ changes: { from: doc.length - 1, to: doc.length, insert: "" } }).state.doc.toString(),
    ).toBe("- [ ] tarea\n- [ ] otr");
  });

  it("un bullet sin checkbox no tiene nada que sacar: la unión pasa tal cual", () => {
    expect(backspace("- 1A\n- ", "unión")).toBe("- 1A");
    expect(backspace("- 1A\n- ", "carácter")).toBe("- 1A\n-");
  });

  it("un borrado que se lleva contenido de arriba se respeta entero", () => {
    // Seleccionar medio documento y apretar Delete no puede convertirse en
    // «sacale el checkbox»: la corrección preserva la intención.
    const doc = "- [ ] tarea\n- [ ] ";
    const st = estado(doc);
    expect(st.update({ changes: { from: 3, to: doc.length, insert: "" } }).state.doc.toString()).toBe(
      "- [",
    );
  });

  it("un borrado que cruza más de una línea tampoco", () => {
    const doc = "- [ ] una\n- [ ] dos\n- [ ] ";
    const st = estado(doc);
    expect(st.update({ changes: { from: 9, to: doc.length, insert: "" } }).state.doc.toString()).toBe(
      "- [ ] una",
    );
  });

  it("reemplazar la selección por texto no es un borrado", () => {
    const doc = "- [ ] tarea\n- [ ] ";
    const st = estado(doc);
    expect(
      st.update({ changes: { from: doc.length - 4, to: doc.length, insert: "x" } }).state.doc.toString(),
    ).toBe("- [ ] tarea\n- x");
  });
});

// ------------------------------------------------------------- propiedades

/**
 * Las propiedades encuentran lo que los casos no (NOTAS §12.3). Estas dos son
 * el modelo entero del prototipo, dicho sin enumerar situaciones.
 */
describe("propiedades", () => {
  const indentes = ["", "\t", "\t\t"];
  const marcadores = ["-", "*", "+"];
  const checkboxes = ["", "[ ] ", "[x] "];

  it("desde cualquier bullet con texto, la línea nueva SIEMPRE queda «‹mismo prefijo›[ ] »", () => {
    for (const indent of indentes)
      for (const marcador of marcadores)
        for (const checkbox of checkboxes)
          for (const forma of Object.keys(FORMAS)) {
            const doc = `${indent}${marcador} ${checkbox}texto`;
            expect(enter(doc, forma), `${JSON.stringify(doc)} — ${forma}`).toBe(
              `${doc}\n${indent}${marcador} [ ] `,
            );
          }
  });

  it("la primera línea nunca cambia", () => {
    for (const indent of indentes)
      for (const marcador of marcadores)
        for (const checkbox of checkboxes)
          for (const forma of Object.keys(FORMAS)) {
            const doc = `${indent}${marcador} ${checkbox}texto`;
            expect(enter(doc, forma).split("\n")[0], `${JSON.stringify(doc)} — ${forma}`).toBe(doc);
          }
  });

  it("A y B son inversas: Enter y Backspace dejan el bullet pelado que había antes", () => {
    for (const indent of indentes)
      for (const marcador of marcadores)
        for (const forma of Object.keys(FORMAS)) {
          const doc = `${indent}${marcador} texto`;
          const conTarea = enter(doc, forma);
          expect(backspace(conTarea, "carácter")).toBe(`${doc}\n${indent}${marcador} `);
          expect(backspace(conTarea, "unión")).toBe(`${doc}\n${indent}${marcador} `);
        }
  });
});

// ------------------------------------------------- la defensa del cursor

/**
 * El defecto que encontró el caso 17 de la verificación: Outliner despacha
 * **dos** transacciones —`replaceRange` y después `setSelections`— y la segunda
 * no sabe del `[ ] ` recién agregado, así que deja el cursor cuatro caracteres
 * antes. Con `stickCursor` encendido no se veía porque Outliner después lo
 * empujaba fuera del checkbox; con `stickCursor` en «Never» el cursor queda
 * dentro del `[ ]` y Live Preview deja de dibujar el checkbox.
 */
describe("la selección que Outliner despacha después", () => {
  /** Enter con la forma de Outliner, y después su `setSelections`. */
  function enterYLuegoSeleccion(doc: string, cabeza: (fin: number) => number) {
    const st = estado(doc);
    const linea = st.doc.lineAt(0);
    const tr1 = st.update({
      changes: FORMAS["Outliner: reemplaza la línea entera"]!(linea, linea.to, continuacion(doc)),
    });
    const fin = tr1.state.doc.length;
    return tr1.state.update({ selection: { anchor: cabeza(fin) } });
  }

  it("el cursor vuelve a quedar después del «[ ] »", () => {
    const tr2 = enterYLuegoSeleccion("\t- 1A", (fin) => fin - 4);
    expect(tr2.state.doc.toString()).toBe("\t- 1A\n\t- [ ] ");
    expect(tr2.state.selection.main.head).toBe(tr2.state.doc.length);
  });

  it("si ya viene bien —que es el caso con stickCursor encendido— no toca nada", () => {
    const tr2 = enterYLuegoSeleccion("\t- 1A", (fin) => fin);
    expect(tr2.state.selection.main.head).toBe(tr2.state.doc.length);
  });

  it("una selección a cualquier otro lado se respeta", () => {
    const tr2 = enterYLuegoSeleccion("\t- 1A", () => 2);
    expect(tr2.state.selection.main.head).toBe(2);
  });

  it("un rango, no un cursor, se respeta", () => {
    const st = estado("\t- 1A");
    const linea = st.doc.lineAt(0);
    const tr1 = st.update({
      changes: FORMAS["Outliner: reemplaza la línea entera"]!(linea, linea.to, continuacion("\t- 1A")),
    });
    const fin = tr1.state.doc.length;
    const tr2 = tr1.state.update({ selection: { anchor: fin - 4, head: fin } });
    expect(tr2.state.selection.main.anchor).toBe(fin - 4);
    expect(tr2.state.selection.main.head).toBe(fin);
  });

  /**
   * La ventana dura **una** transacción. Sin esto habría que decidir a ciegas
   * si un cursor dentro del checkbox llegó por Outliner o porque el usuario
   * apretó la flecha izquierda, y adivinar mal lo deja atrapado ahí.
   */
  it("una transacción después, la flecha izquierda ya funciona normal", () => {
    const st = estado("\t- 1A");
    const linea = st.doc.lineAt(0);
    const tr1 = st.update({
      changes: FORMAS["Outliner: reemplaza la línea entera"]!(linea, linea.to, continuacion("\t- 1A")),
    });
    const fin = tr1.state.doc.length;
    // Una selección cualquiera consume la ventana…
    const tr2 = tr1.state.update({ selection: { anchor: fin } });
    // …y ahora el cursor puede meterse en el checkbox y quedarse ahí.
    const tr3 = tr2.state.update({ selection: { anchor: fin - 4 } });
    expect(tr3.state.selection.main.head).toBe(fin - 4);
  });

  it("sin una corrección previa, mover el cursor a esa columna no se toca", () => {
    const st = estado("- [ ] tarea\n\t- [ ] ");
    const fin = st.doc.length;
    expect(st.update({ selection: { anchor: fin - 4 } }).state.selection.main.head).toBe(fin - 4);
  });
});

describe("la transacción corregida sigue siendo el mismo gesto", () => {
  /**
   * CodeMirror discrimina por el subtipo del `userEvent`: `indentOnInput` solo
   * reacciona a «input.type». Aplastarlo a «input» apaga cosas del entorno sin
   * que se note en ninguna prueba de texto.
   */
  it("conserva el userEvent original", () => {
    const doc = "\t- 1A";
    const st = estado(doc);
    const linea = st.doc.lineAt(0);
    const tr = st.update({
      changes: FORMAS["Obsidian: reemplaza el carácter previo al cursor"]!(
        linea,
        linea.to,
        continuacion(doc),
      ),
      userEvent: "input.type",
    });
    expect(tr.state.doc.toString()).toBe("\t- 1A\n\t- [ ] ");
    expect(tr.isUserEvent("input.type")).toBe(true);
  });

  it("una transacción sin userEvent tampoco se inventa uno", () => {
    const doc = "\t- 1A";
    const st = estado(doc);
    const linea = st.doc.lineAt(0);
    const tr = st.update({
      changes: FORMAS["Outliner: reemplaza la línea entera"]!(linea, linea.to, continuacion(doc)),
    });
    expect(tr.state.doc.toString()).toBe("\t- 1A\n\t- [ ] ");
    expect(tr.isUserEvent("input")).toBe(false);
  });
});
