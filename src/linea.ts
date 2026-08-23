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

// ---------------------------------------------------------------- headings

/**
 * El tipo semántico de un heading (spec §4.1).
 *
 * Sale del **prefijo del destino del wikilink**, no del nivel (D6): en el
 * corpus H1 y H4 aparecen las dos veces como proyecto y como sección, así que
 * el nivel no distingue nada. El nivel solo decide anidamiento y herencia.
 */
export type TipoHeading = "proyecto" | "área" | "sección";

/**
 * Los pedazos de un heading, verbatim: `renderHeading(parseHeading(x)) === x`.
 *
 * `hashes` y `espacio` se guardan aparte por la misma razón que en `Bullet`:
 * reescribir sin normalizar de paso.
 */
export interface Heading {
  hashes: string;
  espacio: string;
  /** Lo que sigue al espacio, verbatim, incluidos los espacios finales. */
  texto: string;
  /** 1 a 6. */
  nivel: number;
  tipo: TipoHeading;
  /** El destino del wikilink, si el heading es proyecto o área. */
  destino: string | null;
  /**
   * Una referencia `p_`/`a_` escrita **sin corchetes**, si la hay.
   *
   * No tiene efecto sobre `tipo`: por decisión del usuario, solo el wikilink
   * define proyecto o área (§4.1 al pie de la letra). Existe porque hoy 15 de
   * los 18 headings semánticos están en texto plano y la migración de la §19.1
   * —que es el paso 8— necesita la lista. Guardarlo acá evita tener que volver
   * a inventar una gramática para eso.
   *
   * El corte es hasta el fin de línea: sin delimitador no hay forma de saber
   * dónde termina el nombre, y adivinar lo partiría. Cortar en el primer
   * espacio —lo que hace `scripts/medir-tareas.mjs`— produce nombres que no son
   * de nada: hay proyectos del vault cuyo nombre lleva espacios y existe como
   * carpeta con el nombre entero. Ver `INFORME-gramaticas.md` §3.
   */
  candidatoPlano: string | null;
}

const HEADING_RE = /^(#{1,6})([ \t]+)([\s\S]*)$/;
/** Wikilink en cualquier parte del texto. El destino corta en `#`, `|` o `]]`. */
const WIKILINK_RE = /\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/;
/** `p_algo` o `a_algo` sin corchetes, tras principio de línea o separador. */
const REF_PLANA_RE = /(?:^|[\s⮕→>])([pa]_.*)$/;

/** Los pedazos del heading, o `null` si la línea no es un heading ATX. */
export function parseHeading(text: string): Heading | null {
  const m = HEADING_RE.exec(text);
  if (!m) return null;
  const [, hashes, espacio, contenido] = m as unknown as [string, string, string, string];

  const wiki = WIKILINK_RE.exec(contenido);
  const destino = wiki ? wiki[1]!.trim() : null;
  const tipo: TipoHeading =
    destino?.startsWith("p_") ? "proyecto" : destino?.startsWith("a_") ? "área" : "sección";

  return {
    hashes,
    espacio,
    texto: contenido,
    nivel: hashes.length,
    tipo,
    destino: tipo === "sección" ? null : destino,
    // Solo tiene sentido cuando no hay wikilink semántico: si el heading ya
    // dice `[[p_X]]`, no hay nada que migrar. Se busca aunque haya un
    // wikilink a otra cosa (`## WORKBENCH | [[tareas_LOG]] ⮕ p_X`).
    candidatoPlano:
      tipo === "sección" ? (REF_PLANA_RE.exec(contenido)?.[1]?.trim() ?? null) : null,
  };
}

/** La línea de vuelta, byte por byte. */
export function renderHeading(h: Heading): string {
  return `${h.hashes}${h.espacio}${h.texto}`;
}
