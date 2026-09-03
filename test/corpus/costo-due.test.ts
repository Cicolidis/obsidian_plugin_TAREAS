import { describe, expect, it } from "vitest";
import { parseDocumento } from "../../src/documento.js";
import { indexar } from "../../src/tareas.js";
import { resolverDue } from "../../src/token.js";
import { notasReales, VAULT } from "./vault.js";

/**
 * Cuánto cuesta `resolverDue`, **por tarea y por dibujo**.
 *
 * La pregunta que contesta: la pestaña Agenda (§13.3) ordena por vencimiento y
 * la de Buscar filtra por él, así que las dos van a llamar a esto **por tarea
 * en cada dibujo**. Con 390 tareas eso son 390 llamadas por cuadro, y un
 * número que nadie miró es un número que se descubre cuando la lista se traba.
 *
 * `resolverDue` es una función del reloj y no del archivo —ese es el punto de
 * guardar el día del mes y no la fecha (§11)—, así que **no se puede cachear
 * por contenido**: al cambiar el mes, el mismo `due=10` da otra cosa. Si el
 * costo fuera alto no habría una salida barata, y por eso se mide antes.
 *
 * ## El peor caso es «todas cíclicas», y hay que forzarlo
 *
 * Una fecha absoluta sale por la primera línea de la función; un día del mes
 * construye un `Date` para saber cuántos días tiene el mes. Medir el corpus
 * como está mediría el camino corto, porque hoy **no hay ni un `due` escrito**
 * (contado el 02/09/2026: 0 en las siete notas). Las dos columnas de abajo
 * separan «como está» de «saturada», igual que `costo-fila.test.ts`.
 *
 * ## Calentamiento descartado, y muestras suficientes
 *
 * Es la corrección que costó una vez: la primera versión del test de costo de
 * la fila informaba 0,711 ms para la primera nota y 0,02 para las siguientes, y
 * eso era el JIT, no la nota. Con dos muestras «la mediana» no significa nada.
 *
 * ## Cómo se lee la columna de µs por tarea, y cómo no
 *
 * **Con pocas tareas el número está dominado por el reloj, no por la función.**
 * Leído en la salida: `tareas_CLAUDE` (5 tareas) informa 0,57 µs por tarea y
 * `tareas_COLE` (292) informa 0,22 — y no es que la nota chica sea más cara por
 * tarea, es que a esa escala lo que se mide son las dos llamadas a
 * `performance.now()`. **El único número que significa algo es el de la nota
 * grande**, y el que decide es la mediana de la columna «saturada»: 0,065 ms
 * para 292 tareas, o sea el 10% de lo que cuesta decorar la nota entera y el
 * 0,4% de un cuadro. La misma advertencia vale para el p90, que a estas
 * magnitudes es ruido de recolección de basura.
 */
const PASADAS = 50;
const CALENTAMIENTO = 10;

/**
 * El techo. No es el cuadro entero: es lo que ya se acepta por transacción.
 *
 * Decorar la nota entera cuesta 0,65 ms y construir la fila entre 0,1 y 0,2
 * (medidos). Si resolver los vencimientos de una nota entera costara más que
 * decorarla, sería lo más caro que hace el plugin por dibujo, y eso habría que
 * mirarlo antes de que se note.
 */
const TECHO_MS = 0.65;

/** Medido el 02/09/2026: 400 tareas todas cíclicas, mediana 0,054 ms. */
const MEDIDO_MS = 0.054;

const HOY = "2026-09-02";

describe.skipIf(!VAULT)("costo de resolverDue, por nota y por dibujo", () => {
  for (const { rel, raw } of notasReales()) {
    it(`${rel}`, () => {
      const tareas = indexar(parseDocumento(raw), rel);
      if (tareas.length === 0) return; // el LOG y CÍCLICAS no tienen tareas

      // El peor caso: **todas** cíclicas, con el día del mes, que es el camino
      // que construye un `Date`. El corpus de hoy tiene 0 `due` escritos.
      const comoEsta = tareas.map((t) => t.due);
      const saturada = tareas.map((_, i) => String(1 + (i % 31)));

      for (const [nombre, dues] of [
        ["como está", comoEsta],
        ["saturada ", saturada],
      ] as const) {
        const ms: number[] = [];
        for (let pasada = 0; pasada < CALENTAMIENTO + PASADAS; pasada++) {
          const t0 = performance.now();
          let resueltos = 0;
          for (const d of dues) if (resolverDue(d, HOY) !== null) resueltos++;
          const t = performance.now() - t0;
          if (pasada >= CALENTAMIENTO) ms.push(t);
          // Que el bucle sirva para algo: sin esto un motor puede borrarlo.
          expect(resueltos).toBeGreaterThanOrEqual(0);
        }

        ms.sort((a, b) => a - b);
        const mediana = ms[Math.floor(ms.length / 2)]!;
        const p90 = ms[Math.floor(ms.length * 0.9)] ?? mediana;
        console.log(
          `  ${nombre} ${String(tareas.length).padStart(3)} tareas · ` +
            `${ms.length} muestras → mediana ${mediana.toFixed(4)} ms · ` +
            `p90 ${p90.toFixed(4)} ms · ` +
            `${((mediana / tareas.length) * 1000).toFixed(3)} µs por tarea ` +
            `(medido el 02/09/2026 con 400 cíclicas: ${MEDIDO_MS} ms)`,
        );
        expect(mediana).toBeLessThan(TECHO_MS);
      }
    });
  }
});
