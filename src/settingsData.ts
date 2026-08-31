/**
 * Los **datos** de la configuración, sin nada de Obsidian.
 *
 * Vive separado de la pantalla por la misma razón que en Anotaciones: así se
 * puede verificar sin abrir la aplicación. El módulo de la pantalla importa
 * `obsidian` en tiempo de ejecución y eso basta para que ningún test lo toque.
 */
import { NOTA_DE_LOG_POR_OMISION, NOTAS_POR_OMISION } from "./notas.js";

/** Los tres estilos de la §14. Un solo lugar: los consumen los ajustes y el CSS. */
export const ESTILOS_DE_PRIORIDAD = ["barra-checkbox", "barra", "checkbox", "fondo"] as const;
export type EstiloDePrioridad = (typeof ESTILOS_DE_PRIORIDAD)[number];

/**
 * Cómo se revela la fila de botones (§13.0, §15 punto 1).
 *
 * **Es un parámetro, no un `mouseenter`.** La §15 es explícita: «si nace con
 * `mouseenter` adentro, después se reescribe entero». El modo viaja como clase
 * en `body` —igual que el estilo de prioridad— y la hoja de estilos decide; en
 * `hover` no hay un solo gesto cableado en el código.
 *
 * `swipe` está declarado y **no se ofrece**: es la alternativa móvil de la §15
 * y hoy no hace nada. Un modo que no funciona es lo mismo que un ítem gris en
 * el ⋯, y vale la misma regla: si no se puede usar, no va. `sanearRevelacion`
 * lo hace caer a `hover`, así que un `data.json` que lo tenga no rompe nada.
 */
export const MODOS_DE_REVELACION = ["hover", "siempre", "swipe"] as const;
export type ModoDeRevelacion = (typeof MODOS_DE_REVELACION)[number];

/** Los que hoy se pueden elegir. El desplegable de ajustes lee de acá. */
export const MODOS_OFRECIDOS = ["hover", "siempre"] as const satisfies readonly ModoDeRevelacion[];

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
   * El segundo botón fijo de la fila, el ◐ de la §13.0.
   *
   * **Vacío por omisión, y vacío significa que el ◐ no se dibuja.** Es la misma
   * regla con la que el ⋯ deja afuera lo que todavía no tiene capa 1 y 2
   * detrás: un botón que no puede hacer nada es peor que un botón que no está.
   * Inventarle un nombre por omisión sería peor todavía — se escribiría en el
   * token de la primera tarea que el usuario toque sin haberlo elegido.
   */
  workbenchSecundario: string;
  /**
   * La fila de botones sobre la línea (§13.0, paso 4b).
   *
   * Encendida, con interruptor, por lo mismo que las decoraciones: es lo que
   * permite medir A/B cuánto cuesta y es la salida si algo sale mal, sin
   * desinstalar nada. Patrón `designFlags.ts`.
   */
  filaDeBotones: boolean;
  /** Cuándo se ve la fila. Ver `MODOS_DE_REVELACION`. */
  modoDeRevelacion: ModoDeRevelacion;
  /**
   * Las decoraciones sobre la nota: token invisible y color de prioridad (§4a).
   *
   * Encendido por omisión. Existe apagado por dos razones, y ninguna es
   * decorativa: es lo que permite medir A/B la predicción de la §5.5 sobre la
   * misma nota y el mismo scroll —sin poder apagarlo, la línea de base no se
   * puede comparar con nada—, y es la salida si la regresión aparece, sin
   * desinstalar nada y sin perder el resto del plugin.
   *
   * **No apaga `protegerTramo`.** Aquel defiende un dato: sin decoraciones el
   * peligro no desaparece, porque un Backspace que une dos líneas con token
   * deja dos `%%t:` en una y la vuelve ilegible para siempre.
   */
  decoracionesEnLaNota: boolean;
  /**
   * Cómo se dibuja la prioridad. Tres estilos, uno a la vez.
   *
   * Los tres salieron de usar el primero: teñir la línea entera resultó pesado,
   * la distinción madre/hijos por fondo contra filete no convenció, y dos
   * tareas contiguas de distinta prioridad formaban una franja continua que
   * cambiaba de color. Es el patrón `designFlags.ts` llevado a su forma útil
   * acá: los tres conviven y se comparan **en Obsidian**, que es el único lugar
   * donde se puede juzgar cómo se ve algo.
   *
   * | | Qué dibuja | Cómo se lee el nivel sin color |
   * |---|---|---|
   * | `barra-checkbox` | las dos cosas juntas | por la altura y por el anillo |
   * | `barra` | una marca corta en el margen | por su **altura** |
   * | `checkbox` | el checkbox de la tarea, coloreado | por un anillo de más |
   * | `fondo` | la línea teñida más un filete | por el grosor y las muescas |
   *
   * El combinado es el que pidió el usuario después de mirar los tres sueltos, y
   * por eso es el de por omisión.
   *
   * La §14 pide que los tres niveles se distingan **también sin color**, por
   * accesibilidad y por pantallas al sol; por eso los tres estilos lo resuelven
   * de alguna manera y ninguno se apoya solo en el tono.
   */
  estiloDePrioridad: EstiloDePrioridad;
  /**
   * Al unir dos tareas, la línea queda limpia: con un espacio y sin el marcador
   * de la absorbida.
   *
   * Sin esto, unir `- [ ] comprar` con `- [ ] pan` deja
   * `- [ ] comprar- [ ] pan`. Encendido por omisión porque es lo que uno espera
   * de un outliner —Outliner ya lo hace con Backspace, y esto lo empareja para
   * el resto de los gestos— y con interruptor porque cambia el comportamiento
   * del teclado, que es lo que más molesta cuando no se puede apagar.
   */
  unirLimpio: boolean;
  /**
   * Prioridad: un `!` o `!!` al final de la línea.
   *
   * Apagado por omisión, y a propósito: **suma ancho al renglón**, y el ancho
   * es lo que decide si una línea entra en un renglón o en dos. Con la ventana
   * angosta eso alimenta al mismo bucle de medición que la §5.5 mide. Encender
   * los dos indicadores por separado deja ver cuál de los dos, si alguno, mueve
   * la cuenta de avisos.
   */
  indicadorGlifo: boolean;
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

/** Un estilo conocido, o el de por omisión. Se lee de un `data.json` editable. */
export function sanearEstilo(valor: unknown): EstiloDePrioridad {
  return (ESTILOS_DE_PRIORIDAD as readonly unknown[]).includes(valor)
    ? (valor as EstiloDePrioridad)
    : "barra-checkbox";
}

/** Un modo conocido y **ofrecido**, o `hover`. Ver `MODOS_DE_REVELACION`. */
export function sanearRevelacion(valor: unknown): ModoDeRevelacion {
  return (MODOS_OFRECIDOS as readonly unknown[]).includes(valor)
    ? (valor as ModoDeRevelacion)
    : "hover";
}

export const DEFAULT_SETTINGS: TareasSettings = {
  formatVersion: FORMAT_VERSION,
  notasDeTareas: [...NOTAS_POR_OMISION],
  checkboxAutomatico: true,
  notaDeLog: NOTA_DE_LOG_POR_OMISION,
  workbenchFavorito: WORKBENCH_POR_OMISION,
  workbenchSecundario: "",
  filaDeBotones: true,
  modoDeRevelacion: "hover",
  decoracionesEnLaNota: true,
  estiloDePrioridad: "barra-checkbox",
  indicadorGlifo: false,
  unirLimpio: true,
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

/**
 * Lo mismo, pero **el vacío es una respuesta válida**: «este botón no existe».
 *
 * Son dos funciones y no un parámetro porque son dos preguntas distintas. El
 * workbench del comando **tiene** que existir —un comando sin destino no hace
 * nada y no hay dónde decirlo—; el segundo botón de la fila puede legítimamente
 * no estar, y ahí la fila dibuja tres botones en vez de cuatro.
 */
export function sanearWorkbenchOpcional(valor: unknown): string {
  if (typeof valor !== "string") return "";
  const limpio = valor.trim().normalize("NFC");
  return /[;,%]/.test(limpio) ? "" : limpio;
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
    workbenchSecundario: sanearWorkbenchOpcional(raw.workbenchSecundario),
    filaDeBotones: raw.filaDeBotones ?? DEFAULT_SETTINGS.filaDeBotones,
    modoDeRevelacion: sanearRevelacion(raw.modoDeRevelacion),
    decoracionesEnLaNota: raw.decoracionesEnLaNota ?? DEFAULT_SETTINGS.decoracionesEnLaNota,
    estiloDePrioridad: sanearEstilo(raw.estiloDePrioridad),
    indicadorGlifo: raw.indicadorGlifo ?? DEFAULT_SETTINGS.indicadorGlifo,
    unirLimpio: raw.unirLimpio ?? DEFAULT_SETTINGS.unirLimpio,
    congelarStore: raw.congelarStore ?? DEFAULT_SETTINGS.congelarStore,
    registrarEventos: raw.registrarEventos ?? DEFAULT_SETTINGS.registrarEventos,
  };
}
