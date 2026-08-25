import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { decoraciones } from "../../src/editor/decoraciones.js";
import { notasReales, VAULT } from "./vault.js";

/**
 * Cuánto cuesta recalcular las decoraciones, **por transacción**.
 *
 * La §5.5 decide recorrer el documento entero y no el viewport, y se apoya en
 * que parsear las siete notas cuesta 0,31 ms. Pero eso se midió por **evento**
 * del vault, que llega cada ~2100 ms; esto corre por **tecla**. Son dos
 * preguntas distintas y merecían dos mediciones.
 *
 * Se mide en dos condiciones porque la nota real todavía tiene pocos tokens, y
 * el costo depende de cuántos haya: la segunda le pone un token a cada línea de
 * tarea, que es el peor caso realista.
 *
 * No afirma un número —una máquina es una máquina— pero sí un techo generoso:
 * si esto pasara de un cuadro a 60 fps, el diseño de la §5.5 habría que
 * revisarlo, y conviene enterarse acá y no por un editor que se traba.
 */
const TECHO_MS = 16;

describe.skipIf(!VAULT)("costo de decorar, por transacción", () => {
  for (const { rel, raw } of notasReales()) {
    it(`${rel}`, () => {
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
        const ms: number[] = [];
        let st = EditorState.create({
          doc,
          extensions: [decoraciones(() => true, (t) => ms.push(t))],
        });
        for (let i = 0; i < 100; i++) {
          st = st.update({ changes: { from: 0, to: 0, insert: "x" } }).state;
        }
        ms.sort((a, b) => a - b);
        const mediana = ms[Math.floor(ms.length / 2)]!;
        console.log(
          `  ${nombre} ${String(doc.split("\n").length).padStart(4)} líneas · ` +
            `${String((doc.match(/%%t:/g) ?? []).length).padStart(3)} tokens → ` +
            `mediana ${mediana.toFixed(2)} ms · p90 ${ms[Math.floor(ms.length * 0.9)]!.toFixed(2)} ms`,
        );
        expect(mediana).toBeLessThan(TECHO_MS);
      }
    });
  }
});
