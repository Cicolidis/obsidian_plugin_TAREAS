/**
 * Los **datos** de la configuración, sin nada de Obsidian.
 *
 * Vive separado de la pantalla por la misma razón que en Anotaciones: así se
 * puede verificar sin abrir la aplicación. El módulo de la pantalla importa
 * `obsidian` en tiempo de ejecución y eso basta para que ningún test lo toque.
 */
import { NOTA_DE_LOG_POR_OMISION, NOTAS_POR_OMISION } from "./notas.js";

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
  /**
   * La nota de historial (spec §12).
   *
   * Se nombra aparte de la lista porque cumple dos papeles opuestos: es a donde
   * el archivado **escribe**, y es la única nota de la lista que el store **no
   * parsea al arrancar**. El archivo solo recibe y crece sin techo; las notas
   * de trabajo se mantienen de tamaño porque las cosas salen de ellas.
   */
  notaDeLog: string;
  /**
   * El workbench de los botones fijos (§13.0: «asignables en settings»).
   *
   * Hoy lo usa el comando de paleta, que es el 90% del uso de la §13.0 sin la
   * interfaz todavía. Cuando estén el ★ y el ◐ van a leer de acá.
   */
  workbenchFavorito: string;
  /**
   * Verificación: el store deja de absorber cambios (patrón `designFlags.ts`).
   *
   * Con esto encendido el store queda deliberadamente atrasado, que es la única
   * forma reproducible de probar `ubicar.ts` en vivo: teclear arriba de una
   * tarea y correr el comando **sin** carreras contra la ventana del evento.
   * Apagado por omisión, y no reemplaza nada.
   */
  congelarStore: boolean;
  /**
   * Verificación: cada reparseo del store se imprime en la consola.
   *
   * Sin vistas todavía, que el store reaccione es invisible. Esto lo hace
   * visible, y de paso confirma en producción la demora que mide
   * `scripts/espia-eventos.js` — y que **teclear no dispara ninguna escritura**,
   * que es la regla 2 de la §8.
   */
  registrarEventos: boolean;
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

/**
 * El nombre por omisión del workbench favorito.
 *
 * La §10 es explícita: **no se llaman por unidad de tiempo.** Un workbench
 * llamado «hoy» obliga psicológicamente a mantenerlo al día; uno llamado «foco»
 * no caduca. Va como texto por defecto, no como sugerencia.
 */
export const WORKBENCH_POR_OMISION = "foco";

export const DEFAULT_SETTINGS: TareasSettings = {
  formatVersion: FORMAT_VERSION,
  notasDeTareas: [...NOTAS_POR_OMISION],
  checkboxAutomatico: true,
  notaDeLog: NOTA_DE_LOG_POR_OMISION,
  workbenchFavorito: WORKBENCH_POR_OMISION,
  congelarStore: false,
  registrarEventos: false,
};

/**
 * Un nombre de workbench utilizable, o el de por omisión.
 *
 * Se sanea con el mismo criterio que el token: un nombre con `;`, `,` o `%`
 * rompería el `%%t:…%%` y haría ilegible la línea entera —y una línea ilegible
 * no se vuelve a escribir (§5.3)—. Vale más caer al de por omisión que dejar
 * que un campo de texto mal tipeado corrompa tareas.
 */
export function sanearWorkbench(valor: unknown): string {
  if (typeof valor !== "string") return WORKBENCH_POR_OMISION;
  const limpio = valor.trim().normalize("NFC");
  return limpio === "" || /[;,%]/.test(limpio) ? WORKBENCH_POR_OMISION : limpio;
}

/** Lo guardado en `data.json`, mezclado con lo de por omisión y saneado. */
export function cargarSettings(saved: unknown): TareasSettings {
  const raw = (saved ?? {}) as Partial<TareasSettings>;
  return {
    formatVersion: typeof raw.formatVersion === "number" ? raw.formatVersion : FORMAT_VERSION,
    notasDeTareas: sanearNotas(raw.notasDeTareas),
    checkboxAutomatico: raw.checkboxAutomatico ?? DEFAULT_SETTINGS.checkboxAutomatico,
    notaDeLog:
      typeof raw.notaDeLog === "string" && raw.notaDeLog.trim() !== ""
        ? raw.notaDeLog.trim().normalize("NFC")
        : DEFAULT_SETTINGS.notaDeLog,
    workbenchFavorito: sanearWorkbench(raw.workbenchFavorito),
    congelarStore: raw.congelarStore ?? DEFAULT_SETTINGS.congelarStore,
    registrarEventos: raw.registrarEventos ?? DEFAULT_SETTINGS.registrarEventos,
  };
}
