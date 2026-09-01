import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import type { Favoritos } from "../../src/botones.js";
import { decoracionesDeFila } from "../../src/editor/filaDeBotones.js";
import { notasReales, VAULT } from "./vault.js";

/**
 * Cuánto cuesta construir la fila de botones, **por transacción**.
 *
 * Es el hermano de `costo-decoraciones.test.ts` y se compara contra él: decorar
 * el documento entero cuesta **0,65 ms** en el peor caso realista, medido. La
 * fila recorre solo el viewport, así que tiene que costar mucho menos — y si no
 * lo hace, la decisión de mandarla a un `ViewPlugin` no compró nada y hay que
 * mirarla de nuevo.
 *
 * Se mide `decoracionesDeFila`, que es puro sobre un `EditorState`, y no el
 * `ViewPlugin`: aquel necesita una vista de verdad y esto no. Es la razón por la
 * que las dos piezas están separadas.
 *
 * El viewport se simula con una ventana de líneas, y el número **está medido**,
 * no elegido: la verificación de la sesión 5 informó desde la consola de
 * Obsidian ventanas de **46 a 103 líneas** scrolleando la nota de prueba. Se usa
 * el techo de eso, que es el caso caro.
 *
 * ## Por qué hay una pasada de calentamiento, y por qué eso no es adorno
 *
 * La primera versión medía una pasada sola y la salida decía que la primera
 * nota costaba **0,711 ms** y las seis siguientes 0,02-0,12. No es que esa nota
 * sea cara: es que era la primera llamada del proceso y se estaba midiendo el
 * JIT. Con dos ventanas, además, «la mediana» son dos muestras.
 *
 * Se descubrió mirando la salida, no por un test en rojo — el techo de 16 ms lo
 * pasaba igual. Es el §«mirar la salida» del método: un instrumento que informa
 * un número que no es el que dice medir es peor que no medir.
 */
const LINEAS_VISIBLES = 103;

/** El techo del que hay que enterarse acá y no por un editor que se traba. */
const TECHO_MS = 16;

/** Pasadas completas sobre la nota. La primera se descarta: es el JIT. */
const PASADAS = 30;

/** Lo que cuesta decorar el documento entero, medido el 25/08/2026. */
const COSTO_DE_DECORAR_MS = 0.65;

const FAV: Favoritos = { primario: "foco", secundario: "mudanza" };

describe.skipIf(!VAULT)("costo de construir la fila, por transacción", () => {
  for (const { rel, raw } of notasReales()) {
    it(`${rel}`, () => {
      // El peor caso realista: un token en cada línea de tarea. Sin esto se
      // mide una nota que casi no tiene tokens, que es medir otra cosa.
      const saturada = raw
        .split("\n")
        .map((l) =>
          /^\s*[-*+] \[[ x]\] \S/.test(l) && !l.includes("%%t:")
            ? `${l} %%t:id=k3f9;wb=foco;due=2026-09-02;p=1%%`
            : l,
        )
        .join("\n");

      for (const [nombre, doc] of [
        ["como está", raw],
        ["saturada ", saturada],
      ] as const) {
        const st = EditorState.create({ doc });
        const opciones = {
          favoritos: () => FAV,
          conEliminar: () => true,
          alClic: () => {},
          dibujarIcono: () => {},
        };

        // Se recorre la nota entera de a ventanas, no una ventana sola: el
        // costo depende de cuántas tareas caigan adentro, y una nota tiene
        // zonas densas y zonas de texto libre.
        const ventanas: { from: number; to: number }[][] = [];
        for (let inicio = 1; inicio <= st.doc.lines; inicio += LINEAS_VISIBLES) {
          const fin = Math.min(inicio + LINEAS_VISIBLES - 1, st.doc.lines);
          ventanas.push([{ from: st.doc.line(inicio).from, to: st.doc.line(fin).to }]);
        }

        const ms: number[] = [];
        for (let pasada = 0; pasada < PASADAS; pasada++) {
          for (const rango of ventanas) {
            const t0 = performance.now();
            decoracionesDeFila(st, rango, opciones);
            const t = performance.now() - t0;
            if (pasada > 0) ms.push(t); // la primera es el calentamiento
          }
        }

        ms.sort((a, b) => a - b);
        const mediana = ms[Math.floor(ms.length / 2)]!;
        const p90 = ms[Math.floor(ms.length * 0.9)] ?? mediana;
        console.log(
          `  ${nombre} ${String(st.doc.lines).padStart(4)} líneas · ` +
            `${String((doc.match(/%%t:/g) ?? []).length).padStart(3)} tokens · ` +
            `${String(ventanas.length).padStart(2)} ventanas de ${LINEAS_VISIBLES} · ` +
            `${ms.length} muestras → ` +
            `mediana ${mediana.toFixed(3)} ms · p90 ${p90.toFixed(3)} ms ` +
            `(decorar la nota entera: ${COSTO_DE_DECORAR_MS} ms)`,
        );
        expect(mediana).toBeLessThan(TECHO_MS);
      }
    });
  }
});
