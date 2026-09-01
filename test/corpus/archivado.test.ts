import { describe, expect, it } from "vitest";
import {
  aplicarArchivado,
  archivarEnElLog,
  bloqueParaElLog,
  caminoDeArchivado,
  planDeArchivado,
} from "../../src/archivado.js";
import { arbolDe, headingsDe, parseDocumento, recorrer, renderDocumento } from "../../src/documento.js";
import { estadoDe } from "../../src/linea.js";
import { indexar } from "../../src/tareas.js";
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

  /** Todas las tareas completadas del corpus, con su nota, su nodo y su proyecto. */
  const completadas = notas
    .filter((n) => n.rel !== rutaLog)
    .flatMap(({ rel, raw }) => {
      const doc = parseDocumento(raw);
      const porLinea = new Map(indexar(doc, rel).map((t) => [t.linea, t.proyecto]));
      return recorrer(arbolDe(doc))
        .filter((n) => n.rol === "tarea" && estadoDe(n.bullet) !== " ")
        .map((nodo) => ({ rel, doc, nodo, proyecto: porLinea.get(nodo.n) ?? null }));
    });

  it("hay tareas completadas para archivar", () => {
    expect(completadas.length).toBeGreaterThan(10);
    console.log(`  completadas en el corpus: ${completadas.length}`);
  });

  const archivarTodo = () => {
    let log = parseDocumento(logOriginal);
    for (const { rel, doc, nodo, proyecto } of completadas) {
      const camino = caminoDeArchivado(rel, proyecto);
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
    for (const { rel, doc, nodo, proyecto } of completadas) {
      const camino = caminoDeArchivado(rel, proyecto);
      log = aplicarArchivado(log, planDeArchivado(log, camino, bloqueParaElLog(doc, nodo, HOY)));
    }
    expect(headingsDe(log).map((h) => [h.heading.nivel, h.heading.texto])).toEqual(unaVez);
  });
});

/**
 * `archivarEnElLog` sobre el LOG real: es lo que corre adentro de `process`.
 *
 * El bloque de arriba prueba las piezas en memoria; este prueba **la función
 * que toca el disco**, sobre los bytes que hay ahí. Y sobre todo: imprime la
 * **forma** del resultado para mirarla. El bug de que las secciones nuevas se
 * insertaban arriba de todo no lo agarró ninguno de los 60 tests del corpus —
 * apareció mirando la estructura del archivo.
 *
 * Se imprime la clase de cada línea y **nunca su contenido**: el repositorio es
 * público y las notas son reales.
 */
describe.skipIf(!VAULT)("archivarEnElLog sobre el LOG real", () => {
  const notas = notasReales();
  const rutaLog = "0_inbox/tareas_LOG.md";
  const logOriginal = notas.find((n) => n.rel === rutaLog)!.raw;
  const HOY = "2026-08-24";

  /** Una tarea completada de cada nota, con su camino y su bloque. */
  const unaDeCadaNota = notas
    .filter((n) => n.rel !== rutaLog)
    .flatMap(({ rel, raw }) => {
      const doc = parseDocumento(raw);
      const porLinea = new Map(indexar(doc, rel).map((t) => [t.linea, t.proyecto]));
      const nodo = recorrer(arbolDe(doc)).find(
        (n) => n.rol === "tarea" && estadoDe(n.bullet) !== " ",
      );
      if (!nodo) return [];
      return [
        {
          camino: caminoDeArchivado(rel, porLinea.get(nodo.n) ?? null),
          bloque: bloqueParaElLog(doc, nodo, HOY),
        },
      ];
    });

  const archivarTodas = () => {
    let texto = logOriginal;
    let headings = 0;
    for (const { camino, bloque } of unaDeCadaNota) {
      const r = archivarEnElLog(texto, camino, bloque);
      texto = r.texto;
      headings += r.plan.headingsNuevos.length;
    }
    return { texto, headings };
  };

  it("el LOG de hoy sigue siendo el que la §12 describe", () => {
    // La spec también es una medición con fecha. `[✓ AAAA-MM-DD]` es formato
    // nuevo mientras esto sea cierto; el día que deje de serlo, hay que releer.
    const doc = parseDocumento(logOriginal);
    const bullets = doc.lineas.filter((l) => l.clase === "bullet").length;
    const checkboxes = doc.lineas.filter((l) => l.clase === "tarea").length;
    const conFecha = doc.lineas.filter((l) => /\[✓ \d{4}-\d{2}-\d{2}\]\s*$/.test(l.texto)).length;
    console.log(
      `  LOG: ${doc.lineas.length} líneas · ${bullets} bullets · ${checkboxes} checkboxes · ` +
        `${conFecha} marcas [✓ …] · ${headingsDe(doc).length} headings`,
    );
    expect(checkboxes).toBe(0);
  });

  it("no toca ni una línea de las que ya estaban: el LOG crece por abajo", () => {
    const { texto } = archivarTodas();
    expect(texto.startsWith(logOriginal)).toBe(true);
  });

  it("el resultado se vuelve a leer byte por byte (invariante 9)", () => {
    const { texto } = archivarTodas();
    expect(renderDocumento(parseDocumento(texto))).toBe(texto);
  });

  it("archivar dos veces seguidas no crea ningún heading de más (invariante 6)", () => {
    const primera = archivarTodas();
    let texto = primera.texto;
    let headings = 0;
    for (const { camino, bloque } of unaDeCadaNota) {
      const r = archivarEnElLog(texto, camino, bloque);
      texto = r.texto;
      headings += r.plan.headingsNuevos.length;
    }
    expect(headings).toBe(0);
    console.log(`  headings creados: ${primera.headings} la primera vuelta, ${headings} la segunda`);
  });

  it("la forma del LOG resultante, para mirarla", () => {
    // Los tests comprueban lo que se me ocurrió. Esto es para leer.
    const { texto, headings } = archivarTodas();
    const viejas = logOriginal.split("\n").length;
    const doc = parseDocumento(texto);
    const clase = { heading: "H", tarea: "T", bullet: "b", otro: "o" } as const;
    const forma = doc.lineas
      .map((l, i) =>
        i < viejas ? "·" : l.texto.trim() === "" ? "_" : clase[l.clase],
      )
      .join("");
    console.log(`  · = ya estaba · H heading · b bullet · T checkbox · _ blanco · o resto`);
    console.log(`  ${forma}`);
    console.log(`  +${doc.lineas.length - viejas} líneas, ${headings} headings nuevos`);

    // Lo que la forma tiene que decir: ningún checkbox y ningún token.
    for (const l of doc.lineas.slice(viejas)) {
      expect(l.clase, "el LOG no lleva checkboxes").not.toBe("tarea");
      expect(l.texto, "el LOG no lleva tokens").not.toContain("%%t:");
    }
  });
});
