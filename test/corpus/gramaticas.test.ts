import { describe, expect, it } from "vitest";
// @ts-expect-error -- el script no tiene tipos a propósito: es la OTRA gramática.
import { analizar } from "../../scripts/medir-tareas.mjs";
import { arbolDe, headingsDe, parseDocumento, recorrer } from "../../src/documento.js";
import { indexar } from "../../src/tareas.js";
import { notasReales, VAULT } from "./vault.js";

/**
 * Las dos gramáticas, contadas sobre el mismo corpus.
 *
 * Hasta ahora había dos parseos del vault —el del plugin y el de
 * `scripts/medir-tareas.mjs`— sin forma de saber si divergían. Esto lo
 * resuelve. La gramática del script **no se comparte**: se importa `analizar`
 * tal como está, porque el valor de la comparación es que sean independientes.
 *
 * Las diferencias esperadas se afirman como tales. Una diferencia esperada que
 * se tolera en silencio deja de ser una comprobación.
 */
describe.skipIf(!VAULT)("las dos gramáticas cuentan lo mismo", () => {
  const notas = notasReales();

  /** Lo que cuenta el parser nuevo, con los mismos nombres que el script. */
  function contar(rel: string, raw: string) {
    const doc = parseDocumento(raw);
    const nodos = recorrer(arbolDe(doc));
    const tareas = indexar(doc, rel);

    // La profundidad que mide el script es la del **árbol de bullets**, no la
    // del árbol de tareas: un grupo cuenta como un nivel. Se compara la misma
    // magnitud, no la del modelo de la §6.
    const profundidad = new Map<number, number>();
    const visitar = (ns: readonly ReturnType<typeof recorrer>[number][], nivel: number) => {
      for (const n of ns) {
        profundidad.set(n.n, nivel);
        visitar(n.hijos, nivel + 1);
      }
    };
    visitar(arbolDe(doc), 0);

    const estados: Record<string, number> = {};
    for (const n of nodos) {
      if (n.bullet.checkbox === null) continue;
      const e = n.bullet.checkbox[1]!;
      estados[e] = (estados[e] ?? 0) + 1;
    }

    const headingsPorNivel: Record<number, number> = {};
    for (const h of headingsDe(doc))
      headingsPorNivel[h.heading.nivel] = (headingsPorNivel[h.heading.nivel] ?? 0) + 1;

    return {
      tareas: tareas.length,
      tareasCompletadas: tareas.filter((t) => t.hecha).length,
      bulletsSinCheckbox: nodos.filter((n) => n.bullet.checkbox === null).length,
      bulletsSinCheckboxBajoTarea: nodos.filter((n) => n.rol === "nota").length,
      checkboxVacio: nodos.filter((n) => n.rol === "separador").length,
      estadosDeCheckbox: estados,
      headingsPorNivel,
      profundidadMaxima: Math.max(
        0,
        ...nodos.filter((n) => n.rol === "tarea").map((n) => profundidad.get(n.n)!),
      ),
    };
  }

  const pares = notas.map((n) => [n.rel, contar(n.rel, n.raw), analizar(n.rel, n.raw)] as const);

  it.each(pares.map(([rel]) => rel))("%s: los conteos coinciden", (rel) => {
    const [, mio, suyo] = pares.find(([r]) => r === rel)!;
    expect(mio.tareas, "tareas").toBe(suyo.tareas);
    expect(mio.tareasCompletadas, "completadas").toBe(suyo.tareasCompletadas);
    expect(mio.bulletsSinCheckbox, "bullets sin checkbox").toBe(suyo.bulletsSinCheckbox);
    expect(mio.bulletsSinCheckboxBajoTarea, "notas de tarea").toBe(
      suyo.bulletsSinCheckboxBajoTarea,
    );
    expect(mio.checkboxVacio, "checkboxes vacíos").toBe(suyo.checkboxVacio);
    expect(mio.estadosDeCheckbox, "estados").toEqual(suyo.estadosDeCheckbox);
    expect(mio.headingsPorNivel, "headings por nivel").toEqual(suyo.headingsPorNivel);
    expect(mio.profundidadMaxima, "profundidad máxima").toBe(
      Math.max(0, ...suyo.profundidadPorTarea),
    );
  });

  it("en total, sobre las siete notas", () => {
    const sumar = (f: (x: (typeof pares)[number]) => number) => pares.reduce((s, p) => s + f(p), 0);
    expect(sumar(([, m]) => m.tareas)).toBe(sumar(([, , s]) => s.tareas));
    expect(sumar(([, m]) => m.bulletsSinCheckbox)).toBe(sumar(([, , s]) => s.bulletsSinCheckbox));
    expect(sumar(([, m]) => m.checkboxVacio)).toBe(sumar(([, , s]) => s.checkboxVacio));
  });

  it("solo se usan `[ ]` y `[x]`: D7 sigue siendo cierto", () => {
    const estados = new Set(pares.flatMap(([, m]) => Object.keys(m.estadosDeCheckbox)));
    expect([...estados].sort()).toEqual([" ", "x"]);
  });
});

/**
 * La semántica de los headings es donde las dos gramáticas **no** coinciden, y
 * las tres diferencias son decisiones, no bugs. Se afirman una por una.
 */
describe.skipIf(!VAULT)("headings: las diferencias esperadas", () => {
  const notas = notasReales();
  const todos = notas.flatMap(({ rel, raw }) =>
    headingsDe(parseDocumento(raw)).map((h) => ({ rel, ...h.heading })),
  );
  const suyos = notas.map(({ rel, raw }) => analizar(rel, raw));
  const total = (campo: string) => suyos.reduce((s, m) => s + (m[campo] ?? 0), 0);

  it("el script y el parser ven la misma cantidad de headings", () => {
    const suyo = suyos.reduce(
      (s, m) => s + Object.values(m.headingsPorNivel).reduce((a: number, b) => a + (b as number), 0),
      0,
    );
    expect(todos.length).toBe(suyo);
  });

  it("«enlace a otra cosa» es sección: la §4.1 pliega esa categoría", () => {
    // El script la cuenta aparte. No está mal ninguno de los dos: la spec dice
    // «cualquier otra cosa o sin enlace → sección», el script la separa para
    // poder informarla. Lo que no puede pasar es que el parser la trate como
    // proyecto.
    const conWikilinkSemantico = todos.filter((h) => /\[\[[pa]_/.test(h.texto)).length;
    expect(todos.filter((h) => h.tipo === "proyecto" || h.tipo === "área").length).toBe(
      conWikilinkSemantico,
    );
    expect(todos.filter((h) => h.tipo === "sección").length).toBe(
      todos.length - conWikilinkSemantico,
    );
  });

  it("los headings en texto plano son exactamente los que el script llama referencia plana", () => {
    // Es la lista de trabajo de la migración de la §19.1, que es el paso 8.
    const candidatos = todos.filter((h) => h.candidatoPlano !== null);
    expect(candidatos.length).toBe(total("headingsConRefPlana"));
  });

  it("hoy el parser no reconoce ningún proyecto, y eso es la decisión, no un bug", () => {
    // Solo el wikilink define proyecto o área. Los 18 headings semánticos que
    // el script encuentra están 15 en texto plano y 3 con wikilink a otra cosa,
    // así que el parser reporta cero. Cuando corra la migración del paso 8,
    // este test es el que tiene que cambiar.
    expect(todos.filter((h) => h.tipo === "proyecto").length).toBe(0);
    expect(todos.filter((h) => h.tipo === "área").length).toBe(0);
    expect(total("headingsProyecto") + total("headingsArea")).toBeGreaterThan(0);
  });

  it("la herencia por pila no es la misma que la bandera pegajosa del script", () => {
    // El script nunca vuelve `headingSemanticoVigente` a null, así que un
    // proyecto se derrama sobre las secciones que vienen después. Con la pila
    // de la §4.1 quedan más tareas sin proyecto que con la bandera.
    const conPila = notas.reduce(
      (s, { rel, raw }) =>
        s +
        indexar(parseDocumento(raw), rel).filter((t) => t.proyecto === null && t.area === null)
          .length,
      0,
    );
    expect(conPila).toBeGreaterThan(total("tareasSinHeadingSemantico"));
  });
});
