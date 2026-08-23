import { describe, expect, it } from "vitest";
import {
  arbolDe,
  eliminarLineas,
  insertarLineas,
  lineasDelSubarbol,
  parseDocumento,
  rangoDelSubarbol,
  recorrer,
  renderDocumento,
} from "../../src/documento.js";
import { setTaskToken } from "../../src/token.js";
import { notasReales, VAULT } from "./vault.js";

/**
 * Las primitivas de escritura, contra las siete notas de verdad.
 *
 * Nada de esto escribe en el vault: se lee el archivo, se opera en memoria y se
 * compara. Es el ensayo de la capa 2 sin tocar un byte en disco, y es lo que el
 * paso 3 va a necesitar antes de que `vault.process()` toque nada.
 */
describe.skipIf(!VAULT)("escritura por rango sobre el corpus real", () => {
  const notas = notasReales();

  it.each(notas.map((n) => [n.rel, n.raw] as const))(
    "%s: insertar y volver a borrar no altera un byte",
    (_rel, raw) => {
      const doc = parseDocumento(raw);
      for (const n of [0, Math.floor(doc.lineas.length / 2), doc.lineas.length]) {
        const con = insertarLineas(doc, n, ["- [ ] tarea de prueba"]);
        expect(renderDocumento(eliminarLineas(con, n, n)), `en ${n}`).toBe(raw);
      }
    },
  );

  it.each(notas.map((n) => [n.rel, n.raw] as const))(
    "%s: escribir el token de cada tarea deja intacto todo lo demás",
    (_rel, raw) => {
      // El invariante 3 sobre el corpus entero: 395 reescrituras, una por
      // tarea, y ninguna toca una línea que no sea la suya.
      const doc = parseDocumento(raw);
      for (const l of doc.lineas.filter((x) => x.clase === "tarea")) {
        const despues = renderDocumento({
          lineas: doc.lineas.map((x) =>
            x.n === l.n ? { ...x, texto: setTaskToken(x.texto, { prioridad: 1 }) } : x,
          ),
        });
        const antes = raw.split("\n");
        const ahora = despues.split("\n");
        expect(ahora.length, `línea ${l.n}`).toBe(antes.length);
        for (let i = 0; i < antes.length; i++) {
          if (i === l.n) continue;
          expect(ahora[i], `línea ${i} al reescribir ${l.n}`).toBe(antes[i]);
        }
      }
    },
  );

  it.each(notas.map((n) => [n.rel, n.raw] as const))(
    "%s: borrar un subárbol se lleva el subárbol y nada más",
    (_rel, raw) => {
      const doc = parseDocumento(raw);
      for (const nodo of recorrer(arbolDe(doc))) {
        const { desde, hasta } = rangoDelSubarbol(nodo);
        const afuera = doc.lineas.filter((l) => l.n < desde || l.n > hasta).map((l) => l.texto);
        expect(eliminarLineas(doc, desde, hasta).lineas.map((l) => l.texto), `${desde}..${hasta}`)
          .toEqual(afuera);
      }
    },
  );

  it("los subárboles de las raíces no se solapan en ninguna nota", () => {
    for (const { rel, raw } of notas) {
      const rangos = arbolDe(parseDocumento(raw))
        .map(rangoDelSubarbol)
        .sort((a, b) => a.desde - b.desde);
      for (let i = 1; i < rangos.length; i++) {
        expect(rangos[i]!.desde, `${rel} rango ${i}`).toBeGreaterThan(rangos[i - 1]!.hasta);
      }
    }
  });

  it("el subárbol más grande del corpus sigue siendo el que dice la §9", () => {
    // La §2 midió máx 76 líneas y de ahí sale la regla de colapso. Si el corpus
    // se pasa de eso por mucho, la regla hay que volver a mirarla.
    const mayor = Math.max(
      ...notas.flatMap(({ raw }) => {
        const doc = parseDocumento(raw);
        return arbolDe(doc).map((n) => lineasDelSubarbol(doc, n).length);
      }),
    );
    expect(mayor).toBeLessThan(120);
    console.log(`  subárbol más grande del corpus: ${mayor} líneas`);
  });
});
