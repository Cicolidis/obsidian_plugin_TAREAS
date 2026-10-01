/**
 * Los **datos** de la configuración, sin nada de Obsidian.
 *
 * Vive separado de la pantalla por la misma razón que en Anotaciones: así se
 * puede verificar sin abrir la aplicación. El módulo de la pantalla importa
 * `obsidian` en tiempo de ejecución y eso basta para que ningún test lo toque.
 */
import { NOTA_DE_LOG_POR_OMISION, NOTAS_POR_OMISION } from "./notas.js";

/**
 * Cómo se revela la fila de botones (§13.0, §15 punto 1).
 *
 * **Es un parámetro, no un `mouseenter`.** La §15 es explícita: «si nace con
 * `mouseenter` adentro, después se reescribe entero». El modo viaja como clase
 * en `body` —igual que el estilo de prioridad— y la hoja de estilos decide; en
 * `hover` no hay un solo gesto cableado en el código.
 *
 * `swipe` está declarado y hoy no hace nada: es la alternativa móvil de la
 * §15. `siempre` existió hasta el 30/09/2026 y se borró al elegir.
 */
export const MODOS_DE_REVELACION = ["hover", "swipe"] as const;
export type ModoDeRevelacion = (typeof MODOS_DE_REVELACION)[number];

/**
 * El modo en uso. **No es un ajuste**: el 30/09/2026 el usuario eligió «al pasar
 * el mouse» contra «siempre», y la alternativa que perdió se borró —con un
 * solo modo ofrecido, un desplegable no elige nada—. El parámetro sigue
 * existiendo porque la §15 lo exige: `swipe` es la forma móvil, y cuando exista
 * se elige acá según la plataforma, en la capa 3.
 */
export const MODO_DE_REVELACION: ModoDeRevelacion = "hover";

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
  /**
   * El quinto botón de la fila: 🗑 Eliminar (§12, el descarte físico).
   *
   * Pedido al verificar el paso 6a: «Obsidian no es un verdadero outliner» y
   * borrar una tarea anidada a mano es incómodo. Va **último**, después del ⋯,
   * para quedar lo más lejos posible del ★, que es el que más se aprieta.
   */
  botonEliminar: boolean;
  /**
   * Tildar el checkbox **es** completar la tarea (§12).
   *
   * Escribe `done=` y baja por el subárbol, igual que el ⋯. Encendido por
   * omisión: sin esto el gesto más natural y más frecuente es el único que no
   * pasa por el plugin, y la fecha de completado —que es lo que el historial
   * necesita— solo existe si uno se acordó de usar el menú.
   *
   * Con interruptor porque **cambia lo que hace el teclado**, que es lo que más
   * molesta cuando no se puede apagar. Patrón `designFlags.ts`.
   */
  completarAlTildar: boolean;
  /**
   * Cmd+clic (Ctrl+clic fuera de macOS) en el checkbox: completar y archivar.
   *
   * Encendido por omisión, y con interruptor propio porque es el único
   * mecanismo del plugin que **intercepta un clic**: un modificador no deja
   * rastro en la transacción, así que no se puede reconocer el hecho como hace
   * `completarAlTildar`. Eso lo vuelve estructuralmente más frágil —depende de
   * llegar antes que el handler de Obsidian y en el teléfono no existe—, y el
   * ⋯ sigue siendo el camino que anda siempre.
   */
  archivarConModificador: boolean;
  /**
   * ¿Archivar pregunta antes?
   *
   * **Apagado por omisión, y es una decisión del usuario contra una medición
   * mía.** Yo propuse preguntar con dos líneas o más (138 de 389 tareas, 35,5%)
   * y al usarlo resultó fricción, que es exactamente lo que la §12 existe para
   * eliminar: tildar tiene que costar menos que borrar. Gana el uso.
   *
   * Con una excepción que no es fricción: si la tarea **ya figura** en el
   * historial bajo ese camino, se pregunta igual. Ahí el cartel evita una
   * entrada repetida en vez de agregar un paso.
   */
  confirmarAlArchivar: boolean;
  /**
   * ¿Eliminar pregunta antes?
   *
   * **Apagado por omisión, por decisión explícita del usuario**, y con la
   * objeción dicha una vez: eliminar es la única acción del plugin que pierde
   * texto, el subárbol más grande del corpus son 77 líneas, y `vault.process()`
   * no pasa por el editor — con la nota cerrada no hay nada que lo deshaga.
   * Queda el ajuste para volver.
   */
  confirmarAlEliminar: boolean;
  /**
   * Los dos indicadores de la fila (paso 6c): «tiene fecha» y «es cíclica».
   *
   * Encendidos por omisión: son el único lugar donde esos dos datos **se ven**,
   * porque el token está oculto (§5.1). Con interruptor, y **dos y no uno**, por
   * lo mismo que los dos indicadores de forma de la prioridad (§14): cada uno
   * suma un lugar al ancho del margen, y separados dejan ver cuál de los dos, si
   * alguno, molesta con la ventana angosta.
   */
  indicadorDeFecha: boolean;
  indicadorDeRecurrencia: boolean;
  /**
   * Los grupos de reinicio que el submenú ofrece **aunque no exista ninguno**.
   *
   * Es la mitad del pedido «recurrencia con opciones preconfiguradas». La otra
   * mitad —«que recuerde y ofrezca las más usadas»— **no necesita ajuste ni
   * estado**: sale de contar cuántas tareas llevan cada `rec` (`gruposPorUso`),
   * derivado de las notas como todo lo demás (§10).
   *
   * Esto sí es un ajuste porque son nombres que se van a escribir en el token, y
   * el vocabulario es del usuario. Medido el 03/09/2026: hay **0 grupos** en las
   * siete notas reales, así que sin semilla el submenú de una nota real no
   * ofrece nada para clickear. Cada nombre se sanea con el mismo criterio que un
   * workbench: `NOMBRE_RE` es literalmente la misma para `wb` y para `rec`.
   */
  gruposSugeridos: string[];
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

/**
 * La semilla de grupos: nombres utilizables, sin repetidos y sin vacíos.
 *
 * Reusa `sanearWorkbenchOpcional` por nombre, y eso no es ahorro de líneas: los
 * grupos y los workbenches viven en el mismo token con la misma gramática, y dos
 * saneos con la misma intención divergirían justo en si aceptan un `;` — que
 * deja la línea ilegible para siempre (§5.3).
 *
 * **Una lista vacía es válida**: significa «no me sugieras nada», que es la
 * respuesta correcta una vez que los grupos propios existen.
 */
export function sanearGrupos(saved: unknown): string[] {
  const crudos = Array.isArray(saved) ? saved : GRUPOS_POR_OMISION;
  const vistos = new Set<string>();
  const salida: string[] = [];
  for (const g of crudos) {
    const limpio = sanearWorkbenchOpcional(g);
    if (limpio === "" || vistos.has(limpio)) continue;
    vistos.add(limpio);
    salida.push(limpio);
  }
  return salida;
}

/**
 * Los grupos sugeridos de arranque.
 *
 * Son **períodos y no días de la semana**: la §11 nombra las dos formas
 * (`rec=lunes`, `rec=mensual`) pero los días son el mecanismo de
 * `tareas_CÍCLICAS`, que sigue fuera de la v1, y sembrar los siete dejaría un
 * menú de nueve ítems para elegir entre dos.
 */
export const GRUPOS_POR_OMISION: readonly string[] = ["semanal", "mensual"];

export const DEFAULT_SETTINGS: TareasSettings = {
  formatVersion: FORMAT_VERSION,
  notasDeTareas: [...NOTAS_POR_OMISION],
  checkboxAutomatico: true,
  notaDeLog: NOTA_DE_LOG_POR_OMISION,
  workbenchFavorito: WORKBENCH_POR_OMISION,
  workbenchSecundario: "",
  filaDeBotones: true,
  botonEliminar: true,
  completarAlTildar: true,
  archivarConModificador: true,
  confirmarAlArchivar: false,
  confirmarAlEliminar: false,
  indicadorDeFecha: true,
  indicadorDeRecurrencia: true,
  gruposSugeridos: [...GRUPOS_POR_OMISION],
  decoracionesEnLaNota: true,
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
    botonEliminar: raw.botonEliminar ?? DEFAULT_SETTINGS.botonEliminar,
    completarAlTildar: raw.completarAlTildar ?? DEFAULT_SETTINGS.completarAlTildar,
    archivarConModificador:
      raw.archivarConModificador ?? DEFAULT_SETTINGS.archivarConModificador,
    confirmarAlArchivar: raw.confirmarAlArchivar ?? DEFAULT_SETTINGS.confirmarAlArchivar,
    confirmarAlEliminar: raw.confirmarAlEliminar ?? DEFAULT_SETTINGS.confirmarAlEliminar,
    indicadorDeFecha: raw.indicadorDeFecha ?? DEFAULT_SETTINGS.indicadorDeFecha,
    indicadorDeRecurrencia:
      raw.indicadorDeRecurrencia ?? DEFAULT_SETTINGS.indicadorDeRecurrencia,
    gruposSugeridos: sanearGrupos(raw.gruposSugeridos),
    decoracionesEnLaNota: raw.decoracionesEnLaNota ?? DEFAULT_SETTINGS.decoracionesEnLaNota,
    indicadorGlifo: raw.indicadorGlifo ?? DEFAULT_SETTINGS.indicadorGlifo,
    unirLimpio: raw.unirLimpio ?? DEFAULT_SETTINGS.unirLimpio,
    congelarStore: raw.congelarStore ?? DEFAULT_SETTINGS.congelarStore,
    registrarEventos: raw.registrarEventos ?? DEFAULT_SETTINGS.registrarEventos,
  };
}
