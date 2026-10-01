import { describe, expect, it } from "vitest";
import { NOTAS_POR_OMISION } from "../src/notas.js";
import {
  cargarSettings,
  DEFAULT_SETTINGS,
  FORMAT_VERSION,
  MODO_DE_REVELACION,
  MODOS_DE_REVELACION,
  sanearNotas,
  sanearWorkbenchOpcional,
} from "../src/settingsData.js";

/**
 * Esto se lee de un `data.json` que el usuario puede haber editado a mano, así
 * que el patrón es el de `blockId.ts` de Anotaciones: parsear devuelve algo
 * razonable en vez de tirar.
 */
describe("sanearNotas", () => {
  it("lo que no es una lista vuelve a las de por omisión, que es ninguna", () => {
    for (const basura of [null, undefined, 7, "una nota", {}]) {
      expect(sanearNotas(basura)).toEqual([...NOTAS_POR_OMISION]);
      expect(sanearNotas(basura)).toEqual([]);
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

describe("las alternativas que se eligieron", () => {
  /**
   * El 30/09/2026 el usuario eligió entre las alternativas de diseño y las que
   * perdieron se borraron, con sus ajustes. Un `data.json` de antes las sigue
   * teniendo: se ignoran, y la próxima vez que se guarde desaparecen.
   */
  it("una configuración vieja con los ajustes borrados carga sin ellos", () => {
    const s = cargarSettings({
      estiloDePrioridad: "fondo",
      estiloDeFila: "derecha",
      modoDeRevelacion: "siempre",
      ordenDeAtajos: "semana",
      selectorDeFecha: "nativo",
      checkboxAutomatico: false,
    });
    for (const k of ["estiloDePrioridad", "estiloDeFila", "modoDeRevelacion", "ordenDeAtajos", "selectorDeFecha"]) {
      expect(s).not.toHaveProperty(k);
    }
    expect(s.checkboxAutomatico).toBe(false);
  });
});

describe("sanearWorkbenchOpcional", () => {
  /**
   * Son dos funciones y no un parámetro porque son dos preguntas distintas: el
   * workbench del comando **tiene** que existir; el segundo botón de la fila
   * puede legítimamente no estar, y ahí la fila dibuja tres botones.
   */
  it("el vacío es una respuesta válida y no cae al de por omisión", () => {
    expect(sanearWorkbenchOpcional("")).toBe("");
    expect(sanearWorkbenchOpcional("   ")).toBe("");
    expect(sanearWorkbenchOpcional(null)).toBe("");
    expect(sanearWorkbenchOpcional(7)).toBe("");
  });

  // Los tres caracteres que romperían el `%%t:…%%` y dejarían la línea
  // ilegible para siempre (§5.3). Vale más negarse que corromper tareas.
  it("un nombre que rompería el token se rechaza", () => {
    for (const malo of ["a;b", "a,b", "100%", "wb=x;y"]) {
      expect(sanearWorkbenchOpcional(malo)).toBe("");
    }
  });

  it("un nombre común pasa, normalizado", () => {
    expect(sanearWorkbenchOpcional("  mudanza  ")).toBe("mudanza");
    expect(sanearWorkbenchOpcional("semana en el cole")).toBe("semana en el cole");
  });

  it("por omisión no hay segundo botón", () => {
    expect(DEFAULT_SETTINGS.workbenchSecundario).toBe("");
    expect(cargarSettings({}).workbenchSecundario).toBe("");
  });
});

describe("el modo de revelación", () => {
  /**
   * `swipe` está en el tipo —la §15 punto 1 pide que el modo sea un parámetro—
   * y hoy no hace nada. El que está en uso es `hover`, elegido el 30/09/2026.
   */
  it("está en uso `hover`, y `swipe` sigue declarado para el móvil", () => {
    expect(MODO_DE_REVELACION).toBe("hover");
    expect(MODOS_DE_REVELACION).toContain("swipe");
    expect(MODOS_DE_REVELACION).not.toContain("siempre");
  });
});
