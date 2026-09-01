import { describe, expect, it } from "vitest";
import {
  planDeArchivarEnLaNota,
  planDeCompletar,
  planDeEliminar,
  planDeWorkbench,
} from "../../src/acciones.js";
import { parseDocumento } from "../../src/documento.js";
import { claveDe, indexar } from "../../src/tareas.js";
import { aplicarLote, ubicarLinea } from "../../src/ubicar.js";
import { notasReales, VAULT } from "./vault.js";

/**
 * `ubicar.ts` contra las siete notas de verdad.
 *
 * Nada de esto escribe: se lee el archivo, se opera en memoria y se compara.
 * Lo que agrega sobre las propiedades offline es la forma real de las notas —y
 * en particular **cuántas líneas de tarea están repetidas**, que es la única
 * cosa que hace que este mecanismo tenga que darse por vencido—.
 */
describe.skipIf(!VAULT)("ubicar sobre el corpus real", () => {
  const notas = notasReales();
  const HOY = "2026-08-24";

  it("cuántas líneas de tarea del corpus están duplicadas", () => {
    // El dato que decide cuán seguido `ubicarLinea` va a decir «ambigua». Si
    // fueran muchas, haría falta otro mecanismo; si son poquísimas, el camino
    // conservador no molesta nunca.
    let tareas = 0;
    let repetidas = 0;
    for (const { rel, raw } of notas) {
      const lineas = raw.split("\n");
      const cuenta = new Map<string, number>();
      for (const l of lineas) cuenta.set(l, (cuenta.get(l) ?? 0) + 1);

      const doc = parseDocumento(raw);
      const deTarea = doc.lineas.filter((l) => l.clase === "tarea");
      const dup = deTarea.filter((l) => cuenta.get(l.texto)! > 1);
      tareas += deTarea.length;
      repetidas += dup.length;
      if (dup.length) console.log(`  ${rel}: ${dup.length} de ${deTarea.length} repetidas`);
    }
    const pct = ((repetidas / tareas) * 100).toFixed(1);
    console.log(`  total: ${repetidas} de ${tareas} líneas de tarea repetidas (${pct}%)`);
    expect(tareas).toBeGreaterThan(0);
  });

  it.each(notas.map((n) => [n.rel, n.raw] as const))(
    "%s: cada tarea se ubica en su propia línea",
    (_rel, raw) => {
      const lineas = raw.split("\n");
      const doc = parseDocumento(raw);
      for (const l of doc.lineas.filter((x) => x.clase === "tarea")) {
        expect(ubicarLinea(lineas, l.n, l.texto), `línea ${l.n}`).toEqual({
          estado: "ok",
          linea: l.n,
        });
      }
    },
  );

  it.each(notas.map((n) => [n.rel, n.raw] as const))(
    "%s: completar escribe solo las líneas del subárbol",
    (rel, raw) => {
      const doc = parseDocumento(raw);
      const tareas = indexar(doc, rel);
      for (const t of tareas) {
        const plan = planDeCompletar(doc, tareas, claveDe(rel, t.linea), HOY);
        const { texto, resultado } = aplicarLote(raw, plan);
        expect(resultado.estado, `tarea en ${t.linea}`).toBe("ok");

        const antes = raw.split("\n");
        const ahora = texto.split("\n");
        expect(ahora.length).toBe(antes.length);
        const tocadas = new Set(plan.map((c) => c.linea));
        for (let i = 0; i < antes.length; i++) {
          if (tocadas.has(i)) continue;
          expect(ahora[i], `${rel}:${i} al completar ${t.linea}`).toBe(antes[i]);
        }
      }
    },
  );

  it.each(notas.map((n) => [n.rel, n.raw] as const))(
    "%s: con el índice atrasado k líneas, se sigue escribiendo donde va",
    (rel, raw) => {
      // Es la prueba de la sesión, offline y sobre las notas reales: el plan se
      // arma sobre el documento viejo y se aplica sobre uno que se corrió.
      const doc = parseDocumento(raw);
      const tareas = indexar(doc, rel);
      const lineas = raw.split("\n");

      for (const k of [1, 5, 20]) {
        const relleno = Array.from({ length: k }, (_, j) => `- [ ] tarea agregada ${j}`);
        const corrido = [...relleno, ...lineas].join("\n");

        for (const t of tareas) {
          const plan = planDeCompletar(doc, tareas, claveDe(rel, t.linea), HOY);
          if (plan.length === 0) continue;
          // Solo tiene sentido cuando ninguna línea del plan está repetida: con
          // una repetida, no saber cuál era es la respuesta correcta.
          if (plan.some((c) => lineas.filter((l) => l === c.antes).length !== 1)) continue;

          const { texto, resultado } = aplicarLote(corrido, plan);
          expect(resultado.estado, `${rel}:${t.linea} k=${k}`).toBe("ok");
          if (resultado.estado !== "ok") continue;

          for (const u of resultado.ubicados) {
            expect(u.ubicacion.linea, `${rel}:${t.linea} k=${k}`).toBe(u.cambio.linea + k);
          }
          // Y ninguna de las líneas de relleno se tocó.
          expect(texto.split("\n").slice(0, k)).toEqual(relleno);
        }
      }
    },
  );

  it("asignar al workbench no repite un id que ya exista en otra nota", () => {
    const idsGlobales = new Set<string>();
    const docs = notas.map(({ rel, raw }) => {
      const doc = parseDocumento(raw);
      const tareas = indexar(doc, rel);
      for (const t of tareas) if (t.id !== null) idsGlobales.add(t.id);
      return { rel, raw, doc, tareas };
    });

    const nuevos = new Set<string>();
    for (const { rel, doc, tareas } of docs) {
      for (const t of tareas.slice(0, 40)) {
        const plan = planDeWorkbench(doc, tareas, claveDe(rel, t.linea), "foco", idsGlobales);
        for (const c of plan) {
          const m = /%%t:id=([a-z0-9]+)/.exec(c.despues);
          if (m && !idsGlobales.has(m[1]!)) nuevos.add(m[1]!);
        }
      }
    }
    for (const id of nuevos) expect(idsGlobales.has(id)).toBe(false);
    console.log(`  ids ya escritos en el corpus: ${idsGlobales.size}`);
  });
});

/**
 * Los dos caminos del paso 6a contra las siete notas de verdad.
 *
 * Nada de esto escribe: se lee el archivo, se opera en memoria y se compara.
 * Lo que agrega sobre las propiedades offline es la forma real de las notas, y
 * en particular **cuántos subárboles están repetidos verbatim**, que es lo
 * único que hace que borrar o archivar tengan que darse por vencidos.
 */
describe.skipIf(!VAULT)("archivar y eliminar sobre el corpus real", () => {
  const notas = notasReales();
  const HOY = "2026-08-24";

  it("cuántos subárboles del corpus están repetidos verbatim", () => {
    // El dato que decide cuán seguido estas dos acciones van a decir «ambigua»
    // con el índice atrasado. Si fueran muchos, haría falta otro mecanismo.
    let total = 0;
    let repetidos = 0;
    let conSubarbol = 0;
    for (const { rel, raw } of notas) {
      const lineas = raw.split("\n");
      const doc = parseDocumento(raw);
      const tareas = indexar(doc, rel);
      for (const t of tareas) {
        const plan = planDeEliminar(doc, tareas, claveDe(rel, t.linea));
        if (plan.length !== 1) continue;
        const c = plan[0]!;
        if (c.tipo !== "bloque") continue;
        total++;
        if (c.antes.length > 1) conSubarbol++;
        let veces = 0;
        for (let i = 0; i + c.antes.length <= lineas.length; i++) {
          if (c.antes.every((l, j) => lineas[i + j] === l)) veces++;
        }
        if (veces > 1) repetidos++;
      }
    }
    const pct = (n: number) => ((n / total) * 100).toFixed(1);
    console.log(`  subárboles de tarea: ${total}`);
    console.log(`  con subárbol → default ARCHIVAR: ${conSubarbol} (${pct(conSubarbol)}%)`);
    console.log(`  hojas de una línea → default DESCARTAR: ${total - conSubarbol} (${pct(total - conSubarbol)}%)`);
    console.log(`  repetidos verbatim: ${repetidos} (${pct(repetidos)}%)`);
    expect(total).toBeGreaterThan(0);
  });

  it.each(notas.map((n) => [n.rel, n.raw] as const))(
    "%s: eliminar se lleva el subárbol y nada más",
    (rel, raw) => {
      const doc = parseDocumento(raw);
      const tareas = indexar(doc, rel);
      const lineas = raw.split("\n");
      for (const t of tareas) {
        const plan = planDeEliminar(doc, tareas, claveDe(rel, t.linea));
        const { texto, resultado } = aplicarLote(raw, plan);
        // Un subárbol repetido no se puede atribuir: negarse es la respuesta
        // correcta, no una falla.
        if (resultado.estado !== "ok") continue;
        const c = plan[0]!;
        if (c.tipo !== "bloque") throw new Error("se esperaba un bloque");
        const esperado = lineas
          .filter((_, i) => i < c.linea || i >= c.linea + c.antes.length)
          .join("\n");
        expect(texto, `${rel}:${t.linea}`).toBe(esperado);
      }
    },
  );

  it.each(notas.map((n) => [n.rel, n.raw] as const))(
    "%s: archivar completa el subárbol y no cambia la cantidad de líneas",
    (rel, raw) => {
      // La §12: archivar **no borra la línea de la nota**.
      const doc = parseDocumento(raw);
      const tareas = indexar(doc, rel);
      for (const t of tareas) {
        const plan = planDeArchivarEnLaNota(doc, tareas, claveDe(rel, t.linea), HOY);
        const { texto, resultado } = aplicarLote(raw, plan);
        if (resultado.estado !== "ok") continue;
        expect(texto.split("\n"), `${rel}:${t.linea}`).toHaveLength(raw.split("\n").length);
        // Y escribe exactamente lo mismo que «completar y descartar».
        const soloCompletar = aplicarLote(raw, planDeCompletar(doc, tareas, claveDe(rel, t.linea), HOY));
        expect(texto, `${rel}:${t.linea}`).toBe(soloCompletar.texto);
      }
    },
  );

  it.each(notas.map((n) => [n.rel, n.raw] as const))(
    "%s: con el índice atrasado k líneas, el bloque se sigue encontrando entero",
    (rel, raw) => {
      const doc = parseDocumento(raw);
      const tareas = indexar(doc, rel);
      const lineas = raw.split("\n");

      for (const k of [1, 5, 20]) {
        const relleno = Array.from({ length: k }, (_, j) => `- [ ] tarea agregada ${j}`);
        const corrido = [...relleno, ...lineas].join("\n");

        for (const t of tareas) {
          const plan = planDeEliminar(doc, tareas, claveDe(rel, t.linea));
          if (plan.length === 0) continue;
          const c = plan[0]!;
          if (c.tipo !== "bloque") continue;
          // Solo tiene sentido cuando el bloque no está repetido.
          let veces = 0;
          for (let i = 0; i + c.antes.length <= lineas.length; i++) {
            if (c.antes.every((l, j) => lineas[i + j] === l)) veces++;
          }
          if (veces !== 1) continue;

          const { resultado } = aplicarLote(corrido, plan);
          expect(resultado.estado, `${rel}:${t.linea} k=${k}`).toBe("ok");
          if (resultado.estado !== "ok") continue;
          expect(resultado.ubicados[0]!.ubicacion.linea).toBe(c.linea + k);
        }
      }
    },
  );
});
