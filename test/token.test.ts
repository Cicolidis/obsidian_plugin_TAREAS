import { describe, expect, it } from "vitest";
import { parseTaskToken, setTaskToken, stripTaskToken } from "../src/token.js";

const CON_TODO = "- [ ] llamar a Flow %%t:id=a3f2;wb=foco,mudanza;due=2026-08-29;rec=w;p=2;done=2026-08-30%%";

describe("parseTaskToken", () => {
  it("lee los seis campos en orden", () => {
    const a = parseTaskToken(CON_TODO);
    expect(a.estado).toBe("ok");
    if (a.estado !== "ok") return;
    expect(a.meta).toEqual({
      id: "a3f2",
      wb: ["foco", "mudanza"],
      due: "2026-08-29",
      rec: "w",
      prioridad: 2,
      done: "2026-08-30",
    });
    expect(a.texto).toBe("- [ ] llamar a Flow ");
  });

  it("una línea sin token es una tarea sin metadatos, no un error", () => {
    const a = parseTaskToken("- [ ] una tarea común");
    expect(a.estado).toBe("sin-token");
    if (a.estado !== "sin-token") return;
    expect(a.meta.prioridad).toBe(0);
    expect(a.meta.wb).toEqual([]);
  });

  it("tolera espacios detrás del token al leer", () => {
    // Un espacio suelto no puede congelar una línea para siempre.
    const a = parseTaskToken("- [ ] x %%t:id=a3f2%%  ");
    expect(a.estado).toBe("ok");
    if (a.estado !== "ok") return;
    expect(a.token).toBe("%%t:id=a3f2%%");
  });

  it("un `%%` que no es token no molesta", () => {
    expect(parseTaskToken("- [ ] ver %%esto es un comentario%%").estado).toBe("sin-token");
  });

  /**
   * El invariante 7 vive acá: todo lo que sigue es «ilegible», y ninguna de
   * esas líneas se puede reescribir. Nunca reparar a ciegas.
   */
  it.each([
    ["campo desconocido", "- [ ] x %%t:id=a3f2;zz=1%%"],
    ["campos desordenados", "- [ ] x %%t:due=2026-08-29;id=a3f2%%"],
    ["campo repetido", "- [ ] x %%t:id=a3f2;id=b4g3%%"],
    ["id demasiado corto", "- [ ] x %%t:id=a3%%"],
    ["id demasiado largo", "- [ ] x %%t:id=abcdefghi%%"],
    ["id con mayúsculas", "- [ ] x %%t:id=A3F2%%"],
    ["fecha mal formada", "- [ ] x %%t:due=29-08-2026%%"],
    ["fecha imposible de leer", "- [ ] x %%t:due=mañana%%"],
    ["rec inválido", "- [ ] x %%t:rec=d%%"],
    ["p=0 explícito", "- [ ] x %%t:p=0%%"],
    ["p fuera de rango", "- [ ] x %%t:p=3%%"],
    ["wb vacío", "- [ ] x %%t:wb=%%"],
    ["wb repetido", "- [ ] x %%t:wb=foco,foco%%"],
    ["token vacío", "- [ ] x %%t:%%"],
    ["sin `=`", "- [ ] x %%t:id%%"],
    ["dos tokens", "- [ ] x %%t:id=a3f2%% %%t:p=1%%"],
    ["token que no está al final", "- [ ] %%t:id=a3f2%% texto después"],
    ["token sin cerrar", "- [ ] x %%t:id=a3f2"],
    ["un `%` adentro", "- [ ] x %%t:id=a3f2;wb=50%off%%"],
  ])("ilegible: %s", (_nombre, linea) => {
    expect(parseTaskToken(linea).estado).toBe("ilegible");
    // Y por lo tanto la línea no se toca (invariante 7).
    expect(setTaskToken(linea, { prioridad: 1 })).toBe(linea);
    expect(stripTaskToken(linea)).toBe(linea);
  });
});

describe("setTaskToken", () => {
  it("escribe el token al final, con los campos en orden fijo", () => {
    expect(setTaskToken("- [ ] llamar a Flow", { id: "a3f2", wb: ["foco"], prioridad: 2 })).toBe(
      "- [ ] llamar a Flow %%t:id=a3f2;wb=foco;p=2%%",
    );
  });

  it("la prioridad normal no deja rastro (§5.2)", () => {
    expect(setTaskToken("- [ ] x", { prioridad: 0 })).toBe("- [ ] x");
    expect(setTaskToken("- [ ] x %%t:p=2%%", { prioridad: 0 })).toBe("- [ ] x");
  });

  it("un patch vacío no modifica el archivo (invariante 2)", () => {
    // Incluidas las líneas con espacios al final, que son 20 en el corpus: si
    // esto se resolviera comparando al final en vez de saliendo antes, se las
    // normalizaría de paso.
    for (const l of [CON_TODO, "- [ ] x", "- [ ] con espacios   ", "\t- [ ] x %%t:id=a3f2%%  "]) {
      expect(setTaskToken(l, {}), l).toBe(l);
    }
  });

  it("es idempotente (invariante 2)", () => {
    const patch = { wb: ["foco", "semana"], due: "2026-09-01" as const };
    const una = setTaskToken("- [ ] x", patch);
    expect(setTaskToken(una, patch)).toBe(una);
  });

  it("quitar el último campo deja la línea limpia, sin `%%` huérfano", () => {
    expect(setTaskToken("- [ ] x %%t:id=a3f2%%", { id: null })).toBe("- [ ] x");
  });

  it("al escribir, recorta los espacios finales del texto", () => {
    // El token va al final real de la línea. Solo pasa cuando el usuario pidió
    // una acción sobre esa tarea.
    expect(setTaskToken("- [ ] x   ", { prioridad: 1 })).toBe("- [ ] x %%t:p=1%%");
  });

  it("no genera ids: el `id` se pone al entrar a un workbench (§5.4)", () => {
    expect(setTaskToken("- [ ] x", { wb: ["foco"] })).toBe("- [ ] x %%t:wb=foco%%");
  });

  it("lo que escribe, lo vuelve a leer igual", () => {
    const meta = {
      id: "a3f2",
      wb: ["foco", "mudanza"],
      due: "2026-08-29",
      rec: "w" as const,
      prioridad: 1 as const,
      done: "2026-08-30",
    };
    const a = parseTaskToken(setTaskToken("- [ ] x", meta));
    expect(a.estado).toBe("ok");
    if (a.estado === "ok") expect(a.meta).toEqual(meta);
  });
});

describe("stripTaskToken", () => {
  it("saca el token y el espacio que lo separaba (§12)", () => {
    expect(stripTaskToken(CON_TODO)).toBe("- [ ] llamar a Flow");
  });

  it("una línea sin token vuelve tal cual, espacios finales incluidos", () => {
    expect(stripTaskToken("- [ ] x   ")).toBe("- [ ] x   ");
  });
});
