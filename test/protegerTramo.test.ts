import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { EditorState, Prec, type ChangeSpec, type Line } from "@codemirror/state";
import { checkboxAutomatico } from "../src/editor/autoCheckbox.js";
import { protegerTramo } from "../src/editor/protegerTramo.js";
import { inicioDelTramo, parsea } from "../src/hiddenTail.js";
import { columnaDelContenido, parseBullet } from "../src/linea.js";
import { documento } from "./arbitrarios.js";

const solo = (doc: string, activo: (s: EditorState) => boolean = () => true) =>
  EditorState.create({ doc, extensions: [protegerTramo(activo)] });

/**
 * Los dos filtros juntos, con las precedencias con que los registra `main.ts`.
 *
 * El orden está fijado acá y no en la memoria de nadie: `filterTransaction`
 * recorre los filtros en orden **inverso de precedencia**, así que `Prec.low`
 * hace que este corra **primero** y `autoCheckbox` reciba el Enter ya
 * renormalizado.
 */
const ambos = (doc: string) =>
  EditorState.create({
    doc,
    extensions: [Prec.low(protegerTramo(() => true)), checkboxAutomatico(() => true)],
  });

const aplicar = (st: EditorState, cambio: ChangeSpec) => st.update({ changes: cambio }).state;
const texto = (st: EditorState, cambio: ChangeSpec) => aplicar(st, cambio).doc.toString();

const TOKEN = "%%t:id=a3f2;wb=foco%%";
const OTRO = "%%t:id=b4g3%%";

// ------------------------------------------------------------- R2: partir

/**
 * Las cuatro formas del **mismo** Enter, ninguna inventada: las tres que se
 * midieron sobre este vault más la inserción pelada. La regla tiene que dar lo
 * mismo con las cuatro, porque enumerar formas es una lista siempre incompleta.
 */
const FORMAS: Record<string, (linea: Line, pos: number, prefijo: string) => ChangeSpec> = {
  "Obsidian: reemplaza el carácter previo al cursor": (linea, pos, prefijo) => ({
    from: pos - 1,
    to: pos,
    insert: `${linea.text[pos - 1 - linea.from]}\n${prefijo}`,
  }),
  "Outliner: reemplaza la línea entera": (linea, pos, prefijo) => ({
    from: linea.from,
    to: linea.to,
    insert: `${linea.text.slice(0, pos - linea.from)}\n${prefijo}${linea.text.slice(pos - linea.from)}`,
  }),
  "Outliner: desde el comienzo del contenido": (linea, pos, prefijo) => {
    const col = columnaDelContenido(parseBullet(linea.text)!);
    return {
      from: linea.from + col,
      to: linea.to,
      insert: `${linea.text.slice(col, pos - linea.from)}\n${prefijo}${linea.text.slice(pos - linea.from)}`,
    };
  },
  "sin ninguno de los dos: inserción pura del salto": (_linea, pos, prefijo) => ({
    from: pos,
    to: pos,
    insert: `\n${prefijo}`,
  }),
};

/** Enter en el final **visible** de la única línea del documento. */
function enter(st: EditorState, prefijo: string, forma: keyof typeof FORMAS): string {
  const linea = st.doc.lineAt(0);
  const pos = linea.from + inicioDelTramo(linea.text);
  return texto(st, FORMAS[forma]!(linea, pos, prefijo));
}

describe("R2 — partir: el token se queda arriba", () => {
  const doc = `- [ ] llamar a la escuela ${TOKEN}`;

  for (const forma of Object.keys(FORMAS)) {
    it(`el token no baja — ${forma}`, () => {
      expect(enter(solo(doc), "- ", forma)).toBe(`${doc}\n- `);
    });

    it(`tampoco cuando el motor ya escribe el checkbox — ${forma}`, () => {
      expect(enter(solo(doc), "- [ ] ", forma)).toBe(`${doc}\n- [ ] `);
    });
  }

  it("una tarea sin token no se toca", () => {
    const st = solo("- [ ] pelada");
    expect(texto(st, { from: st.doc.length, to: st.doc.length, insert: "\n- " })).toBe(
      "- [ ] pelada\n- ",
    );
  });

  // Cuál de las dos mitades «es» la tarea original es ambiguo, y adivinar sería
  // peor que no tocar. Lo que sí tiene que valer es que ninguna quede ilegible.
  it("cortar al medio no se corrige, y las dos mitades parsean", () => {
    const doc2 = `- [ ] comprar leche y pan ${TOKEN}`;
    const st = solo(doc2);
    const salida = texto(st, { from: 19, to: 19, insert: "\n- [ ] " });
    expect(salida).toBe(`- [ ] comprar leche\n- [ ]  y pan ${TOKEN}`);
    for (const l of salida.split("\n")) expect(parsea(l)).toBe(true);
  });

  it("Enter después del token deja el token arriba y la línea nueva vacía", () => {
    const st = solo(`- [ ] x ${TOKEN}`);
    expect(texto(st, { from: st.doc.length, to: st.doc.length, insert: "\n" })).toBe(
      `- [ ] x ${TOKEN}\n`,
    );
  });

  it("un salto en medio del token no deja media pieza suelta abajo", () => {
    const doc2 = `- [ ] x ${TOKEN}`;
    const st = solo(doc2);
    const dentro = doc2.length - 5;
    expect(texto(st, { from: dentro, to: dentro, insert: "\n" })).toBe(`- [ ] x ${TOKEN}\n`);
  });
});

// --------------------------------------------------------------- R1: unir

/**
 * Backspace desde el comienzo de la línea de abajo, tal como lo produce
 * Obsidian: verificado dentro del asar 1.13.7, `deleteBy` corre el objetivo
 * hasta el comienzo del rango atómico, o sea hasta donde empieza el tramo.
 */
function backspaceDesdeAbajo(st: EditorState, nLinea: number): string {
  const arriba = st.doc.line(nLinea);
  const abajo = st.doc.line(nLinea + 1);
  const inicio = arriba.from + inicioDelTramo(arriba.text);
  return texto(st, { from: inicio, to: abajo.from, insert: "" });
}

describe("R1 — unir: sobrevive el token de arriba", () => {
  it("con la línea de abajo vacía, el token no se pierde", () => {
    const st = solo(`- [ ] llamar ${TOKEN}\n`);
    expect(backspaceDesdeAbajo(st, 1)).toBe(`- [ ] llamar ${TOKEN}`);
  });

  it("con texto abajo, el token queda al final de la línea unida", () => {
    const st = solo(`- [ ] llamar ${TOKEN}\n- [ ] otra`);
    expect(backspaceDesdeAbajo(st, 1)).toBe(`- [ ] llamar- [ ] otra ${TOKEN}`);
  });

  // Decisión del usuario: la línea unida ocupa la posición de la de arriba, así
  // que hereda su lugar en el árbol y su token. Dos `%%t:` en una línea la
  // volverían ilegible, y una línea ilegible no se vuelve a escribir nunca.
  it("con token abajo también, gana el de arriba y el de abajo se limpia", () => {
    const st = solo(`- [ ] llamar ${TOKEN}\n- [ ] otra ${OTRO}`);
    const salida = backspaceDesdeAbajo(st, 1);
    expect(salida).toBe(`- [ ] llamar- [ ] otra ${TOKEN}`);
    expect(salida).not.toContain(OTRO);
    expect(parsea(salida)).toBe(true);
  });

  it("borrar hacia adelante desde el final visible es la misma unión", () => {
    const doc = `- [ ] llamar ${TOKEN}\n- [ ] otra`;
    const st = solo(doc);
    const inicio = inicioDelTramo(st.doc.line(1).text);
    // Delete: el rango atómico se borra entero, incluido el salto.
    expect(texto(st, { from: inicio, to: doc.indexOf("\n") + 1, insert: "" })).toBe(
      `- [ ] llamar- [ ] otra ${TOKEN}`,
    );
  });

  it("sin token arriba no hay nada que devolver", () => {
    const doc = `- [ ] pelada\n- [ ] otra ${OTRO}`;
    const st = solo(doc);
    expect(texto(st, { from: 12, to: 13, insert: "" })).toBe(`- [ ] pelada- [ ] otra ${OTRO}`);
  });
});

// ----------------------------------------------------- R3 y R4: el tramo

describe("R3 — un borrado no parte el tramo: se lo lleva entero", () => {
  it("borrar el cierre del token se lleva el token", () => {
    const doc = `- [ ] x ${TOKEN}`;
    const st = solo(doc);
    expect(texto(st, { from: doc.length - 2, to: doc.length, insert: "" })).toBe("- [ ] x");
  });

  it("borrar por el medio del token también", () => {
    const doc = `- [ ] x ${TOKEN}`;
    const st = solo(doc);
    expect(texto(st, { from: doc.length - 6, to: doc.length - 3, insert: "" })).toBe("- [ ] x");
  });

  it("un borrado que ya se lleva el tramo entero pasa tal cual", () => {
    const doc = `- [ ] x ${TOKEN}`;
    const st = solo(doc);
    const inicio = inicioDelTramo(doc);
    expect(texto(st, { from: inicio, to: doc.length, insert: "" })).toBe("- [ ] x");
  });

  it("Backspace sobre la última letra visible no toca el token", () => {
    const doc = `- [ ] xy ${TOKEN}`;
    const st = solo(doc);
    const inicio = inicioDelTramo(doc);
    expect(texto(st, { from: inicio - 1, to: inicio, insert: "" })).toBe(`- [ ] x ${TOKEN}`);
  });
});

describe("R4 — escribir adentro del tramo escribe antes del tramo", () => {
  it("una inserción en el medio del token va delante", () => {
    const doc = `- [ ] x ${TOKEN}`;
    const st = solo(doc);
    expect(texto(st, { from: doc.length - 4, to: doc.length - 4, insert: "z" })).toBe(
      `- [ ] xz ${TOKEN}`,
    );
  });

  it("una inserción después del token también", () => {
    const doc = `- [ ] x ${TOKEN}`;
    const st = solo(doc);
    expect(texto(st, { from: doc.length, to: doc.length, insert: "z" })).toBe(
      `- [ ] xz ${TOKEN}`,
    );
  });

  it("escribir en el final visible no se corrige: ya está bien", () => {
    const doc = `- [ ] x ${TOKEN}`;
    const st = solo(doc);
    const inicio = inicioDelTramo(doc);
    expect(texto(st, { from: inicio, to: inicio, insert: "z" })).toBe(`- [ ] xz ${TOKEN}`);
  });
});

// --------------------------------------------------------- el guardia §5.3

describe("una línea que no se entiende no se toca", () => {
  const ROTO = "%%t:id=A3F2%%";

  it("no se corrige nada si la línea tiene el token roto", () => {
    const doc = `- [ ] x ${ROTO}`;
    const st = solo(doc);
    expect(texto(st, { from: doc.length, to: doc.length, insert: "\n- " })).toBe(`${doc}\n- `);
  });

  // Limpiarlo «de paso», mientras se corrige otra cosa, es reparar a ciegas:
  // se lo llevaría sin que nadie lo pidiera y sin que se note.
  it("tampoco si el token roto está en la línea que se absorbe", () => {
    const st = solo(`- [ ] llamar ${TOKEN}\n- [ ] otra ${ROTO}`);
    const salida = backspaceDesdeAbajo(st, 1);
    expect(salida).toContain(ROTO);
    expect(salida).not.toContain(TOKEN);
  });
});

describe("el interruptor", () => {
  it("apagado, no corrige nada", () => {
    const doc = `- [ ] x ${TOKEN}`;
    const st = solo(doc, () => false);
    const inicio = inicioDelTramo(doc);
    expect(texto(st, { from: inicio, to: inicio, insert: "\n- " })).toBe(
      `- [ ] x\n- ${TOKEN.padStart(TOKEN.length + 1, " ")}`,
    );
  });
});

// ------------------------------------------------------------ convivencia

describe("convivencia con el checkbox automático", () => {
  const doc = `- [ ] llamar ${TOKEN}`;

  for (const forma of Object.keys(FORMAS)) {
    it(`el token se queda arriba y la línea nueva nace tarea — ${forma}`, () => {
      expect(enter(ambos(doc), "- ", forma)).toBe(`${doc}\n- [ ] `);
    });
  }

  /**
   * El orden importa y este test es el que lo fija.
   *
   * Con `autoCheckbox` primero, la primera línea resultante le llega sin el
   * token, su comparación `resultado[0].trimEnd() === linea.text.trimEnd()`
   * falla, y el checkbox automático deja de funcionar **en toda tarea que tenga
   * token**. Un mecanismo roto por el orden de registro de otro.
   */
  it("al revés, el checkbox automático se rompe (por eso va Prec.low)", () => {
    const alReves = EditorState.create({
      doc,
      extensions: [Prec.low(checkboxAutomatico(() => true)), protegerTramo(() => true)],
    });
    expect(enter(alReves, "- ", "sin ninguno de los dos: inserción pura del salto")).toBe(
      `${doc}\n- `,
    );
  });

  it("una tarea sin token sigue naciendo tarea", () => {
    const st = ambos("- [ ] pelada");
    expect(texto(st, { from: st.doc.length, to: st.doc.length, insert: "\n- " })).toBe(
      "- [ ] pelada\n- [ ] ",
    );
  });

  it("Backspace sobre una tarea vacía recién nacida le saca el checkbox", () => {
    const st = ambos(`- [ ] llamar ${TOKEN}\n- [ ] `);
    const abajo = st.doc.line(2);
    const fin = abajo.from + 6;
    expect(texto(st, { from: fin - 1, to: fin, insert: "" })).toBe(
      `- [ ] llamar ${TOKEN}\n- `,
    );
  });
});

// ------------------------------------------------------- varios cursores

describe("varios cursores", () => {
  it("dos uniones lejos una de otra se corrigen las dos", () => {
    const doc = [`- [ ] a ${TOKEN}`, "- [ ] b", "texto", `- [ ] c ${OTRO}`, "- [ ] d"].join("\n");
    const st = solo(doc);
    const i1 = st.doc.line(1).from + inicioDelTramo(st.doc.line(1).text);
    const i4 = st.doc.line(4).from + inicioDelTramo(st.doc.line(4).text);
    const salida = texto(st, [
      { from: i1, to: st.doc.line(2).from, insert: "" },
      { from: i4, to: st.doc.line(5).from, insert: "" },
    ]);
    expect(salida).toBe(
      [`- [ ] a- [ ] b ${TOKEN}`, "texto", `- [ ] c- [ ] d ${OTRO}`].join("\n"),
    );
  });

  /**
   * Medido: CodeMirror no tira con rangos superpuestos, los **fusiona**, y ahí
   * la corrección de un cursor se come la edición del otro sin que nada avise.
   * Por eso el filtro prefiere no corregir antes que corregir de más.
   */
  it("si la corrección pisaría al otro cursor, no se corrige nada", () => {
    const doc = `- [ ] a ${TOKEN}\n- [ ] b`;
    const st = solo(doc);
    const i1 = inicioDelTramo(st.doc.line(1).text);
    const segunda = st.doc.line(2).from;
    const salida = texto(st, [
      { from: i1, to: segunda, insert: "" },
      { from: segunda + 6, to: segunda + 7, insert: "X" },
    ]);
    // Sin corregir: se pierde el token, que es el daño recuperable de la §5.4.
    // Lo que no pasa es que la edición del segundo cursor desaparezca.
    expect(salida).toBe("- [ ] a- [ ] X");
  });
});

// ------------------------------------------------------------- propiedad

/**
 * La propiedad que cierra el paso.
 *
 * Si ninguna línea de partida es ilegible y el cambio no escribe ni un `%`,
 * ninguna línea del resultado puede quedar ilegible. Enter, Backspace y teclear
 * letras cumplen el antecedente; escribir `%%t:` a mano no, y ahí el token roto
 * **tiene que** verse (invariante 7).
 *
 * Es la que agarra la unión de dos líneas con token, que no inserta un solo `%`
 * y sin embargo produce una línea con dos.
 */
describe("propiedad: nada que no escriba un % puede dejar una línea ilegible", () => {
  const inserto = fc.constantFrom("", "\n", "\n- ", "\n- [ ] ", "a", "hola", "\t- [ ] x");

  it("con cambios al azar sobre documentos con tokens", () => {
    fc.assert(
      fc.property(documento, fc.nat(), fc.nat(), inserto, (raw, a, b, ins) => {
        fc.pre(raw.split("\n").every(parsea));
        const st = solo(raw);
        const largo = st.doc.length;
        const x = largo === 0 ? 0 : a % (largo + 1);
        const y = largo === 0 ? 0 : b % (largo + 1);
        const salida = aplicar(st, {
          from: Math.min(x, y),
          to: Math.max(x, y),
          insert: ins,
        }).doc.toString();
        for (const l of salida.split("\n")) expect(parsea(l)).toBe(true);
      }),
      { numRuns: 500 },
    );
  });

  it("y con los dos filtros puestos", () => {
    fc.assert(
      fc.property(documento, fc.nat(), fc.nat(), inserto, (raw, a, b, ins) => {
        fc.pre(raw.split("\n").every(parsea));
        const st = ambos(raw);
        const largo = st.doc.length;
        const x = largo === 0 ? 0 : a % (largo + 1);
        const y = largo === 0 ? 0 : b % (largo + 1);
        const salida = aplicar(st, {
          from: Math.min(x, y),
          to: Math.max(x, y),
          insert: ins,
        }).doc.toString();
        for (const l of salida.split("\n")) expect(parsea(l)).toBe(true);
      }),
      { numRuns: 500 },
    );
  });

  /**
   * Y la otra mitad: el filtro **mueve** tokens, nunca los inventa. Sin esto,
   * un `pegarTramo` que se olvidara de limpiar antes dejaría dos copias y la
   * línea sería ilegible — que la primera propiedad sí agarraría — o, peor, dos
   * tareas distintas con el mismo id, que no la agarraría ninguna.
   */
  it("ningún token aparece más veces de las que ya estaba", () => {
    fc.assert(
      fc.property(documento, fc.nat(), fc.nat(), inserto, (raw, a, b, ins) => {
        fc.pre(raw.split("\n").every(parsea));
        const st = solo(raw);
        const largo = st.doc.length;
        const x = largo === 0 ? 0 : a % (largo + 1);
        const y = largo === 0 ? 0 : b % (largo + 1);
        const salida = aplicar(st, {
          from: Math.min(x, y),
          to: Math.max(x, y),
          insert: ins,
        }).doc.toString();
        for (const [tk, veces] of contar(salida)) {
          expect(veces).toBeLessThanOrEqual(contar(raw).get(tk) ?? 0);
        }
      }),
      { numRuns: 500 },
    );
  });
});

/** Cuántas veces aparece cada token en un texto. */
function contar(texto: string): Map<string, number> {
  const cuenta = new Map<string, number>();
  for (const m of texto.matchAll(/%%t:[^%]*%%/g)) {
    cuenta.set(m[0], (cuenta.get(m[0]) ?? 0) + 1);
  }
  return cuenta;
}
