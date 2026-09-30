import { describe, expect, it } from "vitest";
import { rutasRepetidas } from "../src/ubicar.js";

/**
 * Dos lotes sobre el mismo archivo se calcularon por separado, así que
 * aplicarlos en fila lo corrompe, y `vault/escribir.ts` se niega a escribir.
 *
 * Hasta el 29/09/2026 esa negativa salía como `sin-archivo` con **todas** las
 * rutas del pedido, y el aviso decía «no encuentro la nota «a, b, c»» sobre
 * notas que existían. Un aviso que afirma un hecho falso sobre el mundo es la
 * misma trampa que el «congelar» de la §7. Esto fija **cuáles** son las
 * repetidas, para que el aviso nombre esas y diga lo que pasó.
 */
describe("rutasRepetidas", () => {
  it("sin repetidas, ninguna", () => {
    expect(rutasRepetidas([{ archivo: "a.md" }, { archivo: "b.md" }])).toEqual([]);
    expect(rutasRepetidas([])).toEqual([]);
  });

  it("nombra solo las repetidas, una vez cada una, en orden de aparición", () => {
    expect(
      rutasRepetidas([
        { archivo: "b.md" },
        { archivo: "a.md" },
        { archivo: "c.md" },
        { archivo: "a.md" },
        { archivo: "b.md" },
        { archivo: "a.md" },
      ]),
    ).toEqual(["b.md", "a.md"]);
  });

  it("compara en NFC: dos formas del mismo nombre son la misma nota", () => {
    const nfc = "tareas_CÍCLICAS.md".normalize("NFC");
    expect(rutasRepetidas([{ archivo: nfc }, { archivo: nfc.normalize("NFD") }])).toEqual([nfc]);
  });
});
