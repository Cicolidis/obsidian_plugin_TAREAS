import { describe, expect, it } from "vitest";
import {
  arbolDe,
  headingsDe,
  parseDocumento,
  recorrer,
  reemplazarLinea,
  renderDocumento,
  type Nodo,
} from "../src/documento.js";
import { fixture, NOMBRES } from "./fixtures.js";

/** Los roles de los nodos, por número de línea, para comparar cómodo. */
function roles(raw: string): Record<number, string> {
  const salida: Record<number, string> = {};
  for (const n of recorrer(arbolDe(parseDocumento(raw)))) salida[n.n] = n.rol;
  return salida;
}

/** El nodo cuyo contenido empieza con este texto. */
function nodo(raw: string, empiezaCon: string): Nodo {
  const n = recorrer(arbolDe(parseDocumento(raw))).find((x) =>
    x.bullet.contenido.startsWith(empiezaCon),
  );
  if (!n) throw new Error(`no hay nodo que empiece con ${JSON.stringify(empiezaCon)}`);
  return n;
}

describe("parseDocumento / renderDocumento", () => {
  it("no altera un byte de ninguna fixture (invariante 9)", () => {
    for (const nombre of NOMBRES) {
      const raw = fixture(nombre);
      expect(renderDocumento(parseDocumento(raw)), nombre).toBe(raw);
    }
  });

  it("conserva lo que se pierde solo: CRLF, sin salto final, espacios al final", () => {
    // Ninguna de las siete notas tiene CRLF hoy, pero basta que un archivo pase
    // por otro sistema para que llegue así, y el invariante 9 no admite
    // excepciones por procedencia.
    for (const raw of [
      "# a\r\n- [ ] b\r\n",
      "- [ ] sin salto final",
      "- [ ] con espacios   \n\t- nota\t\n",
      "",
      "\n\n\n",
    ]) {
      expect(renderDocumento(parseDocumento(raw)), JSON.stringify(raw)).toBe(raw);
    }
  });

  it("clasifica las cuatro clases de línea de la §4", () => {
    const doc = parseDocumento(fixture("basico"));
    expect(doc.lineas.map((l) => l.clase)).toEqual([
      "heading",
      "otro", // línea en blanco
      "heading",
      "otro",
      "tarea",
      "tarea",
      "bullet",
      "otro",
      "otro", // el salto final produce una línea vacía al final
    ]);
  });

  it("un `- [ ]` vacío no es clase tarea (invariante 8)", () => {
    expect(parseDocumento("- [ ]").lineas[0]!.clase).toBe("bullet");
    expect(parseDocumento("- [ ] ").lineas[0]!.clase).toBe("bullet");
  });
});

describe("reemplazarLinea", () => {
  it("cambia una línea y deja el resto byte por byte", () => {
    const raw = fixture("arbol");
    const doc = parseDocumento(raw);
    const nuevo = reemplazarLinea(doc, 4, "- [x] raíz");
    expect(nuevo.lineas[4]!.texto).toBe("- [x] raíz");
    for (let i = 0; i < doc.lineas.length; i++) {
      if (i === 4) continue;
      expect(nuevo.lineas[i]!.texto, `línea ${i}`).toBe(doc.lineas[i]!.texto);
    }
  });

  it("no muta el documento original", () => {
    const doc = parseDocumento("- [ ] a\n- [ ] b");
    reemplazarLinea(doc, 0, "- [x] a");
    expect(doc.lineas[0]!.texto).toBe("- [ ] a");
  });

  it("reclasifica la línea nueva", () => {
    const doc = reemplazarLinea(parseDocumento("- [ ] a"), 0, "## heading");
    expect(doc.lineas[0]!.clase).toBe("heading");
  });

  it("una línea fuera del documento es un error, no un silencio", () => {
    const doc = parseDocumento("- [ ] a");
    expect(() => reemplazarLinea(doc, 5, "x")).toThrow(RangeError);
    expect(() => reemplazarLinea(doc, -1, "x")).toThrow(RangeError);
  });
});

describe("headingsDe", () => {
  it("los devuelve en orden, con su línea y su tipo", () => {
    const hs = headingsDe(parseDocumento(fixture("headings")));
    expect(hs.map((h) => [h.heading.nivel, h.heading.tipo, h.heading.destino])).toEqual([
      [1, "sección", null],
      [2, "proyecto", "p_Proyecto con wikilink"],
      [2, "área", "a_Un área"],
      [3, "proyecto", "p_Anidado bajo el área"],
      [2, "sección", null], // enlace a otra cosa
      [4, "sección", null], // texto plano
      [6, "sección", null],
      [1, "sección", null],
      [2, "sección", null],
    ]);
  });
});

describe("arbolDe", () => {
  it("anida por ancho de sangría hasta profundidad 6", () => {
    const raiz = nodo(fixture("arbol"), "raíz");
    let n = raiz;
    let profundidad = 1;
    while (n.hijos.length) {
      n = n.hijos[0]!;
      profundidad++;
    }
    expect(profundidad).toBe(6);
  });

  it("un bullet sin checkbox bajo una tarea es una nota (§4.3)", () => {
    const raw = fixture("arbol");
    expect(nodo(raw, "primer paso").rol).toBe("nota");
    expect(nodo(raw, "detalle del segundo").rol).toBe("nota");
    expect(nodo(raw, "una subtarea").rol).toBe("tarea");
  });

  it("un bullet sin checkbox que cuelga tareas es un grupo", () => {
    const raw = fixture("arbol");
    expect(nodo(raw, "**primero**").rol).toBe("grupo");
    expect(nodo(raw, "esta semana:").rol).toBe("grupo");
  });

  it("un bullet sin tareas ni arriba ni abajo queda suelto", () => {
    const raw = fixture("arbol");
    expect(nodo(raw, "una lista de referencia").rol).toBe("suelto");
    expect(nodo(raw, "un ítem").rol).toBe("suelto");
  });

  it("un `- [ ]` vacío es separador, y no convierte en nota a lo que cuelgue", () => {
    const raw = fixture("arbol");
    const sep = recorrer(arbolDe(parseDocumento(raw))).filter((n) => n.rol === "separador");
    expect(sep).toHaveLength(2);
    // La tarea que cuelga de un separador sigue siendo tarea, no se pierde.
    expect(nodo(raw, "cuelga de un separador").rol).toBe("tarea");
  });

  it("gana `nota` cuando un bullet es nota y grupo a la vez", () => {
    // En el corpus no pasa (medido: 0 casos), pero el parser tiene que
    // decidirlo. Gana nota porque las notas se preservan verbatim (§4.3) y
    // equivocarse hacia ese lado no reescribe nada.
    const raw = "- [ ] la madre\n\t- un bullet que es las dos cosas\n\t\t- [ ] una tarea abajo";
    expect(nodo(raw, "un bullet que es").rol).toBe("nota");
  });

  it("una línea en blanco no corta el árbol; una tabla sí", () => {
    const raw = fixture("arbol");
    expect(nodo(raw, "la hija, después de un blanco").indent).toBeGreaterThan(0);
    expect(nodo(raw, "la madre").hijos.map((h) => h.bullet.contenido)).toEqual([
      "la hija, después de un blanco",
    ]);
    // Después de la tabla el árbol arranca de cero: la tarea indentada es raíz.
    const raices = arbolDe(parseDocumento(raw));
    expect(raices.some((r) => r.bullet.contenido.startsWith("esta ya no cuelga"))).toBe(true);
  });

  it("un heading corta el árbol", () => {
    const raices = arbolDe(parseDocumento("- [ ] a\n## corte\n\t- [ ] b"));
    expect(raices).toHaveLength(2);
    expect(raices[1]!.indent).toBe(1);
  });

  it("todos los nodos del corpus sintético tienen un rol", () => {
    for (const nombre of NOMBRES) {
      for (const [n, rol] of Object.entries(roles(fixture(nombre)))) {
        expect(rol, `${nombre}:${n}`).toBeTruthy();
      }
    }
  });
});
