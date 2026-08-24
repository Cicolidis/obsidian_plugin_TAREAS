import { describe, expect, it } from "vitest";
import {
  aplicarArchivado,
  bloqueParaElLog,
  caminoDeHeadings,
  planDeArchivado,
} from "../../src/archivado.js";
import { arbolDe, headingsDe, parseDocumento, recorrer, renderDocumento } from "../../src/documento.js";
import { estadoDe } from "../../src/linea.js";
import { notasReales, VAULT } from "./vault.js";

/**
 * Archivar todo lo completado del corpus dentro del LOG real, **en memoria**.
 *
 * No escribe nada: lee las siete notas, arma el LOG resultante y lo compara.
 * Es el ensayo del paso 6 antes de que `vault.process()` toque un archivo, y la
 * forma más barata de descubrir que el archivado deja el LOG mal formado.
 */
describe.skipIf(!VAULT)("archivar el corpus completo en el LOG real", () => {
  const notas = notasReales();
  const rutaLog = "0_inbox/tareas_LOG.md";
  const logOriginal = notas.find((n) => n.rel === rutaLog)!.raw;
  const HOY = "2026-08-24";

  /** Todas las tareas completadas del corpus, con su nota y su nodo. */
  const completadas = notas
    .filter((n) => n.rel !== rutaLog)
    .flatMap(({ rel, raw }) => {
      const doc = parseDocumento(raw);
      return recorrer(arbolDe(doc))
        .filter((n) => n.rol === "tarea" && estadoDe(n.bullet) !== " ")
        .map((nodo) => ({ rel, doc, nodo }));
    });

  it("hay tareas completadas para archivar", () => {
    expect(completadas.length).toBeGreaterThan(10);
    console.log(`  completadas en el corpus: ${completadas.length}`);
  });

  const archivarTodo = () => {
    let log = parseDocumento(logOriginal);
    for (const { doc, nodo } of completadas) {
      const camino = caminoDeHeadings(doc, nodo.n);
      const bloque = bloqueParaElLog(doc, nodo, HOY);
      log = aplicarArchivado(log, planDeArchivado(log, camino, bloque));
    }
    return log;
  };

  it("el LOG resultante se vuelve a leer byte por byte (inv. 9)", () => {
    const texto = renderDocumento(archivarTodo());
    expect(renderDocumento(parseDocumento(texto))).toBe(texto);
  });

  it("no toca ni una línea de las que ya estaban en el LOG", () => {
    const antes = logOriginal.split("\n");
    const despues = renderDocumento(archivarTodo()).split("\n");
    // Todas las líneas viejas siguen presentes y en el mismo orden relativo.
    let i = 0;
    for (const l of antes) {
      const j = despues.indexOf(l, i);
      expect(j, `se perdió la línea ${JSON.stringify(l.slice(0, 30))}`).toBeGreaterThanOrEqual(0);
      i = j + 1;
    }
  });

  it("no deja checkboxes ni tokens en el LOG", () => {
    // El LOG usa bullets sin checkbox: 37 hoy, cero checkboxes.
    const nuevas = renderDocumento(archivarTodo()).split("\n").slice(logOriginal.split("\n").length);
    for (const l of nuevas) {
      expect(l, "checkbox").not.toMatch(/^\s*-\s+\[.\]/);
      expect(l, "token").not.toContain("%%t:");
    }
  });

  it("los headings del LOG quedan bien anidados, sin huecos de nivel", () => {
    // En `tareas_COLE` un h4 cuelga directo de un h1. Si el archivado copiara
    // los niveles de origen, el LOG heredaría ese hueco.
    const niveles = headingsDe(archivarTodo()).map((h) => h.heading.nivel);
    let previo = 0;
    for (const n of niveles) {
      expect(n, `salto de nivel a h${n} desde h${previo}`).toBeLessThanOrEqual(previo + 1);
      previo = n;
    }
  });

  it("archivar todo dos veces no duplica ningún heading (invariante 6)", () => {
    const unaVez = headingsDe(archivarTodo()).map((h) => [h.heading.nivel, h.heading.texto]);
    let log = archivarTodo();
    for (const { doc, nodo } of completadas) {
      const camino = caminoDeHeadings(doc, nodo.n);
      log = aplicarArchivado(log, planDeArchivado(log, camino, bloqueParaElLog(doc, nodo, HOY)));
    }
    expect(headingsDe(log).map((h) => [h.heading.nivel, h.heading.texto])).toEqual(unaVez);
  });
});
