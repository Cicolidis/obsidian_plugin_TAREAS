import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { destinoDelClic } from "../src/editor/clicAlFinal.js";
import { inicioDelTramo } from "../src/hiddenTail.js";
import { documento } from "./arbitrarios.js";

const TOKEN = "%%t:id=a3f2;wb=foco%%";

describe("a dónde va un clic que cayó adentro del tramo", () => {
  const doc = `- [ ] llamar ${TOKEN}`;
  const fin = "- [ ] llamar".length;

  it("un clic en el vacío de la derecha vuelve al final del texto", () => {
    expect(destinoDelClic(doc, doc.length)).toBe(fin);
    expect(destinoDelClic(doc, fin + 3)).toBe(fin);
  });

  // Justo donde el tramo empieza ya está bien: es el final del texto visible.
  // Devolver algo ahí sería reemplazar un gesto por sí mismo.
  it("un clic justo en el final del texto no se toca", () => {
    expect(destinoDelClic(doc, fin)).toBe(null);
  });

  it("un clic adentro del texto no se toca", () => {
    for (const c of [0, 3, fin - 1]) expect(destinoDelClic(doc, c)).toBe(null);
  });

  it("una línea sin nada oculto no se toca nunca", () => {
    for (const l of ["- [ ] pelada", "", "## heading", `- [ ] rota %%t:id=ABCD%%`]) {
      for (const c of [0, 3, l.length]) expect(destinoDelClic(l, c)).toBe(null);
    }
  });
});

describe("propiedades", () => {
  it("el destino, cuando lo hay, es siempre donde empieza el tramo", () => {
    fc.assert(
      fc.property(documento, fc.nat(), (raw, n) => {
        for (const l of raw.split("\n")) {
          const c = l.length === 0 ? 0 : n % (l.length + 1);
          const d = destinoDelClic(l, c);
          if (d === null) continue;
          expect(d).toBe(inicioDelTramo(l));
          expect(d).toBeLessThan(c);
        }
      }),
    );
  });

  // Si no, el clic quedaría atrapado: cada uno mandaría a un lugar que a su vez
  // habría que corregir.
  it("el destino es un punto fijo: corregir dos veces da lo mismo que una", () => {
    fc.assert(
      fc.property(documento, fc.nat(), (raw, n) => {
        for (const l of raw.split("\n")) {
          const c = l.length === 0 ? 0 : n % (l.length + 1);
          const d = destinoDelClic(l, c);
          if (d === null) continue;
          expect(destinoDelClic(l, d)).toBe(null);
        }
      }),
    );
  });
});
