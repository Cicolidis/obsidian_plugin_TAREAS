/**
 * El índice en memoria de las notas de tareas (spec §7).
 *
 * No es una nota ni un archivo: es lo que las vistas van a leer para no abrir
 * archivos nunca. Un solo camino de lectura y un solo camino de escritura es lo
 * que evita que el workbench y la nota digan cosas distintas.
 *
 * ## Recibe un puerto, no `App`
 *
 * Todo lo que este módulo necesita del mundo son cinco operaciones: qué notas
 * mirar, leer una, y enterarse de que cambió, se renombró o se borró. Pedirlas
 * como interfaz —y no recibir `App`— deja la lógica probable offline con un
 * puerto falso, que es la separación de capas de la §17 aplicada acá: quien
 * habla con Obsidian es `vault/puertoObsidian.ts`, y este archivo no importa
 * `obsidian` ni sabe que existe.
 *
 * ## Se alimenta de la escritura, no del evento
 *
 * `vault.process()` devuelve **lo que quedó escrito**. Eso entra al store en el
 * acto por `absorber`, sin esperar al `changed`, que llega después. El evento
 * sigue haciendo falta —para lo que el usuario escribe a mano, y para lo que
 * llega por Sync desde otro dispositivo— pero cuando trae un contenido idéntico
 * al que ya está guardado **no se reparsea ni se notifica**. Sin eso, cada
 * escritura propia provocaría dos redibujos: uno correcto y uno de regalo.
 */
import { indexar, porClave, type Clave, type Task } from "./tareas.js";
import { parseDocumento, type Documento } from "./documento.js";

/** Deshacer una suscripción. */
export type Baja = () => void;

/**
 * Lo que el store necesita del mundo. Cinco operaciones, ninguna de Obsidian.
 *
 * `notas()` es una función y no una lista porque la lista efectiva vive en la
 * configuración y el usuario la edita sin recargar el plugin. Es el mismo
 * patrón que `filtroActivo` en `main.ts`: leer la configuración por closure en
 * el momento de usarla, no capturarla al registrar.
 */
export interface PuertoDeNotas {
  notas(): readonly string[];
  /** El contenido, o `null` si la nota no existe. */
  leer(path: string): Promise<string | null>;
  /** Trae el contenido: el store no tiene que releer nada. */
  alCambiar(fn: (path: string, contenido: string) => void): Baja;
  /** `changed` no dispara al renombrar: por eso este es aparte. */
  alRenombrar(fn: (viejo: string, nuevo: string) => void): Baja;
  alBorrar(fn: (path: string) => void): Baja;
}

/** De dónde vino una actualización. Sirve para diagnosticar, no para decidir. */
export type OrigenDeCambio =
  | "arranque"
  | "evento"
  | "escritura"
  | "renombre"
  | "borrado"
  | "ajustes";

export interface EventoDeStore {
  path: string;
  origen: OrigenDeCambio;
  /** Tareas que quedaron en esa nota. */
  tareas: number;
  /** Lo que tardó el parseo, en milisegundos. */
  ms: number;
}

interface Entrada {
  /** El contenido verbatim, para poder decir «esto ya lo tengo». */
  raw: string;
  doc: Documento;
  tareas: Task[];
}

const ahora = (): number =>
  typeof performance === "undefined" ? Date.now() : performance.now();

export class StoreDeTareas {
  private readonly notas = new Map<string, Entrada>();
  private readonly bajas: Baja[] = [];
  private readonly oyentes = new Set<(e: EventoDeStore) => void>();

  /**
   * Ajuste de verificación: el store deja de absorber (patrón `designFlags.ts`).
   *
   * Con esto encendido, ni el evento ni lo que devuelve `process` actualizan lo
   * que hay en memoria, así que el store queda deliberadamente atrasado. Es la
   * única forma de probar `ubicarLinea` en vivo sin depender de meterse a mano
   * adentro de la ventana del evento. Apagado por omisión.
   */
  congelado = false;

  constructor(private readonly puerto: PuertoDeNotas) {}

  /** Parsea las notas y se suscribe. Va en `workspace.onLayoutReady`. */
  async arrancar(): Promise<void> {
    await this.resincronizar("arranque");

    this.bajas.push(
      this.puerto.alCambiar((path, contenido) => {
        if (!this.mira(path)) return;
        this.absorber(path, contenido, "evento");
      }),
      this.puerto.alRenombrar((viejo, nuevo) => this.renombrar(viejo, nuevo)),
      this.puerto.alBorrar((path) => this.olvidar(path)),
    );
  }

  detener(): void {
    for (const baja of this.bajas.splice(0)) baja();
    this.notas.clear();
    this.oyentes.clear();
  }

  /**
   * Alinea el store con la lista de notas: parsea las nuevas, olvida las que
   * salieron. Se llama al arrancar y cuando el usuario toca la configuración.
   */
  async resincronizar(origen: OrigenDeCambio = "ajustes"): Promise<void> {
    const quiero = new Set(this.puerto.notas());
    for (const path of [...this.notas.keys()]) if (!quiero.has(path)) this.notas.delete(path);

    await Promise.all(
      [...quiero].map(async (path) => {
        if (this.notas.has(path)) return;
        const raw = await this.puerto.leer(path);
        if (raw !== null) this.absorber(path, raw, origen);
      }),
    );
  }

  /**
   * Guardar el contenido de una nota, venga de donde venga.
   *
   * Es la entrada principal del store, no el evento: lo que devuelve
   * `vault.process()` entra por acá inmediatamente después de escribir.
   *
   * Devuelve si hubo algo que hacer. **Un contenido idéntico al guardado no se
   * reparsea ni se notifica**: es el `changed` que llega detrás de nuestra
   * propia escritura, y reparsearlo sería un segundo redibujo por cada acción.
   */
  absorber(path: string, contenido: string, origen: OrigenDeCambio = "escritura"): boolean {
    if (this.congelado) return false;
    if (this.notas.get(path)?.raw === contenido) return false;

    const t0 = ahora();
    const doc = parseDocumento(contenido);
    const tareas = indexar(doc, path);
    this.notas.set(path, { raw: contenido, doc, tareas });
    this.avisar({ path, origen, tareas: tareas.length, ms: ahora() - t0 });
    return true;
  }

  private renombrar(viejo: string, nuevo: string): void {
    const entrada = this.notas.get(viejo);
    this.notas.delete(viejo);
    // El contenido no cambió, pero `Task.archivo` sí: se reindexa con la ruta
    // nueva en vez de volver a leer del disco.
    if (entrada && this.mira(nuevo)) {
      const t0 = ahora();
      const tareas = indexar(entrada.doc, nuevo);
      this.notas.set(nuevo, { ...entrada, tareas });
      this.avisar({ path: nuevo, origen: "renombre", tareas: tareas.length, ms: ahora() - t0 });
    } else if (entrada) {
      this.avisar({ path: viejo, origen: "renombre", tareas: 0, ms: 0 });
    }
  }

  private olvidar(path: string): void {
    if (!this.notas.delete(path)) return;
    this.avisar({ path, origen: "borrado", tareas: 0, ms: 0 });
  }

  /** ¿Esta ruta está en la lista de notas de trabajo? */
  private mira(path: string): boolean {
    return this.puerto.notas().includes(path);
  }

  // ------------------------------------------------------------- lectura

  /** El documento verbatim de una nota, que es lo que necesita un plan. */
  documento(path: string): Documento | null {
    return this.notas.get(path)?.doc ?? null;
  }

  /** El contenido tal como el store lo tiene. Para comparar, no para escribir. */
  contenido(path: string): string | null {
    return this.notas.get(path)?.raw ?? null;
  }

  tareasDe(path: string): readonly Task[] {
    return this.notas.get(path)?.tareas ?? [];
  }

  /** Todas las tareas de todas las notas, agrupadas por nota. */
  tareas(): Task[] {
    return [...this.notas.values()].flatMap((e) => e.tareas);
  }

  /** La tarea de esa clave dentro de su propia nota. */
  buscar(archivo: string, clave: Clave): Task | null {
    return porClave(this.tareasDe(archivo)).get(clave) ?? null;
  }

  /**
   * Todos los `id` escritos, en **todas** las notas.
   *
   * Tiene que ser global: un id repetido no rompe nada visible, hace que dos
   * tareas distintas sean la misma para el workbench, que es peor que un error.
   * Es lo que `planDeWorkbench` recibe para no repetir ninguno.
   */
  idsEnUso(): Set<string> {
    const ids = new Set<string>();
    for (const e of this.notas.values())
      for (const t of e.tareas) if (t.id !== null) ids.add(t.id);
    return ids;
  }

  /** Las notas que el store tiene parseadas ahora mismo. */
  cargadas(): string[] {
    return [...this.notas.keys()];
  }

  // ---------------------------------------------------------- notificación

  /**
   * Un solo canal para las dos cosas que necesitan enterarse: las vistas, que
   * se redibujan, y el registro de verificación, que imprime la demora. Dos
   * mecanismos separados para el mismo hecho terminarían divergiendo.
   */
  alActualizar(fn: (e: EventoDeStore) => void): Baja {
    this.oyentes.add(fn);
    return () => this.oyentes.delete(fn);
  }

  private avisar(e: EventoDeStore): void {
    // Un oyente que tira no puede cortar a los demás ni romper el handler de
    // Obsidian del que esto cuelga.
    for (const fn of this.oyentes) {
      try {
        fn(e);
      } catch (err) {
        console.error("[tareas] un oyente del store falló:", err);
      }
    }
  }
}
