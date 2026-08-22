/**
 * El índice de tareas: el modelo de la §6 derivado del documento.
 *
 * Deriva de `documento.ts` y no al revés, por la razón de la §8: reescribir
 * exige la línea verbatim, y una tarea es una vista sobre una línea, no su
 * dueña. De ahí que `linea` esté marcado como volátil en la spec: la identidad
 * es el `id` del token, nunca la posición.
 */
import { arbolDe, headingsDe, recorrer, type Documento, type Nodo } from "./documento.js";
import { estadoDe, type Heading } from "./linea.js";
import { parseTaskToken, type TaskMeta } from "./token.js";

export interface Task {
  /** El `id` del token. `null` hasta que la tarea entra a un workbench (§5.4). */
  id: string | null;
  /** El texto de la tarea, sin el token y sin el checkbox. */
  texto: string;
  hecha: boolean;
  archivo: string;
  /** Volátil: se recalcula en cada parseo. */
  linea: number;
  /** Profundidad dentro del árbol de **tareas**, no de la sangría. */
  nivel: number;
  /** Clave interna de sesión de la tarea madre, no el `id` del token. */
  padre: Clave | null;
  hijos: Clave[];
  /** Bullets sin checkbox que cuelgan de esta tarea, verbatim (§4.3). */
  notas: string[];
  proyecto: string | null;
  area: string | null;
  /** El heading no semántico más cercano. P. ej. «WORKBENCH». */
  seccion: string | null;
  /**
   * El bullet sin checkbox que agrupa a esta tarea, si hay uno.
   *
   * No está en la §6 de la spec: sale de medir el corpus, donde 24 tareas
   * cuelgan de un bullet que las agrupa (`- **sexto**`, `- esta semana:`). El
   * usuario los describió como sub-áreas —modos de agrupar tareas del mismo
   * curso o proyecto que todavía no tenían sintaxis—. Se llama `grupo` y no
   * `subarea` para no colisionar con `area`, que es el prefijo `a_` de la §4.1.
   *
   * Algunos se van a convertir en workbenches en la migración del paso 8.
   */
  grupo: string | null;
  workbenches: string[];
  due: string | null;
  rec: "w" | "m" | null;
  prioridad: 0 | 1 | 2;
  done: string | null;
}

/**
 * La clave de sesión de una tarea: `archivo:línea`.
 *
 * Existe porque `padre`/`hijos` tienen que funcionar **antes** de que haya
 * ningún `id` escrito, y hoy no hay ninguno: el `id` se pone tarde a propósito
 * (§5.4). Es válida solo dentro de un parseo, y por eso no se escribe nunca en
 * el vault.
 */
export type Clave = string;

export function claveDe(archivo: string, linea: number): Clave {
  return `${archivo}:${linea}`;
}

/** El camino de headings vigente en una línea, resuelto por pila. */
interface Contexto {
  proyecto: string | null;
  area: string | null;
  seccion: string | null;
}

/**
 * El contexto de headings línea por línea.
 *
 * La herencia va por **pila, no por bandera pegajosa**: un heading de nivel N
 * saca de la pila todo lo que tenga nivel ≥ N. Es lo que pide la §4.1 —«el
 * nivel solo determina anidamiento y herencia»— y sin eso un proyecto se
 * derrama más allá de su alcance, que es lo que le pasa hoy a
 * `scripts/medir-tareas.mjs`.
 */
function contextoPorLinea(doc: Documento): Contexto[] {
  const salida: Contexto[] = [];
  const pila: { nivel: number; heading: Heading }[] = [];
  const headings = new Map(headingsDe(doc).map((h) => [h.n, h.heading]));

  let actual: Contexto = { proyecto: null, area: null, seccion: null };
  for (const l of doc.lineas) {
    const h = headings.get(l.n);
    if (h) {
      while (pila.length && pila[pila.length - 1]!.nivel >= h.nivel) pila.pop();
      pila.push({ nivel: h.nivel, heading: h });
      actual = {
        proyecto: cercano(pila, "proyecto"),
        area: cercano(pila, "área"),
        seccion: cercano(pila, "sección"),
      };
    }
    salida.push(actual);
  }
  return salida;
}

function cercano(
  pila: readonly { heading: Heading }[],
  tipo: Heading["tipo"],
): string | null {
  for (let i = pila.length - 1; i >= 0; i--) {
    const h = pila[i]!.heading;
    if (h.tipo !== tipo) continue;
    return tipo === "sección" ? h.texto.trim() : h.destino;
  }
  return null;
}

/** El grupo más cercano hacia arriba, o `null`. */
function grupoDe(nodo: Nodo, padres: ReadonlyMap<Nodo, Nodo>): string | null {
  for (let p = padres.get(nodo); p; p = padres.get(p)) {
    if (p.rol === "grupo") return p.bullet.contenido.trim();
    if (p.rol === "tarea") return null; // una tarea madre manda más que un grupo
  }
  return null;
}

/** Las notas de esta tarea: los bullets sin checkbox que cuelgan de ella (§4.3). */
function notasDe(nodo: Nodo): string[] {
  const salida: string[] = [];
  const visitar = (n: Nodo) => {
    for (const h of n.hijos) {
      if (h.rol === "tarea") continue; // lo que cuelga de otra tarea es de ella
      if (h.rol === "nota") salida.push(h.bullet.contenido);
      visitar(h);
    }
  };
  visitar(nodo);
  return salida;
}

/**
 * Las tareas de una nota, en orden de documento.
 *
 * Los `- [ ]` vacíos no aparecen nunca (invariante 8), y los bullets sin
 * checkbox tampoco: van adentro de `notas` de la tarea de la que cuelgan.
 */
export function indexar(doc: Documento, archivo: string): Task[] {
  const raices = arbolDe(doc);
  const todos = recorrer(raices);
  const contexto = contextoPorLinea(doc);

  const padres = new Map<Nodo, Nodo>();
  for (const n of todos) for (const h of n.hijos) padres.set(h, n);

  /** La tarea ancestro más cercana, saltando grupos, notas y separadores. */
  const tareaMadre = (n: Nodo): Nodo | null => {
    for (let p = padres.get(n); p; p = padres.get(p)) if (p.rol === "tarea") return p;
    return null;
  };

  const tareas: Task[] = [];
  const porNodo = new Map<Nodo, Task>();

  for (const nodo of todos) {
    if (nodo.rol !== "tarea") continue;
    const a = parseTaskToken(nodo.bullet.contenido);
    // Una línea ilegible es una tarea sin metadatos: se ve, se puede leer, y
    // no se reescribe (§5.3). Lo segundo lo garantiza `setTaskToken`.
    const meta: Partial<TaskMeta> = a.estado === "ilegible" ? {} : a.meta;
    const texto = (a.estado === "ilegible" ? nodo.bullet.contenido : a.texto).trim();
    const madre = tareaMadre(nodo);
    const ctx = contexto[nodo.n]!;

    const tarea: Task = {
      id: meta.id ?? null,
      texto,
      hecha: estadoDe(nodo.bullet) !== " ",
      archivo,
      linea: nodo.n,
      nivel: madre ? porNodo.get(madre)!.nivel + 1 : 0,
      padre: madre ? claveDe(archivo, madre.n) : null,
      hijos: [],
      notas: notasDe(nodo),
      proyecto: ctx.proyecto,
      area: ctx.area,
      seccion: ctx.seccion,
      grupo: grupoDe(nodo, padres),
      workbenches: meta.wb ?? [],
      due: meta.due ?? null,
      rec: meta.rec ?? null,
      prioridad: meta.prioridad ?? 0,
      done: meta.done ?? null,
    };
    porNodo.set(nodo, tarea);
    tareas.push(tarea);
    if (madre) porNodo.get(madre)!.hijos.push(claveDe(archivo, nodo.n));
  }

  return tareas;
}

/** Índice por clave, para navegar el árbol sin recorrerlo. */
export function porClave(tareas: readonly Task[]): Map<Clave, Task> {
  return new Map(tareas.map((t) => [claveDe(t.archivo, t.linea), t]));
}

/**
 * La tarea y todo lo que cuelga de ella, en orden de documento.
 *
 * Es la unidad de la §9: al mandar algo a un workbench va el árbol completo, no
 * una hoja suelta.
 */
export function subarbolDe(tareas: readonly Task[], clave: Clave): Task[] {
  const indice = porClave(tareas);
  const salida: Task[] = [];
  const visitar = (c: Clave) => {
    const t = indice.get(c);
    if (!t) return;
    salida.push(t);
    t.hijos.forEach(visitar);
  };
  visitar(clave);
  return salida;
}

/**
 * Qué tareas se completan al marcar esta.
 *
 * La §9 en una función: **marcar el padre completa a los hijos, y completar
 * todos los hijos no completa al padre.** Por eso esto es estrictamente
 * descendente y no existe la operación inversa: la asimetría es la regla.
 */
export function idsACompletar(tareas: readonly Task[], clave: Clave): Clave[] {
  return subarbolDe(tareas, clave).map((t) => claveDe(t.archivo, t.linea));
}

/**
 * Qué se destilda al desmarcar esta tarea: solo ella.
 *
 * La spec no dice nada del camino de vuelta, y la elección conservadora es no
 * tocar a los hijos: destildar en cascada borraría trabajo terminado por un
 * clic, y volver a tildar el padre los completa de nuevo igual.
 */
export function idsADestildar(_tareas: readonly Task[], clave: Clave): Clave[] {
  return [clave];
}
