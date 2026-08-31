import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { filaDe, workbenchesDelPopover, type Favoritos } from "../src/botones.js";
import { STRINGS } from "../src/strings.js";
import { tokenRoto, tokenValido } from "./arbitrarios.js";

/**
 * Capa 1: sin DOM y sin Obsidian. Fixtures inventadas — las notas reales solo
 * se comparan en `npm run test:corpus`, que no está en el repositorio.
 */
const FAV: Favoritos = { primario: "foco", secundario: "mudanza" };
const acciones = (texto: string, f: Favoritos = FAV) =>
  filaDe(texto, f)?.botones.map((b) => b.accion) ?? null;

describe("qué líneas llevan fila", () => {
  it("una tarea, sí", () => {
    expect(acciones("- [ ] llamar")).toEqual([
      "wb-primario",
      "wb-secundario",
      "popover",
      "menu",
    ]);
    expect(acciones("\t- [x] hecha %%t:done=2026-08-30%%")).toHaveLength(4);
  });

  // Invariante 8: los `- [ ]` vacíos del corpus son separadores visuales.
  it("un `- [ ]` vacío, no", () => {
    expect(filaDe("- [ ] ", FAV)).toBeNull();
    expect(filaDe("- [ ]", FAV)).toBeNull();
    expect(filaDe("\t- [ ]   ", FAV)).toBeNull();
  });

  // Se gestiona lo que se gestiona: un bullet sin checkbox no está en el índice
  // y ninguna acción del plugin lo toca. Es el mismo criterio de `decorar.ts`.
  it("un bullet sin checkbox, un heading y el texto libre, no", () => {
    expect(filaDe("- nota de tarea", FAV)).toBeNull();
    expect(filaDe("- grupo %%t:id=a3f2%%", FAV)).toBeNull();
    expect(filaDe("## sección", FAV)).toBeNull();
    expect(filaDe("texto suelto", FAV)).toBeNull();
    expect(filaDe("", FAV)).toBeNull();
  });

  // `- [ ]texto` no es tarea para Obsidian, para Outliner ni para `linea.ts`.
  it("un checkbox sin separador, no", () => {
    expect(filaDe("- [ ]llamar", FAV)).toBeNull();
  });
});

describe("el segundo botón", () => {
  // Un botón que no puede hacer nada es peor que un botón que no está: es la
  // misma decisión que deja afuera del ⋯ lo que todavía no tiene capa 1 y 2.
  it("sin nombre, el ◐ no se dibuja", () => {
    expect(acciones("- [ ] llamar", { primario: "foco", secundario: "" })).toEqual([
      "wb-primario",
      "popover",
      "menu",
    ]);
  });

  it("sin ninguno de los dos quedan el → y el ⋯", () => {
    expect(acciones("- [ ] llamar", { primario: "", secundario: "" })).toEqual([
      "popover",
      "menu",
    ]);
  });
});

describe("el indicador persistente (§13.0)", () => {
  const activos = (texto: string) =>
    filaDe(texto, FAV)!.botones.filter((b) => b.activo).map((b) => b.workbench);

  it("relleno si la tarea está en ese workbench", () => {
    expect(activos("- [ ] llamar %%t:wb=foco%%")).toEqual(["foco"]);
    expect(activos("- [ ] llamar %%t:wb=foco,mudanza%%")).toEqual(["foco", "mudanza"]);
    expect(activos("- [ ] llamar %%t:wb=otro%%")).toEqual([]);
    expect(activos("- [ ] llamar")).toEqual([]);
  });

  it("el tooltip dice qué va a pasar, no cómo está", () => {
    const [estrella] = filaDe("- [ ] llamar %%t:wb=foco%%", FAV)!.botones;
    expect(estrella!.etiqueta).toBe(STRINGS.fila.sacarDe("foco"));
    const [otra] = filaDe("- [ ] llamar", FAV)!.botones;
    expect(otra!.etiqueta).toBe(STRINGS.fila.mandarA("foco"));
  });

  it("el → y el ⋯ nunca están activos ni apuntan a un workbench", () => {
    for (const b of filaDe("- [ ] llamar %%t:wb=foco,mudanza%%", FAV)!.botones.slice(2)) {
      expect(b.activo).toBe(false);
      expect(b.workbench).toBeNull();
    }
  });
});

describe("el token ilegible (§5.3)", () => {
  // La fila se dibuja igual, apagada: esconderla dejaría una tarea sin botones
  // y sin explicación, que es peor que el token roto.
  it("marca la fila y apaga los indicadores", () => {
    const fila = filaDe("- [ ] llamar %%t:id=A3F2%%", FAV)!;
    expect(fila.ilegible).toBe(true);
    expect(fila.botones).toHaveLength(4);
    expect(fila.botones.every((b) => !b.activo)).toBe(true);
  });

  /**
   * Salió de mirar la salida, no de un test: los cuatro botones son inertes
   * sobre una línea ilegible, así que ninguno puede prometer lo que va a hacer.
   * Un control que dice «Mandar a foco» y no manda nada es peor que uno
   * apagado.
   */
  it("ningún botón promete lo que no puede hacer", () => {
    const fila = filaDe("- [ ] llamar %%t:id=A3F2%%", FAV)!;
    for (const b of fila.botones) expect(b.etiqueta).toBe(STRINGS.fila.ilegible);
  });

  // De una línea ilegible no se leyó nada: los botones van apagados, no
  // «afuera». Decir que la tarea no está en «foco» sería afirmar algo que no
  // se sabe.
  it("un token roto que igual contiene `wb=foco` no rellena nada", () => {
    const fila = filaDe("- [ ] a %%t:wb=foco%% %%t:id=a3f2%%", FAV)!;
    expect(fila.ilegible).toBe(true);
    expect(fila.botones.every((b) => !b.activo)).toBe(true);
  });

  it("una tarea sana no está marcada", () => {
    expect(filaDe("- [ ] llamar %%t:wb=foco%%", FAV)!.ilegible).toBe(false);
    expect(filaDe("- [ ] llamar", FAV)!.ilegible).toBe(false);
  });
});

describe("los workbenches del popover", () => {
  it("los dos de ajustes van primero y siempre", () => {
    expect(workbenchesDelPopover(FAV, [])).toEqual(["foco", "mudanza"]);
    expect(workbenchesDelPopover(FAV, ["ayer", "zeta"])).toEqual([
      "foco",
      "mudanza",
      "ayer",
      "zeta",
    ]);
  });

  it("los que están en uso no se repiten y van alfabéticos", () => {
    expect(workbenchesDelPopover(FAV, ["zeta", "foco", "ayer", "zeta"])).toEqual([
      "foco",
      "mudanza",
      "ayer",
      "zeta",
    ]);
  });

  it("un favorito vacío no ocupa lugar", () => {
    expect(workbenchesDelPopover({ primario: "foco", secundario: "" }, ["ayer"])).toEqual([
      "foco",
      "ayer",
    ]);
  });
});

// ------------------------------------------------------------- propiedades

describe("propiedades", () => {
  const tarea = fc
    .tuple(fc.constantFrom("- [ ] ", "\t- [x] ", "  * [ ] "), fc.constantFrom("a", "llamar", "x y"))
    .map(([m, t]) => `${m}${t}`);

  it("toda línea de tarea tiene fila, y la fila termina en → y ⋯", () => {
    fc.assert(
      fc.property(tarea, tokenValido, (base, { token }) => {
        const fila = filaDe(token ? `${base} ${token}` : base, FAV);
        expect(fila).not.toBeNull();
        const fin = fila!.botones.slice(-2).map((b) => b.accion);
        expect(fin).toEqual(["popover", "menu"]);
      }),
    );
  });

  /**
   * La afirmación que sostiene el indicador: el ★ dice exactamente lo que dice
   * el token, ni más ni menos. Si esto se rompe, el botón miente sobre la línea
   * que tiene debajo — que es el modo de falla que la §13.0 quiere evitar.
   */
  it("el estado del ★ es el `wb` del token", () => {
    fc.assert(
      fc.property(tarea, tokenValido, (base, { meta, token }) => {
        const fila = filaDe(token ? `${base} ${token}` : base, FAV)!;
        expect(fila.ilegible).toBe(false);
        for (const b of fila.botones) {
          if (b.workbench === null) continue;
          // `meta.wb` viene del generador con sus nombres como literales; acá
          // la pregunta es sobre strings.
          expect(b.activo).toBe((meta.wb as readonly string[]).includes(b.workbench));
        }
      }),
    );
  });

  it("con el token roto nunca se afirma pertenencia", () => {
    fc.assert(
      fc.property(tarea, tokenRoto, (base, roto) => {
        const fila = filaDe(`${base} ${roto}`, FAV);
        // Algunos «rotos» del generador son en realidad texto: lo que se afirma
        // es la implicación, no que todos rompan.
        if (fila === null || !fila.ilegible) return;
        expect(fila.botones.every((b) => !b.activo)).toBe(true);
      }),
    );
  });
});
