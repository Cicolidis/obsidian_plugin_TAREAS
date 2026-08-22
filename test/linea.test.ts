import { describe, expect, it } from "vitest";
import {
  columnaDelCheckbox,
  columnaDelContenido,
  esTarea,
  estadoDe,
  parseBullet,
  renderBullet,
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
