import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  arbolDe,
  eliminarLineas,
  insertarLineas,
  lineasDelSubarbol,
  parseDocumento,
  rangoDelSubarbol,
  recorrer,
  reemplazarLinea,
  renderDocumento,
} from "../src/documento.js";
import { indexar } from "../src/tareas.js";
import { nuevoId, parseTaskToken, setTaskToken, stripTaskToken } from "../src/token.js";
import { documento, documentoRaro, patch, textoLibre, tokenRoto, tokenValido } from "./arbitrarios.js";

/**
 * Los invariantes de la §18 escritos como propiedades.
 *
 * La diferencia con un caso no es de estilo: un caso comprueba el ejemplo que
 * a alguien se le ocurrió, y una propiedad comprueba el que no. Los generadores
 * de `arbitrarios.ts` producen las formas medidas en la §2 —tabs, los cuatro
 * tipos de heading, agrupadores, notas, separadores vacíos, tablas, imágenes,
 * espacios al final, sin salto final, CRLF—, así que lo que encuentran es lo
 * que se va a encontrar en el vault.
 */

/** Corridas por propiedad. Alto a propósito: son microsegundos cada una. */
const corridas = { numRuns: 500 };

describe("invariante 2 — setTaskToken es idempotente y estable", () => {
  it("con un patch vacío no modifica la línea, nunca", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          textoLibre.map((t) => `- [ ] ${t}`),
          fc.tuple(textoLibre, tokenValido).map(([t, tk]) => `- [ ] ${t} ${tk.token}`),
          fc.tuple(textoLibre, tokenRoto).map(([t, tk]) => `- [ ] ${t} ${tk}`),
          textoLibre.map((t) => `- [ ] ${t}   `),
          fc.string(),
        ),
        (linea) => {
          expect(setTaskToken(linea, {})).toBe(linea);
        },
      ),
      corridas,
    );
  });

  it("aplicarla dos veces da lo mismo que una", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          textoLibre.map((t) => `- [ ] ${t}`),
          fc.tuple(textoLibre, tokenValido).map(([t, tk]) => `- [ ] ${t} ${tk.token}`),
          textoLibre.map((t) => `- [ ] ${t}   `),
        ),
        patch,
        (linea, p) => {
          const una = setTaskToken(linea, p);
          expect(setTaskToken(una, p)).toBe(una);
        },
      ),
      corridas,
    );
  });

  it("lo que escribe lo vuelve a leer igual", () => {
    fc.assert(
      fc.property(textoLibre, tokenValido, (t, tk) => {
        const linea = setTaskToken(`- [ ] ${t}`, tk.meta);
        const a = parseTaskToken(linea);
        expect(a.estado).toBe("ok");
        if (a.estado === "ok") expect(a.meta).toEqual(tk.meta);
      }),
      corridas,
    );
  });
});

describe("invariante 3 — reescribir una tarea no toca sus bullets sin checkbox", () => {
  it("cambiar una línea deja las demás byte por byte", () => {
    fc.assert(
      fc.property(documento, patch, fc.nat(), (raw, p, semilla) => {
        const doc = parseDocumento(raw);
        const tareas = doc.lineas.filter((l) => l.clase === "tarea");
        if (tareas.length === 0) return;
        const objetivo = tareas[semilla % tareas.length]!;

        const nueva = setTaskToken(objetivo.texto, p);
        const despues = reemplazarLinea(doc, objetivo.n, nueva);

        for (const l of doc.lineas) {
          if (l.n === objetivo.n) continue;
          expect(despues.lineas[l.n]!.texto, `línea ${l.n}`).toBe(l.texto);
        }
      }),
      corridas,
    );
  });

  it("las notas de una tarea sobreviven a que la tarea se reescriba", () => {
    fc.assert(
      fc.property(documento, patch, fc.nat(), (raw, p, semilla) => {
        const doc = parseDocumento(raw);
        const antes = indexar(doc, "n.md");
        const conNotas = antes.filter((t) => t.notas.length > 0);
        if (conNotas.length === 0) return;
        const objetivo = conNotas[semilla % conNotas.length]!;

        const linea = doc.lineas[objetivo.linea]!.texto;
        const despues = indexar(
          reemplazarLinea(doc, objetivo.linea, setTaskToken(linea, p)),
          "n.md",
        );
        const misma = despues.find((t) => t.linea === objetivo.linea)!;
        expect(misma.notas).toEqual(objetivo.notas);
      }),
      corridas,
    );
  });
});

describe("invariante 7 — un token que no parsea deja la línea intacta", () => {
  it("ni setTaskToken ni stripTaskToken la tocan", () => {
    fc.assert(
      fc.property(textoLibre, tokenRoto, patch, (t, roto, p) => {
        const linea = `- [ ] ${t} ${roto}`;
        expect(parseTaskToken(linea).estado).toBe("ilegible");
        expect(setTaskToken(linea, p)).toBe(linea);
        expect(stripTaskToken(linea)).toBe(linea);
      }),
      corridas,
    );
  });

  it("y la tarea igual aparece en el índice, sin metadatos", () => {
    fc.assert(
      fc.property(textoLibre, tokenRoto, (t, roto) => {
        const tareas = indexar(parseDocumento(`- [ ] ${t} ${roto}`), "n.md");
        expect(tareas).toHaveLength(1);
        expect(tareas[0]!.id).toBeNull();
        expect(tareas[0]!.workbenches).toEqual([]);
        expect(tareas[0]!.prioridad).toBe(0);
      }),
      corridas,
    );
  });
});

describe("invariante 8 — un `- [ ]` vacío nunca aparece como tarea", () => {
  it("a cualquier profundidad y en cualquier contexto", () => {
    fc.assert(
      fc.property(documento, (raw) => {
        for (const t of indexar(parseDocumento(raw), "n.md")) {
          expect(t.texto, `línea ${t.linea}`).not.toBe("");
        }
      }),
      corridas,
    );
  });

  it("tampoco se cuela como nota de otra tarea", () => {
    fc.assert(
      fc.property(documento, (raw) => {
        for (const t of indexar(parseDocumento(raw), "n.md")) {
          for (const n of t.notas) expect(n.trim()).not.toBe("");
        }
      }),
      corridas,
    );
  });

  it("un separador con hijos no se convierte en su padre", () => {
    fc.assert(
      fc.property(textoLibre, (t) => {
        const tareas = indexar(parseDocumento(`- [ ]\n\t- [ ] ${t}`), "n.md");
        expect(tareas).toHaveLength(1);
        expect(tareas[0]!.padre).toBeNull();
      }),
      corridas,
    );
  });
});

describe("invariante 9 — parsear y volver a escribir no altera un byte", () => {
  it("para cualquier documento con las formas del corpus", () => {
    fc.assert(
      fc.property(documentoRaro, (raw) => {
        expect(renderDocumento(parseDocumento(raw))).toBe(raw);
      }),
      corridas,
    );
  });

  it("para cualquier string, incluso uno que no sea markdown", () => {
    fc.assert(
      fc.property(fc.string(), (raw) => {
        expect(renderDocumento(parseDocumento(raw))).toBe(raw);
      }),
      corridas,
    );
  });

  it("y reemplazar una línea por sí misma tampoco lo altera", () => {
    fc.assert(
      fc.property(documento, fc.nat(), (raw, semilla) => {
        const doc = parseDocumento(raw);
        const n = semilla % doc.lineas.length;
        expect(renderDocumento(reemplazarLinea(doc, n, doc.lineas[n]!.texto))).toBe(raw);
      }),
      corridas,
    );
  });
});

describe("primitivas de escritura por rango (§8)", () => {
  it("insertar y volver a borrar deja el archivo idéntico, siempre", () => {
    fc.assert(
      fc.property(
        documento,
        fc.nat(),
        fc.array(fc.constantFrom("- [ ] nueva", "\t- nota", "", "## corte"), {
          minLength: 1,
          maxLength: 4,
        }),
        (raw, semilla, textos) => {
          const doc = parseDocumento(raw);
          const n = semilla % (doc.lineas.length + 1);
          const con = insertarLineas(doc, n, textos);
          expect(renderDocumento(eliminarLineas(con, n, n + textos.length - 1))).toBe(raw);
        },
      ),
      corridas,
    );
  });

  it("después de insertar o borrar, el invariante 9 sigue en pie", () => {
    fc.assert(
      fc.property(documento, fc.nat(), (raw, semilla) => {
        const doc = parseDocumento(raw);
        const n = semilla % (doc.lineas.length + 1);
        const con = renderDocumento(insertarLineas(doc, n, ["- [ ] nueva"]));
        expect(renderDocumento(parseDocumento(con))).toBe(con);
        if (doc.lineas.length === 0) return;
        const m = semilla % doc.lineas.length;
        const sin = renderDocumento(eliminarLineas(doc, m, m));
        expect(renderDocumento(parseDocumento(sin))).toBe(sin);
      }),
      corridas,
    );
  });

  it("borrar un subárbol no toca ni un byte de lo que está afuera", () => {
    // Es el invariante 3 llevado al descarte físico de la §12: se va el
    // subárbol entero y nada más que el subárbol.
    fc.assert(
      fc.property(documento, fc.nat(), (raw, semilla) => {
        const doc = parseDocumento(raw);
        const nodos = recorrer(arbolDe(doc));
        if (nodos.length === 0) return;
        const objetivo = nodos[semilla % nodos.length]!;
        const { desde, hasta } = rangoDelSubarbol(objetivo);

        const afuera = doc.lineas.filter((l) => l.n < desde || l.n > hasta).map((l) => l.texto);
        const despues = eliminarLineas(doc, desde, hasta);
        expect(despues.lineas.map((l) => l.texto)).toEqual(afuera);
      }),
      corridas,
    );
  });

  it("los subárboles de las raíces particionan el documento sin solaparse", () => {
    fc.assert(
      fc.property(documento, (raw) => {
        const rangos = arbolDe(parseDocumento(raw))
          .map(rangoDelSubarbol)
          .sort((a, b) => a.desde - b.desde);
        for (let i = 1; i < rangos.length; i++) {
          expect(rangos[i]!.desde).toBeGreaterThan(rangos[i - 1]!.hasta);
        }
      }),
      corridas,
    );
  });

  it("las líneas de un subárbol son un tramo contiguo del documento", () => {
    fc.assert(
      fc.property(documento, fc.nat(), (raw, semilla) => {
        const doc = parseDocumento(raw);
        const nodos = recorrer(arbolDe(doc));
        if (nodos.length === 0) return;
        const objetivo = nodos[semilla % nodos.length]!;
        const { desde, hasta } = rangoDelSubarbol(objetivo);
        expect(lineasDelSubarbol(doc, objetivo)).toEqual(
          doc.lineas.slice(desde, hasta + 1).map((l) => l.texto),
        );
      }),
      corridas,
    );
  });
});

describe("nuevoId nunca choca (§5.4)", () => {
  it("con cualquier conjunto de ids ya escritos", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.stringMatching(/^[a-z0-9]{4,8}$/), { maxLength: 200 }),
        (existentes) => {
          const set = new Set(existentes);
          const id = nuevoId(set);
          expect(set.has(id)).toBe(false);
          expect(id).toMatch(/^[a-z0-9]{4,8}$/);
        },
      ),
      corridas,
    );
  });
});
