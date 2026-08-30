import { describe, expect, it } from "vitest";
import { EditorState, Prec } from "@codemirror/state";
import { marcasDe } from "../../src/decorar.js";
import { parseDocumento } from "../../src/documento.js";
import { checkboxAutomatico } from "../../src/editor/autoCheckbox.js";
import { protegerTramo } from "../../src/editor/protegerTramo.js";
import { unirLimpio } from "../../src/editor/unirLimpio.js";
import { inicioDelTramo, parsea } from "../../src/hiddenTail.js";
import { notasReales, VAULT } from "./vault.js";

/**
 * Las decoraciones y el filtro, contra las siete notas de verdad.
 *
 * **Nada de acá es una foto.** Hoy las siete notas tienen cero tokens —medido—
 * y sería facilísimo escribir `expect(marcas).toHaveLength(0)`; ese test
 * empezaría a fallar el día que el usuario asigne su primera tarea a un
 * workbench, o sea el día que el plugin empiece a servir. Lo que se comprueba
 * son **propiedades**: donde hay marca hay token, y ningún gesto sobre una
 * línea real deja algo ilegible.
 */
describe.skipIf(!VAULT)("decoraciones sobre el corpus real", () => {
  const notas = notasReales();

  it("encuentra las notas", () => {
    expect(notas.length).toBeGreaterThan(0);
  });

  for (const { rel, raw } of notas) {
    describe(rel, () => {
      const doc = parseDocumento(raw);

      it("toda marca de token cae sobre una línea que tiene token", () => {
        for (const m of marcasDe(doc)) {
          if (m.tipo !== "oculto") continue;
          const texto = doc.lineas[m.linea]!.texto;
          expect(texto.slice(m.desde)).toMatch(/%%t:[^%]*%%[ \t]*$/);
          expect(m.desde).toBe(inicioDelTramo(texto));
        }
      });

      it("ninguna línea real está ilegible hoy", () => {
        const rotas = doc.lineas.filter((l) => !parsea(l.texto)).map((l) => l.n);
        expect(rotas).toEqual([]);
      });

      /**
       * Enter y Backspace en el final visible de **cada** línea de la nota.
       *
       * Es caro y vale la pena: son los dos gestos que rompían datos, y acá
       * corren contra las formas reales —tabs, líneas en blanco adentro de los
       * árboles, tablas, imágenes, headings, los `- [ ]` de separador— y no
       * contra fixtures inventadas.
       */
      it("Enter y Backspace en cada línea no dejan nada ilegible", () => {
        const st = EditorState.create({
          doc: raw,
          extensions: [
            Prec.lowest(unirLimpio(() => true)),
            Prec.low(protegerTramo(() => true)),
            checkboxAutomatico(() => true),
          ],
        });

        for (let n = 1; n <= st.doc.lines; n++) {
          const linea = st.doc.line(n);
          const fin = linea.from + inicioDelTramo(linea.text);

          const conEnter = st.update({ changes: { from: fin, to: fin, insert: "\n- " } }).state;
          for (const l of conEnter.doc.toString().split("\n")) expect(parsea(l)).toBe(true);

          if (n < st.doc.lines) {
            const abajo = st.doc.line(n + 1);
            const unida = st.update({ changes: { from: fin, to: abajo.from, insert: "" } }).state;
            for (const l of unida.doc.toString().split("\n")) expect(parsea(l)).toBe(true);
          }
        }
      });

      /**
       * Y la mitad que importa del otro lado: sobre una nota **sin** tokens el
       * filtro tiene que ser transparente. Si tocara algo acá, estaría
       * reescribiendo notas reales sin que nadie se lo pidiera, que es la regla
       * 2 de la §8.
       */
      it("sin tokens, el filtro no cambia ni un byte de más", () => {
        if (raw.includes("%%t:")) return; // ya hay tokens: esta nota no aplica
        const st = EditorState.create({
          doc: raw,
          extensions: [protegerTramo(() => true)],
        });
        for (let n = 1; n <= st.doc.lines; n++) {
          const linea = st.doc.line(n);
          const salida = st.update({
            changes: { from: linea.to, to: linea.to, insert: "\n- " },
          }).state.doc.toString();
          const esperado =
            raw.slice(0, linea.to) + "\n- " + raw.slice(linea.to);
          expect(salida).toBe(esperado);
        }
      });
    });
  }
});
