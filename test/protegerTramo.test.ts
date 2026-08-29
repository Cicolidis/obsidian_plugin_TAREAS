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

  /**
   * Cortar al medio: **el token se queda arriba**.
   *
   * Es la misma regla que en la unión —la línea que hereda la posición hereda
   * el token— y la razón es que el token no se ve: con el comportamiento
   * anterior, partir una tarea la sacaba del workbench sin que se notara,
   * porque la mitad que quedaba adentro era el texto nuevo y no la tarea que
   * uno reconoce. El workbench pasaba a mostrar «y pan».
   *
   * Alguna de las dos mitades queda afuera sí o sí. Que sea la nueva es la que
   * se nota en el acto, y arreglarla cuesta una tecla estando ahí.
   */
  it("cortar al medio deja el token arriba y la mitad nueva sin metadatos", () => {
    const doc2 = `- [ ] comprar leche y pan ${TOKEN}`;
    const st = solo(doc2);
    const salida = texto(st, { from: 19, to: 19, insert: "\n- [ ] " });
    expect(salida).toBe(`- [ ] comprar leche ${TOKEN}\n- [ ]  y pan`);
    for (const l of salida.split("\n")) expect(parsea(l)).toBe(true);
  });

  /**
   * Y el límite: si la mitad de arriba queda **sin texto**, el token baja.
   *
   * Es apretar Enter con el cursor al comienzo del texto, para abrir una línea
   * arriba. Sin este límite el token quedaría en una tarea vacía, que sería la
   * dueña del workbench.
   */
  it("si la mitad de arriba queda vacía, el token baja con el texto", () => {
    const doc2 = `- [ ] comprar leche ${TOKEN}`;
    const st = solo(doc2);
    const salida = texto(st, { from: 6, to: 6, insert: "\n- [ ] " });
    expect(salida).toBe(`- [ ] \n- [ ] comprar leche ${TOKEN}`);
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

/**
 * Las cinco formas de la **misma** unión.
 *
 * Igual que con Enter, ninguna es inventada. Y esta tabla es la que faltaba: la
 * verificación de la sesión 4 encontró que con Outliner instalado unir dos
 * líneas **no borra el salto, reemplaza las dos líneas por una**, y ahí la
 * regla de unir —que preguntaba si el borrado empezaba después del tramo— no
 * reconocía el gesto. El token quedaba en el medio de la línea unida, visible,
 * y con los dos tokens si las dos tareas tenían.
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

describe("unir: el token de arriba queda entero, al final y único", () => {
  for (const [nombre, forma] of Object.entries(UNIONES)) {
    it(`con token abajo también — ${nombre}`, () => {
      const st = solo(`- [ ] arriba ${TOKEN}\n- [ ] abajo ${OTRO}`);
      const salida = texto(st, forma(st));
      expect(parsea(salida)).toBe(true);
      expect(salida.match(/%%t:/g)).toHaveLength(1);
      expect(salida).toContain(TOKEN);
      expect(salida).not.toContain(OTRO);
      expect(salida.endsWith(TOKEN)).toBe(true);
    });

    it(`sin token abajo — ${nombre}`, () => {
      const st = solo(`- [ ] arriba ${TOKEN}\n- [ ] abajo`);
      const salida = texto(st, forma(st));
      expect(parsea(salida)).toBe(true);
      expect(salida.endsWith(TOKEN)).toBe(true);
    });
  }
});

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

describe("cambios adentro del tramo", () => {
  /**
   * Un cambio que deja el token **entero y al final** pasa tal cual, aunque
   * caiga adentro del token.
   *
   * No es indulgencia: es cómo llegan las escrituras del propio plugin. Cuando
   * `vault.process` escribe en el disco, Obsidian mete el cambio en el editor
   * abierto como un diff, y el diff de `…;wb=foco%%` → `…;wb=foco;p=1%%` es una
   * inserción adentro del token. La primera versión del filtro la confundía con
   * alguien tecleando y la sacaba afuera: la prioridad no se escribía nunca y
   * quedaba «;p=1» como texto a la vista. Es la falla F de la sesión 4.
   *
   * El cursor no puede llegar ahí —el rango atómico no lo deja— así que el
   * único tránsito real por este camino son las escrituras del plugin y lo que
   * llega por Sync.
   */
  it("el diff con que el plugin escribe la prioridad pasa intacto", () => {
    const antes = `- [ ] llamar ${TOKEN}`;
    const st = solo(antes);
    const cierre = antes.lastIndexOf("%%");
    expect(texto(st, { from: cierre, to: cierre, insert: ";p=1" })).toBe(
      "- [ ] llamar %%t:id=a3f2;wb=foco;p=1%%",
    );
  });

  it("y también un cambio que reemplaza parte del token", () => {
    const antes = `- [ ] llamar ${TOKEN}`;
    const st = solo(antes);
    const desde = antes.indexOf("foco");
    expect(texto(st, { from: desde, to: desde + 4, insert: "mudanza" })).toBe(
      "- [ ] llamar %%t:id=a3f2;wb=mudanza%%",
    );
  });

  it("un cambio que dejaría el token partido no se aplica: el tramo es atómico", () => {
    const doc = `- [ ] x ${TOKEN}`;
    const st = solo(doc);
    // Borrar el cierre dejaría `%%t:id=a3f2;wb=foco` y la línea sería ilegible
    // para siempre. Como el cursor no puede pararse ahí, el gesto no existe: no
    // hacer nada es más seguro que destruir metadatos.
    expect(texto(st, { from: doc.length - 2, to: doc.length, insert: "" })).toBe(doc);
  });

  it("un cambio que deja texto DESPUÉS del token lo devuelve al final", () => {
    const doc = `- [ ] x ${TOKEN}`;
    const st = solo(doc);
    expect(texto(st, { from: doc.length, to: doc.length, insert: "z" })).toBe(
      `- [ ] xz ${TOKEN}`,
    );
  });

  it("borrar el tramo entero a propósito sí se lo lleva", () => {
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

  // La falla B6 de la sesión 4: el espacio caía adentro del tramo y desaparecía.
  // Se apretaba la barra y no pasaba nada.
  it("escribir un espacio al final del texto visible se ve", () => {
    const doc = `- [ ] llamar ${TOKEN}`;
    const st = solo(doc);
    const inicio = inicioDelTramo(doc);
    const salida = texto(st, { from: inicio, to: inicio, insert: " " });
    expect(salida).toBe(`- [ ] llamar  ${TOKEN}`);
    expect(salida.slice(0, inicioDelTramo(salida))).toBe("- [ ] llamar ");
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

// ------------------------------------------- lo que NO tiene que tocar

describe("cambios que dejan todo bien pasan intactos", () => {
  /**
   * Es la mitad que la primera versión no tenía, y de donde salieron sus tres
   * fallas: un filtro que corrige por la forma del gesto toca cosas que estaban
   * bien. Estos casos son todos reales y ninguno necesita arreglo.
   */
  it("des-indentar un bloque entero no cambia ni un byte", () => {
    const antes = [
      "\t- [ ] madre %%t:id=a3f2%%",
      "\t\t- [ ] hija %%t:id=b4g3%%",
      "\t\t- [ ] otra",
    ].join("\n");
    const st = solo(antes);
    // Outliner des-indenta reemplazando el bloque entero por su versión con un
    // tab menos. Todas las líneas resultantes están bien, así que no hay nada
    // que corregir — y corregir acá borraría el token de la hija.
    const bloque = antes.split("\n").map((l) => l.slice(1)).join("\n");
    expect(texto(st, { from: 0, to: st.doc.length, insert: bloque })).toBe(bloque);
  });

  it("escribir el token entero de cero pasa intacto", () => {
    const antes = "- [ ] llamar a la escuela";
    const st = solo(antes);
    expect(texto(st, { from: antes.length, to: antes.length, insert: ` ${TOKEN}` })).toBe(
      `${antes} ${TOKEN}`,
    );
  });

  it("teclear en el medio del texto de una tarea con token", () => {
    const doc = `- [ ] llamar ${TOKEN}`;
    const st = solo(doc);
    expect(texto(st, { from: 8, to: 8, insert: "X" })).toBe(`- [ ] llXamar ${TOKEN}`);
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
   * Y la otra mitad: el filtro **mueve** tokens, nunca los duplica. Sin esto,
   * un `pegarTramo` que se olvidara de limpiar antes dejaría dos copias, y dos
   * tareas distintas con el mismo id son la misma para el workbench, que es
   * peor que un error.
   *
   * **La primera versión de esta propiedad no decía la verdad.** Exigía que
   * ningún token apareciera más veces que antes, y eso prohíbe también
   * *modificarlo*: borrar un carácter adentro de `id=0a00000a` deja
   * `id=a00000a`, que es un token nuevo con una aparición y cero antes. La
   * propiedad fallaba con razón sobre un caso que tiene que estar permitido —es
   * cómo llegan las escrituras del propio plugin— y afirmaba algo más fuerte
   * que la verdad. Lo que importa es que nada quede **repetido**.
   */
  it("ningún token queda repetido si no lo estaba", () => {
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
        const antes = contar(raw);
        for (const [tk, veces] of contar(salida)) {
          if (veces > 1) expect(veces).toBeLessThanOrEqual(antes.get(tk) ?? 0);
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
