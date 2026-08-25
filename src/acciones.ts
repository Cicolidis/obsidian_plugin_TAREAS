/**
 * Los planes: qué líneas cambia cada acción del usuario, y en qué las cambia.
 *
 * Capa 1 entera. **Nada de acá escribe.** Devuelven `CambioDeLinea[]` y quien
 * escribe es `vault/escribir.ts`, que es el único lugar del plugin que toca el
 * disco. La separación no es estética; compra tres cosas:
 *
 * 1. La §8: quien escribe necesita **rangos**, no un archivo nuevo.
 * 2. **Confirmar antes.** El reinicio de un grupo son 23 líneas de un tirón en
 *    `tareas_MES`, medido, sobre un archivo en Sync, y `vault.process()` no
 *    pasa por el editor: Ctrl-Z no lo deshace. Para decir «vas a reiniciar 23
 *    tareas» hay que tener el plan antes de aplicarlo.
 * 3. Cada `CambioDeLinea` lleva `antes`, así que **nada se escribe sin decir
 *    qué esperaba encontrar**. Es el invariante 10, y lo verifica `ubicar.ts`.
 *
 * Un plan se arma sobre el documento que el store tiene en memoria; para cuando
 * se escribe, el archivo puede haberse corrido. Por eso el número de línea de un
 * plan es una **sugerencia** y el texto de `antes` es el dato duro.
 */
import { reemplazarLinea, type CambioDeLinea, type Documento } from "./documento.js";
import { esTarea, parseBullet, renderBullet } from "./linea.js";
import { esNotaDeTareas } from "./notas.js";
import { seEncontro, ubicarLinea } from "./ubicar.js";
import {
  claveDe,
  idsACompletar,
  porClave,
  subarbolDe,
  tareasDelGrupo,
  type Clave,
  type Task,
} from "./tareas.js";
import {
  nuevoId,
  parseTaskToken,
  setTaskToken,
  type Prioridad,
  type TaskMeta,
} from "./token.js";

/**
 * Un cambio sobre una línea, o nada si esa línea no hay que tocarla.
 *
 * Todo plan de acá pasa por esta función, y de acá salen dos garantías baratas:
 * una línea con el token ilegible vuelve intacta —`setTaskToken` ya lo hace, y
 * la comparación de abajo lo confirma— y **un cambio que no cambia nada no
 * entra al plan**. Lo segundo importa para poder contar: un plan que incluye
 * líneas idénticas miente en la confirmación sobre cuántas cosas va a tocar.
 */
function cambio(doc: Documento, linea: number, despues: string): CambioDeLinea | null {
  const antes = doc.lineas[linea]?.texto;
  if (antes === undefined || antes === despues) return null;
  return { linea, antes, despues };
}

/** El checkbox de una línea, cambiado de estado. La línea entera si no es bullet. */
function conCheckbox(texto: string, estado: " " | "x"): string {
  const b = parseBullet(texto);
  if (!b || b.checkbox === null) return texto;
  return renderBullet({ ...b, checkbox: b.checkbox.replace(/\[.\]/, `[${estado}]`) });
}

/**
 * La línea con el checkbox cambiado **y** el token parcheado.
 *
 * El primer intento hacía `setTaskToken(conCheckbox(...))` y tenía un agujero
 * que encontró un caso: sobre una línea con el token ilegible, `setTaskToken`
 * se niega y devuelve lo que recibió —pero lo que recibió **ya tenía el
 * checkbox tildado**—, así que la mitad del cambio pasaba igual. El invariante
 * 7 dice que un token que no parsea deja la línea **intacta**, no medio
 * escrita.
 *
 * Por eso la negativa está acá, antes de tocar nada, y no en `setTaskToken`:
 * es el único lugar por el que pasan los tres planes.
 */
function marcar(texto: string, estado: " " | "x", patch: Partial<TaskMeta>): string {
  if (parseTaskToken(texto).estado === "ilegible") return texto; // invariante 7
  return setTaskToken(conCheckbox(texto, estado), patch);
}

/**
 * Las líneas del subárbol que el plugin **no va a tocar** por tener el token
 * ilegible (§5.3).
 *
 * Existe para que el comando lo pueda decir. Saltear una línea rota es lo
 * correcto —nunca reparar a ciegas— pero saltearla **en silencio** deja al
 * usuario con una tarea madre en `[x]` y una hija en `[ ]` sin explicación, que
 * es peor que el token roto. Un aviso convierte un misterio en algo arreglable
 * a mano.
 */
export function ilegiblesDelSubarbol(
  doc: Documento,
  tareas: readonly Task[],
  clave: Clave,
): number[] {
  return subarbolDe(tareas, clave)
    .map((t) => t.linea)
    .filter((n) => {
      const texto = doc.lineas[n]?.texto;
      return texto !== undefined && parseTaskToken(texto).estado === "ilegible";
    });
}

// ------------------------------------------------------ completar (§12, §9)

/**
 * Qué líneas cambia completar una tarea: **«completar y descartar»** de la §12.
 *
 * Marca `[x]` y escribe `done`, y **no borra la línea de la nota**: la tarea
 * queda en su lugar y las vistas la ocultan. El descarte físico es otra acción,
 * explícita y con confirmación.
 *
 * Baja por el subárbol completo, que es la §9 —«marcar el padre completa todos
 * los hijos»—, usando `idsACompletar`, que ya tiene esa asimetría escrita: no
 * existe la operación inversa, porque completar todos los hijos **no** completa
 * al padre.
 *
 * Los bullets sin checkbox del subárbol no aparecen en el plan: `idsACompletar`
 * devuelve tareas, no líneas, así que el invariante 3 —reescribir una tarea
 * nunca modifica sus bullets sin checkbox— sale de la forma del recorrido y no
 * de una comprobación aparte.
 *
 * Una tarea del subárbol que ya estaba completada con **otra** fecha conserva la
 * suya: `done` solo se escribe donde no había ninguno. Pisarla convertiría
 * «terminé esto el martes» en «terminé todo hoy», que es perder un dato para no
 * ganar nada.
 *
 * `hoy` se pasa como `AAAA-MM-DD` en vez de leerse del reloj para que los tests
 * puedan pararse en cualquier día.
 */
export function planDeCompletar(
  doc: Documento,
  tareas: readonly Task[],
  clave: Clave,
  hoy: string,
): CambioDeLinea[] {
  const indice = porClave(tareas);
  const cambios: CambioDeLinea[] = [];
  for (const c of idsACompletar(tareas, clave)) {
    const t = indice.get(c);
    if (!t) continue;
    const texto = doc.lineas[t.linea]?.texto;
    if (texto === undefined) continue;
    const patch: Partial<TaskMeta> = t.done === null ? { done: hoy } : {};
    const x = cambio(doc, t.linea, marcar(texto, "x", patch));
    if (x) cambios.push(x);
  }
  return cambios;
}

/** ¿Hay algo que completar acá, o el subárbol ya está entero en `[x]`? */
export function yaEstaCompleta(tareas: readonly Task[], clave: Clave): boolean {
  const indice = porClave(tareas);
  return idsACompletar(tareas, clave).every((c) => indice.get(c)?.hecha ?? true);
}

// ----------------------------------------------------- workbench (§9, §5.4)

/**
 * Qué líneas cambia asignar —o sacar— un workbench.
 *
 * Tres reglas de la spec, en una función:
 *
 * - **Va el árbol completo, no una hoja suelta** (§9). Mandar una tarea madre a
 *   un workbench y que los hijos se queden en la nota deja el workbench
 *   mostrando un título sin lo que hay que hacer.
 * - **El toggle lo decide la raíz** y se aplica a todo el subárbol. La spec no
 *   dice qué hacer cuando la raíz está en el workbench y un hijo no —el ★ de la
 *   §13.0 es un toggle sobre *la* tarea—, y mirar cada línea por separado haría
 *   que un clic dejara el árbol mitad adentro y mitad afuera. Que mande la raíz
 *   es lo único predecible desde afuera: el indicador que se ve es el de ella.
 * - **El `id` se escribe solo al entrar** (§5.4). Ponerle id a las 406 tareas al
 *   arrancar tocaría los cinco archivos en cada dispositivo cada vez que se abre
 *   Obsidian: la receta de conflictos de Sync. Al salir **no se borra**: el id es
 *   identidad, no pertenencia, y una tarea que vuelve al workbench tiene que ser
 *   la misma tarea.
 *
 * `idsEnUso` viene de afuera —del store, que los conoce en **todas** las notas—
 * porque un id repetido no rompe nada visible: hace que dos tareas distintas
 * sean la misma para el workbench, que es peor que un error. `aleatorio` se
 * inyecta por lo mismo que en `nuevoId`: un generador que no se puede hacer
 * chocar es un generador cuyo camino de choque no se probó nunca.
 */
export function planDeWorkbench(
  doc: Documento,
  tareas: readonly Task[],
  clave: Clave,
  wb: string,
  idsEnUso: ReadonlySet<string>,
  aleatorio: () => number = Math.random,
): CambioDeLinea[] {
  const raiz = porClave(tareas).get(clave);
  if (!raiz) return [];
  const entra = !raiz.workbenches.includes(wb);

  // Los ids que se van repartiendo entran al conjunto sobre la marcha: si no,
  // dos tareas del mismo subárbol podrían recibir el mismo id en el mismo clic.
  const usados = new Set(idsEnUso);

  const cambios: CambioDeLinea[] = [];
  for (const t of subarbolDe(tareas, clave)) {
    const texto = doc.lineas[t.linea]?.texto;
    if (texto === undefined) continue;
    // Una línea ilegible no se reescribe (§5.3), y tampoco se le gasta un id.
    if (parseTaskToken(texto).estado === "ilegible") continue;

    const patch: Partial<TaskMeta> = {
      wb: entra
        ? t.workbenches.includes(wb)
          ? t.workbenches
          : [...t.workbenches, wb]
        : t.workbenches.filter((n) => n !== wb),
    };
    if (entra && t.id === null) {
      patch.id = nuevoId(usados, aleatorio);
      usados.add(patch.id);
    }

    const x = cambio(doc, t.linea, setTaskToken(texto, patch));
    if (x) cambios.push(x);
  }
  return cambios;
}

// ------------------------------------------------------- prioridad (§14)

/**
 * Qué líneas cambia subir o bajar la prioridad: **una sola**, la de la tarea.
 *
 * Es la diferencia con `planDeCompletar` y `planDeWorkbench`, que bajan por el
 * subárbol entero, y sale de la §14: «el color pinta la línea de la tarea, no
 * el subárbol. Los hijos llevan un filete de 2px del mismo color en el borde
 * izquierdo». El filete es **dibujo**, no dato: lo pone la decoración mirando
 * la herencia, y no hay que escribir un `p=` en cada hija.
 *
 * Escribirlo en el subárbol sería además irreversible de hecho: bajarle la
 * prioridad a la madre no podría distinguir una hija que la heredó de una que
 * el usuario subió a mano.
 *
 * La prioridad normal no escribe campo (§5.2), y de eso se encarga
 * `setTaskToken`: con `prioridad: 0` el `p=` desaparece del token, y si era lo
 * único que tenía, desaparece el token entero.
 */
export function planDePrioridad(
  doc: Documento,
  tareas: readonly Task[],
  clave: Clave,
  nivel: Prioridad,
): CambioDeLinea[] {
  const t = porClave(tareas).get(clave);
  if (!t) return [];
  const texto = doc.lineas[t.linea]?.texto;
  if (texto === undefined) return [];
  // Una línea ilegible no se reescribe (invariante 7).
  if (parseTaskToken(texto).estado === "ilegible") return [];
  const x = cambio(doc, t.linea, setTaskToken(texto, { prioridad: nivel }));
  return x ? [x] : [];
}

// ------------------------------------------- reinicio de un grupo (§11)

/**
 * Qué líneas cambia reiniciar un grupo.
 *
 * Destildar y borrar el `done`, nada más. No se crea ninguna instancia, no se
 * clona ningún hijo y no se corre ninguna fecha: el modelo regenerativo de la
 * §11 se reemplazó por este botón justamente para que el plugin no tenga que
 * actuar solo. El `due` de una cíclica es un día del mes y se resuelve con el
 * reloj (`resolverDue`), así que tampoco hay que tocarlo.
 *
 * **Solo toca las tareas etiquetadas.** Es la parte crítica: en `tareas_MES` el
 * usuario lleva a mano un hijo por mes con el monto de ese mes, y esos hijos no
 * llevan etiqueta. Un reinicio que barriera la nota entera los convertiría en
 * tareas pendientes y perdería el registro.
 *
 * Una tarea del grupo que ya está pendiente no aparece en el plan: reiniciarla
 * no cambiaría nada, y contarla haría que la confirmación mintiera sobre
 * cuántas cosas va a tocar.
 */
export function planDeReinicio(
  doc: Documento,
  tareas: readonly Task[],
  grupo: string,
): CambioDeLinea[] {
  const cambios: CambioDeLinea[] = [];
  for (const t of tareasDelGrupo(tareas, grupo)) {
    const antes = doc.lineas[t.linea]?.texto;
    if (antes === undefined) continue;
    const b = parseBullet(antes);
    if (!b || b.checkbox === null) continue;
    if (!t.hecha && t.done === null) continue; // ya está pendiente y limpia

    const x = cambio(doc, t.linea, marcar(antes, " ", { done: null }));
    if (x) cambios.push(x);
  }
  return cambios;
}

// ---------------------------------------------------- aplicar, en memoria

/**
 * El documento con un plan aplicado, línea por línea y sin tocar nada más.
 *
 * Es la versión **en memoria** —la que usan los tests y las propiedades—, no la
 * que escribe. Sobre el disco quien aplica es `ubicar.ts`, que además verifica
 * el `antes` de cada cambio contra lo que hay ahí en ese momento. Acá no hace
 * falta: el documento es el mismo con el que se armó el plan.
 */
export function aplicarPlan(doc: Documento, cambios: readonly CambioDeLinea[]): Documento {
  return cambios.reduce((d, c) => reemplazarLinea(d, c.linea, c.despues), doc);
}

/** La clave de la tarea que está en esta línea, o `null` si no hay ninguna. */
export function claveEnLinea(tareas: readonly Task[], archivo: string, linea: number): Clave | null {
  const c = claveDe(archivo, linea);
  return tareas.some((t) => claveDe(t.archivo, t.linea) === c) ? c : null;
}


// ------------------------------------------ elegir la tarea (antes del plan)

/**
 * Qué tarea eligió el usuario, o por qué no se puede saber.
 *
 * Los cuatro modos de fracaso están separados porque cada uno se arregla de una
 * manera distinta, y un solo mensaje para todos fue exactamente el bug que se
 * cuenta abajo: decía «el cursor no está sobre una tarea» cuando el cursor
 * estaba justo encima de una.
 */
export type Eleccion =
  | { estado: "ok"; clave: Clave }
  | { estado: "fuera-de-la-lista" }
  | { estado: "sin-indice" }
  | { estado: "sin-tarea" }
  | { estado: "ausente" }
  | { estado: "ambigua"; veces: number };

/**
 * La tarea que el cursor está eligiendo.
 *
 * ## El bug que esta función existe para no volver a cometer
 *
 * La primera versión hacía `claveDe(archivo, cursor.linea)` y buscaba esa clave
 * en el índice. Eso **mezcla una coordenada fresca con una foto vieja**: la línea
 * del cursor es de ahora y el índice puede ser de hace un rato. Con cinco líneas
 * tecleadas arriba, el cursor dice 205 y en la 205 del índice hay otra cosa.
 *
 * El síntoma visible era un cartel equivocado. El síntoma **invisible** era
 * mucho peor: si en la línea 205 del índice viejo había otra tarea, el comando
 * la elegía a ella, armaba el plan sobre ella, y `ubicar.ts` escribía esa línea
 * impecablemente. El invariante 10 se cumplía y el resultado estaba mal igual.
 *
 * Es el mismo error que el paso 3 vino a matar, un escalón más arriba: la
 * defensa estaba en la escritura y el agujero, en la elección.
 *
 * ## La regla, que es la misma de `ubicar.ts`
 *
 * **Una línea se identifica por su texto, no por su número.** El cursor da las
 * dos cosas; la que vale es el texto. Se traduce la coordenada del editor a la
 * del índice con `ubicarLinea`, que ya sabe negarse cuando no puede saber.
 *
 * Y si la línea del cursor no es una tarea, eso se contesta **con el texto del
 * editor** y sin consultar el índice: es la respuesta más fresca disponible y no
 * puede equivocarse de línea.
 */
export function elegirTarea(
  archivo: string | null,
  notas: readonly string[],
  doc: Documento | null,
  tareas: readonly Task[],
  cursor: { linea: number; texto: string },
): Eleccion {
  if (!esNotaDeTareas(archivo, notas)) return { estado: "fuera-de-la-lista" };
  if (doc === null) return { estado: "sin-indice" };

  // Con el texto vivo, no con el índice: un `- [ ]` vacío o un bullet sin
  // checkbox se descartan acá y no hace falta traducir nada (invariante 8).
  const b = parseBullet(cursor.texto);
  if (!b || !esTarea(b)) return { estado: "sin-tarea" };

  const u = ubicarLinea(
    doc.lineas.map((l) => l.texto),
    cursor.linea,
    cursor.texto,
  );
  if (u.estado === "ausente") return { estado: "ausente" };
  if (u.estado === "ambigua") return { estado: "ambigua", veces: u.lineas.length };

  const clave = claveDe(archivo!, u.linea);
  return porClave(tareas).has(clave) ? { estado: "ok", clave } : { estado: "sin-tarea" };
}
