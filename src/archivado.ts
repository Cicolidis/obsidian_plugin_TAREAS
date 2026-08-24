/**
 * Archivar al LOG (spec §12).
 *
 * El hallazgo que ordena la §12: solo el 7,5% de las tareas están completadas,
 * y en `tareas_COLE` son 3 de 309. El usuario **borra** las tareas breves y las
 * que quiere guardar «trata» de pasarlas al LOG a mano. Archivar tiene que
 * costar un clic, y **nunca borra la línea de la nota**: la tarea queda `[x]` en
 * su lugar y las vistas la ocultan. El descarte físico es otra acción.
 *
 * Todo acá es lógica pura: produce las **líneas** que hay que escribir y
 * **dónde**, y no escribe nada. La capa 2 lo traduce a rangos de
 * `vault.process()` (§8).
 */
import {
  arbolDe,
  headingsDe,
  insertarLineas,
  rangoDelSubarbol,
  type Documento,
  type Nodo,
} from "./documento.js";
import { renderBullet } from "./linea.js";
import { parseTaskToken, stripTaskToken } from "./token.js";

/** La marca de completado que se escribe al final de la línea archivada. */
export function marcaDeFecha(fecha: string): string {
  return `[✓ ${fecha}]`;
}

/**
 * El camino de headings que tenía la tarea en su nota.
 *
 * La §12 dice que el archivado escribe bajo **el mismo camino**, creando los
 * que falten: el destino no se elige, ya está determinado por dónde vivía la
 * tarea. Se devuelven los textos, no los niveles: los niveles de origen tienen
 * huecos —en `tareas_COLE` un h4 cuelga directo de un h1— y copiarlos dejaría
 * el LOG mal formado. Los niveles se reasignan al escribir.
 */
export function caminoDeHeadings(doc: Documento, linea: number): string[] {
  const pila: { nivel: number; texto: string }[] = [];
  for (const h of headingsDe(doc)) {
    if (h.n >= linea) break;
    while (pila.length && pila[pila.length - 1]!.nivel >= h.heading.nivel) pila.pop();
    pila.push({ nivel: h.heading.nivel, texto: h.heading.texto.trim() });
  }
  return pila.map((p) => p.texto);
}

/**
 * El bloque tal como va escrito en el LOG.
 *
 * - **Bullet sin checkbox**: es el formato que el LOG ya usa, 37 bullets y cero
 *   checkboxes. Una tarea archivada no se vuelve a completar.
 * - **Se limpia el token**: el `id` ya no apunta a nada vivo (§12).
 * - **Va el subárbol completo, notas incluidas.** En el LOG esas líneas son el
 *   contenido valioso, y se copian verbatim.
 * - La sangría se recalcula desde la raíz del subárbol, para que el bloque
 *   quede a nivel cero en el LOG sin importar de qué profundidad salió.
 *
 * La fecha va **en la raíz**, que es lo que la §12 muestra en su ejemplo. Un
 * descendiente solo la lleva si tiene un `done` escrito y **distinto** del de la
 * raíz: sin esa excepción se perdería la fecha de una subtarea terminada otro
 * día, y poniéndola en todas las líneas el LOG se llenaría de fechas repetidas.
 */
export function bloqueParaElLog(doc: Documento, nodo: Nodo, hoy: string): string[] {
  const { desde } = rangoDelSubarbol(nodo);
  const base = nodo.indent;
  const fechaRaiz = doneDe(doc.lineas[desde]!.texto) ?? hoy;

  const salida: string[] = [];
  const visitar = (n: Nodo) => {
    const texto = doc.lineas[n.n]!.texto;
    if (n.rol === "separador") return; // un `- [ ]` vacío no significa nada acá
    salida.push(lineaParaElLog(texto, n, base, n.n === desde ? fechaRaiz : null, fechaRaiz));
    n.hijos.forEach(visitar);
  };
  visitar(nodo);
  return salida;
}

/** El `done` escrito en el token, o `null` si no hay ninguno. */
function doneDe(texto: string): string | null {
  const a = parseTaskToken(texto);
  return a.estado === "ok" ? a.meta.done : null;
}

function lineaParaElLog(
  texto: string,
  nodo: Nodo,
  base: number,
  fechaForzada: string | null,
  fechaRaiz: string,
): string {
  const b = nodo.bullet;
  const sangria = "\t".repeat(Math.max(0, nodo.indent - base));
  const contenido = stripTaskToken(b.contenido).trimEnd();

  let fecha = fechaForzada;
  if (fecha === null && nodo.rol === "tarea") {
    // Solo si el descendiente tiene un `done` **escrito** y distinto del de la
    // raíz. Si no tiene ninguno, no se le inventa uno: heredar la fecha de hoy
    // haría que toda subtarea sin token quedara marcada con un día en el que no
    // se terminó nada.
    const propia = doneDe(texto);
    fecha = propia !== null && propia !== fechaRaiz ? propia : null;
  }

  return renderBullet({
    indent: sangria,
    marcador: "-",
    espacio: " ",
    checkbox: null, // el LOG no lleva checkboxes
    contenido: fecha === null ? contenido : `${contenido} ${marcaDeFecha(fecha)}`,
  });
}

// -------------------------------------------------- dónde va en el LOG

export interface PlanDeArchivado {
  /** Los headings que hay que crear, con su nivel y su texto. */
  headingsNuevos: { nivel: number; texto: string }[];
  /** En qué línea del LOG se inserta todo. */
  linea: number;
  /** Las líneas a insertar, headings nuevos incluidos y en orden. */
  lineas: string[];
}

/**
 * Dónde y qué escribir en el LOG para archivar este bloque.
 *
 * Busca el prefijo más largo del camino que ya existe y crea solo lo que falta.
 * Es lo que hace que archivar dos veces bajo el mismo proyecto no duplique el
 * heading: el invariante 6 de la §18.
 *
 * Los headings nuevos se escriben en niveles consecutivos desde donde enganchó
 * el camino, así el LOG queda bien formado aunque el origen tuviera huecos de
 * nivel.
 */
export function planDeArchivado(
  log: Documento,
  camino: readonly string[],
  bloque: readonly string[],
): PlanDeArchivado {
  const headings = headingsDe(log).map((h) => ({ n: h.n, nivel: h.heading.nivel, texto: h.heading.texto.trim() }));

  // Prefijo del camino que ya existe, anidado de verdad y no solo presente.
  let enganche = -1;
  let nivelEnganche = 0;
  let profundidad = 0;
  for (const paso of camino) {
    const i = headings.findIndex(
      (h, idx) => h.texto === paso && h.nivel > nivelEnganche && idx > enganche && dentroDe(headings, idx, enganche, nivelEnganche),
    );
    if (i === -1) break;
    enganche = i;
    nivelEnganche = headings[i]!.nivel;
    profundidad++;
  }

  const faltan = camino.slice(profundidad);
  const headingsNuevos = faltan.map((texto, i) => ({ nivel: nivelEnganche + i + 1, texto }));

  // El final de la sección donde engancha: antes del próximo heading de nivel
  // menor o igual, y sin arrastrar los blancos que separan las secciones.
  const linea = finDeSeccion(log, enganche === -1 ? -1 : headings[enganche]!.n, nivelEnganche);

  // El blanco que separa del contenido anterior solo va si hay contenido
  // anterior: en un LOG vacío dejaría el archivo empezando con una línea en
  // blanco, que después nadie borra.
  const haceFalta = linea > 0 && log.lineas[linea - 1]!.texto.trim() !== "";
  const lineas = [
    ...headingsNuevos.flatMap((h, i) => [
      ...(i === 0 ? (haceFalta ? [""] : []) : [""]),
      `${"#".repeat(h.nivel)} ${h.texto}`,
    ]),
    ...(headingsNuevos.length ? [""] : []),
    ...bloque,
  ];
  return { headingsNuevos, linea, lineas };
}

/** ¿El heading `idx` cuelga del `enganche`, o ya salió de esa rama? */
function dentroDe(
  headings: readonly { nivel: number }[],
  idx: number,
  enganche: number,
  nivelEnganche: number,
): boolean {
  if (enganche === -1) return true;
  for (let i = enganche + 1; i < idx; i++) if (headings[i]!.nivel <= nivelEnganche) return false;
  return true;
}

/**
 * La línea siguiente al último contenido de una sección.
 *
 * Si el camino no enganchó en ningún lado (`nHeading === -1`), la sección nueva
 * va **al final del archivo**: un log crece por abajo. Meterla arriba dejaría
 * lo recién archivado por encima de lo viejo y, peor, por encima de los
 * headings que ya estaban.
 */
function finDeSeccion(log: Documento, nHeading: number, nivel: number): number {
  let fin = log.lineas.length;
  if (nHeading >= 0) {
    for (const h of headingsDe(log)) {
      if (h.n <= nHeading) continue;
      if (h.heading.nivel <= nivel) {
        fin = h.n;
        break;
      }
    }
  }
  while (fin > nHeading + 1 && log.lineas[fin - 1]!.texto.trim() === "") fin--;
  return fin;
}

/** El LOG con el bloque ya archivado. */
export function aplicarArchivado(log: Documento, plan: PlanDeArchivado): Documento {
  return insertarLineas(log, plan.linea, plan.lineas);
}

/**
 * El default de la §12: descartar o archivar.
 *
 * Se deriva del tamaño del bloque, no de una preferencia: p50 = 2 líneas, así
 * que la mayoría son hojas y el default es descartar. Una tarea con subárbol o
 * con notas tiene contenido que vale guardar.
 */
export function archivarPorDefecto(nodo: Nodo): boolean {
  // Los hijos del nodo son tanto subtareas como notas: las dos cosas que la
  // §12 nombra como razón para archivar.
  return nodo.hijos.length > 0;
}

/** Atajo: el nodo de esa línea, para quien tiene el documento y no el árbol. */
export function nodoDeTarea(doc: Documento, linea: number): Nodo | null {
  const buscar = (ns: readonly Nodo[]): Nodo | null => {
    for (const n of ns) {
      if (n.n === linea) return n;
      const h = buscar(n.hijos);
      if (h) return h;
    }
    return null;
  };
  return buscar(arbolDe(doc));
}
