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
  | "pasadoManana"
  | "enUnaSemana"
  | "enDosSemanas"
  | "enTreintaDias";

/** Un atajo del selector: qué es, y qué escribiría. */
export interface Atajo {
  clave: ClaveDeAtajo;
  /** `AAAA-MM-DD` para una tarea normal, `D`/`DD` para una cíclica. */
  valor: string;
}

/**
 * Los atajos de una tarea **normal**: hoy, mañana, pasado, en una semana, en
 * dos, en treinta días.
 *
 * Salieron del pedido de la verificación del 6b: «no me convence la selección de
 * fechas ni el orden en que figuran […] quizás es mejor ofrecer opciones
 * discontinuas: hoy, mañana, en una semana…». En el 6c convivieron tres órdenes
 * —los siete días de lunes a domingo, los siete en orden de fecha, y este— y el
 * 30/09/2026 el usuario eligió este. Los otros dos se borraron.
 *
 * Son **seis desplazamientos fijos**, y eso cumple de una las dos reglas que la
 * sesión 7 pagó caro, sin ningún filtro:
 *
 * 1. **Ningún atajo repite el valor de otro.** Un miércoles, «Hoy · 2 sep» y
 *    «Miércoles · 2 sep» escribían exactamente lo mismo, y además rompían el
 *    tilde del menú: `setChecked(valor === actual)` marcaba los dos a la vez.
 *    Seis distancias distintas desde el mismo día no pueden chocar nunca.
 * 2. **La cantidad de ítems no cambia según el día.** Un menú cuyo largo se
 *    mueve no se puede aprender, que es la misma razón por la que el ⋯ no
 *    acomoda sus ítems según la tarea (§13.0).
 *
 * Por eso **«fin de mes» no está**, aunque sería el candidato obvio: un día 17
 * de un mes de 31 coincide con «en dos semanas», y ahí vuelven las dos cosas.
 * Para el fin de mes está la grilla, donde no compite con nada.
 *
 * «En treinta días» y no «en un mes» porque es lo que de verdad escribe. Un
 * «en un mes» tendría que decidir qué hace el 31 de enero, y eso es una regla
 * más que aprender por un atajo que se usa poco.
 */
export function atajosDeFecha(hoy: string): Atajo[] {
  return (
    [
      ["hoy", 0],
      ["manana", 1],
      ["pasadoManana", 2],
      ["enUnaSemana", 7],
      ["enDosSemanas", 14],
      ["enTreintaDias", 30],
    ] as const
  ).map(([clave, n]) => ({ clave, valor: sumarDias(hoy, n) }));
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
 * El día de la semana en la convención ISO: 1 lunes … 7 domingo.
 *
 * `Date.getUTCDay()` arranca en domingo, y la conversión vive **acá y en un solo
 * lugar**: es exactamente la clase de desfasaje de uno que no se ve hasta que
 * alguien reporta que «el domingo» escribió el lunes. Lo usa la grilla del mes,
 * que arranca en lunes.
 */
export function diaIso(fecha: string): number {
  const jsDia = new Date(aUTC(fecha)).getUTCDay();
  return jsDia === 0 ? 7 : jsDia;
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

// ------------------------------------------------------- la grilla del mes

/** Un mes dibujado: seis filas de siete, lunes primero. */
export interface GrillaDelMes {
  anio: number;
  /** 1 a 12. */
  mes: number;
  /** `AAAA-MM-DD` en cada celda del mes, `null` en los huecos de los bordes. */
  semanas: (string | null)[][];
}

/**
 * El mes al que pertenece esta fecha, listo para dibujar.
 *
 * Capa 1: devuelve fechas, no DOM. El calendario del selector solo pinta lo que
 * sale de acá, así que «qué día cae en qué celda» se prueba sin abrir Obsidian —
 * que es donde de verdad se cometen los errores de un día.
 *
 * **Lunes primero**, como el resto del plugin: los atajos van de lunes a domingo
 * y `diaIso` ya usa esa convención. Dos calendarios con semanas que empiezan
 * distinto adentro de la misma aplicación es un error de lectura garantizado.
 *
 * **Seis filas siempre**, aunque el mes entre en cinco: si la grilla cambiara de
 * alto, el modal saltaría al pasar de mes y los botones se moverían debajo del
 * mouse. Es lo mismo que la fila de botones resolvió no sacando nada del flujo.
 */
export function grillaDelMes(ancla: string): GrillaDelMes {
  const anio = Number(ancla.slice(0, 4));
  const mes = Number(ancla.slice(5, 7));
  const p = (n: number) => String(n).padStart(2, "0");

  const hueco = diaIso(`${anio}-${p(mes)}-01`) - 1;
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();

  const celdas: (string | null)[] = [
    ...Array<null>(hueco).fill(null),
    ...Array.from({ length: ultimo }, (_, i) => `${anio}-${p(mes)}-${p(i + 1)}`),
  ];
  while (celdas.length < 42) celdas.push(null);

  const semanas: (string | null)[][] = [];
  for (let i = 0; i < 42; i += 7) semanas.push(celdas.slice(i, i + 7));
  return { anio, mes, semanas };
}

/**
 * El primero del mes `n` meses más allá. `n` puede ser negativo.
 *
 * Devuelve el **día 1** y no «el mismo día del otro mes» a propósito: quien lo
 * usa es la navegación de la grilla, que solo mira el año y el mes. Conservar el
 * día obligaría a repetir acá la regla de recorte del día que no existe —«31 en
 * febrero es el 28»— que ya vive en `resolverDue`, y una regla escrita dos veces
 * diverge justo cuando alguien cambia una de las dos.
 */
export function mesVecino(ancla: string, n: number): string {
  const anio = Number(ancla.slice(0, 4));
  const mes = Number(ancla.slice(5, 7)) - 1 + n;
  const d = new Date(Date.UTC(anio, mes, 1));
  return deUTC(d.getTime());
}

/** Los días del mes que una tarea cíclica puede tener: 1 a 31 (§11). */
export function diasDelMes(): string[] {
  return Array.from({ length: 31 }, (_, i) => String(i + 1));
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
