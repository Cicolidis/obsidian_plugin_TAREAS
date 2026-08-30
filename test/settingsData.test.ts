import { describe, expect, it } from "vitest";
import { NOTAS_POR_OMISION } from "../src/notas.js";
import {
  cargarSettings,
  ESTILOS_DE_PRIORIDAD,
  FORMAT_VERSION,
  sanearEstilo,
  sanearNotas,
} from "../src/settingsData.js";

/**
 * Esto se lee de un `data.json` que el usuario puede haber editado a mano, así
 * que el patrón es el de `blockId.ts` de Anotaciones: parsear devuelve algo
 * razonable en vez de tirar.
 */
describe("sanearNotas", () => {
  it("lo que no es una lista vuelve a las de por omisión", () => {
    for (const basura of [null, undefined, 7, "una nota", {}]) {
      expect(sanearNotas(basura)).toEqual([...NOTAS_POR_OMISION]);
    }
  });

  it("una lista vacía es válida: significa «no intervengas»", () => {
    expect(sanearNotas([])).toEqual([]);
  });

  it("descarta lo que no es texto, recorta y saca vacíos", () => {
    expect(sanearNotas(["  a.md  ", 7, null, "", "   ", "b.md"])).toEqual(["a.md", "b.md"]);
  });

  it("saca repetidos y conserva el orden de aparición", () => {
    expect(sanearNotas(["b.md", "a.md", "b.md"])).toEqual(["b.md", "a.md"]);
  });

  it("normaliza a NFC, así que dos formas del mismo nombre son una sola", () => {
    const nfc = "tareas_CÍCLICAS.md".normalize("NFC");
    expect(sanearNotas([nfc, nfc.normalize("NFD")])).toEqual([nfc]);
  });
});

describe("cargarSettings", () => {
  it("sin nada guardado, arranca con lo de por omisión", () => {
    const s = cargarSettings(null);
    expect(s.formatVersion).toBe(FORMAT_VERSION);
    expect(s.notasDeTareas).toEqual([...NOTAS_POR_OMISION]);
    expect(s.checkboxAutomatico).toBe(true);
  });

  it("respeta un interruptor apagado", () => {
    expect(cargarSettings({ checkboxAutomatico: false }).checkboxAutomatico).toBe(false);
  });

  it("no pisa la versión de formato que ya tenía el vault", () => {
    expect(cargarSettings({ formatVersion: 0 }).formatVersion).toBe(0);
  });
});

describe("el estilo de prioridad", () => {
  it("acepta los tres conocidos", () => {
    for (const e of ESTILOS_DE_PRIORIDAD) expect(sanearEstilo(e)).toBe(e);
  });

  // Se lee de un `data.json` que el usuario puede editar a mano, así que
  // cualquier cosa que llegue tiene que caer parada, no romper el plugin.
  it("cualquier otra cosa cae en el de por omisión", () => {
    for (const v of ["filete", "", null, undefined, 3, {}, ["barra"]]) {
      expect(sanearEstilo(v)).toBe("barra-checkbox");
    }
  });

  it("una configuración vieja, sin el campo, arranca en el de por omisión", () => {
    expect(cargarSettings({ indicadorFilete: true }).estiloDePrioridad).toBe("barra-checkbox");
  });
});
