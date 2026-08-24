import { describe, expect, it } from "vitest";
import { parseTaskToken, resolverDue, setTaskToken, stripTaskToken } from "../src/token.js";

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
    ["día del mes cero", "- [ ] x %%t:due=0%%"],
    ["día del mes fuera de rango", "- [ ] x %%t:due=32%%"],
    ["día con cero adelante", "- [ ] x %%t:due=07%%"],
    ["rec vacío", "- [ ] x %%t:rec=%%"],
    ["rec con coma: un grupo, no varios", "- [ ] x %%t:rec=lunes,martes%%"],
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

/**
 * La recurrencia como **etiqueta de grupo**, no como motor.
 *
 * El plugin no regenera ni corre fechas por su cuenta: un botón reinicia todas
 * las tareas de un grupo cuando el usuario lo aprieta. Es lo que evita que la
 * §11 choque con la §8, donde un reinicio por calendario haría que todos los
 * dispositivos reescribieran las mismas líneas en el mismo momento.
 */
describe("rec como grupo de reinicio", () => {
  it("acepta cualquier nombre, como `wb`", () => {
    for (const grupo of ["lunes", "mensual", "mudanza", "semana en el cole", "w", "m"]) {
      const a = parseTaskToken(`- [ ] x %%t:rec=${grupo}%%`);
      expect(a.estado, grupo).toBe("ok");
      if (a.estado === "ok") expect(a.meta.rec).toBe(grupo);
    }
  });

  it("se escribe y se lee igual", () => {
    const linea = setTaskToken("- [ ] regar las plantas", { rec: "lunes" });
    expect(linea).toBe("- [ ] regar las plantas %%t:rec=lunes%%");
  });

  it("convive con un workbench y un vencimiento", () => {
    const linea = setTaskToken("- [ ] pagar el alquiler", {
      wb: ["mes"],
      due: "10",
      rec: "mensual",
    });
    expect(linea).toBe("- [ ] pagar el alquiler %%t:wb=mes;due=10;rec=mensual%%");
  });
});

describe("due como día del mes", () => {
  it("acepta las dos formas", () => {
    for (const [due, valido] of [
      ["2026-09-10", true],
      ["10", true],
      ["1", true],
      ["31", true],
      ["0", false],
      ["32", false],
      ["07", false],
    ] as const) {
      const estado = parseTaskToken(`- [ ] x %%t:due=${due}%%`).estado;
      expect(estado, due).toBe(valido ? "ok" : "ilegible");
    }
  });

  it("una fecha concreta se devuelve tal cual", () => {
    expect(resolverDue("2026-09-10", "2026-12-01")).toBe("2026-09-10");
  });

  it("un día del mes se resuelve contra hoy, sin reescribir nada", () => {
    expect(resolverDue("10", "2026-09-01")).toBe("2026-09-10");
    expect(resolverDue("10", "2026-09-10")).toBe("2026-09-10"); // hoy mismo cuenta
  });

  it("si el día ya pasó, es el del mes que viene", () => {
    expect(resolverDue("10", "2026-09-11")).toBe("2026-10-10");
    expect(resolverDue("10", "2026-12-11")).toBe("2027-01-10");
  });

  it("un día que no existe en ese mes se recorta al último", () => {
    // `due=31` en febrero es el 28, no el 3 de marzo: un vencimiento que se
    // adelanta unos días es mejor que uno que se salta el mes.
    expect(resolverDue("31", "2026-02-01")).toBe("2026-02-28");
    expect(resolverDue("31", "2028-02-01")).toBe("2028-02-29"); // bisiesto
    expect(resolverDue("31", "2026-04-01")).toBe("2026-04-30");
  });

  it("sin vencimiento, no hay nada que resolver", () => {
    expect(resolverDue(null, "2026-09-01")).toBeNull();
  });
});
