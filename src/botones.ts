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
import { formaDeDue, parseTaskToken, resolverDue } from "./token.js";

/**
 * Qué hace cada botón. El orden de la §13.0: `[★] [◐] [→] [⋯]`, más el 🗑.
 *
 * `eliminar` es opcional y va **último**, después del ⋯: es el único
 * destructivo, y lo pidió el uso —«Obsidian no es un verdadero outliner»,
 * borrar una tarea anidada a mano es incómodo—. Va al final para que quede lo
 * más lejos posible del ★, que es el que más se aprieta.
 */
export type Accion =
  | "wb-primario"
  | "wb-secundario"
  | "popover"
  | "menu"
  | "eliminar"
  | "fecha"
  | "recurrencia";

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
  // Ídem: los dos indicadores abren exactamente los submenús del ⋯, así que
  // llevan su mismo glifo. Un ícono distinto para la misma acción es una cosa
  // más que aprender a cambio de nada.
  fecha: "calendar",
  recurrencia: "repeat",
};

/**
 * Lo que la fila necesita saber del mundo para armarse.
 *
 * Es un objeto y no cinco posicionales porque el paso 6c le suma dos cosas más;
 * con `filaDe(texto, favoritos, true, true, false, hoy)` el orden de los
 * booleanos es un bug esperando.
 */
export interface ContextoDeFila {
  favoritos: Favoritos;
  /** ¿Va el quinto botón, el 🗑? */
  conEliminar?: boolean;
  /**
   * Los dos indicadores del paso 6c, cada uno con su interruptor.
   *
   * Separados y no uno solo por lo mismo que los dos indicadores de forma de la
   * prioridad (§14): cada uno suma un lugar al ancho del margen, y tenerlos en
   * dos interruptores deja ver cuál de los dos, si alguno, molesta.
   */
  indicadores?: { fecha?: boolean; recurrencia?: boolean };
  /**
   * Hoy, en `AAAA-MM-DD`, para poder decir en la etiqueta **qué día** vence una
   * cíclica. Se recibe en vez de leerse del reloj porque esto es capa 1.
   */
  hoy?: string;
}

/**
 * La fila de esta línea, o `null` si la línea no es una tarea.
 *
 * Un bullet sin checkbox y un `- [ ]` vacío no llevan fila: no son tareas
 * (invariante 8) y ninguna acción del plugin los toca. Es el mismo criterio con
 * el que `decorar.ts` decide dónde esconder el token — se gestiona lo que se
 * gestiona, y nada más.
 *
 * ## Los dos indicadores del paso 6c
 *
 * Salieron de usar el plugin: «un botón en la fila que quede encendido cuando la
 * tarea tiene `due`, y otro para `rec`». Tres decisiones sobre ellos, y las tres
 * se apoyan en algo que ya estaba decidido:
 *
 * 1. **Son un atajo, no un toggle.** Un clic abre el submenú de fecha o el de
 *    recurrencia; **nunca escribe por su cuenta**. El ★ es toggle porque asignar
 *    un workbench es un clic y su inversa es el mismo clic; «tiene fecha» no
 *    tiene inversa —¿qué fecha escribiría?— y un toggle cuyo apagado borra el
 *    vencimiento es una pérdida de datos por un clic errado.
 * 2. **La etiqueta dice el valor resuelto.** Es lo que más valen: hoy no hay
 *    ninguna forma de ver que una tarea tiene fecha sin abrir el ⋯, porque el
 *    token está oculto (§5.1). Y en una cíclica dice las dos cosas —el día
 *    guardado y contra qué fecha lo resuelve el reloj—, que es la misma razón
 *    por la que los atajos del menú llevan la fecha resuelta en el título.
 * 3. **Ocupan su lugar aunque estén apagados**, y la hoja de estilos los
 *    esconde con `opacity`, nunca con `display`. Dos razones medidas: la §13.0
 *    ya lo decidió para los cuatro botones —lo que sale del flujo mueve al ★
 *    justo cuando el mouse va hacia él— y un `gutter()` se dimensiona por su
 *    elemento **renderizado** más ancho, así que una fila que creciera solo en
 *    las tareas con fecha ensancharía el margen al scrollear hasta una y el
 *    texto saltaría. Es exactamente por lo que en el 6b se descartó
 *    `:has(.cm-gutterElement)`.
 *
 * Van **últimos** en el orden canónico y por lo tanto **primeros en el margen**,
 * que `ordenDelMargen` invierte: así el ★ no se corre ni un lugar de donde está,
 * y lo que queda más cerca del texto sigue siendo el botón que más se aprieta.
 */
export function filaDe(texto: string, ctx: ContextoDeFila): Fila | null {
  const b = parseBullet(texto);
  if (!b || !esTarea(b)) return null;

  const a = parseTaskToken(texto);
  const ilegible = a.estado === "ilegible";
  // De una línea ilegible no se leyó nada, así que no se sabe en qué workbench
  // está: los botones van apagados, no «afuera».
  const wb = ilegible ? [] : a.meta.wb;
  const due = ilegible ? null : a.meta.due;
  const rec = ilegible ? null : a.meta.rec;

  // Con el token roto los botones son inertes —`planDeWorkbench`,
  // `planDePrioridad` y `planDeCompletar` se niegan igual (§5.3)— así que
  // ninguno puede prometer lo que va a hacer. Salió de **mirar la salida**: los
  // tests pasaban y el tooltip decía «Mandar a foco» sobre una tarea donde
  // clickear no hace nada. Un control que miente es peor que uno apagado.
  const etiqueta = (propia: string) => (ilegible ? STRINGS.fila.ilegible : propia);

  const botones: Boton[] = [];
  for (const [accion, nombre] of [
    ["wb-primario", ctx.favoritos.primario],
    ["wb-secundario", ctx.favoritos.secundario],
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

  if (ctx.conEliminar) {
    botones.push({
      accion: "eliminar",
      icono: ICONOS.eliminar,
      etiqueta: etiqueta(STRINGS.fila.eliminar),
      workbench: null,
      activo: false,
    });
  }

  if (ctx.indicadores?.fecha) {
    botones.push({
      accion: "fecha",
      icono: ICONOS.fecha,
      etiqueta: etiqueta(etiquetaDeFecha(due, ctx.hoy)),
      workbench: null,
      activo: due !== null,
    });
  }
  if (ctx.indicadores?.recurrencia) {
    botones.push({
      accion: "recurrencia",
      icono: ICONOS.recurrencia,
      etiqueta: etiqueta(rec === null ? STRINGS.fila.sinRecurrencia : STRINGS.fila.grupo(rec)),
      workbench: null,
      activo: rec !== null,
    });
  }

  return { botones, ilegible };
}

/**
 * Qué dice el indicador de fecha.
 *
 * Las dos formas de `due` (§11) se nombran distinto **a propósito**: en una
 * tarea normal alcanza con la fecha, y en una cíclica hay que decir las dos
 * cosas —el día del mes que está guardado y contra qué fecha lo resuelve el
 * reloj— porque son datos distintos y el guardado no se ve en ningún lado.
 *
 * Sin `hoy` no se puede resolver nada, así que ahí se muestra solo lo guardado.
 * No es un caso que ocurra en la aplicación: es lo que hace que este módulo se
 * pueda seguir llamando desde un test sin inventar un día.
 */
function etiquetaDeFecha(due: string | null, hoy: string | undefined): string {
  if (due === null) return STRINGS.fila.sinFecha;
  if (formaDeDue(due) !== "dia") return STRINGS.fila.vence(due);
  const resuelto = hoy === undefined ? null : resolverDue(due, hoy);
  return resuelto === null
    ? STRINGS.fila.venceElDia(due)
    : STRINGS.fila.venceElDiaResuelto(due, resuelto);
}

/**
 * Todo lo que esta fila **dibuja**, en una cadena. Es lo que decide si dos filas
 * son la misma.
 *
 * Vive acá y no en la vista porque la usan **tres** lugares —el widget, el
 * marcador del margen y la caché de marcadores— y hasta el paso 6c estaba
 * escrita tres veces. Una clave repetida en tres archivos diverge, y esta decide
 * si dos tareas comparten el mismo DOM.
 *
 * Lleva la **etiqueta** y no los campos sueltos, y eso deja de ser un detalle
 * con los indicadores del 6c: la etiqueta es el único texto que varía por tarea
 * —lleva la fecha, el nombre del grupo, el del workbench—, así que incluirla es
 * lo único que garantiza que la clave signifique lo que su nombre dice. Con la
 * versión anterior, dos tareas con fechas distintas compartían marcador y una
 * mostraba la fecha de la otra.
 *
 * Lo que **no** entra sigue siendo tan importante como lo que sí: **el número de
 * línea no está**. Incluirlo reharía el DOM de todas las filas de abajo en cada
 * tecla. Por eso la posición no se guarda: se le pide a CodeMirror al hacer clic.
 */
export function claveDeFila(fila: Fila): string {
  return (
    fila.botones.map((b) => `${b.accion}:${b.activo ? "1" : "0"}:${b.etiqueta}`).join("|") +
    (fila.ilegible ? "|roto" : "")
  );
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

/**
 * Los grupos que ofrece el submenú de recurrencia, en orden y sin repetir.
 *
 * Hermana de `workbenchesDelPopover`, y con la misma razón para ser pura: la
 * numeración 1-9 de la §13.0 tiene que ser comprobable sin abrir un menú.
 *
 * El orden es la respuesta entera al pedido «que recuerde y ofrezca las más
 * usadas»:
 *
 * 1. **Los que están en uso, del más usado al menos.** El número sale de contar
 *    las notas (`gruposPorUso`), no de un contador guardado: la §10 dice que
 *    esto no tiene almacenamiento propio, y derivado no se puede desincronizar.
 * 2. **Los sugeridos**, detrás y sin repetir los de arriba. Existen porque hoy
 *    hay **0 grupos escritos** en las siete notas reales —medido—, o sea que sin
 *    semilla el menú de una nota real no ofrece nada para clickear.
 *
 * Los sugeridos van **después** y no antes: un nombre que el usuario ya usa vale
 * más que uno que el plugin propone, y con el orden al revés la tecla `1`
 * escribiría un grupo que no existe en el vault.
 */
export function opcionesDeRecurrencia(
  enUso: readonly { grupo: string; tareas: number }[],
  sugeridos: readonly string[],
): string[] {
  const salida: string[] = [];
  const vistos = new Set<string>();
  for (const n of [...enUso.map((g) => g.grupo), ...sugeridos]) {
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
