/**
 * **Qué** se decora en una nota de tareas. Sin CodeMirror y sin DOM.
 *
 * Capa 1. `src/editor/decoraciones.ts` traduce esto a `Decoration`, y no hace
 * ninguna otra cosa: así lo que se puede probar sin abrir Obsidian se prueba
 * sin abrir Obsidian, que es el §5 de las notas de método.
 *
 * Son tres marcas y cada una tiene su párrafo en la spec:
 *
 * - `oculto`     — el tramo del token (§5.1: en Live Preview lo esconde el plugin).
 * - `prioridad`  — la línea de la tarea (§14: el color pinta la línea, no el subárbol).
 * - `hija`       — un descendiente (§14: filete de 2px del mismo color a la izquierda).
 *
 * ## Se recorre el documento entero, no el viewport
 *
 * No es distracción: es la restricción de la §5.5. Las decoraciones van en un
 * `StateField`, que aporta al mapa de alturas un `DecorationSet` —lo que llega
 * como función, o sea lo que aporta un `ViewPlugin`, el mapa lo descarta—, y
 * para eso el set tiene que cubrir el documento entero. Y no hay ninguna razón
 * para ser astutos: parsear las siete notas enteras cuesta 0,31 ms.
 */
import { arbolDe, rangoDelSubarbol, recorrer, type Documento } from "./documento.js";
import { inicioDelTramo } from "./hiddenTail.js";
import { parseTaskToken, type Prioridad } from "./token.js";

export type Marca =
  /** El tramo oculto, de la columna `desde` **hasta el final de la línea**. */
  | { tipo: "oculto"; linea: number; desde: number }
  | { tipo: "prioridad"; linea: number; nivel: 1 | 2 }
  | { tipo: "hija"; linea: number; nivel: 1 | 2 };

/**
 * Todas las marcas de una nota, en orden de línea.
 *
 * ## El token se oculta **solo en líneas que son tarea**
 *
 * `indexar` lee el token de `bullet.contenido`, o sea que un `%%t:…%%` en una
 * línea sin checkbox no está en el índice: ninguna vista lo muestra y ninguna
 * acción lo toca. Ocultarlo lo volvería un fantasma —metadatos invisibles que
 * no son de nadie—. Que se vea es lo que permite borrarlo.
 *
 * Es el mismo criterio que con el token roto, y la misma razón: **se oculta
 * solo lo que el plugin gestiona.**
 */
export function marcasDe(doc: Documento): Marca[] {
  const marcas: Marca[] = [];

  for (const l of doc.lineas) {
    if (l.clase !== "tarea") continue;
    const desde = inicioDelTramo(l.texto);
    if (desde < l.texto.length) marcas.push({ tipo: "oculto", linea: l.n, desde });
  }

  for (const [linea, nivel] of prioridadPorLinea(doc)) {
    marcas.push({ tipo: nivel.propia ? "prioridad" : "hija", linea, nivel: nivel.nivel });
  }

  return marcas.sort((a, b) => a.linea - b.linea || orden(a) - orden(b));
}

/** El token oculto va después de la marca de línea, como en Anotaciones. */
function orden(m: Marca): number {
  return m.tipo === "oculto" ? 1 : 0;
}

interface Pintada {
  nivel: 1 | 2;
  /** `true` si es la línea de la tarea que tiene el `p=`; `false` si la hereda. */
  propia: boolean;
}

/**
 * Qué nivel le toca a cada línea, contando la herencia por el subárbol.
 *
 * El filete de los hijos baja por el **rango** del subárbol y no por sus nodos,
 * para que las líneas en blanco de adentro también lo lleven: el 90% de los
 * árboles del corpus tienen blancos adentro y un filete con agujeros se lee
 * como tres bloques en vez de uno.
 *
 * `recorrer` da los nodos en orden de documento, o sea la madre antes que la
 * hija, así que una tarea con prioridad propia **pisa** lo que había heredado
 * de más arriba en todo su subárbol. Gana la ancestra más cercana, que es lo
 * único predecible: la línea se pinta de su propio color y no de dos.
 */
function prioridadPorLinea(doc: Documento): Map<number, Pintada> {
  const nivel = new Array<Prioridad>(doc.lineas.length).fill(0);
  const propias = new Map<number, 1 | 2>();

  for (const nodo of recorrer(arbolDe(doc))) {
    if (nodo.rol !== "tarea") continue;
    const a = parseTaskToken(nodo.bullet.contenido);
    // Un token ilegible es una tarea sin metadatos: no tiene prioridad que
    // dibujar, y encima se la ve entera (invariante 7).
    if (a.estado === "ilegible" || a.meta.prioridad === 0) continue;

    const p = a.meta.prioridad;
    propias.set(nodo.n, p);
    const { desde, hasta } = rangoDelSubarbol(nodo);
    for (let n = desde; n <= hasta && n < nivel.length; n++) nivel[n] = p;
  }

  const salida = new Map<number, Pintada>();
  for (let n = 0; n < nivel.length; n++) {
    const p = nivel[n]!;
    if (p === 0) continue;
    const propia = propias.get(n);
    salida.set(n, propia !== undefined ? { nivel: propia, propia: true } : { nivel: p, propia: false });
  }
  return salida;
}
