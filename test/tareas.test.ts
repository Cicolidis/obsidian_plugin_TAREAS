import { describe, expect, it } from "vitest";
import { parseDocumento } from "../src/documento.js";
import {
  claveDe,
  idsACompletar,
  idsADestildar,
  indexar,
  prioridadEfectiva,
  subarbolDe,
} from "../src/tareas.js";
import { fixture } from "./fixtures.js";

const indexarTexto = (raw: string, archivo = "n.md") => indexar(parseDocumento(raw), archivo);
const buscar = (raw: string, texto: string) => {
  const t = indexarTexto(raw).find((x) => x.texto.startsWith(texto));
  if (!t) throw new Error(`no hay tarea que empiece con ${JSON.stringify(texto)}`);
  return t;
};

describe("indexar", () => {
  it("un `- [ ]` vacío no es nunca una tarea (invariante 8)", () => {
    const tareas = indexarTexto(fixture("arbol"));
    expect(tareas.every((t) => t.texto !== "")).toBe(true);
    // Y el separador tampoco se cuela como nota de nadie.
    expect(tareas.flatMap((t) => t.notas).every((n) => n.trim() !== "")).toBe(true);
  });

  it("un bullet sin checkbox nunca es una tarea", () => {
    const tareas = indexarTexto("- una lista\n- [ ] una tarea");
    expect(tareas).toHaveLength(1);
    expect(tareas[0]!.texto).toBe("una tarea");
  });

  it("lee el estado del checkbox", () => {
    expect(buscar("- [x] hecha", "hecha").hecha).toBe(true);
    expect(buscar("- [ ] pendiente", "pendiente").hecha).toBe(false);
  });

  it("saca el token del texto y lo reparte en los campos", () => {
    const t = buscar("- [ ] llamar %%t:id=a3f2;wb=foco;due=2026-09-01;p=1%%", "llamar");
    expect(t.texto).toBe("llamar");
    expect(t).toMatchObject({
      id: "a3f2",
      workbenches: ["foco"],
      due: "2026-09-01",
      prioridad: 1,
    });
  });

  it("una tarea con token ilegible se ve, sin metadatos (§5.3)", () => {
    const t = indexarTexto("- [ ] x %%t:zz=1%%")[0]!;
    expect(t.id).toBeNull();
    expect(t.workbenches).toEqual([]);
    // El texto queda con el token adentro: el plugin no lo interpreta, pero
    // tampoco lo esconde. Lo que importa es que nadie lo reescriba.
    expect(t.texto).toBe("x %%t:zz=1%%");
  });
});

describe("herencia de headings", () => {
  const raw = fixture("headings");

  it("el proyecto sale del wikilink más cercano hacia arriba", () => {
    expect(buscar(raw, "cuelga de un proyecto").proyecto).toBe("p_Proyecto con wikilink");
  });

  it("un proyecto bajo un área hereda el área (§4.1)", () => {
    const t = buscar(raw, "hereda el área");
    expect(t.proyecto).toBe("p_Anidado bajo el área");
    expect(t.area).toBe("a_Un área");
  });

  it("un heading del mismo nivel saca al anterior de la pila, no lo hereda", () => {
    // Es la diferencia con la bandera pegajosa de `medir-tareas.mjs`: sin la
    // pila, un proyecto se derrama sobre las secciones que vienen después.
    const t = buscar(raw, "enlace a otra cosa");
    expect(t.proyecto).toBeNull();
    expect(t.area).toBeNull();
    expect(t.seccion).toBe("WORKBENCH | [[otra_nota]]");
  });

  it("un heading en texto plano hoy no da proyecto", () => {
    for (const texto of ["hoy esto es sección", "la segunda forma", "la tercera forma"]) {
      expect(buscar(raw, texto).proyecto, texto).toBeNull();
    }
  });

  it("la sección es el heading no semántico más cercano", () => {
    expect(buscar(raw, "cuelga de un proyecto").seccion).toBe("nivel uno como sección");
  });
});

describe("árboles (§9)", () => {
  const raw = fixture("arbol");

  it("el nivel cuenta tareas, no sangría", () => {
    // Bajo un grupo, la tarea es raíz aunque esté indentada.
    expect(buscar(raw, "la agrupada").nivel).toBe(0);
    expect(buscar(raw, "la agrupada").padre).toBeNull();
    // Y en el árbol de seis, cada nivel suma uno.
    expect(buscar(raw, "seis").nivel).toBe(5);
  });

  it("una tarea que cuelga de un separador es raíz, no hija del vacío", () => {
    const t = buscar(raw, "cuelga de un separador");
    expect(t.padre).toBe(claveDe("n.md", buscar(raw, "después del separador").linea));
  });

  it("los bullets sin checkbox van a `notas`, verbatim", () => {
    expect(buscar(raw, "tarea con instructivo").notas).toEqual([
      "primer paso del instructivo",
      "segundo paso",
      "detalle del segundo paso",
    ]);
  });

  it("las notas de una subtarea no se las queda la madre", () => {
    const r = "- [ ] madre\n\t- nota de la madre\n\t- [ ] hija\n\t\t- nota de la hija";
    expect(buscar(r, "madre").notas).toEqual(["nota de la madre"]);
    expect(buscar(r, "hija").notas).toEqual(["nota de la hija"]);
  });

  it("el bullet que agrupa queda en `grupo`", () => {
    expect(buscar(raw, "la agrupada").grupo).toBe("**primero**");
    expect(buscar(raw, "algo de esta semana").grupo).toBe("esta semana:");
    expect(buscar(raw, "raíz").grupo).toBeNull();
  });

  it("una tarea madre manda más que un grupo lejano", () => {
    const r = "- grupo\n\t- [ ] madre\n\t\t- [ ] hija";
    expect(buscar(r, "madre").grupo).toBe("grupo");
    expect(buscar(r, "hija").grupo).toBeNull();
  });

  it("subarbolDe devuelve la tarea y todo lo que cuelga, en orden", () => {
    const tareas = indexarTexto(raw);
    const raiz = tareas.find((t) => t.texto === "raíz")!;
    const sub = subarbolDe(tareas, claveDe("n.md", raiz.linea));
    expect(sub.map((t) => t.texto)).toEqual(["raíz", "dos", "tres", "cuatro", "cinco", "seis"]);
  });

  it("marcar el padre completa a los hijos", () => {
    const tareas = indexarTexto(raw);
    const madre = tareas.find((t) => t.texto === "dos")!;
    expect(idsACompletar(tareas, claveDe("n.md", madre.linea))).toHaveLength(5);
  });

  it("completar todos los hijos no completa al padre", () => {
    const tareas = indexarTexto(raw);
    const hija = tareas.find((t) => t.texto === "seis")!;
    const clave = claveDe("n.md", hija.linea);
    expect(idsACompletar(tareas, clave)).toEqual([clave]);
  });

  it("destildar no cae en cascada", () => {
    const tareas = indexarTexto(raw);
    const madre = tareas.find((t) => t.texto === "raíz")!;
    const clave = claveDe("n.md", madre.linea);
    expect(idsADestildar(tareas, clave)).toEqual([clave]);
  });
});

describe("prioridadEfectiva — el nivel que se ve", () => {
  const efectiva = (raw: string, linea: number) =>
    prioridadEfectiva(indexarTexto(raw), claveDe("n.md", linea));

  const ARBOL = [
    "- [ ] madre %%t:p=2%%",
    "\t- [ ] hija",
    "\t\t- [ ] nieta",
    "\t- [ ] hija con la suya %%t:p=1%%",
    "\t\t- [ ] nieta de esa",
    "- [ ] ajena",
  ].join("\n");

  it("la propia gana sobre la del árbol", () => {
    expect(efectiva(ARBOL, 0)).toEqual({ nivel: 2, deArriba: 0 });
    expect(efectiva(ARBOL, 3)).toEqual({ nivel: 1, deArriba: 2 });
  });

  it("la hija hereda de la madre", () => {
    expect(efectiva(ARBOL, 1)).toEqual({ nivel: 2, deArriba: 2 });
  });

  it("la herencia baja más de un nivel", () => {
    expect(efectiva(ARBOL, 2)).toEqual({ nivel: 2, deArriba: 2 });
  });

  /**
   * `deArriba` se calcula aunque la tarea tenga prioridad propia, y ahí estaba
   * el bug A3: bajar a normal una hija con `p=1` propio adentro de un bloque
   * `p=2` le saca el campo y la deja heredando rojo, mientras el aviso decía
   * «Prioridad normal». Para saber si bajar sirve de algo hay que mirar qué
   * queda **después** de sacarle lo suyo.
   */
  it("una tarea con prioridad propia igual sabe qué heredaría sin ella", () => {
    expect(efectiva(ARBOL, 3).deArriba).toBe(2);
    expect(efectiva(ARBOL, 0).deArriba).toBe(0);
  });

  // La misma regla que dibuja `decorar.ts`: si el comando y el color no usaran
  // la misma, dirían cosas distintas sobre la misma línea.
  it("gana la ancestra más cercana", () => {
    expect(efectiva(ARBOL, 4)).toEqual({ nivel: 1, deArriba: 1 });
  });

  it("sin nadie arriba con prioridad, es normal", () => {
    expect(efectiva(ARBOL, 5)).toEqual({ nivel: 0, deArriba: 0 });
  });

  it("una clave que no existe no rompe", () => {
    expect(prioridadEfectiva(indexarTexto(ARBOL), claveDe("n.md", 99))).toEqual({
      nivel: 0,
      deArriba: 0,
    });
  });

  // No se le pudo leer nada, no que se le haya leído un cero.
  it("una madre con el token ilegible no corta la herencia", () => {
    const raw = [
      "- [ ] abuela %%t:p=1%%",
      "\t- [ ] madre rota %%t:p=2;id=A3F2%%",
      "\t\t- [ ] hija",
    ].join("\n");
    expect(efectiva(raw, 1)).toEqual({ nivel: 1, deArriba: 1 });
    expect(efectiva(raw, 2)).toEqual({ nivel: 1, deArriba: 1 });
  });
});
