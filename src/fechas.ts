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
  | "lunes"
  | "martes"
  | "miercoles"
  | "jueves"
  | "viernes"
  | "sabado"
  | "domingo"
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
 * Los tres órdenes en que se pueden ofrecer los atajos.
 *
 * Salieron del pedido de la verificación del 6b: «no me convence la selección de
 * fechas ni el orden en que figuran. Si queremos ofrecer los siete próximos días
 * de la semana, hay que colocarlos en orden. Pero quizás es mejor ofrecer
 * opciones discontinuas: hoy, mañana, en una semana…».
 *
 * Los tres **conviven** y se eligen en ajustes, que es el patrón
 * `designFlags.ts`: cómo se lee un menú solo se juzga mirándolo. Y los tres
 * cumplen las dos reglas que la sesión 7 pagó caro:
 *
 * 1. **Ningún atajo repite el valor de otro.** Un miércoles, «Hoy · 2 sep» y
 *    «Miércoles · 2 sep» escribían exactamente lo mismo, y además rompían el
 *    tilde del menú: `setChecked(valor === actual)` marcaba los dos a la vez, o
 *    sea que la pantalla decía que la tarea tenía dos vencimientos.
 * 2. **La cantidad de ítems no cambia según el día.** Un menú cuyo largo se
 *    mueve no se puede aprender, que es la misma razón por la que el ⋯ no
 *    acomoda sus ítems según la tarea (§13.0).
 */
export const ORDENES_DE_ATAJO = ["semana", "cronologico", "discontinuo"] as const;
export type OrdenDeAtajo = (typeof ORDENES_DE_ATAJO)[number];

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
export function atajosDeFecha(hoy: string, orden: OrdenDeAtajo = "semana"): Atajo[] {
  switch (orden) {
    case "cronologico":
      return cronologico(hoy);
    case "discontinuo":
      return discontinuo(hoy);
    default:
      return porSemana(hoy);
  }
}

function porSemana(hoy: string): Atajo[] {
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

/**
 * Hoy, mañana y los cinco días siguientes, **en orden de fecha**.
 *
 * Es la mitad literal del pedido: «si queremos ofrecer los siete próximos días
 * de la semana, hay que colocarlos en orden». La diferencia con `porSemana` no
 * es cuáles son —los dos cubren una semana— sino que acá el primero es siempre
 * el más cercano, y ahí el nombre del día es una **etiqueta** y no el criterio.
 *
 * Siete ítems todos los días, y ninguno puede repetir a otro: son siete
 * desplazamientos distintos desde el mismo día.
 */
function cronologico(hoy: string): Atajo[] {
  return [
    { clave: "hoy", valor: hoy },
    { clave: "manana", valor: sumarDias(hoy, 1) },
    ...[2, 3, 4, 5, 6].map((n) => {
      const valor = sumarDias(hoy, n);
      return { clave: claveDelDia(valor), valor };
    }),
  ];
}

/**
 * Hoy, mañana, pasado, en una semana, en dos, en treinta días.
 *
 * La otra mitad del pedido: «quizás es mejor ofrecer opciones discontinuas».
 * Son **seis desplazamientos fijos**, y eso no es una lista arbitraria: al ser
 * todos distancias distintas desde el mismo día, **no pueden chocar entre sí
 * ningún día del año**, y la lista mide siempre seis.
 *
 * Por eso **«fin de mes» no está**, aunque sería el candidato obvio: un día 17
 * de un mes de 31 coincide con «en dos semanas», y ahí vuelven las dos cosas
 * que la sesión 7 encontró mirando la salida —dos ítems que escriben lo mismo,
 * y el tilde marcado en los dos— más una tercera, que el largo del menú
 * cambiaría según el día. Para el fin de mes está el selector, donde no compite
 * con nada.
 *
 * «En treinta días» y no «en un mes» porque es lo que de verdad escribe. Un
 * «en un mes» tendría que decidir qué hace el 31 de enero, y eso es una regla
 * más que aprender por un atajo que se usa poco.
 */
function discontinuo(hoy: string): Atajo[] {
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

/** El nombre del día de la semana de esa fecha, como clave de atajo. */
function claveDelDia(fecha: string): ClaveDeAtajo {
  return DIAS[diaIso(fecha) - 1]!;
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
  return sumarDias(hoy, (dia - diaIso(hoy) + 7) % 7);
}

/**
 * El día de la semana en la convención ISO: 1 lunes … 7 domingo.
 *
 * `Date.getUTCDay()` arranca en domingo, y la conversión vive **acá y en un solo
 * lugar**: es exactamente la clase de desfasaje de uno que no se ve hasta que
 * alguien reporta que «el domingo» escribió el lunes. Lo usan los tres que
 * dependen del calendario: los atajos por semana, el nombre del día en el orden
 * cronológico, y la grilla del mes.
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
