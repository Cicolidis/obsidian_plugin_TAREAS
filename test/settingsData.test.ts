import { describe, expect, it } from "vitest";
import { NOTAS_POR_OMISION } from "../src/notas.js";
import {
  cargarSettings,
  DEFAULT_SETTINGS,
  ESTILOS_DE_PRIORIDAD,
  FORMAT_VERSION,
  ESTILOS_DE_FILA,
  MODOS_DE_REVELACION,
  sanearEstilo,
  sanearEstiloDeFila,
  sanearNotas,
  sanearRevelacion,
  sanearWorkbenchOpcional,
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

describe("sanearRevelacion", () => {
  it("los modos ofrecidos pasan", () => {
    expect(sanearRevelacion("hover")).toBe("hover");
    expect(sanearRevelacion("siempre")).toBe("siempre");
  });

  /**
   * `swipe` está en el tipo —la §15 punto 1 pide que el modo sea un parámetro—
   * y **no** se puede elegir, porque hoy no hace nada. Un modo que no funciona
   * es lo mismo que un ítem gris en el ⋯.
   */
  it("`swipe` está declarado pero cae a `hover`", () => {
    expect(MODOS_DE_REVELACION).toContain("swipe");
    expect(sanearRevelacion("swipe")).toBe("hover");
  });

  it("cualquier basura cae a `hover`", () => {
    for (const basura of [null, undefined, 7, {}, "HOVER"]) {
      expect(sanearRevelacion(basura)).toBe("hover");
    }
  });
});

describe("sanearEstiloDeFila", () => {
  it("los cinco estilos pasan", () => {
    for (const e of ESTILOS_DE_FILA) expect(sanearEstiloDeFila(e)).toBe(e);
  });

  it("cualquier otra cosa cae al primero", () => {
    for (const basura of [null, undefined, 7, {}, "DERECHA", "abajo"]) {
      expect(sanearEstiloDeFila(basura)).toBe("derecha");
    }
  });

  // Los dos que no pueden tapar una palabra. Están acá para que sacarlos sea
  // una decisión y no un descuido: son la respuesta a la objeción de fondo al
  // primer diseño.
  it("están los dos que viven afuera del texto", () => {
    expect(ESTILOS_DE_FILA).toContain("margen");
    expect(ESTILOS_DE_FILA).toContain("izquierda");
  });
});
