/**
 * Generadores de documentos con las formas medidas en la §2 de la spec.
 *
 * No generan markdown cualquiera: generan **lo que hay escrito en las notas**,
 * que es lo que el parser tiene que aguantar. Tabs, los cuatro tipos de
 * heading, bullets sin checkbox como agrupadores y como notas, los `- [ ]`
 * vacíos, tablas, imágenes, texto libre, `---`, espacios al final, y notas que
 * no terminan en salto de línea.
 *
 * Nada sale del vault: los textos son inventados. El repositorio es público.
 */
import fc from "fast-check";
import type { TaskMeta } from "../src/token.js";

/** Palabras sin nada que pueda confundirse con sintaxis. */
const palabra = fc.constantFrom(
  "revisar",
  "armar",
  "mandar",
  "corregir",
  "tangram",
  "guía",
  "monografía",
  "Präsentation",
  "1A",
  "página 3",
);

export const textoLibre = fc
  .array(palabra, { minLength: 1, maxLength: 4 })
  .map((ps) => ps.join(" "));

/** Un `%%t:…%%` bien formado, con los campos en orden fijo. */
export const tokenValido = fc
  .record(
    {
      id: fc.option(fc.stringMatching(/^[a-z0-9]{4,8}$/), { nil: null }),
      wb: fc.uniqueArray(fc.constantFrom("foco", "mudanza", "semana", "cole"), {
        minLength: 0,
        maxLength: 3,
      }),
      due: fc.option(fc.constantFrom("2026-08-29", "2026-01-01"), { nil: null }),
      rec: fc.option(fc.constantFrom<"w" | "m">("w", "m"), { nil: null }),
      prioridad: fc.constantFrom<0 | 1 | 2>(0, 1, 2),
      done: fc.option(fc.constantFrom("2026-08-30"), { nil: null }),
    },
    { noNullPrototype: true },
  )
  .map((m) => {
    const campos: string[] = [];
    if (m.id !== null) campos.push(`id=${m.id}`);
    if (m.wb.length) campos.push(`wb=${m.wb.join(",")}`);
    if (m.due !== null) campos.push(`due=${m.due}`);
    if (m.rec !== null) campos.push(`rec=${m.rec}`);
    if (m.prioridad !== 0) campos.push(`p=${m.prioridad}`);
    if (m.done !== null) campos.push(`done=${m.done}`);
    return { meta: m, token: campos.length ? `%%t:${campos.join(";")}%%` : "" };
  });

/**
 * Un patch de metadatos, que puede estar vacío.
 *
 * Cada campo con **su** tipo: un patch mal tipado no puede llegar desde el
 * código, que es todo TypeScript, y generarlo probaría un contrato que no
 * existe. La primera versión de este generador producía `{ wb: 0 }` y hacía
 * fallar tres propiedades por un `TypeError` que ninguna llamada real puede
 * producir. La propiedad encontró un bug: en el generador.
 */
const CAMPOS = {
  id: fc.option(fc.stringMatching(/^[a-z0-9]{4,8}$/), { nil: null }),
  wb: fc.uniqueArray(fc.constantFrom("foco", "mudanza", "semana"), { maxLength: 3 }),
  due: fc.option(fc.constantFrom("2026-08-29", "2026-01-01"), { nil: null }),
  rec: fc.option(fc.constantFrom<"w" | "m">("w", "m"), { nil: null }),
  prioridad: fc.constantFrom<0 | 1 | 2>(0, 1, 2),
  done: fc.option(fc.constantFrom("2026-08-30"), { nil: null }),
} as const;

export const patch: fc.Arbitrary<Partial<TaskMeta>> = fc.record(CAMPOS, { requiredKeys: [] });

/** Tokens rotos de todas las formas que se pueden romper. */
export const tokenRoto = fc.constantFrom(
  "%%t:zz=1%%",
  "%%t:%%",
  "%%t:id%%",
  "%%t:id=A3F2%%",
  "%%t:id=a3%%",
  "%%t:p=0%%",
  "%%t:p=9%%",
  "%%t:due=29-08-2026%%",
  "%%t:rec=d%%",
  "%%t:wb=%%",
  "%%t:due=2026-08-29;id=a3f2%%",
  "%%t:id=a3f2;id=b4g3%%",
  "%%t:id=a3f2",
  "%%t:id=a3f2%% %%t:p=1%%",
);

const sangria = (nivel: number) => "\t".repeat(nivel);

/** Una línea de lista de un nivel dado, en cualquiera de sus cuatro papeles. */
function lineaDeLista(nivel: number): fc.Arbitrary<string> {
  return fc.oneof(
    // tarea, con y sin token
    fc
      .tuple(fc.constantFrom("[ ] ", "[x] "), textoLibre, tokenValido, fc.boolean())
      .map(([cb, t, tk, conToken]) =>
        `${sangria(nivel)}- ${cb}${t}${conToken && tk.token ? ` ${tk.token}` : ""}`,
      ),
    // bullet sin checkbox: puede ser nota, grupo o suelto según el contexto
    textoLibre.map((t) => `${sangria(nivel)}- ${t}`),
    // separador vacío (§4.4)
    fc.constantFrom(`${sangria(nivel)}- [ ]`, `${sangria(nivel)}- [ ] `),
    // una tarea con espacios al final: 20 líneas del corpus los tienen
    textoLibre.map((t) => `${sangria(nivel)}- [ ] ${t}   `),
  );
}

const heading = fc.oneof(
  fc
    .tuple(fc.integer({ min: 1, max: 6 }), textoLibre)
    .map(([n, t]) => `${"#".repeat(n)} ${t}`),
  fc
    .tuple(fc.integer({ min: 1, max: 6 }), fc.constantFrom("p_Uno", "a_Dos", "otra_nota"))
    .map(([n, d]) => `${"#".repeat(n)} [[${d}]]`),
  fc
    .tuple(fc.integer({ min: 1, max: 6 }), textoLibre, fc.constantFrom("p_Tres", "a_Cuatro"))
    .map(([n, t, d]) => `${"#".repeat(n)} ${t} ⮕ ${d}`),
);

const ruido = fc.constantFrom(
  "",
  "---",
  "| a | b |",
  "|---|---|",
  "![[imagen-inventada.png]]",
  "texto libre suelto",
  "-",
  "   ",
);

/** Un bloque: un heading, ruido, o un arbolito de hasta seis niveles. */
const bloque = fc.oneof(
  { weight: 2, arbitrary: heading.map((h) => [h]) },
  { weight: 1, arbitrary: ruido.map((r) => [r]) },
  {
    weight: 5,
    arbitrary: fc
      .array(fc.integer({ min: 0, max: 5 }), { minLength: 1, maxLength: 8 })
      .chain((niveles) => fc.tuple(...niveles.map((n) => lineaDeLista(n)))),
  },
);

/**
 * Un documento entero.
 *
 * `join("\n")` a secas, sin salto final: es la forma de cinco de las siete
 * notas reales, y la que más rompe a un parser que asuma lo contrario.
 */
export const documento: fc.Arbitrary<string> = fc
  .array(bloque, { minLength: 0, maxLength: 12 })
  .map((bs) => bs.flat().join("\n"));

/** Un documento que además puede terminar en salto, o tener CRLF. */
export const documentoRaro: fc.Arbitrary<string> = fc
  .tuple(documento, fc.constantFrom("", "\n", "\n\n"), fc.boolean())
  .map(([d, cola, crlf]) => (crlf ? d.replace(/\n/g, "\r\n") : d) + cola);
