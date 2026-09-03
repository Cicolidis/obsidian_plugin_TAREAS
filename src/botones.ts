/**
 * **Qué** botones tiene una tarea y en qué estado. Sin CodeMirror y sin DOM.
 *
 * Capa 1. `src/editor/filaDeBotones.ts` traduce esto a un widget y no hace
 * ninguna otra cosa. Es la misma separación que `decorar.ts` con
 * `editor/decoraciones.ts`, que funcionó: lo que se puede probar sin abrir
 * Obsidian se prueba sin abrir Obsidian (§5 de las notas de método).
 *
 * ## Se calcula del texto de la línea, no del store
 *
 * Podría recibir una `Task` —el store ya las tiene indexadas— y sería más
 * cómodo. No lo hace, y la razón es la misma que ordena `elegirTarea`: **el
 * store puede estar atrasado y el texto de la línea no**. La fila se dibuja
 * sobre la línea que el usuario está mirando; si dijera algo distinto de lo que
 * esa línea tiene escrito, el ★ mentiría sobre la tarea que tiene debajo.
 *
 * El store sí aparece del otro lado, al **actuar**: ahí hace falta el subárbol
 * (§9) y ahí `elegirTarea` traduce la coordenada del editor a la del índice.
 *
 * ## El indicador persistente
 *
 * La §13.0: «el ★ queda relleno si la tarea está en ese workbench. Sin esto se
 * hace doble clic sin darse cuenta, porque la tarea no se va de la nota al
 * asignarla». Eso es `activo`, y es la única razón por la que este módulo tiene
 * que leer el token en vez de devolver una lista fija.
 */
import { esTarea, parseBullet } from "./linea.js";
import { STRINGS } from "./strings.js";
import { parseTaskToken } from "./token.js";

/**
 * Qué hace cada botón. El orden de la §13.0: `[★] [◐] [→] [⋯]`, más el 🗑.
 *
 * `eliminar` es opcional y va **último**, después del ⋯: es el único
 * destructivo, y lo pidió el uso —«Obsidian no es un verdadero outliner»,
 * borrar una tarea anidada a mano es incómodo—. Va al final para que quede lo
 * más lejos posible del ★, que es el que más se aprieta.
 */
export type Accion = "wb-primario" | "wb-secundario" | "popover" | "menu" | "eliminar";

export interface Boton {
  accion: Accion;
  /**
   * El nombre del ícono de Lucide, que es lo que Obsidian trae y sabe dibujar.
   *
   * Vive acá y no en la vista por lo mismo que `colorClass` vive en `color.ts`:
   * es la traducción de un dato a presentación, y en un solo lugar. Quién lo
   * dibuja es la capa 3, que recibe `setIcon` inyectado.
   */
  icono: string;
  /** El `aria-label` y el tooltip. La fila es solo íconos: esto es su nombre. */
  etiqueta: string;
  /** El workbench al que apunta, o `null` en el → y el ⋯. */
  workbench: string | null;
  /** El indicador persistente de la §13.0: ★ relleno si ya está ahí. */
  activo: boolean;
}

export interface Fila {
  botones: Boton[];
  /**
   * El token de esta línea no parsea (§5.3).
   *
   * La fila **se dibuja igual**, apagada. Esconderla dejaría una tarea sin
   * botones y sin explicación, que es el modo de falla que el plugin viene
   * evitando desde la sesión 3: un misterio en vez de algo arreglable a mano.
   */
  ilegible: boolean;
}

/** Los dos botones fijos de la §13.0, «asignables en settings». */
export interface Favoritos {
  primario: string;
  /** Vacío = el ◐ no se dibuja. Ver `sanearWorkbenchOpcional`. */
  secundario: string;
}

const ICONOS: Record<Accion, string> = {
  // ★ y ◐ de la §13.0. Los dos se rellenan cuando la tarea está en su
  // workbench, así que el nivel de «relleno» no puede ser parte del glifo:
  // `star` y `circle` son contornos que la hoja de estilos rellena.
  "wb-primario": "star",
  "wb-secundario": "circle",
  popover: "arrow-right",
  menu: "more-horizontal",
  // El mismo que el ítem del ⋯: son la misma acción por dos puertas.
  eliminar: "trash-2",
};

/**
 * La fila de esta línea, o `null` si la línea no es una tarea.
 *
 * Un bullet sin checkbox y un `- [ ]` vacío no llevan fila: no son tareas
 * (invariante 8) y ninguna acción del plugin los toca. Es el mismo criterio con
 * el que `decorar.ts` decide dónde esconder el token — se gestiona lo que se
 * gestiona, y nada más.
 */
export function filaDe(
  texto: string,
  favoritos: Favoritos,
  conEliminar = false,
): Fila | null {
  const b = parseBullet(texto);
  if (!b || !esTarea(b)) return null;

  const a = parseTaskToken(texto);
  const ilegible = a.estado === "ilegible";
  // De una línea ilegible no se leyó nada, así que no se sabe en qué workbench
  // está: los botones van apagados, no «afuera».
  const wb = ilegible ? [] : a.meta.wb;

  // Con el token roto los cuatro botones son inertes —`planDeWorkbench`,
  // `planDePrioridad` y `planDeCompletar` se niegan igual (§5.3)— así que
  // ninguno puede prometer lo que va a hacer. Salió de **mirar la salida**: los
  // tests pasaban y el tooltip decía «Mandar a foco» sobre una tarea donde
  // clickear no hace nada. Un control que miente es peor que uno apagado.
  const etiqueta = (propia: string) => (ilegible ? STRINGS.fila.ilegible : propia);

  const botones: Boton[] = [];
  for (const [accion, nombre] of [
    ["wb-primario", favoritos.primario],
    ["wb-secundario", favoritos.secundario],
  ] as const) {
    if (nombre === "") continue;
    const activo = wb.includes(nombre);
    botones.push({
      accion,
      icono: ICONOS[accion],
      etiqueta: etiqueta(activo ? STRINGS.fila.sacarDe(nombre) : STRINGS.fila.mandarA(nombre)),
      workbench: nombre,
      activo,
    });
  }

  botones.push(
    {
      accion: "popover",
      icono: ICONOS.popover,
      etiqueta: etiqueta(STRINGS.fila.todosLosWorkbenches),
      workbench: null,
      activo: false,
    },
    {
      accion: "menu",
      icono: ICONOS.menu,
      etiqueta: etiqueta(STRINGS.fila.masAcciones),
      workbench: null,
      activo: false,
    },
  );

  if (conEliminar) {
    botones.push({
      accion: "eliminar",
      icono: ICONOS.eliminar,
      etiqueta: etiqueta(STRINGS.fila.eliminar),
      workbench: null,
      activo: false,
    });
  }

  return { botones, ilegible };
}

/**
 * Los workbenches que ofrece el popover del →, sin repetir y en orden.
 *
 * Los dos de ajustes van **primero y siempre**, aunque no los use ninguna
 * tarea: son los que el usuario eligió, y que aparezcan o no según lo que haya
 * escrito en el vault haría que el menú cambiara de forma solo. Detrás, los que
 * están en uso, alfabéticos.
 *
 * Es capa 1 y puro para que la numeración 1-9 de la §13.0 sea comprobable sin
 * abrir un menú: la vista solo enumera lo que sale de acá.
 */
export function workbenchesDelPopover(
  favoritos: Favoritos,
  enUso: readonly string[],
): string[] {
  const salida: string[] = [];
  const vistos = new Set<string>();
  for (const n of [favoritos.primario, favoritos.secundario, ...[...enUso].sort()]) {
    if (n === "" || vistos.has(n)) continue;
    vistos.add(n);
    salida.push(n);
  }
  return salida;
}

// ------------------------------------------------ el modo, como clase de body

/**
 * La clase de `body` que enciende cada modo de revelación.
 *
 * Va en `body` y no en la decoración por lo mismo que las clases del estilo de
 * prioridad (§14): alternar un ajuste no puede obligar a reconstruir el set de
 * decoraciones de cada editor abierto. El widget dibuja siempre lo mismo y la
 * hoja de estilos decide si se ve.
 *
 * `swipe` cae en su propia clase aunque hoy no tenga reglas: el día que exista
 * el móvil, la hoja de estilos ya tiene dónde colgarlas.
 */
export function claseDeRevelacion(modo: string): string {
  return `tareas-revelar-${modo}`;
}

/** Todas las que este módulo puede poner, para poder sacarlas al salir. */
export const CLASES_DE_REVELACION: readonly string[] = ["hover", "siempre", "swipe"].map(
  claseDeRevelacion,
);

/**
 * La clase del `.cm-editor` de una nota que **usa** el margen de botones.
 *
 * No va en `body` como las de arriba, y esa es toda la razón por la que existe:
 * un `gutter()` de CodeMirror es una extensión registrada en **todos** los
 * editores, no algo que se prenda por nota, así que su columna ocupa ancho
 * aunque no tenga un solo marcador. Con la clase en `body` no alcanza —una nota
 * de tareas y otra que no lo es pueden estar abiertas al mismo tiempo, una al
 * lado de la otra— y hace falta que la decida cada editor.
 *
 * Vive acá y no en `styles.css` ni en `main.ts` porque la escriben los dos: el
 * atributo del editor y la hoja de estilos. Una clase repetida en dos archivos
 * diverge, y esta decide el ancho del margen de **todas** las notas del vault.
 */
export const CLASE_CON_MARGEN = "tareas-con-margen";

/**
 * La clase de `body` de cada estilo de fila.
 *
 * Mismo mecanismo que el modo de revelación y que el estilo de prioridad: el
 * widget dibuja siempre lo mismo y la hoja de estilos decide dónde queda.
 * Cambiar de estilo no reconstruye ninguna decoración.
 */
export function claseDeFila(estilo: string): string {
  return `tareas-fila-${estilo}`;
}

/** Todas las que este módulo puede poner, para poder sacarlas al salir. */
export const CLASES_DE_FILA: readonly string[] = [
  "derecha",
  "derecha-plana",
  "pastilla",
  "margen",
  "izquierda",
  "columna",
].map(claseDeFila);
