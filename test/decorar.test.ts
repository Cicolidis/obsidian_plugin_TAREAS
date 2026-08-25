import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { marcasDe, type Marca } from "../src/decorar.js";
import { parseDocumento } from "../src/documento.js";
import { inicioDelTramo } from "../src/hiddenTail.js";
import { parseTaskToken } from "../src/token.js";
import { documento } from "./arbitrarios.js";

const marcas = (raw: string) => marcasDe(parseDocumento(raw));
const de = <T extends Marca["tipo"]>(raw: string, tipo: T) =>
  marcas(raw).filter((m) => m.tipo === tipo);

describe("el token oculto", () => {
  it("una tarea con token bien formado se oculta desde el fin del texto", () => {
    const doc = "- [ ] llamar %%t:id=a3f2%%";
    expect(de(doc, "oculto")).toEqual([
      { tipo: "oculto", linea: 0, desde: "- [ ] llamar".length },
    ]);
  });

  // Invariante 7: la única forma de arreglar un token roto es verlo.
  it("un token roto no se oculta", () => {
    expect(de("- [ ] llamar %%t:id=A3F2%%", "oculto")).toEqual([]);
    expect(de("- [ ] llamar %%t:id=a3f2", "oculto")).toEqual([]);
    expect(de("- [ ] a %%t:id=a3f2%% %%t:p=1%%", "oculto")).toEqual([]);
  });

  // Un token en una línea sin checkbox no está en el índice: ninguna vista lo
  // muestra y ninguna acción lo toca. Ocultarlo lo volvería un fantasma.
  it("un token fuera de una tarea no se oculta", () => {
    expect(de("- nota de tarea %%t:id=a3f2%%", "oculto")).toEqual([]);
    expect(de("## heading %%t:id=a3f2%%", "oculto")).toEqual([]);
    expect(de("texto libre %%t:id=a3f2%%", "oculto")).toEqual([]);
    // Un `- [ ]` vacío no es tarea (invariante 8), aunque el token le dé texto.
    expect(de("- [ ] %%t:id=a3f2%%", "oculto")).toHaveLength(1);
  });

  it("una tarea sin token no produce marca", () => {
    expect(de("- [ ] pelada", "oculto")).toEqual([]);
  });
});

describe("la prioridad", () => {
  it("la línea de la tarea lleva su propio nivel", () => {
    expect(de("- [ ] urgente %%t:p=2%%", "prioridad")).toEqual([
      { tipo: "prioridad", linea: 0, nivel: 2 },
    ]);
  });

  it("normal no dibuja nada", () => {
    expect(marcas("- [ ] normal %%t:id=a3f2%%").filter((m) => m.tipo !== "oculto")).toEqual([]);
  });

  it("el subárbol lleva filete, la madre lleva color", () => {
    const doc = ["- [ ] madre %%t:p=1%%", "\t- [ ] hija", "\t- nota de la hija", "- [ ] otra"].join(
      "\n",
    );
    expect(marcas(doc).filter((m) => m.tipo !== "oculto")).toEqual([
      { tipo: "prioridad", linea: 0, nivel: 1 },
      { tipo: "hija", linea: 1, nivel: 1 },
      { tipo: "hija", linea: 2, nivel: 1 },
    ]);
  });

  // El 90% de los árboles del corpus tienen blancos adentro: un filete con
  // agujeros se lee como tres bloques en vez de uno.
  it("las líneas en blanco de adentro del subárbol también llevan filete", () => {
    const doc = ["- [ ] madre %%t:p=2%%", "\t- [ ] una", "", "\t- [ ] otra", "", "- [ ] ajena"].join(
      "\n",
    );
    expect(de(doc, "hija").map((m) => m.linea)).toEqual([1, 2, 3]);
  });

  it("una hija con prioridad propia pisa la heredada en su propio subárbol", () => {
    const doc = [
      "- [ ] madre %%t:p=1%%",
      "\t- [ ] hija %%t:p=2%%",
      "\t\t- [ ] nieta",
      "\t- [ ] otra hija",
    ].join("\n");
    expect(marcas(doc).filter((m) => m.tipo !== "oculto")).toEqual([
      { tipo: "prioridad", linea: 0, nivel: 1 },
      { tipo: "prioridad", linea: 1, nivel: 2 },
      { tipo: "hija", linea: 2, nivel: 2 },
      { tipo: "hija", linea: 3, nivel: 1 },
    ]);
  });

  it("un token ilegible no tiene prioridad que dibujar", () => {
    expect(marcas("- [ ] rota %%t:p=1;id=A3F2%%").filter((m) => m.tipo !== "oculto")).toEqual([]);
  });
});

describe("propiedades", () => {
  it("ninguna marca cae fuera del documento", () => {
    fc.assert(
      fc.property(documento, (raw) => {
        const doc = parseDocumento(raw);
        for (const m of marcasDe(doc)) {
          expect(m.linea).toBeGreaterThanOrEqual(0);
          expect(m.linea).toBeLessThan(doc.lineas.length);
          if (m.tipo === "oculto") {
            const texto = doc.lineas[m.linea]!.texto;
            expect(m.desde).toBeGreaterThanOrEqual(0);
            expect(m.desde).toBeLessThan(texto.length);
          }
        }
      }),
    );
  });

  // Es la garantía que la decoración necesita para poder reemplazar el rango
  // sin mirar nada más: donde hay marca hay token, y donde hay token hay marca.
  it("hay marca de oculto exactamente donde el token parsea en una tarea", () => {
    fc.assert(
      fc.property(documento, (raw) => {
        const doc = parseDocumento(raw);
        const conMarca = new Set(
          marcasDe(doc).filter((m) => m.tipo === "oculto").map((m) => m.linea),
        );
        for (const l of doc.lineas) {
          const deberia =
            l.clase === "tarea" &&
            parseTaskToken(l.texto).estado === "ok" &&
            inicioDelTramo(l.texto) < l.texto.length;
          expect(conMarca.has(l.n)).toBe(deberia);
        }
      }),
    );
  });

  it("ninguna línea recibe dos marcas de color a la vez", () => {
    fc.assert(
      fc.property(documento, (raw) => {
        const color = marcasDe(parseDocumento(raw)).filter((m) => m.tipo !== "oculto");
        expect(new Set(color.map((m) => m.linea)).size).toBe(color.length);
      }),
    );
  });

  it("las marcas salen en orden de línea", () => {
    fc.assert(
      fc.property(documento, (raw) => {
        const ns = marcasDe(parseDocumento(raw)).map((m) => m.linea);
        expect(ns).toEqual([...ns].sort((a, b) => a - b));
      }),
    );
  });
});
