import { afterAll, describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  atajosDeDiaDelMes,
  atajosDeFecha,
  diaDelMesDe,
  diasDelMes,
  esDiaDelMes,
  esFechaReal,
  grillaDelMes,
  mesVecino,
  sumarDias,
} from "../src/fechas.js";
import { formaDeDue, resolverDue } from "../src/token.js";

describe("sumarDias", () => {
  it("cruza el mes y el año", () => {
    expect(sumarDias("2026-08-31", 1)).toBe("2026-09-01");
    expect(sumarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(sumarDias("2027-01-01", -1)).toBe("2026-12-31");
  });

  it("cuenta bien febrero, con bisiesto y sin él", () => {
    expect(sumarDias("2026-02-28", 1)).toBe("2026-03-01");
    expect(sumarDias("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("sumar cero no mueve nada", () => {
    expect(sumarDias("2026-09-02", 0)).toBe("2026-09-02");
  });
});

/**
 * El único test de este archivo que necesita tocar el entorno.
 *
 * La aritmética va en UTC (ver la cabecera de `fechas.ts`), y lo que eso
 * compra solo se ve desde una zona horaria con horario de verano y desfasaje
 * negativo: ahí `new Date("2026-03-08")` es medianoche **UTC**, que en Nueva
 * York es todavía el 7, y una implementación con `getDate()` local devolvería
 * un día menos. `process.env.TZ` cambia en caliente en Node, así que esto se
 * puede probar de verdad en vez de dejarlo escrito en un comentario.
 *
 * **Comprobado que el instrumento mide lo que dice**, revirtiendo el módulo a
 * una implementación ingenua —`new Date(fecha)` y getters locales— y corriendo
 * este archivo: fallan las dos zonas de desfasaje **negativo**, y también tres
 * casos de `sumarDias`. `Pacific/Kiritimati` (UTC+14) **pasa igual**, porque un
 * desfasaje positivo no corre la fecha hacia atrás: va como control de que la
 * cuenta tampoco se rompe del otro lado, no como el caso que discrimina.
 */
describe("la zona horaria no mueve un día", () => {
  const original = process.env.TZ;
  afterAll(() => {
    process.env.TZ = original;
  });

  for (const tz of ["America/New_York", "America/Argentina/Buenos_Aires", "Pacific/Kiritimati"]) {
    it(`en ${tz}`, () => {
      process.env.TZ = tz;
      // El domingo del cambio de hora en Estados Unidos, y el de Europa.
      expect(sumarDias("2026-03-08", 1)).toBe("2026-03-09");
      expect(sumarDias("2026-10-25", 1)).toBe("2026-10-26");
    });
  }
});

describe("los atajos", () => {
  it("son seis desplazamientos fijos: hoy, mañana, pasado, 7, 14 y 30 días", () => {
    expect(atajosDeFecha("2026-09-03")).toEqual([
      { clave: "hoy", valor: "2026-09-03" },
      { clave: "manana", valor: "2026-09-04" },
      { clave: "pasadoManana", valor: "2026-09-05" },
      { clave: "enUnaSemana", valor: "2026-09-10" },
      { clave: "enDosSemanas", valor: "2026-09-17" },
      { clave: "enTreintaDias", valor: "2026-10-03" },
    ]);
  });

  it("nunca hay dos atajos con la misma fecha", () => {
    // Salió de **mirar la salida**, no de un test: un miércoles el menú decía
    // «Hoy · 2 sep» y «Miércoles · 2 sep». Además de ser ruido, rompía el
    // tilde: `setChecked(valor === actual)` marcaba los dos a la vez y la
    // pantalla decía que la tarea tenía dos vencimientos.
    fc.assert(
      fc.property(
        fc.date({ min: new Date("2020-01-01"), max: new Date("2040-12-31"), noInvalidDate: true }),
        (fecha) => {
          const a = atajosDeFecha(fecha.toISOString().slice(0, 10));
          expect(new Set(a.map((x) => x.valor)).size).toBe(a.length);
        },
      ),
    );
  });

  it("son seis todos los días", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("2020-01-01"), max: new Date("2040-12-31"), noInvalidDate: true }),
        (fecha) => {
          expect(atajosDeFecha(fecha.toISOString().slice(0, 10))).toHaveLength(6);
        },
      ),
    );
  });

  it("todos escriben una fecha absoluta, que es lo que va en una tarea normal", () => {
    for (const { clave, valor } of atajosDeFecha("2026-09-02")) {
      expect(formaDeDue(valor), clave).toBe("fecha");
      expect(esFechaReal(valor), clave).toBe(true);
    }
  });

  it("los de una cíclica escriben un día del mes, no una fecha", () => {
    for (const { clave, valor } of atajosDeDiaDelMes("2026-09-05")) {
      expect(formaDeDue(valor), clave).toBe("dia");
    }
    expect(atajosDeDiaDelMes("2026-09-05")[0]!.valor).toBe("5");
  });

  it("«fin de mes» es 31 porque resolverDue lo recorta al último real", () => {
    // Guardar el último día del mes en curso haría que en un mes más largo
    // cayera antes del final. `31` es lo único que sigue siendo verdad siempre.
    const finDeMes = atajosDeDiaDelMes("2026-02-10")[1]!.valor;
    expect(finDeMes).toBe("31");
    expect(resolverDue(finDeMes, "2026-02-01")).toBe("2026-02-28");
    expect(resolverDue(finDeMes, "2028-02-01")).toBe("2028-02-29");
    expect(resolverDue(finDeMes, "2026-04-01")).toBe("2026-04-30");
  });
});

describe("esFechaReal", () => {
  it("acepta una fecha que existe", () => {
    expect(esFechaReal("2026-09-02")).toBe(true);
    expect(esFechaReal("2028-02-29")).toBe(true);
  });

  it("rechaza la que no existe, aunque tenga la forma correcta", () => {
    // `FECHA_RE` de `token.ts` mira la forma y no el calendario: `due=2026-02-31`
    // pasa el parser y `resolverDue` lo devuelve tal cual.
    expect(formaDeDue("2026-02-31")).toBe("fecha");
    expect(esFechaReal("2026-02-31")).toBe(false);
    expect(esFechaReal("2026-13-01")).toBe(false);
    expect(esFechaReal("2027-02-29")).toBe(false); // no bisiesto
  });

  it("rechaza lo que no es una fecha", () => {
    expect(esFechaReal("")).toBe(false);
    expect(esFechaReal("10")).toBe(false);
    expect(esFechaReal("2026-9-2")).toBe(false);
  });
});

describe("esDiaDelMes y diaDelMesDe", () => {
  it("el día del mes va sin cero adelante", () => {
    expect(diaDelMesDe("2026-09-05")).toBe("5");
    expect(diaDelMesDe("2026-09-10")).toBe("10");
    expect(diaDelMesDe("2026-09-30")).toBe("30");
  });

  it("lo que devuelve diaDelMesDe es siempre un día escribible", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("2020-01-01"), max: new Date("2040-12-31"), noInvalidDate: true }),
        (fecha) => {
          expect(esDiaDelMes(diaDelMesDe(fecha.toISOString().slice(0, 10)))).toBe(true);
        },
      ),
    );
  });

  it("distingue las dos formas", () => {
    expect(esDiaDelMes("10")).toBe(true);
    expect(esDiaDelMes("0")).toBe(false);
    expect(esDiaDelMes("32")).toBe(false);
    expect(esDiaDelMes("2026-09-10")).toBe(false);
  });
});

// ----------------------------------------------------- los atajos (6c)

/**
 * Las dos reglas de los atajos, y las dos son un bug pagado. En el 6c valían
 * para tres órdenes; el 30/09/2026 quedó uno solo, el discontinuo.
 *
 * 1. **Ningún atajo repite el valor de otro.** Un miércoles, la primera versión
 *    del menú mostraba «Hoy · 2 sep» y «Miércoles · 2 sep», que escriben lo
 *    mismo; y `setChecked(valor === actual)` marcaba los dos, o sea que la
 *    pantalla decía que la tarea tenía dos vencimientos. Apareció **mirando la
 *    salida**, no con un test: ahora es un test.
 * 2. **La cantidad no cambia según el día.** Un menú cuyo largo se mueve no se
 *    puede aprender (§13.0).
 *
 * Se comprueban sobre **400 días consecutivos**, que cubre todos los días de la
 * semana, los doce meses, los dos bordes de año y un 29 de febrero.
 */
describe("los atajos, sobre 400 días seguidos", () => {
  const dias = Array.from({ length: 400 }, (_, i) => sumarDias("2027-11-20", i));

  it("ningún atajo escribe lo mismo que otro", () => {
    for (const hoy of dias) {
      const valores = atajosDeFecha(hoy).map((a) => a.valor);
      expect(new Set(valores).size, `el ${hoy}: ${valores.join(" ")}`).toBe(valores.length);
    }
  });

  it("la lista mide siempre lo mismo", () => {
    expect(new Set(dias.map((hoy) => atajosDeFecha(hoy).length)).size).toBe(1);
  });

  it("ningún atajo cae en el pasado", () => {
    for (const hoy of dias) {
      for (const a of atajosDeFecha(hoy)) expect(a.valor >= hoy).toBe(true);
    }
  });

  it("todos escriben una fecha que existe", () => {
    for (const hoy of dias.slice(0, 40)) {
      for (const a of atajosDeFecha(hoy)) expect(esFechaReal(a.valor)).toBe(true);
    }
  });
});

// ------------------------------------------------- la grilla del mes (6c)

describe("grillaDelMes", () => {
  it("son seis semanas de siete, siempre", () => {
    for (const ancla of ["2026-01-15", "2026-02-01", "2026-08-31", "2028-02-29"]) {
      const g = grillaDelMes(ancla);
      expect(g.semanas).toHaveLength(6);
      for (const s of g.semanas) expect(s).toHaveLength(7);
    }
  });

  it("empieza en lunes", () => {
    // Septiembre de 2026 arranca un martes: la primera celda es un hueco.
    const g = grillaDelMes("2026-09-15");
    expect(g.semanas[0]![0]).toBeNull();
    expect(g.semanas[0]![1]).toBe("2026-09-01");
  });

  it("cada día del mes aparece exactamente una vez, y ninguno de otro mes", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2020, max: 2040 }),
        fc.integer({ min: 1, max: 12 }),
        (anio, mes) => {
          const p = String(mes).padStart(2, "0");
          const g = grillaDelMes(`${anio}-${p}-01`);
          const celdas = g.semanas.flat().filter((c): c is string => c !== null);
          const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
          expect(celdas).toHaveLength(ultimo);
          expect(new Set(celdas).size).toBe(ultimo);
          for (const c of celdas) expect(c.slice(0, 7)).toBe(`${anio}-${p}`);
        },
      ),
    );
  });

  it("los huecos están solo en los bordes", () => {
    const celdas = grillaDelMes("2026-09-15").semanas.flat();
    const primera = celdas.findIndex((c) => c !== null);
    const ultima = celdas.length - 1 - [...celdas].reverse().findIndex((c) => c !== null);
    for (let i = primera; i <= ultima; i++) expect(celdas[i]).not.toBeNull();
  });

  it("mesVecino cruza el año y no arrastra el día", () => {
    expect(mesVecino("2026-12-31", 1)).toBe("2027-01-01");
    expect(mesVecino("2026-01-31", -1)).toBe("2025-12-01");
    // El 31 de enero no se convierte en un 31 de febrero que no existe: se
    // devuelve el primero, porque la grilla solo mira el año y el mes.
    expect(mesVecino("2026-01-31", 1)).toBe("2026-02-01");
  });

  it("ir y volver un mes deja la grilla en el mismo mes", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2020, max: 2040 }),
        fc.integer({ min: 1, max: 12 }),
        (anio, mes) => {
          const ancla = `${anio}-${String(mes).padStart(2, "0")}-01`;
          expect(mesVecino(mesVecino(ancla, 1), -1)).toBe(ancla);
        },
      ),
    );
  });

  it("diasDelMes son los 31, todos escribibles", () => {
    const d = diasDelMes();
    expect(d).toHaveLength(31);
    for (const x of d) expect(esDiaDelMes(x)).toBe(true);
  });
});

/**
 * Y la zona horaria tampoco mueve la grilla ni los órdenes nuevos.
 *
 * Es el mismo caso que `sumarDias`: `grillaDelMes` pregunta qué día de la semana
 * cae el primero, y `diaIso` sale de `getUTCDay`. Con una implementación local,
 * en Nueva York el primero de marzo caería en la celda de al lado.
 */
describe("la zona horaria no mueve la grilla", () => {
  const original = process.env.TZ;
  afterAll(() => {
    process.env.TZ = original;
  });

  for (const tz of ["America/New_York", "America/Argentina/Buenos_Aires", "Pacific/Kiritimati"]) {
    it(`en ${tz}`, () => {
      process.env.TZ = tz;
      expect(grillaDelMes("2026-03-15").semanas[0]).toEqual([
        null,
        null,
        null,
        null,
        null,
        null,
        "2026-03-01",
      ]);
      expect(atajosDeFecha("2026-03-08").map((a) => a.valor)).toEqual([
        "2026-03-08",
        "2026-03-09",
        "2026-03-10",
        "2026-03-15",
        "2026-03-22",
        "2026-04-07",
      ]);
      expect(mesVecino("2026-03-08", 1)).toBe("2026-04-01");
    });
  }
});
