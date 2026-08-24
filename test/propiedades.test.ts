import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  aplicarArchivado,
  bloqueParaElLog,
  planDeArchivado,
} from "../src/archivado.js";
import {
  arbolDe,
  eliminarLineas,
  insertarLineas,
  lineasDelSubarbol,
  headingsDe,
  parseDocumento,
  rangoDelSubarbol,
  recorrer,
  reemplazarLinea,
  renderDocumento,
} from "../src/documento.js";
import { aplicarReinicio, indexar, planDeReinicio } from "../src/tareas.js";
import {
  nuevoId,
  parseTaskToken,
  setTaskToken,
  stripTaskToken,
  type TaskMeta,
} from "../src/token.js";
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

describe("reinicio de un grupo cíclico", () => {
  /** Un documento con tareas de dos grupos y tareas sin etiqueta. */
  const conGrupos = fc
    .array(
      fc.tuple(
        fc.constantFrom("[ ] ", "[x] "),
        textoLibre,
        fc.constantFrom<string | null>("lunes", "mensual", null),
        fc.option(fc.constantFrom("2026-08-24"), { nil: null }),
        fc.integer({ min: 0, max: 2 }),
      ),
      { minLength: 1, maxLength: 12 },
    )
    .map((filas) =>
      filas
        .map(([cb, t, rec, done, nivel]) => {
          const meta: Partial<TaskMeta> = {};
          if (rec !== null) meta.rec = rec;
          if (done !== null && cb === "[x] ") meta.done = done;
          return setTaskToken(`${"\t".repeat(nivel)}- ${cb}${t}`, meta);
        })
        .join("\n"),
    );

  it("no toca ni un byte de las líneas que no son del grupo", () => {
    // Es la propiedad de seguridad del botón: en `tareas_MES` el registro por
    // mes son hijos sin etiqueta, y barrerlos perdería el dato de cada mes.
    fc.assert(
      fc.property(conGrupos, fc.constantFrom("lunes", "mensual", "inexistente"), (raw, grupo) => {
        const doc = parseDocumento(raw);
        const tareas = indexar(doc, "n.md");
        const plan = planDeReinicio(doc, tareas, grupo);
        const tocadas = new Set(plan.map((c) => c.linea));

        const despues = aplicarReinicio(doc, plan);
        for (const l of doc.lineas) {
          if (tocadas.has(l.n)) continue;
          expect(despues.lineas[l.n]!.texto, `línea ${l.n}`).toBe(l.texto);
        }
        // Y todo lo que sí tocó pertenece al grupo.
        for (const n of tocadas) {
          expect(tareas.find((t) => t.linea === n)!.rec).toBe(grupo);
        }
      }),
      corridas,
    );
  });

  it("después de reiniciar, ninguna del grupo queda hecha ni con done", () => {
    fc.assert(
      fc.property(conGrupos, fc.constantFrom("lunes", "mensual"), (raw, grupo) => {
        const doc = parseDocumento(raw);
        const plan = planDeReinicio(doc, indexar(doc, "n.md"), grupo);
        const despues = aplicarReinicio(doc, plan);
        for (const t of indexar(despues, "n.md")) {
          if (t.rec !== grupo) continue;
          expect(t.hecha, `línea ${t.linea}`).toBe(false);
          expect(t.done, `línea ${t.linea}`).toBeNull();
        }
      }),
      corridas,
    );
  });

  it("es idempotente: reiniciar dos veces es reiniciar una", () => {
    fc.assert(
      fc.property(conGrupos, fc.constantFrom("lunes", "mensual"), (raw, grupo) => {
        const doc = parseDocumento(raw);
        const una = aplicarReinicio(doc, planDeReinicio(doc, indexar(doc, "n.md"), grupo));
        const dos = aplicarReinicio(una, planDeReinicio(una, indexar(una, "n.md"), grupo));
        expect(renderDocumento(dos)).toBe(renderDocumento(una));
      }),
      corridas,
    );
  });

  it("conserva los workbenches y el vencimiento de cada tarea", () => {
    // Sin esto hay que rearmar el workbench cada lunes, que es exactamente la
    // fricción que la §11 quiere eliminar.
    fc.assert(
      fc.property(textoLibre, fc.constantFrom("10", "2026-09-10"), (t, due) => {
        const raw = setTaskToken(`- [x] ${t}`, {
          wb: ["foco"],
          due,
          rec: "mensual",
          done: "2026-08-09",
        });
        const doc = parseDocumento(raw);
        const despues = aplicarReinicio(doc, planDeReinicio(doc, indexar(doc, "n.md"), "mensual"));
        const tarea = indexar(despues, "n.md")[0]!;
        expect(tarea.workbenches).toEqual(["foco"]);
        expect(tarea.due).toBe(due);
        expect(tarea.rec).toBe("mensual");
      }),
      corridas,
    );
  });

  it("el invariante 9 sigue en pie después de reiniciar", () => {
    fc.assert(
      fc.property(conGrupos, fc.constantFrom("lunes", "mensual"), (raw, grupo) => {
        const doc = parseDocumento(raw);
        const texto = renderDocumento(
          aplicarReinicio(doc, planDeReinicio(doc, indexar(doc, "n.md"), grupo)),
        );
        expect(renderDocumento(parseDocumento(texto))).toBe(texto);
      }),
      corridas,
    );
  });
});

describe("invariante 6 — el archivado es idempotente", () => {
  /** Un camino de headings de uno a tres pasos. */
  const camino = fc.array(fc.constantFrom("PESTALOZZI", "ACADEMIA", "unidad 1", "unidad 2", "IB"), {
    minLength: 1,
    maxLength: 3,
  });
  const bloque = fc.array(textoLibre.map((t) => `- ${t}`), { minLength: 1, maxLength: 4 });

  it("archivar N bloques en el mismo camino no crea headings de más", () => {
    // La afirmación es que el camino se crea una vez y después se reusa, no que
    // cada texto aparezca una sola vez: un camino como `["IB", "IB"]` crea dos
    // headings legítimamente, uno anidado en el otro.
    fc.assert(
      fc.property(camino, fc.array(bloque, { minLength: 2, maxLength: 4 }), (c, bloques) => {
        let log = parseDocumento("");
        for (const b of bloques) log = aplicarArchivado(log, planDeArchivado(log, c, b));

        const uno = aplicarArchivado(parseDocumento(""), planDeArchivado(parseDocumento(""), c, bloques[0]!));
        expect(headingsDe(log).map((h) => [h.heading.nivel, h.heading.texto])).toEqual(
          headingsDe(uno).map((h) => [h.heading.nivel, h.heading.texto]),
        );
      }),
      corridas,
    );
  });

  it("y todos los bloques quedan adentro, en orden", () => {
    fc.assert(
      fc.property(camino, fc.array(bloque, { minLength: 2, maxLength: 4 }), (c, bloques) => {
        let log = parseDocumento("");
        for (const b of bloques) log = aplicarArchivado(log, planDeArchivado(log, c, b));
        // Contiguos y en orden. Se compara contra el texto sin el salto final,
        // que depende de cómo terminaba el LOG y no del archivado.
        expect(renderDocumento(log).trimEnd().endsWith(bloques.flat().join("\n"))).toBe(true);
      }),
      corridas,
    );
  });

  it("lo que escribe el archivado se vuelve a leer igual (inv. 9 sobre el LOG)", () => {
    fc.assert(
      fc.property(camino, bloque, (c, b) => {
        const texto = renderDocumento(aplicarArchivado(parseDocumento(""), planDeArchivado(parseDocumento(""), c, b)));
        expect(renderDocumento(parseDocumento(texto))).toBe(texto);
      }),
      corridas,
    );
  });

  it("el camino queda realmente anidado en el LOG resultante", () => {
    fc.assert(
      fc.property(camino, bloque, (c, b) => {
        const log = aplicarArchivado(parseDocumento(""), planDeArchivado(parseDocumento(""), c, b));
        const niveles = headingsDe(log).map((h) => h.heading.nivel);
        expect(niveles).toEqual(c.map((_, i) => i + 1));
      }),
      corridas,
    );
  });

  it("archivar nunca toca una línea que ya estaba en el LOG", () => {
    fc.assert(
      fc.property(documento, camino, bloque, (viejo, c, b) => {
        const log = parseDocumento(viejo);
        const plan = planDeArchivado(log, c, b);
        const despues = aplicarArchivado(log, plan);
        // Todo lo viejo sigue estando, en orden y sin cambios: insertar por
        // rango no reescribe nada (§8).
        const sinLoNuevo = despues.lineas
          .map((l) => l.texto)
          .filter((_, i) => i < plan.linea || i >= plan.linea + plan.lineas.length);
        expect(sinLoNuevo).toEqual(log.lineas.map((l) => l.texto));
      }),
      corridas,
    );
  });

  it("el bloque archivado no lleva checkboxes ni tokens", () => {
    fc.assert(
      fc.property(documento, fc.nat(), (raw, semilla) => {
        const doc = parseDocumento(raw);
        const tareas = recorrer(arbolDe(doc)).filter((n) => n.rol === "tarea");
        if (tareas.length === 0) return;
        const nodo = tareas[semilla % tareas.length]!;
        for (const l of bloqueParaElLog(doc, nodo, "2026-08-24")) {
          expect(l, "checkbox en el LOG").not.toMatch(/^\s*-\s+\[.\]/);
          expect(l, "token en el LOG").not.toContain("%%t:");
        }
      }),
      corridas,
    );
  });
});
