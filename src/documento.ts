/**
 * La nota **entera y sin pérdida**.
 *
 * El índice de tareas se deriva de acá, no al revés. La razón es la §8 de la
 * spec: se escribe **por rango**, nunca el archivo entero, y para reemplazar un
 * rango hace falta tener la línea verbatim y su número. Un parser que solo
 * extraiga tareas no puede reescribir el archivo sin volver a leerlo, y ahí es
 * donde se pierden bytes.
 *
 * De la §4 salen cuatro clases de línea. Tres se deciden mirando la línea sola
 * —heading, tarea, resto—; la cuarta, «nota de tarea», **depende de los
 * ancestros**, así que no es una clase de línea sino un rol dentro del árbol.
 * Por eso `Clase` y `Rol` son dos cosas distintas.
 */
import { esTarea, parseBullet, parseHeading, type Bullet, type Heading } from "./linea.js";

/** Lo que se decide mirando la línea sola. */
export type Clase = "heading" | "tarea" | "bullet" | "otro";

/**
 * El papel de un ítem de lista dentro del árbol.
 *
 * `nota` y `grupo` son los dos usos que tienen los bullets sin checkbox en el
 * corpus, y son opuestos: uno cuelga de una tarea y el otro cuelga tareas.
 *
 * - `tarea`      — checkbox con texto (§4.2).
 * - `separador`  — `- [ ]` vacío (§4.4): nunca es tarea (invariante 8).
 * - `nota`       — bullet sin checkbox con una tarea entre sus ancestros (§4.3).
 *                  Se preserva verbatim en toda reescritura.
 * - `grupo`      — bullet sin checkbox con una tarea entre sus descendientes.
 *                  La spec no lo nombra, pero son 24 tareas del corpus las que
 *                  cuelgan de uno (`- **sexto**`, `- esta semana:`): es un
 *                  rótulo que el usuario escribió y que no hay que perder.
 * - `suelto`     — bullet sin checkbox sin tareas ni arriba ni abajo. Las 43
 *                  líneas de `tareas_CÍCLICAS` y los 37 del LOG son esto.
 */
export type Rol = "tarea" | "separador" | "nota" | "grupo" | "suelto";

export interface LineaDoc {
  /** Índice 0-based dentro de `lineas`. Volátil por diseño (§6). */
  n: number;
  /** La línea completa, verbatim. */
  texto: string;
  clase: Clase;
}

export interface Nodo {
  /** Número de línea, 0-based. */
  n: number;
  /** Ancho de la sangría en caracteres. */
  indent: number;
  bullet: Bullet;
  rol: Rol;
  hijos: Nodo[];
}

export interface HeadingDoc {
  n: number;
  heading: Heading;
}

export interface Documento {
  lineas: LineaDoc[];
}

function claseDe(texto: string): Clase {
  if (parseHeading(texto)) return "heading";
  const b = parseBullet(texto);
  if (!b) return "otro";
  return esTarea(b) ? "tarea" : "bullet";
}

/**
 * La nota partida en líneas y clasificada.
 *
 * `split("\n")` es exacto para cualquier string: conserva los `\r` de un
 * archivo con CRLF, la falta de salto final —cinco de las siete notas no
 * terminan en `\n`— y los espacios al final de línea. Es lo que hace que el
 * invariante 9 salga gratis en vez de tener que defenderse.
 */
export function parseDocumento(raw: string): Documento {
  return {
    lineas: raw.split("\n").map((texto, n) => ({ n, texto, clase: claseDe(texto) })),
  };
}

/**
 * El documento armado desde líneas que ya vienen partidas.
 *
 * Existe para la capa 3: CodeMirror parte el texto con `/\r\n?|\n/` y
 * `parseDocumento` con `split("\n")` a secas. Con CRLF las dos dan la misma
 * cantidad de líneas pero **no el mismo texto** —CodeMirror se come el `\r` y
 * el otro lo conserva— y por lo tanto tampoco las mismas columnas. Una
 * decoración calculada sobre columnas que no son las del editor reemplaza el
 * rango equivocado.
 *
 * Así que la capa 3 no vuelve a partir nada: le pasa a esto las líneas que
 * CodeMirror ya tiene.
 */
export function documentoDeLineas(lineas: readonly string[]): Documento {
  return renumerar(lineas);
}

/** El archivo de vuelta. `renderDocumento(parseDocumento(x)) === x` (inv. 9). */
export function renderDocumento(doc: Documento): string {
  return doc.lineas.map((l) => l.texto).join("\n");
}

/**
 * Una línea nueva en lugar de otra, sin tocar el resto.
 *
 * Es la forma de la §8 llevada a la lógica pura: la escritura sobre el vault de
 * la capa 2 va a traducir esto a un rango de `vault.process()`. Devuelve un
 * documento nuevo; nada se muta.
 */
export function reemplazarLinea(doc: Documento, n: number, texto: string): Documento {
  if (n < 0 || n >= doc.lineas.length) throw new RangeError(`línea ${n} fuera del documento`);
  const lineas = doc.lineas.slice();
  lineas[n] = { n, texto, clase: claseDe(texto) };
  return { lineas };
}

/** Los headings de la nota, en orden. */
export function headingsDe(doc: Documento): HeadingDoc[] {
  const salida: HeadingDoc[] = [];
  for (const l of doc.lineas) {
    if (l.clase !== "heading") continue;
    salida.push({ n: l.n, heading: parseHeading(l.texto)! });
  }
  return salida;
}

/**
 * El árbol de listas de la nota.
 *
 * Qué corta un árbol y qué no, medido sobre el corpus:
 *
 * - Una **línea en blanco no corta**: el 90% de los árboles del corpus tienen
 *   blancos adentro y cortar ahí partiría casi todos.
 * - Un **heading sí corta**: es el agrupador de la §4.1.
 * - Cualquier otra línea —una tabla, un `---`, texto libre— **también corta**.
 *   Son las 8 filas de tabla y los 36 `---` del corpus, y ninguno está adentro
 *   de un árbol.
 *
 * No hay saltos de nivel en el corpus (medido: cero saltos > 1), pero el
 * algoritmo no los necesita: se apoya en el ancho de la sangría, no en contarla.
 */
export function arbolDe(doc: Documento): Nodo[] {
  const raices: Nodo[] = [];
  let pila: Nodo[] = [];

  for (const l of doc.lineas) {
    if (l.texto.trim() === "") continue; // el blanco no corta
    const b = l.clase === "tarea" || l.clase === "bullet" ? parseBullet(l.texto) : null;
    if (!b) {
      pila = [];
      continue;
    }
    const indent = b.indent.length;
    while (pila.length && pila[pila.length - 1]!.indent >= indent) pila.pop();
    // El rol definitivo necesita ver los descendientes: se decide en la pasada
    // de abajo. Acá va el provisorio, que ya es correcto para las tareas.
    const nodo: Nodo = { n: l.n, indent, bullet: b, rol: rolProvisorio(l.clase, b), hijos: [] };
    (pila[pila.length - 1]?.hijos ?? raices).push(nodo);
    pila.push(nodo);
  }

  for (const r of raices) asignarRoles(r, false);
  return raices;
}

function rolProvisorio(clase: Clase, b: Bullet): Rol {
  if (clase === "tarea") return "tarea";
  return b.checkbox === null ? "suelto" : "separador";
}

/**
 * Reparte `nota`, `grupo` y `suelto` mirando el contexto completo.
 *
 * Cuando un bullet es las dos cosas —cuelga de una tarea y cuelga tareas—
 * **gana `nota`**, porque la consecuencia de equivocarse es asimétrica: una
 * nota mal clasificada se puede reescribir, y la §4.3 dice que las notas se
 * preservan verbatim. En el corpus no pasa nunca (medido: 0 casos), pero el
 * parser tiene que decidirlo igual.
 *
 * Un `separador` no cuenta como tarea a estos efectos (invariante 8): un bullet
 * bajo un `- [ ]` vacío no es una nota de tarea.
 */
function asignarRoles(nodo: Nodo, bajoTarea: boolean): boolean {
  let hayTareaAbajo = false;
  for (const h of nodo.hijos) {
    const conTarea = asignarRoles(h, bajoTarea || nodo.rol === "tarea");
    hayTareaAbajo = hayTareaAbajo || conTarea;
  }
  if (nodo.rol === "suelto" || nodo.rol === "nota" || nodo.rol === "grupo") {
    nodo.rol = bajoTarea ? "nota" : hayTareaAbajo ? "grupo" : "suelto";
  }
  return nodo.rol === "tarea" || hayTareaAbajo;
}

/** Todos los nodos del árbol, en orden de documento. */
export function recorrer(nodos: readonly Nodo[]): Nodo[] {
  const salida: Nodo[] = [];
  const visitar = (n: Nodo) => {
    salida.push(n);
    n.hijos.forEach(visitar);
  };
  nodos.forEach(visitar);
  return salida;
}

// ------------------------------------------------- escritura por rango (§8)

/**
 * Una línea que va a cambiar, y **en qué texto la esperaba quien planeó el cambio**.
 *
 * Vive acá, con `reemplazarLinea` e `insertarLineas`, porque es la descripción
 * de una escritura por rango: lo que la §8 pide en vez de reescribir el archivo.
 *
 * `antes` no es decorativo y es lo que hace posible el invariante 10. Un plan se
 * arma sobre el documento que el store tiene en memoria y se aplica minutos
 * después sobre el disco, que para entonces puede haberse corrido: llevar el
 * texto esperado permite **verificar antes de escribir** en vez de confiar en un
 * número de línea. Quien lo verifica es `src/ubicar.ts`.
 *
 * También es lo que permite confirmar antes de una escritura grande —el reinicio
 * de un grupo cíclico son 23 líneas de un tirón, medido— porque para decir «vas a
 * reiniciar 23 tareas» hay que tener el plan antes de aplicarlo. Y hace falta:
 * `vault.process()` no pasa por el editor, así que Ctrl-Z no lo deshace.
 */
export interface CambioDeLinea {
  linea: number;
  antes: string;
  despues: string;
}

/**
 * Líneas nuevas insertadas **antes** de la línea `n`.
 *
 * Insertar en `lineas.length` agrega al final. Ojo con lo que eso significa
 * según cómo termine el archivo: una nota que termina en `\n` tiene una última
 * línea vacía, así que «al final del texto» es antes de esa, no después. Es la
 * diferencia entre agregar una tarea y agregar una tarea más un salto de línea
 * de regalo, en cinco de las siete notas que no terminan en `\n`.
 */
export function insertarLineas(doc: Documento, n: number, textos: readonly string[]): Documento {
  if (n < 0 || n > doc.lineas.length) throw new RangeError(`línea ${n} fuera del documento`);
  const crudas = doc.lineas.map((l) => l.texto);
  crudas.splice(n, 0, ...textos);
  return renumerar(crudas);
}

/**
 * El documento sin las líneas de `desde` a `hasta`, las dos incluidas.
 *
 * Existe para el descarte físico de la §12, que es una acción explícita y con
 * confirmación. Ninguna operación automática lo llama.
 */
export function eliminarLineas(doc: Documento, desde: number, hasta: number): Documento {
  if (desde < 0 || hasta >= doc.lineas.length || desde > hasta)
    throw new RangeError(`rango ${desde}..${hasta} fuera del documento`);
  const crudas = doc.lineas.map((l) => l.texto);
  crudas.splice(desde, hasta - desde + 1);
  return renumerar(crudas);
}

/**
 * Reconstruye el documento desde las líneas crudas.
 *
 * Insertar y borrar corren los números de línea de todo lo que sigue, y `n` es
 * volátil por diseño (§6): la identidad es el `id`, nunca la posición. Volver a
 * clasificar es barato —parsear las siete notas enteras cuesta 0,3 ms— y evita
 * la clase de bug donde un índice queda apuntando a otra línea.
 */
function renumerar(crudas: readonly string[]): Documento {
  return { lineas: crudas.map((texto, n) => ({ n, texto, clase: claseDe(texto) })) };
}

/**
 * El rango de líneas que ocupa un nodo con todo lo que cuelga de él.
 *
 * Es la unidad de la §12 —archivar manda el subárbol completo, incluidas las
 * notas sin checkbox— y también la unidad de escritura de la §8: un rango, no
 * el archivo.
 *
 * Las líneas en blanco **de adentro** entran, porque el árbol no se corta en
 * un blanco y sacarlas cambiaría el texto que se archiva. Las de después del
 * último descendiente no: pertenecen a lo que sigue, no al subárbol.
 */
export function rangoDelSubarbol(nodo: Nodo): { desde: number; hasta: number } {
  let hasta = nodo.n;
  const visitar = (x: Nodo) => {
    hasta = Math.max(hasta, x.n);
    x.hijos.forEach(visitar);
  };
  visitar(nodo);
  return { desde: nodo.n, hasta };
}

/** Las líneas de un subárbol, verbatim y en orden. */
export function lineasDelSubarbol(doc: Documento, nodo: Nodo): string[] {
  const { desde, hasta } = rangoDelSubarbol(nodo);
  return doc.lineas.slice(desde, hasta + 1).map((l) => l.texto);
}

/** El nodo que empieza en esta línea, o `null`. */
export function nodoEnLinea(nodos: readonly Nodo[], n: number): Nodo | null {
  return recorrer(nodos).find((x) => x.n === n) ?? null;
}
