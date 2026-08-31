import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  bajar,
  CLASES_DE_ESTILO,
  claseDeHija,
  clasesDelEstilo,
  colorClass,
  subir,
} from "../src/color.js";
import { ESTILOS_DE_PRIORIDAD } from "../src/settingsData.js";
import type { Prioridad } from "../src/token.js";

const prioridad = fc.constantFrom<Prioridad>(0, 1, 2);

describe("la clase de una prioridad", () => {
  it("normal no dibuja nada: no escribe campo y no pinta línea", () => {
    expect(colorClass(0)).toBe("");
    expect(claseDeHija(0)).toBe("");
  });

  it("alta y muy alta tienen su clase, y la de la hija es otra", () => {
    expect(colorClass(1)).toBe("tareas-p1");
    expect(colorClass(2)).toBe("tareas-p2");
    expect(claseDeHija(1)).toBe("tareas-hija-p1");
    expect(claseDeHija(2)).toBe("tareas-hija-p2");
  });

  it("ninguna clase se repite entre niveles ni entre madre e hija", () => {
    const todas = [1, 2].flatMap((p) => [colorClass(p as Prioridad), claseDeHija(p as Prioridad)]);
    expect(new Set(todas).size).toBe(todas.length);
  });
});

describe("subir y bajar", () => {
  it("recorren los tres niveles", () => {
    expect(subir(0)).toBe(1);
    expect(subir(1)).toBe(2);
    expect(bajar(2)).toBe(1);
    expect(bajar(1)).toBe(0);
  });

  // Con un ciclo `2 → 0`, apretar dos veces por las dudas deja en normal la
  // tarea más urgente. Un tope no puede equivocarse en esa dirección.
  it("topan y no dan la vuelta", () => {
    expect(subir(2)).toBe(2);
    expect(bajar(0)).toBe(0);
  });

  it("bajar deshace subir salvo en el tope", () => {
    fc.assert(
      fc.property(prioridad, (p) => {
        expect(bajar(subir(p))).toBe(p === 2 ? 1 : p);
        expect(subir(bajar(p))).toBe(p === 0 ? 1 : p);
      }),
    );
  });

  it("nunca se salen del rango", () => {
    fc.assert(
      fc.property(prioridad, (p) => {
        for (const q of [subir(p), bajar(p)]) expect([0, 1, 2]).toContain(q);
      }),
    );
  });
});

describe("las clases de cada estilo", () => {
  it("cada estilo suelto enciende una sola clase", () => {
    expect(clasesDelEstilo("barra")).toEqual(["tareas-estilo-barra"]);
    expect(clasesDelEstilo("checkbox")).toEqual(["tareas-estilo-checkbox"]);
    expect(clasesDelEstilo("fondo")).toEqual(["tareas-estilo-fondo"]);
  });

  // El combinado no tiene clase propia: enciende las dos. Así la hoja de
  // estilos no necesita saber que existe y cada regla mira una sola clase.
  it("el combinado enciende las dos", () => {
    expect(clasesDelEstilo("barra-checkbox")).toEqual([
      "tareas-estilo-barra",
      "tareas-estilo-checkbox",
    ]);
  });

  it("`CLASES_DE_ESTILO` las cubre todas, sin repetir", () => {
    for (const e of ESTILOS_DE_PRIORIDAD) {
      for (const c of clasesDelEstilo(e)) expect(CLASES_DE_ESTILO).toContain(c);
    }
    expect(new Set(CLASES_DE_ESTILO).size).toBe(CLASES_DE_ESTILO.length);
  });
});

describe("las clases de body", () => {
  /**
   * `barra-completa` es la barra con otra altura, no otro dibujo: enciende la
   * misma clase base y una de más. Si algún día tuviera clase propia, la hoja
   * de estilos tendría que repetir la paleta y la posición — y eso es lo que
   * después diverge.
   */
  it("`barra-completa` se apoya en la barra", () => {
    expect(clasesDelEstilo("barra-completa")).toEqual([
      "tareas-estilo-barra",
      "tareas-estilo-barra-completa",
    ]);
  });

  it("todo estilo tiene al menos una clase, y todas están en CLASES_DE_ESTILO", () => {
    for (const e of ESTILOS_DE_PRIORIDAD) {
      const clases = clasesDelEstilo(e);
      expect(clases.length).toBeGreaterThan(0);
      for (const c of clases) expect(CLASES_DE_ESTILO).toContain(c);
    }
  });
});
