import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  aplicarPlan,
  claveEnLinea,
  elegirTarea,
  planDeCompletar,
  planDeWorkbench,
  yaEstaCompleta,
} from "../src/acciones.js";
import { parseDocumento, renderDocumento } from "../src/documento.js";
import { claveDe, indexar } from "../src/tareas.js";
import { documento } from "./arbitrarios.js";

const HOY = "2026-08-24";
const A = "n.md";

const armar = (raw: string) => {
  const doc = parseDocumento(raw);
  return { doc, tareas: indexar(doc, A) };
};

const completar = (raw: string, linea: number) => {
  const { doc, tareas } = armar(raw);
  const plan = planDeCompletar(doc, tareas, claveDe(A, linea), HOY);
  return { plan, texto: renderDocumento(aplicarPlan(doc, plan)) };
};

/**
 * Un azar determinista, para que los tests no dependan del reloj ni de la suerte.
 *
 * La primera versión era `() => 0.5` y **hacía fallar cuatro propiedades**. No
 * por un bug del código: `nuevoId` prueba 16 veces por largo antes de agrandar,
 * y con una fuente constante las 16 dan el mismo id, así que solo puede producir
 * cinco ids en toda su vida —`ssss`, `sssss`, … `ssssssss`— y en el sexto tira.
 * Cualquier subárbol de seis tareas rompía la propiedad.
 *
 * Es la lección de la sesión 2 otra vez: cuando una propiedad falla, la primera
 * pregunta es si el generador dice la verdad. Un LCG barato la dice; una
 * constante, no.
 */
function azar(semilla = 1): () => number {
  let x = semilla >>> 0;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 0x100000000;
  };
}

/** Un azar fijo, para los casos donde el id concreto importa. */
const dado = (...valores: number[]) => {
  let i = 0;
  return () => valores[i++ % valores.length]!;
};

const workbench = (raw: string, linea: number, wb: string, ids = new Set<string>()) => {
  const { doc, tareas } = armar(raw);
  const plan = planDeWorkbench(doc, tareas, claveDe(A, linea), wb, ids, dado(0));
  return { plan, texto: renderDocumento(aplicarPlan(doc, plan)) };
};

describe("planDeCompletar — «completar y descartar» (§12)", () => {
  it("una hoja queda [x] con la fecha de hoy", () => {
    expect(completar("- [ ] llamar", 0).texto).toBe(`- [x] llamar %%t:done=${HOY}%%`);
  });

  it("no borra la línea: la tarea queda en su lugar y las vistas la ocultan", () => {
    const { texto } = completar("# h\n- [ ] a\n- [ ] b", 1);
    expect(texto.split("\n")).toHaveLength(3);
  });

  it("marcar la madre completa a las hijas (§9)", () => {
    const { plan, texto } = completar("- [ ] madre\n\t- [ ] hija\n\t\t- [ ] nieta", 0);
    expect(plan).toHaveLength(3);
    expect(texto).toBe(
      `- [x] madre %%t:done=${HOY}%%\n\t- [x] hija %%t:done=${HOY}%%\n\t\t- [x] nieta %%t:done=${HOY}%%`,
    );
  });

  it("completar una hija no toca a la madre (la asimetría de la §9)", () => {
    const { plan } = completar("- [ ] madre\n\t- [ ] hija", 1);
    expect(plan.map((c) => c.linea)).toEqual([1]);
  });

  it("los bullets sin checkbox del subárbol quedan verbatim (invariante 3)", () => {
    const raw = "- [ ] madre\n\t- dato de pago: 123\n\t- [ ] hija";
    const { plan, texto } = completar(raw, 0);
    expect(plan.map((c) => c.linea)).toEqual([0, 2]);
    expect(texto.split("\n")[1]).toBe("\t- dato de pago: 123");
  });

  it("un `- [ ]` vacío no es una tarea y no entra al plan (invariante 8)", () => {
    const { plan } = completar("- [ ] madre\n\t- [ ] \n\t- [ ] hija", 0);
    expect(plan.map((c) => c.linea)).toEqual([0, 2]);
  });

  it("una hija ya completada con otra fecha conserva la suya", () => {
    // Pisarla convertiría «terminé esto el martes» en «terminé todo hoy».
    const raw = "- [ ] madre\n\t- [x] hija %%t:done=2026-01-05%%";
    expect(completar(raw, 0).texto.split("\n")[1]).toBe("\t- [x] hija %%t:done=2026-01-05%%");
  });

  it("una línea con el token ilegible no se reescribe (§5.3, invariante 7)", () => {
    const raw = "- [ ] rota %%t:campo=raro%%";
    expect(completar(raw, 0)).toMatchObject({ plan: [], texto: raw });
  });

  it("el plan conserva la línea original en `antes`", () => {
    const raw = "# h\n- [ ] a";
    expect(completar(raw, 1).plan[0]).toMatchObject({ linea: 1, antes: "- [ ] a" });
  });

  it("una tarea ya completa no genera plan, y `yaEstaCompleta` lo dice", () => {
    const raw = `- [x] hecha %%t:done=${HOY}%%`;
    const { doc, tareas } = armar(raw);
    expect(yaEstaCompleta(tareas, claveDe(A, 0))).toBe(true);
    expect(planDeCompletar(doc, tareas, claveDe(A, 0), HOY)).toEqual([]);
  });

  it("una madre completa con una hija pendiente todavía tiene algo que hacer", () => {
    const raw = `- [x] madre %%t:done=${HOY}%%\n\t- [ ] hija`;
    const { tareas } = armar(raw);
    expect(yaEstaCompleta(tareas, claveDe(A, 0))).toBe(false);
    expect(completar(raw, 0).plan.map((c) => c.linea)).toEqual([1]);
  });
});

describe("planDeWorkbench — el árbol completo, con id al entrar (§9, §5.4)", () => {
  it("entrar escribe el wb y un id nuevo", () => {
    expect(workbench("- [ ] a", 0, "foco").texto).toBe("- [ ] a %%t:id=aaaa;wb=foco%%");
  });

  it("va el árbol completo, no la hoja suelta", () => {
    const { plan } = workbench("- [ ] madre\n\t- [ ] hija", 0, "foco");
    expect(plan.map((c) => c.linea)).toEqual([0, 1]);
  });

  it("cada tarea del lote recibe un id distinto", () => {
    const { texto } = workbench("- [ ] madre\n\t- [ ] hija", 0, "foco", new Set());
    const ids = [...texto.matchAll(/id=([a-z0-9]+)/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(2);
  });

  it("no repite un id que ya existe en otra nota", () => {
    const { texto } = workbench("- [ ] a", 0, "foco", new Set(["aaaa"]));
    // Comparar el id extraído, no la subcadena: `id=aaaaa` **contiene**
    // `id=aaaa`, y la primera versión de este test pasaba por eso.
    expect(texto).toMatch(/%%t:id=[a-z0-9]{4,8};wb=foco%%/);
    expect(/id=([a-z0-9]+)/.exec(texto)![1]).not.toBe("aaaa");
  });

  it("salir saca el wb y **conserva** el id: es identidad, no pertenencia", () => {
    const raw = "- [ ] a %%t:id=k3f9;wb=foco%%";
    expect(workbench(raw, 0, "foco").texto).toBe("- [ ] a %%t:id=k3f9%%");
  });

  it("salir de uno no toca los otros workbenches", () => {
    const raw = "- [ ] a %%t:id=k3f9;wb=foco,mudanza%%";
    expect(workbench(raw, 0, "foco").texto).toBe("- [ ] a %%t:id=k3f9;wb=mudanza%%");
  });

  it("el toggle lo decide la raíz y se aplica a todo el subárbol", () => {
    // La raíz está adentro, la hija no: el clic saca a las dos. Mirar cada
    // línea por separado dejaría el árbol mitad adentro y mitad afuera.
    const raw = "- [ ] madre %%t:id=aaaa;wb=foco%%\n\t- [ ] hija %%t:id=bbbb%%";
    const { texto } = workbench(raw, 0, "foco");
    expect(texto).toBe("- [ ] madre %%t:id=aaaa%%\n\t- [ ] hija %%t:id=bbbb%%");
  });

  it("entrando, una tarea que ya estaba en ese wb no se duplica ni se reescribe", () => {
    const raw = "- [ ] madre %%t:id=aaaa%%\n\t- [ ] hija %%t:id=bbbb;wb=foco%%";
    const { plan, texto } = workbench(raw, 0, "foco");
    expect(plan.map((c) => c.linea)).toEqual([0]);
    expect(texto.split("\n")[1]).toBe("\t- [ ] hija %%t:id=bbbb;wb=foco%%");
  });

  it("una línea ilegible se saltea y no gasta un id", () => {
    const raw = "- [ ] madre\n\t- [ ] rota %%t:campo=raro%%";
    const { plan, texto } = workbench(raw, 0, "foco");
    expect(plan.map((c) => c.linea)).toEqual([0]);
    expect(texto.split("\n")[1]).toBe("\t- [ ] rota %%t:campo=raro%%");
  });

  it("los bullets sin checkbox no entran al plan", () => {
    const { plan } = workbench("- [ ] madre\n\t- una nota\n\t- [ ] hija", 0, "foco");
    expect(plan.map((c) => c.linea)).toEqual([0, 2]);
  });

  it("una clave que no es de ninguna tarea no genera plan", () => {
    const { doc, tareas } = armar("# solo un heading");
    expect(planDeWorkbench(doc, tareas, claveDe(A, 0), "foco", new Set())).toEqual([]);
    expect(claveEnLinea(tareas, A, 0)).toBeNull();
  });
});

// --------------------------------------------------------------- propiedades

const corridas = { numRuns: 300 };

/** Un documento y la clave de una de sus tareas, si tiene alguna. */
const docConTarea = documento
  .map((raw) => ({ raw, tareas: indexar(parseDocumento(raw), A) }))
  .filter((x) => x.tareas.length > 0)
  .chain((x) =>
    fc.nat({ max: x.tareas.length - 1 }).map((i) => ({
      raw: x.raw,
      clave: claveDe(A, x.tareas[i]!.linea),
    })),
  );

describe("propiedades de los planes", () => {
  it("todo cambio lleva en `antes` la línea que de verdad está ahí", () => {
    // Es lo que hace posible el invariante 10: sin esto, `ubicar.ts` no tendría
    // contra qué comparar.
    fc.assert(
      fc.property(docConTarea, fc.constantFrom("foco", "mudanza"), ({ raw, clave }, wb) => {
        const doc = parseDocumento(raw);
        const tareas = indexar(doc, A);
        for (const plan of [
          planDeCompletar(doc, tareas, clave, HOY),
          planDeWorkbench(doc, tareas, clave, wb, new Set(), azar()),
        ]) {
          for (const c of plan) expect(c.antes).toBe(doc.lineas[c.linea]!.texto);
        }
      }),
      corridas,
    );
  });

  it("ningún plan toca una línea que no sea una tarea", () => {
    // Headings, texto libre, tablas, `- [ ]` vacíos y bullets sin checkbox: los
    // invariantes 3 y 8 sobre las dos acciones nuevas.
    fc.assert(
      fc.property(docConTarea, ({ raw, clave }) => {
        const doc = parseDocumento(raw);
        const tareas = indexar(doc, A);
        const deTarea = new Set(tareas.map((t) => t.linea));
        for (const plan of [
          planDeCompletar(doc, tareas, clave, HOY),
          planDeWorkbench(doc, tareas, clave, "foco", new Set(), azar()),
        ]) {
          for (const c of plan) expect(deTarea.has(c.linea), `línea ${c.linea}`).toBe(true);
        }
      }),
      corridas,
    );
  });

  it("completar dos veces seguidas da el mismo archivo", () => {
    fc.assert(
      fc.property(docConTarea, ({ raw, clave }) => {
        const uno = parseDocumento(raw);
        const dos = aplicarPlan(uno, planDeCompletar(uno, indexar(uno, A), clave, HOY));
        const tres = aplicarPlan(dos, planDeCompletar(dos, indexar(dos, A), clave, HOY));
        expect(renderDocumento(tres)).toBe(renderDocumento(dos));
      }),
      corridas,
    );
  });

  it("el toggle del workbench se estabiliza, y el id no se regenera nunca", () => {
    // La primera versión de esta propiedad decía «período 2 desde la primera
    // vuelta» y **afirmaba algo más fuerte que la verdad**. El contraejemplo:
    // una tarea que ya tiene `wb=foco` y **no** tiene id —estado que la §5.4
    // anticipa, porque un Backspace puede llevarse parte del token—. Ahí el
    // primer paso es «sale» y no escribe id; el segundo es «entra» y sí. Recién
    // desde el segundo alterna.
    //
    // Lo que sí vale desde siempre, y es lo que de verdad importa, es que un id
    // ya escrito no se toca: es identidad, no pertenencia.
    fc.assert(
      fc.property(docConTarea, ({ raw, clave }) => {
        const paso = (d: ReturnType<typeof parseDocumento>) =>
          aplicarPlan(d, planDeWorkbench(d, indexar(d, A), clave, "foco", new Set(), azar()));
        const ids = (d: ReturnType<typeof parseDocumento>) =>
          indexar(d, A)
            .map((t) => `${t.linea}=${t.id}`)
            .filter((x) => !x.endsWith("=null"));

        const dos = paso(paso(parseDocumento(raw)));
        const tres = paso(dos);
        const cuatro = paso(tres);

        expect(renderDocumento(cuatro)).toBe(renderDocumento(dos));
        expect(ids(tres)).toEqual(ids(dos));
        expect(ids(cuatro)).toEqual(ids(dos));
      }),
      corridas,
    );
  });

  it("el plan nunca cambia la cantidad de líneas del archivo", () => {
    // Un plan solo reemplaza; insertar o borrar es otra operación y otra
    // sesión. `ubicar.ts` se apoya en esto para resolver todo contra el
    // documento original.
    fc.assert(
      fc.property(docConTarea, ({ raw, clave }) => {
        const doc = parseDocumento(raw);
        const tareas = indexar(doc, A);
        const plan = [
          ...planDeCompletar(doc, tareas, clave, HOY),
          ...planDeWorkbench(doc, tareas, clave, "foco", new Set(), azar()),
        ];
        for (const c of plan) expect(c.despues.includes("\n")).toBe(false);
      }),
      corridas,
    );
  });
});


describe("elegirTarea — el bug de B5, y el que no se veía", () => {
  const NOTAS = [A];
  const cursor = (linea: number, texto: string) => ({ linea, texto });
  const elegir = (raw: string, c: { linea: number; texto: string }, archivo = A) => {
    const doc = parseDocumento(raw);
    return elegirTarea(archivo, NOTAS, doc, indexar(doc, A), c);
  };

  const NOTA = ["# h", "- [ ] primera", "- [ ] segunda", "- una nota", "- [ ] "].join("\n");

  it("el caso normal: índice al día, se elige la del cursor", () => {
    expect(elegir(NOTA, cursor(2, "- [ ] segunda"))).toEqual({
      estado: "ok",
      clave: claveDe(A, 2),
    });
  });

  it("una nota fuera de la lista no se toca", () => {
    expect(elegir(NOTA, cursor(1, "- [ ] primera"), "otra.md")).toEqual({
      estado: "fuera-de-la-lista",
    });
    expect(elegirTarea(null, NOTAS, null, [], cursor(0, "- [ ] x"))).toEqual({
      estado: "fuera-de-la-lista",
    });
  });

  it("sin índice todavía, lo dice y no adivina", () => {
    expect(elegirTarea(A, NOTAS, null, [], cursor(1, "- [ ] primera"))).toEqual({
      estado: "sin-indice",
    });
  });

  it.each([
    ["un heading", 0, "# h"],
    ["un bullet sin checkbox", 3, "- una nota"],
    ["un `- [ ]` vacío", 4, "- [ ] "],
    ["una línea en blanco", 0, ""],
  ])("sobre %s contesta «no hay tarea» con el texto vivo, sin consultar el índice", (_q, n, t) => {
    expect(elegir(NOTA, cursor(n, t))).toEqual({ estado: "sin-tarea" });
  });

  describe("con el índice desfasado — es lo que falló en B5", () => {
    // El índice quedó con la nota original; el editor tiene cinco líneas más
    // arriba, así que el cursor dice 7 donde el índice dice 2.
    const doc = parseDocumento(NOTA);
    const tareas = indexar(doc, A);
    const desfasada = (linea: number, texto: string) =>
      elegirTarea(A, NOTAS, doc, tareas, cursor(linea, texto));

    it("traduce la coordenada del cursor a la del índice por el texto", () => {
      expect(desfasada(7, "- [ ] segunda")).toEqual({ estado: "ok", clave: claveDe(A, 2) });
    });

    it("**no elige la tarea equivocada**, que era el bug que no se veía", () => {
      // Con el índice viejo, la línea 1 del cursor cae sobre «primera». Pero el
      // usuario está parado sobre «segunda», corrida por una línea nueva arriba.
      // La versión anterior hacía `claveDe(archivo, 1)` y completaba «primera»
      // sin decir nada, y `ubicar.ts` escribía esa línea impecablemente.
      const elegida = desfasada(1, "- [ ] segunda");
      expect(elegida).toEqual({ estado: "ok", clave: claveDe(A, 2) });
      expect(elegida).not.toEqual({ estado: "ok", clave: claveDe(A, 1) });
    });

    it("una tarea que el índice no tiene todavía se informa aparte", () => {
      // Recién tecleada, o el índice congelado. No es «no hay tarea acá»: hay
      // una, y mandar a mirar el cursor sería mandar a mirar donde no está.
      expect(desfasada(9, "- [ ] tercera, recién escrita")).toEqual({ estado: "ausente" });
    });

    it("si el texto está repetido y la línea no coincide, no se adivina", () => {
      const conDup = parseDocumento(["- [ ] igual", "- [ ] otra", "- [ ] igual"].join("\n"));
      expect(
        elegirTarea(A, NOTAS, conDup, indexar(conDup, A), cursor(9, "- [ ] igual")),
      ).toEqual({ estado: "ambigua", veces: 2 });
    });

    it("pero si la línea del cursor coincide, se usa esa aunque el texto se repita", () => {
      const conDup = parseDocumento(["- [ ] igual", "- [ ] otra", "- [ ] igual"].join("\n"));
      expect(
        elegirTarea(A, NOTAS, conDup, indexar(conDup, A), cursor(2, "- [ ] igual")),
      ).toEqual({ estado: "ok", clave: claveDe(A, 2) });
    });
  });

  it("propiedad: con el índice al día, elegir siempre da la tarea de esa línea", () => {
    fc.assert(
      fc.property(docConTarea, ({ raw, clave }) => {
        const doc = parseDocumento(raw);
        const tareas = indexar(doc, A);
        const n = Number(clave.split(":")[1]);
        expect(elegirTarea(A, NOTAS, doc, tareas, cursor(n, doc.lineas[n]!.texto))).toEqual({
          estado: "ok",
          clave,
        });
      }),
      corridas,
    );
  });

  it("propiedad: con k líneas tecleadas arriba, se sigue eligiendo la misma tarea", () => {
    fc.assert(
      fc.property(docConTarea, fc.integer({ min: 1, max: 8 }), ({ raw, clave }, k) => {
        const doc = parseDocumento(raw);
        const tareas = indexar(doc, A);
        const n = Number(clave.split(":")[1]);
        const texto = doc.lineas[n]!.texto;
        // Solo cuando el texto es único: con uno repetido, negarse es correcto.
        if (doc.lineas.filter((l) => l.texto === texto).length !== 1) return;

        // El índice sigue siendo `doc`; el cursor viene corrido k líneas.
        expect(elegirTarea(A, NOTAS, doc, tareas, cursor(n + k, texto))).toEqual({
          estado: "ok",
          clave,
        });
      }),
      corridas,
    );
  });
});
