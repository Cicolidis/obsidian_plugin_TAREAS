/**
 * La gramática mínima de una línea de lista.
 *
 * De las cuatro clases de línea de la §4 de la spec, acá vive solo la que el
 * prototipo necesita: el bullet, con o sin checkbox. Está en un módulo propio
 * porque **el regex del bullet tiene que ser uno solo**: hoy lo usan el filtro
 * de transacciones y sus tests, y mañana lo van a usar el parser, el token y
 * el archivado. Una lista de valores repartida en varios archivos diverge
 * (CLAUDE.md).
 *
 * La forma sale de los dos motores que ya deciden esto en el vault real, para
 * no divergir de ninguno:
 *
 * - Obsidian, `newlineAndIndentContinueMarkdownList`:
 *   `/^([>\s]*)(([*+-] |(\d+)([.)] ))(?:\[(.)\] )?)?/`
 * - Outliner: `` `(?:[-*+]|\d+\.)` `` + `` `\[[^\[\]]\][ \t]` ``
 *
 * De los dos se hereda que el checkbox **necesita un separador después del
 * `]`**: `- [ ]texto` no es una tarea para ninguno de los dos, y tampoco acá.
 * La única concesión es el final de línea, para que `- [ ]` sin espacio —que
 * el corpus tiene— siga siendo un checkbox.
 */

/** El checkbox que escribe el plugin. Pendiente y con su espacio. */
export const CHECKBOX_PENDIENTE = "[ ] ";

/**
 * Los pedazos de una línea de lista, **verbatim**: concatenarlos en orden
 * devuelve la línea original byte por byte. Es lo que permite reescribir sin
 * normalizar de paso, que es la forma más barata de corromper un archivo de
 * 304 tareas.
 */
export interface Bullet {
  /** Sangría. Las siete notas usan tabs y ninguna mezcla (spec §2). */
  indent: string;
  /** `-`, `*`, `+`, `1.`, `1)` */
  marcador: string;
  /** Lo que separa el marcador del resto. */
  espacio: string;
  /** `"[ ] "`, `"[x] "`, `"[ ]"` al final de línea… o `null` si no hay. */
  checkbox: string | null;
  contenido: string;
}

const BULLET_RE = /^([ \t]*)([-*+]|\d+[.)])([ \t]+)(\[[^[\]]\](?:[ \t]|(?=$)))?([\s\S]*)$/;

/** Los pedazos de la línea, o `null` si no es una línea de lista. */
export function parseBullet(text: string): Bullet | null {
  const m = BULLET_RE.exec(text);
  if (!m) return null;
  return {
    indent: m[1]!,
    marcador: m[2]!,
    espacio: m[3]!,
    checkbox: m[4] ?? null,
    contenido: m[5]!,
  };
}

/** La línea de vuelta. `renderBullet(parseBullet(x)) === x` para todo bullet. */
export function renderBullet(b: Bullet): string {
  return `${b.indent}${b.marcador}${b.espacio}${b.checkbox ?? ""}${b.contenido}`;
}

/** El estado del checkbox —`" "`, `"x"`— o `null` si no tiene. */
export function estadoDe(b: Bullet): string | null {
  return b.checkbox === null ? null : b.checkbox[1]!;
}

/**
 * ¿Es una tarea?
 *
 * Tiene checkbox **y** algo escrito. Es el invariante 8 de la spec: los 11
 * `- [ ]` vacíos del corpus son separadores visuales, no tareas, y contarlos
 * haría que las vistas mostraran tareas que nadie escribió.
 */
export function esTarea(b: Bullet): boolean {
  return b.checkbox !== null && b.contenido.trim() !== "";
}

/** En qué columna de la línea empieza —o empezaría— el checkbox. */
export function columnaDelCheckbox(b: Bullet): number {
  return b.indent.length + b.marcador.length + b.espacio.length;
}

/** En qué columna empieza el contenido: después del marcador y del checkbox. */
export function columnaDelContenido(b: Bullet): number {
  return columnaDelCheckbox(b) + (b.checkbox?.length ?? 0);
}
