import { describe, expect, it } from "vitest";
import {
  columnaDelCheckbox,
  columnaDelContenido,
  esTarea,
  estadoDe,
  parseBullet,
  parseHeading,
  renderBullet,
  renderHeading,
} from "../src/linea.js";

/**
 * Los casos salen del corpus real (`tareas_COLE.md`), no de ejemplos
 * inventados: la gramática tiene que aguantar lo que hay escrito, incluidos
 * los tabs, los `- [ ]` vacíos y los bullets con markdown adentro.
 */
const DEL_CORPUS: [string, string][] = [
  ["tarea raíz", "- [ ] IB"],
  ["tarea con dos tabs", "\t\t- [ ] temas:"],
  ["tarea con tres tabs y sin texto", "\t\t\t- [ ] "],
  ["bullet sin checkbox", "- pasar notas a la app"],
  ["bullet con negrita", "- **primero**"],
  ["bullet indentado", "\t- 1A"],
  ["tarea completada", "- [x] hecha"],
  ["tarea con corchetes en el texto", "- [ ] armar grupos de trabajo [sólo falta: 1A]"],
];

describe("parseBullet", () => {
  it("es reversible byte por byte en todo el corpus", () => {
    for (const [nombre, linea] of DEL_CORPUS) {
      const b = parseBullet(linea);
      expect(b, nombre).not.toBeNull();
      expect(renderBullet(b!), nombre).toBe(linea);
    }
  });

  it("separa los pedazos de una tarea indentada", () => {
    expect(parseBullet("\t\t- [ ] temas:")).toEqual({
      indent: "\t\t",
      marcador: "-",
      espacio: " ",
      checkbox: "[ ] ",
      contenido: "temas:",
    });
  });

  it("un bullet sin checkbox no inventa uno", () => {
    const b = parseBullet("\t- 1A")!;
    expect(b.checkbox).toBeNull();
    expect(estadoDe(b)).toBeNull();
    expect(b.contenido).toBe("1A");
  });

  it("`- [ ]` al final de línea es checkbox aunque no tenga espacio detrás", () => {
    const b = parseBullet("- [ ]")!;
    expect(b.checkbox).toBe("[ ]");
    expect(b.contenido).toBe("");
  });

  it("`- [ ]texto` no es checkbox: ni Obsidian ni Outliner lo aceptan", () => {
    const b = parseBullet("- [ ]texto")!;
    expect(b.checkbox).toBeNull();
    expect(b.contenido).toBe("[ ]texto");
  });

  it("acepta los otros marcadores de lista", () => {
    for (const linea of ["* [ ] con asterisco", "+ [ ] con más", "1. [ ] numerada", "1) [ ] otra"]) {
      expect(renderBullet(parseBullet(linea)!)).toBe(linea);
    }
  });

  it("no es un bullet: headings, texto libre, línea vacía, tabla", () => {
    for (const linea of ["## WORKBENCH | [[tareas_LOG]]", "texto suelto", "", "\t", "| a | b |", "---"]) {
      expect(parseBullet(linea), linea).toBeNull();
    }
  });

  it("un guion pelado sin espacio no es un ítem de lista", () => {
    expect(parseBullet("-")).toBeNull();
  });
});

describe("esTarea", () => {
  it("un checkbox vacío no es una tarea (invariante 8)", () => {
    // Los 11 separadores del corpus. Contarlos mostraría en las vistas
    // tareas que nadie escribió.
    for (const linea of ["- [ ]", "- [ ] ", "\t\t\t- [ ] ", "- [ ]   "]) {
      expect(esTarea(parseBullet(linea)!), linea).toBe(false);
    }
  });

  it("un bullet sin checkbox tampoco lo es", () => {
    expect(esTarea(parseBullet("- pasar notas a la app")!)).toBe(false);
  });

  it("con checkbox y texto, sí", () => {
    expect(esTarea(parseBullet("- [ ] IB")!)).toBe(true);
    expect(esTarea(parseBullet("- [x] hecha")!)).toBe(true);
  });
});

describe("columnas", () => {
  it("dónde empieza el checkbox y dónde el contenido", () => {
    const b = parseBullet("\t\t- [ ] temas:")!;
    expect(columnaDelCheckbox(b)).toBe(4); // dos tabs + "-" + " "
    expect(columnaDelContenido(b)).toBe(8); // + "[ ] "
    expect("\t\t- [ ] temas:".slice(columnaDelContenido(b))).toBe("temas:");
  });

  it("sin checkbox, las dos columnas coinciden", () => {
    const b = parseBullet("\t- 1A")!;
    expect(columnaDelCheckbox(b)).toBe(columnaDelContenido(b));
  });
});

/**
 * Los headings del corpus, en sus tres formas reales. La forma dominante es la
 * de texto plano: 15 de los 18 headings semánticos no tienen corchetes. Por
 * decisión del usuario **solo el wikilink define proyecto o área**; el texto
 * plano queda registrado en `candidatoPlano` para la migración de la §19.1.
 */
describe("parseHeading", () => {
  it("es reversible byte por byte", () => {
    for (const l of [
      "# PERSONAL",
      "## WORKBENCH | [[tareas_LOG]]",
      "#### MINT 6 ⮕ p_6_Sheets",
      "###### hasta seis",
      "#  dos espacios",
      "#\tcon tab",
      "## con espacios al final   ",
      "# ",
    ]) {
      const h = parseHeading(l);
      expect(h, l).not.toBeNull();
      expect(renderHeading(h!), l).toBe(l);
    }
  });

  it("el nivel sale de los numerales", () => {
    expect(parseHeading("### x")!.nivel).toBe(3);
    expect(parseHeading("###### x")!.nivel).toBe(6);
  });

  it("el tipo sale del prefijo del destino del wikilink, no del nivel (D6)", () => {
    // El mismo nivel, los tres tipos: es la razón de ser de D6.
    expect(parseHeading("#### [[p_6_Sheets]]")).toMatchObject({
      tipo: "proyecto",
      destino: "p_6_Sheets",
    });
    expect(parseHeading("#### [[a_Reuniones semanales]]")).toMatchObject({
      tipo: "área",
      destino: "a_Reuniones semanales",
    });
    // Un enlace a otra cosa es sección: la §4.1 lo dice explícitamente.
    // `medir-tareas.mjs` lo cuenta aparte como «enlace-otro»; no es un bug de
    // ninguno de los dos, es que la spec pliega esa categoría dentro de sección.
    expect(parseHeading("## WORKBENCH | [[tareas_LOG]]")).toMatchObject({
      tipo: "sección",
      destino: null,
    });
  });

  it("un wikilink con ancla o con alias sigue apuntando al proyecto", () => {
    expect(parseHeading("## [[p_X#junio]]")!.destino).toBe("p_X");
    expect(parseHeading("## [[p_X|otro nombre]]")!.destino).toBe("p_X");
  });

  it("un proyecto en texto plano NO es proyecto, pero queda anotado", () => {
    // Las tres formas que existen hoy en el vault.
    for (const [linea, candidato] of [
      ["#### MINT 6 ⮕ p_6_Sheets", "p_6_Sheets"],
      ["#### p_PKM", "p_PKM"],
      ["# p_HOGAR → CHARCAS 5142", "p_HOGAR → CHARCAS 5142"],
      ["#### IB, MATE, etc. ⮕ a_Reuniones con Gabi V.", "a_Reuniones con Gabi V."],
    ] as const) {
      const h = parseHeading(linea)!;
      expect(h.tipo, linea).toBe("sección");
      expect(h.destino, linea).toBeNull();
      expect(h.candidatoPlano, linea).toBe(candidato);
    }
  });

  it("un `a_` en medio de una palabra no es una referencia", () => {
    // `casa_Zapiola` y `**casa_Soler**` son secciones del corpus; leerlas como
    // área inventaría un área por cada casa.
    for (const l of ["### casa_Zapiola :LiHouse:", "### **casa_Soler** :LiWarehouse:"]) {
      expect(parseHeading(l)!.candidatoPlano, l).toBeNull();
    }
  });

  it("con wikilink semántico no hay candidato que migrar", () => {
    expect(parseHeading("## [[p_X]]")!.candidatoPlano).toBeNull();
  });

  it("no es un heading: sin espacio, siete numerales, bullet, texto", () => {
    for (const l of ["#tag", "####### siete", "- [ ] tarea", "texto", "", "#"]) {
      expect(parseHeading(l), l).toBeNull();
    }
  });
});
