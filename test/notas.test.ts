import { describe, expect, it } from "vitest";
import { esNotaDeTareas, NOTAS_POR_OMISION } from "../src/notas.js";

describe("esNotaDeTareas", () => {
  it("las siete notas medidas están en la lista por omisión", () => {
    expect(NOTAS_POR_OMISION).toHaveLength(7);
    for (const n of NOTAS_POR_OMISION) expect(esNotaDeTareas(n, NOTAS_POR_OMISION)).toBe(true);
  });

  it("cualquier otra nota del vault queda afuera", () => {
    for (const otra of [
      "0_inbox/workbench.md",
      "1_proyectos/p_6_Sheets.md",
      "0_inbox/tareas_VIDA.canvas",
      "tareas_VIDA.md", // misma hoja, otra carpeta
    ]) {
      expect(esNotaDeTareas(otra, NOTAS_POR_OMISION), otra).toBe(false);
    }
  });

  it("sin archivo abierto no actúa", () => {
    expect(esNotaDeTareas(null, NOTAS_POR_OMISION)).toBe(false);
    expect(esNotaDeTareas(undefined, NOTAS_POR_OMISION)).toBe(false);
    expect(esNotaDeTareas("", NOTAS_POR_OMISION)).toBe(false);
  });

  it("una lista vacía apaga el plugin en todo el vault", () => {
    expect(esNotaDeTareas("0_inbox/tareas_COLE.md", [])).toBe(false);
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
    expect(esNotaDeTareas(nfd, NOTAS_POR_OMISION)).toBe(true);
    expect(esNotaDeTareas(nfc, [nfd])).toBe(true);
  });
});
