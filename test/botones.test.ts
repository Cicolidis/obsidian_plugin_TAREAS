import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  claveDeFila,
  filaDe,
  opcionesDeRecurrencia,
  workbenchesDelPopover,
  type ContextoDeFila,
  type Favoritos,
} from "../src/botones.js";
import { STRINGS } from "../src/strings.js";
import { tokenRoto, tokenValido } from "./arbitrarios.js";

/**
 * Capa 1: sin DOM y sin Obsidian. Fixtures inventadas — las notas reales solo
 * se comparan en `npm run test:corpus`, que no está en el repositorio.
 */
const FAV: Favoritos = { primario: "foco", secundario: "mudanza" };
const acciones = (texto: string, f: Favoritos = FAV) =>
  filaDe(texto, { favoritos: f })?.botones.map((b) => b.accion) ?? null;

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
    expect(filaDe("- [ ] ", { favoritos: FAV })).toBeNull();
    expect(filaDe("- [ ]", { favoritos: FAV })).toBeNull();
    expect(filaDe("\t- [ ]   ", { favoritos: FAV })).toBeNull();
  });

  // Se gestiona lo que se gestiona: un bullet sin checkbox no está en el índice
  // y ninguna acción del plugin lo toca. Es el mismo criterio de `decorar.ts`.
  it("un bullet sin checkbox, un heading y el texto libre, no", () => {
    expect(filaDe("- nota de tarea", { favoritos: FAV })).toBeNull();
    expect(filaDe("- grupo %%t:id=a3f2%%", { favoritos: FAV })).toBeNull();
    expect(filaDe("## sección", { favoritos: FAV })).toBeNull();
    expect(filaDe("texto suelto", { favoritos: FAV })).toBeNull();
    expect(filaDe("", { favoritos: FAV })).toBeNull();
  });

  // `- [ ]texto` no es tarea para Obsidian, para Outliner ni para `linea.ts`.
  it("un checkbox sin separador, no", () => {
    expect(filaDe("- [ ]llamar", { favoritos: FAV })).toBeNull();
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
    filaDe(texto, { favoritos: FAV })!.botones.filter((b) => b.activo).map((b) => b.workbench);

  it("relleno si la tarea está en ese workbench", () => {
    expect(activos("- [ ] llamar %%t:wb=foco%%")).toEqual(["foco"]);
    expect(activos("- [ ] llamar %%t:wb=foco,mudanza%%")).toEqual(["foco", "mudanza"]);
    expect(activos("- [ ] llamar %%t:wb=otro%%")).toEqual([]);
    expect(activos("- [ ] llamar")).toEqual([]);
  });

  it("el tooltip dice qué va a pasar, no cómo está", () => {
    const [estrella] = filaDe("- [ ] llamar %%t:wb=foco%%", { favoritos: FAV })!.botones;
    expect(estrella!.etiqueta).toBe(STRINGS.fila.sacarDe("foco"));
    const [otra] = filaDe("- [ ] llamar", { favoritos: FAV })!.botones;
    expect(otra!.etiqueta).toBe(STRINGS.fila.mandarA("foco"));
  });

  it("el → y el ⋯ nunca están activos ni apuntan a un workbench", () => {
    for (const b of filaDe("- [ ] llamar %%t:wb=foco,mudanza%%", { favoritos: FAV })!.botones.slice(2)) {
      expect(b.activo).toBe(false);
      expect(b.workbench).toBeNull();
    }
  });
});

describe("el token ilegible (§5.3)", () => {
  // La fila se dibuja igual, apagada: esconderla dejaría una tarea sin botones
  // y sin explicación, que es peor que el token roto.
  it("marca la fila y apaga los indicadores", () => {
    const fila = filaDe("- [ ] llamar %%t:id=A3F2%%", { favoritos: FAV })!;
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
    const fila = filaDe("- [ ] llamar %%t:id=A3F2%%", { favoritos: FAV })!;
    for (const b of fila.botones) expect(b.etiqueta).toBe(STRINGS.fila.ilegible);
  });

  // De una línea ilegible no se leyó nada: los botones van apagados, no
  // «afuera». Decir que la tarea no está en «foco» sería afirmar algo que no
  // se sabe.
  it("un token roto que igual contiene `wb=foco` no rellena nada", () => {
    const fila = filaDe("- [ ] a %%t:wb=foco%% %%t:id=a3f2%%", { favoritos: FAV })!;
    expect(fila.ilegible).toBe(true);
    expect(fila.botones.every((b) => !b.activo)).toBe(true);
  });

  it("una tarea sana no está marcada", () => {
    expect(filaDe("- [ ] llamar %%t:wb=foco%%", { favoritos: FAV })!.ilegible).toBe(false);
    expect(filaDe("- [ ] llamar", { favoritos: FAV })!.ilegible).toBe(false);
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
        const fila = filaDe(token ? `${base} ${token}` : base, { favoritos: FAV });
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
        const fila = filaDe(token ? `${base} ${token}` : base, { favoritos: FAV })!;
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
        const fila = filaDe(`${base} ${roto}`, { favoritos: FAV });
        // Algunos «rotos» del generador son en realidad texto: lo que se afirma
        // es la implicación, no que todos rompan.
        if (fila === null || !fila.ilegible) return;
        expect(fila.botones.every((b) => !b.activo)).toBe(true);
      }),
    );
  });
});

describe("el 🗑 de la fila (pedido al verificar el paso 6a)", () => {
  const FAVS = { primario: "foco", secundario: "" };

  it("no está si no se pide", () => {
    expect(filaDe("- [ ] x", { favoritos: FAVS })!.botones.map((b) => b.accion)).toEqual([
      "wb-primario",
      "popover",
      "menu",
    ]);
  });

  it("va **último**, después del ⋯", () => {
    // Lo más lejos posible del ★, que es el que más se aprieta, porque es el
    // único que borra y por omisión no pregunta.
    expect(filaDe("- [ ] x", { favoritos: FAVS, conEliminar: true })!.botones.map((b) => b.accion)).toEqual([
      "wb-primario",
      "popover",
      "menu",
      "eliminar",
    ]);
  });

  it("sobre una línea ilegible se apaga como los demás", () => {
    const fila = filaDe("- [ ] x %%t:zz=1%%", { favoritos: FAVS, conEliminar: true })!;
    const eliminar = fila.botones.find((b) => b.accion === "eliminar")!;
    expect(fila.ilegible).toBe(true);
    expect(eliminar.etiqueta).toBe(fila.botones[0]!.etiqueta);
  });

  it("no apunta a ningún workbench ni se rellena nunca", () => {
    const eliminar = filaDe("- [ ] x", { favoritos: FAVS, conEliminar: true })!.botones.at(-1)!;
    expect(eliminar.workbench).toBeNull();
    expect(eliminar.activo).toBe(false);
  });
});

/**
 * Los dos indicadores del paso 6c: «tiene fecha» y «es cíclica».
 *
 * Salieron de usar el plugin, y lo que valen es que son el **único** lugar donde
 * esos dos datos se ven: el token está oculto (§5.1).
 */
describe("los indicadores de fecha y de recurrencia (paso 6c)", () => {
  const HOY = "2026-09-03";
  const con = (texto: string, extra: Partial<ContextoDeFila> = {}) =>
    filaDe(texto, {
      favoritos: { primario: "foco", secundario: "" },
      indicadores: { fecha: true, recurrencia: true },
      hoy: HOY,
      ...extra,
    })!;
  const boton = (texto: string, accion: string) =>
    con(texto).botones.find((b) => b.accion === accion)!;

  it("apagados no se dibujan, y encendidos van **últimos**", () => {
    // Últimos en el orden canónico = **primeros en el margen**, que
    // `ordenDelMargen` invierte: así el ★ no se corre de donde está, y lo que
    // queda pegado al texto sigue siendo el que más se aprieta.
    expect(
      filaDe("- [ ] x", { favoritos: { primario: "foco", secundario: "" } })!.botones.map(
        (b) => b.accion,
      ),
    ).toEqual(["wb-primario", "popover", "menu"]);
    expect(con("- [ ] x").botones.map((b) => b.accion)).toEqual([
      "wb-primario",
      "popover",
      "menu",
      "fecha",
      "recurrencia",
    ]);
  });

  it("cada uno tiene su interruptor", () => {
    const soloFecha = filaDe("- [ ] x", {
      favoritos: { primario: "foco", secundario: "" },
      indicadores: { fecha: true },
      hoy: HOY,
    })!;
    expect(soloFecha.botones.map((b) => b.accion)).toContain("fecha");
    expect(soloFecha.botones.map((b) => b.accion)).not.toContain("recurrencia");
  });

  it("**ocupan su lugar aunque estén apagados**", () => {
    // No es cosmético: si aparecieran solo en las tareas con fecha, el ★ se
    // movería al pasar de una tarea a otra, y el margen se ensancharía al
    // scrollear hasta la primera tarea con vencimiento.
    expect(con("- [ ] sin nada").botones).toHaveLength(con("- [ ] x %%t:due=2026-09-07%%").botones.length);
  });

  it("se encienden con `due` y con `rec`, cada uno con el suyo", () => {
    expect(boton("- [ ] x %%t:due=2026-09-07%%", "fecha").activo).toBe(true);
    expect(boton("- [ ] x %%t:due=2026-09-07%%", "recurrencia").activo).toBe(false);
    expect(boton("- [ ] x %%t:rec=mensual%%", "recurrencia").activo).toBe(true);
    expect(boton("- [ ] x %%t:rec=mensual%%", "fecha").activo).toBe(false);
    expect(boton("- [ ] x", "fecha").activo).toBe(false);
  });

  it("la etiqueta dice la fecha, que es lo que la nota no muestra", () => {
    expect(boton("- [ ] x %%t:due=2026-09-07%%", "fecha").etiqueta).toBe(
      STRINGS.fila.vence("2026-09-07"),
    );
    expect(boton("- [ ] x %%t:rec=mensual%%", "recurrencia").etiqueta).toBe(
      STRINGS.fila.grupo("mensual"),
    );
  });

  it("en una cíclica dice **las dos cosas**: el día guardado y contra qué cae", () => {
    // `due=10` es «el 10 del mes en curso» y se resuelve con el reloj (§11).
    // Mostrar solo uno de los dos deja la mitad de la pregunta sin contestar.
    const b = boton("- [ ] x %%t:due=10;rec=mensual%%", "fecha");
    expect(b.etiqueta).toBe(STRINGS.fila.venceElDiaResuelto("10", "2026-09-10"));
    expect(b.etiqueta).toContain("10 de cada mes");
    // La fecha resuelta va en el formato del menú —«10 sep»— y no en ISO: son
    // dos formatos del mismo dato a dos centímetros uno del otro, y eso salió
    // de mirar la salida.
    expect(b.etiqueta).toContain("10 sep");
  });

  it("el día que ya pasó se resuelve al mes que viene, como `resolverDue`", () => {
    const b = filaDe("- [ ] x %%t:due=1;rec=mensual%%", {
      favoritos: { primario: "foco", secundario: "" },
      indicadores: { fecha: true },
      hoy: "2026-09-03",
    })!.botones.find((x) => x.accion === "fecha")!;
    expect(b.etiqueta).toContain("1 oct");
  });

  it("sin `hoy` muestra solo lo guardado, en vez de inventar un mes", () => {
    const b = filaDe("- [ ] x %%t:due=10;rec=mensual%%", {
      favoritos: { primario: "foco", secundario: "" },
      indicadores: { fecha: true },
    })!.botones.find((x) => x.accion === "fecha")!;
    expect(b.etiqueta).toBe(STRINGS.fila.venceElDia("10"));
  });

  it("nunca apuntan a un workbench: no son toggles", () => {
    // Un clic abre el submenú y **no escribe**. El ★ es toggle porque asignar
    // es un clic y su inversa es el mismo clic; «tiene fecha» no tiene inversa.
    for (const a of ["fecha", "recurrencia"]) {
      expect(boton("- [ ] x %%t:due=2026-09-07;rec=mensual%%", a).workbench).toBeNull();
    }
  });

  it("sobre una línea ilegible se apagan y dicen lo mismo que los demás", () => {
    const fila = con("- [ ] x %%t:zz=1%%");
    expect(fila.ilegible).toBe(true);
    for (const b of fila.botones) expect(b.etiqueta).toBe(STRINGS.fila.ilegible);
    expect(fila.botones.find((b) => b.accion === "fecha")!.activo).toBe(false);
  });
});

/**
 * La clave de una fila: lo que decide si dos filas comparten el mismo DOM.
 *
 * Con los indicadores del 6c deja de ser una formalidad: la etiqueta lleva la
 * fecha, así que una clave que no la incluyera haría que dos tareas con fechas
 * distintas compartieran marcador y una mostrara la fecha de la otra.
 */
describe("claveDeFila", () => {
  const ctx = {
    favoritos: { primario: "foco", secundario: "" },
    indicadores: { fecha: true, recurrencia: true },
    hoy: "2026-09-03",
  };
  const clave = (texto: string) => claveDeFila(filaDe(texto, ctx)!);

  it("dos fechas distintas dan claves distintas", () => {
    expect(clave("- [ ] x %%t:due=2026-09-07%%")).not.toBe(
      clave("- [ ] x %%t:due=2026-09-08%%"),
    );
  });

  it("dos grupos distintos, también", () => {
    expect(clave("- [ ] x %%t:rec=lunes%%")).not.toBe(clave("- [ ] x %%t:rec=mensual%%"));
  });

  it("dos días del mes distintos, también", () => {
    expect(clave("- [ ] x %%t:due=10;rec=mensual%%")).not.toBe(
      clave("- [ ] x %%t:due=20;rec=mensual%%"),
    );
  });

  it("dos tareas en el mismo estado comparten clave: para eso existe la caché", () => {
    expect(clave("- [ ] una %%t:due=2026-09-07%%")).toBe(
      clave("- [ ] otra distinta %%t:due=2026-09-07%%"),
    );
  });

  it("el texto de la tarea no entra, y el token roto sí", () => {
    expect(clave("- [ ] una")).toBe(clave("- [ ] otra"));
    expect(clave("- [ ] x %%t:zz=1%%")).not.toBe(clave("- [ ] x"));
  });
});

describe("opcionesDeRecurrencia (paso 6c)", () => {
  it("los que están en uso van primero, del más usado al menos", () => {
    expect(
      opcionesDeRecurrencia(
        [
          { grupo: "mensual", tareas: 5 },
          { grupo: "lunes", tareas: 3 },
        ],
        [],
      ),
    ).toEqual(["mensual", "lunes"]);
  });

  it("los sugeridos van detrás, y no pisan a los que existen", () => {
    // El orden importa: la tecla `1` tiene que escribir un grupo que el vault
    // ya usa, no uno que el plugin propone.
    expect(
      opcionesDeRecurrencia([{ grupo: "quincenal", tareas: 2 }], ["semanal", "mensual"]),
    ).toEqual(["quincenal", "semanal", "mensual"]);
  });

  it("un sugerido que ya está en uso no se repite", () => {
    expect(opcionesDeRecurrencia([{ grupo: "mensual", tareas: 1 }], ["semanal", "mensual"])).toEqual(
      ["mensual", "semanal"],
    );
  });

  it("sin nada en uso, la semilla es todo lo que hay", () => {
    // El caso de hoy: 0 grupos en las siete notas reales, medido.
    expect(opcionesDeRecurrencia([], ["semanal", "mensual"])).toEqual(["semanal", "mensual"]);
  });

  it("sin nada de nada, la lista queda vacía y el menú solo ofrece «Grupo nuevo…»", () => {
    expect(opcionesDeRecurrencia([], [])).toEqual([]);
  });
});
