import { describe, expect, it } from "vitest";
import { esNotaDeTareas, NOTA_DE_LOG_POR_OMISION, NOTAS_POR_OMISION } from "../src/notas.js";

/** Una lista inventada con las formas de la real: carpeta, prefijo y un acento. */
const LISTA = [
  "0_inbox/tareas_CASA.md",
  "0_inbox/tareas_TRABAJO.md",
  "0_inbox/tareas_CÍCLICAS.md".normalize("NFC"),
];

describe("la lista por omisión", () => {
  /**
   * Hasta el 29/09/2026 eran las rutas del vault de desarrollo, compiladas en
   * el bundle. Un plugin que se instala en otro vault no puede proponer notas
   * que ahí no existen, ni publicar las de su autor.
   */
  it("está vacía, y la nota de historial también", () => {
    expect(NOTAS_POR_OMISION).toEqual([]);
    expect(NOTA_DE_LOG_POR_OMISION).toBe("");
  });
});

describe("esNotaDeTareas", () => {
  it("las notas de la lista son notas de tareas", () => {
    for (const n of LISTA) expect(esNotaDeTareas(n, LISTA)).toBe(true);
  });

  it("cualquier otra nota del vault queda afuera", () => {
    for (const otra of [
      "0_inbox/workbench.md",
      "1_proyectos/p_6_Sheets.md",
      "0_inbox/tareas_CASA.canvas",
      "tareas_CASA.md", // misma hoja, otra carpeta
    ]) {
      expect(esNotaDeTareas(otra, LISTA), otra).toBe(false);
    }
  });

  it("sin archivo abierto no actúa", () => {
    expect(esNotaDeTareas(null, LISTA)).toBe(false);
    expect(esNotaDeTareas(undefined, LISTA)).toBe(false);
    expect(esNotaDeTareas("", LISTA)).toBe(false);
  });

  it("una lista vacía apaga el plugin en todo el vault", () => {
    expect(esNotaDeTareas("0_inbox/tareas_CASA.md", [])).toBe(false);
  });

  /**
   * El acento de `tareas_CÍCLICAS.md`. Si la ruta llega descompuesta —otro
   * sistema de archivos, Sync, un `readdir` de macOS— la comparación falla sin
   * decir nada y el plugin simplemente no hace nada en esa nota, que es
   * indistinguible de un bug del filtro.
   */
  it("compara en NFC de los dos lados", () => {
    const nfc = "0_inbox/tareas_CÍCLICAS.md".normalize("NFC");
    const nfd = nfc.normalize("NFD");
    expect(nfc).not.toBe(nfd);
    expect(esNotaDeTareas(nfd, LISTA)).toBe(true);
    expect(esNotaDeTareas(nfc, [nfd])).toBe(true);
  });
});
