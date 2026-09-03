import { afterAll, describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  atajosDeDiaDelMes,
  atajosDeFecha,
  diaDelMesDe,
  esDiaDelMes,
  esFechaReal,
  proximoDiaDeSemana,
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
      expect(proximoDiaDeSemana("2026-03-08", 1)).toBe("2026-03-09");
    });
  }
});

describe("proximoDiaDeSemana", () => {
  // 2026-09-02 es miércoles. Se comprueba contra `getUTCDay` más abajo, para
  // no depender de que yo haya mirado bien el calendario.
  const miercoles = "2026-09-02";

  it("hoy cuenta como hoy, igual que resolverDue con el día del mes", () => {
    expect(proximoDiaDeSemana(miercoles, 3)).toBe(miercoles);
  });

  it("el día que ya pasó esta semana cae en la que viene", () => {
    expect(proximoDiaDeSemana(miercoles, 1)).toBe("2026-09-07"); // lunes
    expect(proximoDiaDeSemana(miercoles, 2)).toBe("2026-09-08"); // martes
  });

  it("el día que falta cae en esta semana", () => {
    expect(proximoDiaDeSemana(miercoles, 4)).toBe("2026-09-03"); // jueves
    expect(proximoDiaDeSemana(miercoles, 7)).toBe("2026-09-06"); // domingo
  });

  it("siempre cae en el día pedido, y nunca a más de 6 días", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("2020-01-01"), max: new Date("2040-12-31"), noInvalidDate: true }),
        fc.integer({ min: 1, max: 7 }),
        (fecha, dia) => {
          const hoy = fecha.toISOString().slice(0, 10);
          const caida = proximoDiaDeSemana(hoy, dia);
          const jsDia = new Date(`${caida}T00:00:00Z`).getUTCDay();
          expect(jsDia === 0 ? 7 : jsDia).toBe(dia);
          const dias = (Date.parse(`${caida}T00:00:00Z`) - Date.parse(`${hoy}T00:00:00Z`)) / 86_400_000;
          expect(dias).toBeGreaterThanOrEqual(0);
          expect(dias).toBeLessThanOrEqual(6);
        },
      ),
    );
  });
});

describe("los atajos", () => {
  it("son hoy, mañana y los días que esos dos no cubren, en orden fijo", () => {
    // 2026-09-02 es miércoles, así que se van «miércoles» (= hoy) y «jueves»
    // (= mañana). El orden de los que quedan no rota.
    const a = atajosDeFecha("2026-09-02");
    expect(a.map((x) => x.clave)).toEqual([
      "hoy",
      "manana",
      "lunes",
      "martes",
      "viernes",
      "sabado",
      "domingo",
    ]);
    expect(a[0]!.valor).toBe("2026-09-02");
    expect(a[1]!.valor).toBe("2026-09-03");
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

  it("son siete todos los días: hoy y mañana tapan exactamente dos", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("2020-01-01"), max: new Date("2040-12-31"), noInvalidDate: true }),
        (fecha) => {
          expect(atajosDeFecha(fecha.toISOString().slice(0, 10))).toHaveLength(7);
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
