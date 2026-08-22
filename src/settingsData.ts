/**
 * Los **datos** de la configuración, sin nada de Obsidian.
 *
 * Vive separado de la pantalla por la misma razón que en Anotaciones: así se
 * puede verificar sin abrir la aplicación. El módulo de la pantalla importa
 * `obsidian` en tiempo de ejecución y eso basta para que ningún test lo toque.
 */
import { NOTAS_POR_OMISION } from "./notas.js";

/**
 * Versión del **formato de lo que el plugin escribe en las notas**.
 *
 * No es la versión del plugin. Existe desde el primer día para que un cambio
 * futuro de formato pueda **migrar** lo ya escrito en vez de romperlo en
 * silencio: sin un número guardado no hay forma de saber con qué formato se
 * escribió lo que está en el vault. Hoy el plugin no escribe todavía ningún
 * token (`%%t:…%%`, spec §5); cuando lo haga, esto ya está.
 *
 * Cuando cambie, hay que sumar acá y escribir la migración correspondiente.
 */
export const FORMAT_VERSION = 1;

export interface TareasSettings {
  /** Con qué versión del formato se escribió este vault. Ver `FORMAT_VERSION`. */
  formatVersion: number;
  /**
   * Las notas donde el plugin actúa (spec D2). Rutas desde la raíz del vault.
   */
  notasDeTareas: string[];
  /**
   * El prototipo del checkbox automático (spec §20 paso 1), encendido.
   *
   * Es un interruptor y no un reemplazo: un cambio de diseño se prueba
   * encendiéndolo, no tirando el anterior (NOTAS-DE-METODO §17). Si la
   * hipótesis falla —o si en el teléfono el teclado por composición produce
   * otra cosa, que es el riesgo de la §15 punto 2— se apaga sin desinstalar
   * nada y sin perder el resto del plugin.
   */
  checkboxAutomatico: boolean;
}

/**
 * Normaliza la lista guardada: solo strings, sin espacios de más, sin
 * repetidos, sin vacíos.
 *
 * Sigue el patrón tolerante de `blockId.ts` de Anotaciones —parsear devuelve
 * un valor razonable en vez de tirar—, porque esto se lee de un `data.json`
 * que el usuario puede haber editado a mano. **Una lista vacía es válida**:
 * significa «no intervengas en ninguna nota», y es la salida de emergencia si
 * el filtro molesta. Solo cuando lo guardado no es una lista se vuelve a las
 * de por omisión.
 */
export function sanearNotas(saved: unknown): string[] {
  if (!Array.isArray(saved)) return [...NOTAS_POR_OMISION];
  const vistas = new Set<string>();
  const salida: string[] = [];
  for (const n of saved) {
    if (typeof n !== "string") continue;
    const limpia = n.trim().normalize("NFC");
    if (limpia === "" || vistas.has(limpia)) continue;
    vistas.add(limpia);
    salida.push(limpia);
  }
  return salida;
}

export const DEFAULT_SETTINGS: TareasSettings = {
  formatVersion: FORMAT_VERSION,
  notasDeTareas: [...NOTAS_POR_OMISION],
  checkboxAutomatico: true,
};

/** Lo guardado en `data.json`, mezclado con lo de por omisión y saneado. */
export function cargarSettings(saved: unknown): TareasSettings {
  const raw = (saved ?? {}) as Partial<TareasSettings>;
  return {
    formatVersion: typeof raw.formatVersion === "number" ? raw.formatVersion : FORMAT_VERSION,
    notasDeTareas: sanearNotas(raw.notasDeTareas),
    checkboxAutomatico: raw.checkboxAutomatico ?? DEFAULT_SETTINGS.checkboxAutomatico,
  };
}
