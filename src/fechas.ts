/**
 * Lo que un selector de fecha necesita saber: los atajos y la aritmética.
 *
 * Capa 1 entera: sin DOM, sin Obsidian y sin `Date.now()`. Todo recibe `hoy`
 * como `AAAA-MM-DD`, igual que `resolverDue` y `planDeCompletar`, para que los
 * tests puedan pararse en cualquier día sin tocar el reloj de la máquina.
 *
 * ## Por qué existe, y por qué no es un parser
 *
 * La §5.2 dice que `due` se escribe «desde el menú, **o al confirmar una fecha
 * detectada**». Lo segundo se midió el 02/09/2026 y se descarta: de las 24
 * líneas del corpus con una fecha en prosa, **solo 9 caen sobre una línea de
 * tarea**; de esas 9, **4 tienen forma de rango** («del N al M») y **8 no
 * llevan el año escrito**. Un parser de lenguaje natural serviría para **5 de
 * las 390 tareas**, y en casi todas tendría que inventar el año. Lo que sí sale
 * de esa medición es la forma de este módulo: las fechas que el usuario escribe
 * son **relativas** —un día de la semana o un día del mes—, así que los atajos
 * son la entrada principal y el campo de fecha es la salida.
 *
 * ## Toda la aritmética va en UTC
 *
 * Es la misma decisión que `enMes` en `token.ts`, y no es prolijidad: sumarle
 * un día a una fecha local con `setDate` da 23 o 25 horas en los dos domingos
 * del año en que cambia la hora, y ahí «mañana» cae en hoy o en pasado mañana.
 * En UTC no hay saltos. `hoy` ya viene como día calendario, así que no se
 * pierde nada.
 */
import { formaDeDue } from "./token.js";

/**
 * Qué atajo es. **No lleva el texto**: los textos de interfaz van todos juntos
 * en `strings.ts` (CLAUDE.md), y acá quedaría un módulo de capa 1 con
 * castellano adentro.
 */
export type ClaveDeAtajo =
  | "hoy"
  | "manana"
  | "lunes"
  | "martes"
  | "miercoles"
  | "jueves"
  | "viernes"
  | "sabado"
  | "domingo";

/** Un atajo del selector: qué es, y qué escribiría. */
export interface Atajo {
  clave: ClaveDeAtajo;
  /** `AAAA-MM-DD` para una tarea normal, `D`/`DD` para una cíclica. */
  valor: string;
}

/** Los siete días, de lunes a domingo, en el orden en que se muestran. */
const DIAS: readonly ClaveDeAtajo[] = [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo",
];

/**
 * Los atajos de una tarea **normal**: hoy, mañana y los siete días.
 *
 * Cada día se resuelve a su **próxima** ocurrencia, y **hoy cuenta como hoy**:
 * es la misma regla que `resolverDue` usa con el día del mes, y tenerlas
 * distintas haría que «el lunes» significara una cosa en una tarea y otra en
 * una cíclica. La ambigüedad no se resuelve con una regla: se resuelve
 * **mostrando la fecha resuelta en la etiqueta**, que es lo que hace el menú.
 *
 * El orden nunca rota —lunes a domingo, siempre— porque un menú cuyo orden
 * cambia según el día no se puede aprender, que es la misma razón por la que el
 * ⋯ no acomoda sus ítems según la tarea (§13.0).
 *
 * **Pero los dos días que «hoy» y «mañana» ya cubren no se repiten**, y eso
 * salió de mirar la salida, no de un test: un miércoles el menú mostraba «Hoy ·
 * 2 sep» y «Miércoles · 2 sep», que escriben exactamente lo mismo. Dos ítems
 * que hacen lo mismo son ruido, y además rompían el tilde del menú — `setChecked`
 * marcaba los dos a la vez, así que la pantalla decía que la tarea tenía dos
 * vencimientos. Son siempre exactamente dos los que se van, así que la lista
 * tiene siete ítems todos los días.
 */
export function atajosDeFecha(hoy: string): Atajo[] {
  const manana = sumarDias(hoy, 1);
  const cubiertos = new Set([hoy, manana]);
  return [
    { clave: "hoy" as const, valor: hoy },
    { clave: "manana" as const, valor: manana },
    ...DIAS.map((clave, i) => ({ clave, valor: proximoDiaDeSemana(hoy, i + 1) })).filter(
      (a) => !cubiertos.has(a.valor),
    ),
  ];
}

/** Qué atajo es, en una cíclica. Ver `atajosDeDiaDelMes`. */
export type ClaveDeAtajoCiclico = "mismoDiaQueHoy" | "finDeMes";

/**
 * Los atajos de una tarea **cíclica**: son días del mes, no fechas (§11).
 *
 * Son **dos y los dos se derivan**, en vez de una lista de días «típicos». Un
 * `1 · 5 · 10 · 15 · 20` sería inventado: el corpus tiene 2 tareas con «antes
 * del día N» y no dice cuáles son los días frecuentes. Para el resto está el
 * campo del modal, que es un número y se escribe en un segundo.
 *
 * «Fin de mes» es `31` y no el último día real del mes en curso, a propósito:
 * `resolverDue` recorta el día que no existe al último del mes —`due=31` en
 * febrero es el 28, y el 29 en bisiesto—, así que `31` es la única forma de
 * decir «el último» que sigue siendo verdad en todos los meses. Guardar `30`
 * en un mes de 30 días haría que en marzo cayera un día antes del final.
 */
export function atajosDeDiaDelMes(hoy: string): { clave: ClaveDeAtajoCiclico; valor: string }[] {
  return [
    { clave: "mismoDiaQueHoy", valor: diaDelMesDe(hoy) },
    { clave: "finDeMes", valor: "31" },
  ];
}

/** La fecha `n` días después. `n` puede ser negativo. */
export function sumarDias(fecha: string, n: number): string {
  return deUTC(aUTC(fecha) + n * 86_400_000);
}

/**
 * La próxima vez que caiga ese día de la semana, contando hoy.
 *
 * `dia` va en la convención ISO —1 lunes … 7 domingo— y no en la de
 * `Date.getUTCDay()`, que arranca en domingo. La conversión se hace acá y en un
 * solo lugar: es exactamente la clase de desfasaje de uno que no se ve hasta
 * que alguien reporta que «el domingo» escribió el lunes.
 */
export function proximoDiaDeSemana(hoy: string, dia: number): string {
  const jsDia = new Date(aUTC(hoy)).getUTCDay();
  const iso = jsDia === 0 ? 7 : jsDia;
  return sumarDias(hoy, (dia - iso + 7) % 7);
}

/** El día del mes de una fecha, sin cero adelante: `2026-09-05` → `"5"`. */
export function diaDelMesDe(fecha: string): string {
  return String(Number(fecha.slice(8, 10)));
}

/**
 * ¿Esta cadena es una fecha que **existe**?
 *
 * `FECHA_RE` de `token.ts` comprueba la **forma**, no el calendario: `due=2026-02-31`
 * pasa el parser y `resolverDue` lo devuelve tal cual. Es un agujero que no se
 * puede llegar desde `<input type="date">`, pero sí escribiendo el token a mano,
 * y el lugar barato de taparlo es la entrada — antes de escribir, no después.
 */
export function esFechaReal(s: string): boolean {
  if (formaDeDue(s) !== "fecha") return false;
  return deUTC(aUTC(s)) === s;
}

/** ¿Y este es un día del mes que se puede escribir? Ver `DIA_RE` en `token.ts`. */
export function esDiaDelMes(s: string): boolean {
  return formaDeDue(s) === "dia";
}

// ------------------------------------------------------------ el eje UTC

function aUTC(fecha: string): number {
  return Date.UTC(
    Number(fecha.slice(0, 4)),
    Number(fecha.slice(5, 7)) - 1,
    Number(fecha.slice(8, 10)),
  );
}

function deUTC(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}
