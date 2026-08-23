import { describe, expect, it } from "vitest";
import {
  arbolDe,
  eliminarLineas,
  insertarLineas,
  lineasDelSubarbol,
  nodoEnLinea,
  parseDocumento,
  rangoDelSubarbol,
  renderDocumento,
} from "../src/documento.js";
import { LINEAS_ANTES_DE_COLAPSAR, naceColapsado, resumenDelSubarbol } from "../src/tareas.js";
import { nuevoId, parseTaskToken } from "../src/token.js";
import { fixture } from "./fixtures.js";

/** El nodo cuyo contenido empieza con este texto. */
function nodo(raw: string, empiezaCon: string) {
  const doc = parseDocumento(raw);
  const arbol = arbolDe(doc);
  const buscar = (ns: ReturnType<typeof arbolDe>): ReturnType<typeof arbolDe>[number] | null => {
    for (const n of ns) {
      if (n.bullet.contenido.startsWith(empiezaCon)) return n;
      const h = buscar(n.hijos);
      if (h) return h;
    }
    return null;
  };
  const n = buscar(arbol);
  if (!n) throw new Error(`no hay nodo que empiece con ${JSON.stringify(empiezaCon)}`);
  return { doc, arbol, nodo: n };
}

describe("insertarLineas / eliminarLineas", () => {
  it("insertar y volver a borrar deja el archivo idéntico", () => {
    const raw = fixture("arbol");
    const doc = parseDocumento(raw);
    for (const n of [0, 5, doc.lineas.length]) {
      const con = insertarLineas(doc, n, ["- [ ] intercalada", "\t- una nota"]);
      expect(renderDocumento(eliminarLineas(con, n, n + 1)), `en ${n}`).toBe(raw);
    }
  });

  it("insertar al final de una nota que no termina en salto no inventa uno", () => {
    // Cinco de las siete notas no terminan en `\n`.
    const doc = parseDocumento("- [ ] a");
    expect(renderDocumento(insertarLineas(doc, 1, ["- [ ] b"]))).toBe("- [ ] a\n- [ ] b");
  });

  it("en una nota que sí termina en salto, el final se mantiene", () => {
    // La última línea de `"a\n"` es la vacía: insertar antes es lo que se
    // quiere, insertar después agregaría un salto de regalo.
    const doc = parseDocumento("- [ ] a\n");
    expect(renderDocumento(insertarLineas(doc, 1, ["- [ ] b"]))).toBe("- [ ] a\n- [ ] b\n");
  });

  it("renumera las líneas que se corrieron", () => {
    const doc = insertarLineas(parseDocumento("- [ ] a\n- [ ] b"), 0, ["## nuevo"]);
    expect(doc.lineas.map((l) => [l.n, l.clase])).toEqual([
      [0, "heading"],
      [1, "tarea"],
      [2, "tarea"],
    ]);
  });

  it("un rango fuera del documento es un error, no un silencio", () => {
    const doc = parseDocumento("- [ ] a");
    expect(() => insertarLineas(doc, 2, ["x"])).toThrow(RangeError);
    expect(() => insertarLineas(doc, -1, ["x"])).toThrow(RangeError);
    expect(() => eliminarLineas(doc, 0, 1)).toThrow(RangeError);
    expect(() => eliminarLineas(doc, 1, 0)).toThrow(RangeError);
  });
});

describe("rangoDelSubarbol / lineasDelSubarbol", () => {
  it("abarca la tarea y todo lo que cuelga, verbatim", () => {
    const { doc, nodo: n } = nodo(fixture("arbol"), "tarea con instructivo");
    expect(lineasDelSubarbol(doc, n)).toEqual([
      "- [ ] tarea con instructivo",
      "\t- primer paso del instructivo",
      "\t- segundo paso",
      "\t\t- detalle del segundo paso",
      "\t- [ ] una subtarea de verdad",
    ]);
  });

  it("incluye los blancos de adentro y no los de después", () => {
    // El árbol no se corta en un blanco: sacarlo cambiaría el texto archivado.
    const raw = "- [ ] madre\n\n\t- [ ] hija\n\n- [ ] otra raíz";
    const { doc, nodo: n } = nodo(raw, "madre");
    expect(rangoDelSubarbol(n)).toEqual({ desde: 0, hasta: 2 });
    expect(lineasDelSubarbol(doc, n)).toEqual(["- [ ] madre", "", "\t- [ ] hija"]);
  });

  it("una hoja es su propia línea y nada más", () => {
    const { nodo: n } = nodo(fixture("arbol"), "seis");
    expect(rangoDelSubarbol(n)).toEqual({ desde: n.n, hasta: n.n });
  });

  it("los subárboles de dos hermanas no se pisan", () => {
    const raw = fixture("arbol");
    const doc = parseDocumento(raw);
    const raices = arbolDe(doc);
    const rangos = raices.map(rangoDelSubarbol).sort((a, b) => a.desde - b.desde);
    for (let i = 1; i < rangos.length; i++) {
      expect(rangos[i]!.desde, `rango ${i}`).toBeGreaterThan(rangos[i - 1]!.hasta);
    }
  });

  it("nodoEnLinea encuentra el nodo por su número de línea", () => {
    const { arbol, nodo: n } = nodo(fixture("arbol"), "raíz");
    expect(nodoEnLinea(arbol, n.n)).toBe(n);
    expect(nodoEnLinea(arbol, 1)).toBeNull(); // una línea que no es de lista
  });
});

describe("resumenDelSubarbol y colapso (§9)", () => {
  it("cuenta líneas, tareas, hechas y notas", () => {
    const { doc, nodo: n } = nodo(fixture("arbol"), "tarea con instructivo");
    expect(resumenDelSubarbol(doc, n)).toEqual({ lineas: 5, tareas: 2, hechas: 0, notas: 3 });
  });

  it("los `- [ ]` vacíos no se cuentan como tareas (invariante 8)", () => {
    const { doc, nodo: n } = nodo("- [ ] madre\n\t- [ ]\n\t- [ ] hija", "madre");
    expect(resumenDelSubarbol(doc, n).tareas).toBe(2);
  });

  it("una hoja nace expandida y un árbol de seis nace colapsado", () => {
    const raw = fixture("arbol");
    const hoja = nodo(raw, "seis");
    const arbol = nodo(raw, "raíz");
    expect(naceColapsado(resumenDelSubarbol(hoja.doc, hoja.nodo))).toBe(false);
    expect(naceColapsado(resumenDelSubarbol(arbol.doc, arbol.nodo))).toBe(true);
  });

  it("el corte está en el valor de la §9 y no en otro", () => {
    expect(LINEAS_ANTES_DE_COLAPSAR).toBe(5);
    expect(naceColapsado({ lineas: 5, tareas: 1, hechas: 0, notas: 0 })).toBe(false);
    expect(naceColapsado({ lineas: 6, tareas: 1, hechas: 0, notas: 0 })).toBe(true);
  });
});

describe("nuevoId (§5.4)", () => {
  it("nace de cuatro caracteres y del alfabeto del token", () => {
    const id = nuevoId(new Set());
    expect(id).toMatch(/^[a-z0-9]{4}$/);
    // Y es un id que el propio parser acepta.
    expect(parseTaskToken(`- [ ] x %%t:id=${id}%%`).estado).toBe("ok");
  });

  it("nunca devuelve uno que ya existe", () => {
    const vistos = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const id = nuevoId(vistos);
      expect(vistos.has(id)).toBe(false);
      vistos.add(id);
    }
  });

  it("crece a cinco caracteres cuando los de cuatro están tomados", () => {
    // Con un generador forzado a un solo valor, los 16 intentos de largo 4
    // chocan siempre y tiene que agrandar. Un camino de choque que no se puede
    // provocar es un camino que no se probó.
    const existentes = new Set(["aaaa", "aaaaa"]);
    expect(nuevoId(existentes, () => 0)).toBe("aaaaaa");
  });

  it("se rinde con un error visible en vez de colgarse", () => {
    // Imposible con este corpus, pero un bucle infinito silencioso sería peor.
    const todo = { has: () => true } as unknown as ReadonlySet<string>;
    expect(() => nuevoId(todo, () => 0)).toThrow(/id libre/);
  });
});
