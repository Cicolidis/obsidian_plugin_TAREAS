/**
 * Los planes: qué líneas cambia cada acción del usuario, y en qué las cambia.
 *
 * Capa 1 entera. **Nada de acá escribe.** Devuelven `CambioDeLote[]` y quien
 * escribe es `vault/escribir.ts`, que es el único lugar del plugin que toca el
 * disco. La separación no es estética; compra tres cosas:
 *
 * 1. La §8: quien escribe necesita **rangos**, no un archivo nuevo.
 * 2. **Confirmar antes.** El reinicio de un grupo son 23 líneas de un tirón en
 *    `tareas_MES`, medido, sobre un archivo en Sync, y `vault.process()` no
 *    pasa por el editor: con la nota cerrada no hay nada que lo deshaga, y con
 *    la nota abierta sí (§5.5 punto 15). Para decir «vas a reiniciar 23
 *    tareas» hay que tener el plan antes de aplicarlo.
 * 3. Cada cambio lleva `antes`, así que **nada se escribe sin decir
 *    qué esperaba encontrar**. Es el invariante 10, y lo verifica `ubicar.ts`.
 *
 * Un plan se arma sobre el documento que el store tiene en memoria; para cuando
 * se escribe, el archivo puede haberse corrido. Por eso el número de línea de un
 * plan es una **sugerencia** y el texto de `antes` es el dato duro.
 */
import {
  arbolDe,
  lineasDelSubarbol,
  nodoEnLinea,
  parseDocumento,
  rangoDelSubarbol,
  renderDocumento,
  type CambioDeLinea,
  type CambioDeLote,
  type Documento,
} from "./documento.js";
import { esTarea, parseBullet, renderBullet } from "./linea.js";
import { esNotaDeTareas } from "./notas.js";
import { aplicarLote, seEncontro, ubicarLinea } from "./ubicar.js";
import {
  claveDe,
  idsACompletar,
  idsADestildar,
  porClave,
  subarbolDe,
  tareasDelGrupo,
  type Clave,
  type Task,
} from "./tareas.js";
import {
  formaDeDue,
  nuevoId,
  parseTaskToken,
  setTaskToken,
  type Prioridad,
  type TaskMeta,
} from "./token.js";
import { diaDelMesDe } from "./fechas.js";

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
  return { tipo: "reemplazo", linea, antes, despues };
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

/**
 * Qué líneas cambia **destildar** una tarea: una sola, y le borra el `done`.
 *
 * Es la inversa de `planDeCompletar` y no es simétrica a propósito, en las dos
 * cosas que la distinguen:
 *
 * - **No baja por el subárbol.** Es `idsADestildar`, que la spec ya decidía
 *   así: destildar en cascada borraría trabajo terminado de un clic, y volver a
 *   tildar la madre los completa de nuevo igual.
 * - **Borra el `done`.** Una fecha de completado sobre una tarea pendiente es
 *   un dato que miente, y el historial y la vista de archivadas la leen. Es lo
 *   mismo que `planDeReinicio` hace con un grupo cíclico entero; acá es con
 *   una sola tarea.
 *
 * Una tarea que ya está pendiente y sin `done` no produce ningún cambio, así
 * que llamar a esto de más no escribe nada.
 */
export function planDeDestildar(
  doc: Documento,
  tareas: readonly Task[],
  clave: Clave,
): CambioDeLinea[] {
  const indice = porClave(tareas);
  const cambios: CambioDeLinea[] = [];
  for (const c of idsADestildar(tareas, clave)) {
    const t = indice.get(c);
    if (!t) continue;
    const texto = doc.lineas[t.linea]?.texto;
    if (texto === undefined) continue;
    const x = cambio(doc, t.linea, marcar(texto, " ", { done: null }));
    if (x) cambios.push(x);
  }
  return cambios;
}

// ------------------------------------ archivar y eliminar (§12, paso 6a)

/**
 * Lo que la **nota** recibe al archivar: el bloque entero, como una unidad.
 *
 * Archivar toca dos archivos —la nota y el LOG— y del LOG se encarga
 * `archivado.ts`. Acá va la mitad de la nota, y es un solo `bloque` y no N
 * reemplazos por una razón concreta:
 *
 * > **Lo que se copia al LOG tiene que ser lo que estaba en la nota.** El
 * > bloque incluye las notas sin checkbox del subárbol (§4.3), que ningún
 * > cambio de línea toca y que por lo tanto nadie verificaría. Al viajar
 * > adentro del `antes` del bloque, si alguna cambió desde que se armó el plan,
 * > el lote entero se niega en vez de archivar texto viejo.
 *
 * El `despues` son las mismas líneas con los cambios de `planDeCompletar`
 * aplicados: la §12 dice que archivar **también** completa, y que **no borra la
 * línea de la nota**. La tarea queda `[x]` en su lugar y las vistas la ocultan.
 *
 * Una tarea que ya estaba completa da un bloque con las dos caras iguales: no
 * se escribe nada en la nota —un `process` que devuelve lo mismo no dispara
 * ningún evento— y el LOG recibe la entrada igual, que es lo correcto.
 */
export function planDeArchivarEnLaNota(
  doc: Documento,
  tareas: readonly Task[],
  clave: Clave,
  hoy: string,
): CambioDeLote[] {
  const t = porClave(tareas).get(clave);
  if (!t) return [];
  const nodo = nodoEnLinea(arbolDe(doc), t.linea);
  if (!nodo) return [];

  const { desde } = rangoDelSubarbol(nodo);
  const antes = lineasDelSubarbol(doc, nodo);
  const despues = antes.slice();
  for (const c of planDeCompletar(doc, tareas, clave, hoy)) {
    const i = c.linea - desde;
    // No puede pasar: el subárbol de tareas (`padre`/`hijos`) está contenido en
    // el subárbol del documento. Si alguna vez dejara de estarlo, archivar
    // escribiría el bloque **sin** completar esa línea, y eso no se ve.
    if (i < 0 || i >= despues.length) {
      throw new RangeError(`el plan de completar salió del subárbol: línea ${c.linea}`);
    }
    despues[i] = c.despues;
  }
  return [{ tipo: "bloque", linea: desde, antes, despues }];
}

/**
 * El descarte físico de la §12: **borra** la línea y su subárbol de la nota.
 *
 * Es la única acción del plugin que pierde texto, y por eso es la única con
 * confirmación propia y más dura. No escribe nada en el LOG —para eso está
 * archivar— y no se deshace desde la interfaz.
 *
 * El rango sale del **nodo del documento**, no del árbol de tareas: lo que se
 * borra incluye las notas sin checkbox y los blancos de adentro, que son parte
 * del bloque. Los blancos de **después** del último descendiente no entran:
 * pertenecen a lo que sigue, no al subárbol (`rangoDelSubarbol`).
 *
 * El `antes` es el subárbol verbatim, así que un bloque que ya no está donde
 * estaba se busca entero, y si aparece repetido no se borra nada. Medido sobre
 * el corpus: 38 de 389 subárboles (9,8%) aparecen repetidos verbatim en su
 * nota, y esos son exactamente los casos en que esta acción se va a negar con
 * el índice atrasado. Negarse es la respuesta correcta: borrar el subárbol
 * equivocado no tiene vuelta.
 */
export function planDeEliminar(
  doc: Documento,
  tareas: readonly Task[],
  clave: Clave,
): CambioDeLote[] {
  const t = porClave(tareas).get(clave);
  if (!t) return [];
  const nodo = nodoEnLinea(arbolDe(doc), t.linea);
  if (!nodo) return [];
  const { desde } = rangoDelSubarbol(nodo);
  return [{ tipo: "bloque", linea: desde, antes: lineasDelSubarbol(doc, nodo), despues: [] }];
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

// ------------------------------------------ fecha y recurrencia (§5.2, §11)

/**
 * El `due` que hay que escribir **en esta línea**, con la forma que le toca.
 *
 * `due` guarda dos cosas distintas y cuál depende de `rec` (§11): en una tarea
 * normal es `AAAA-MM-DD` y en una cíclica es el **día del mes**, que es lo que
 * `resolverDue` resuelve contra el reloj sin que nadie reescriba nada cuando
 * cambia el mes.
 *
 * La forma se decide mirando **el texto de la línea**, no el store: entre que
 * el menú se dibujó y que se hizo clic pudo entrar una tecla, y es la misma
 * razón por la que `menuDeTarea.ts` pregunta por el texto de ahora. Si el store
 * estuviera atrasado y la tarea ya fuera cíclica, escribir la fecha absoluta
 * que el menú ofreció dejaría un vencimiento que no avanza nunca.
 *
 * Es pura y exportada porque **la usan dos**: el plan, para escribir, y el
 * comando, para decir en el aviso cuál de las dos formas escribió. Dos copias
 * de esa decisión harían que el cartel mintiera el día que una cambie.
 */
export function dueParaLaLinea(texto: string, due: string | null): string | null {
  const a = parseTaskToken(texto);
  if (a.estado === "ilegible" || a.meta.rec === null) return due;
  return formaDeDue(due) === "fecha" ? diaDelMesDe(due!) : due;
}

/**
 * El `due` que le queda a una tarea que **pasa a ser cíclica**, o `null` si no
 * hay nada que convertir.
 *
 * Decisión de la sesión 7, tomada porque la spec no la cubría: ponerle `rec` a
 * una tarea que ya tiene un `due` absoluto **convierte** la fecha en el día del
 * mes, en el mismo cambio de línea, y el aviso lo dice. Se pierden el año y el
 * mes, que es exactamente lo que la §11 dice que no hay que guardar en una
 * cíclica —guardar `2026-09-10` obligaría a que algo le corriera el mes en
 * octubre, que es la escritura automática por la puerta de atrás—.
 *
 * Al revés no se convierte nada: sacarle el `rec` a una tarea con `due=10` deja
 * el `10`, que sigue resolviendo contra el reloj. La conversión inversa
 * tendría que inventar un mes.
 *
 * Exportada por lo mismo que `dueParaLaLinea`: la usan el plan y el aviso.
 */
export function conversionDeDue(due: string | null): string | null {
  return formaDeDue(due) === "fecha" ? diaDelMesDe(due!) : null;
}

/**
 * Qué líneas cambia fijar —o sacar— la fecha de vencimiento: **una sola**.
 *
 * Es la misma forma que `planDePrioridad` y por la misma clase de razón: un
 * plazo es de una tarea, no de su árbol. Las hijas de una tarea con fecha
 * tienen sus propios plazos, y escribirles el de la madre haría imposible
 * distinguir una fecha heredada de una que el usuario puso.
 *
 * **«Sin fecha» no escribe campo**, y de eso se encarga `setTaskToken`: con
 * `due: null` el campo desaparece del token, y si era lo único que tenía,
 * desaparece el token entero. Es lo mismo que ya hacía `prioridad: 0`.
 */
export function planDeFecha(
  doc: Documento,
  tareas: readonly Task[],
  clave: Clave,
  due: string | null,
): CambioDeLinea[] {
  const t = porClave(tareas).get(clave);
  if (!t) return [];
  const texto = doc.lineas[t.linea]?.texto;
  if (texto === undefined) return [];
  if (parseTaskToken(texto).estado === "ilegible") return []; // invariante 7
  const x = cambio(doc, t.linea, setTaskToken(texto, { due: dueParaLaLinea(texto, due) }));
  return x ? [x] : [];
}

/**
 * Qué líneas cambia etiquetar —o desetiquetar— una tarea cíclica: **una sola**.
 *
 * Que sea una sola línea y no el subárbol **no es una analogía con la
 * prioridad: es la condición de seguridad del reinicio.** La §11 dice que el
 * botón «solo toca las tareas etiquetadas», y la razón está medida: en
 * `tareas_MES` el registro por mes son hijos **sin** etiqueta, con el monto de
 * cada mes. Si `rec` bajara por el subárbol, esos hijos quedarían etiquetados y
 * el primer reinicio los convertiría en tareas pendientes, perdiendo el dato —
 * que es exactamente el desastre que la §11 nombra y que `planDeReinicio` está
 * escrito para evitar. Etiquetar en cascada lo habilitaría desde el otro lado.
 *
 * La consecuencia que esto deja, dicha en vez de tapada: una cíclica **con
 * hijos** se reinicia con la madre destildada y los hijos todavía en `[x]`,
 * porque tildar sí baja por el subárbol (§9). Es lo correcto para `tareas_MES`
 * y puede no serlo para una semanal con subtareas; se decide con uso, no de
 * antemano.
 *
 * Y convierte el `due` si hacía falta (ver `conversionDeDue`), en el **mismo**
 * cambio: dos escrituras sobre la misma línea serían dos entradas en el
 * historial del editor y una ventana en la que el token dice una cosa que ya no
 * es verdad.
 */
export function planDeRecurrencia(
  doc: Documento,
  tareas: readonly Task[],
  clave: Clave,
  rec: string | null,
): CambioDeLinea[] {
  const t = porClave(tareas).get(clave);
  if (!t) return [];
  const texto = doc.lineas[t.linea]?.texto;
  if (texto === undefined) return [];
  const a = parseTaskToken(texto);
  if (a.estado === "ilegible") return []; // invariante 7

  const patch: Partial<TaskMeta> = { rec };
  // Se lee de la línea y no del índice: es la fuente más fresca, y la que
  // decide qué se convierte tiene que ser la misma que se va a reescribir.
  if (rec !== null) {
    const convertido = conversionDeDue(a.meta.due);
    if (convertido !== null) patch.due = convertido;
  }

  const x = cambio(doc, t.linea, setTaskToken(texto, patch));
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

/** Lo que una nota recibe de una acción que toca varias. */
export interface LoteDeNota {
  archivo: string;
  cambios: CambioDeLinea[];
}

/**
 * El reinicio de un grupo, repartido por nota.
 *
 * Un grupo de reinicio es **global** —la §11 pide «un botón por grupo» sobre el
 * store entero, y `rec=lunes` puede estar escrito en cinco notas— pero
 * `planDeReinicio` recibe **un** documento, porque escribir se escribe por
 * archivo. Esto es el doblez, y es puro a propósito: la cuenta que la
 * confirmación tiene que decir —«N tareas en M notas»— se prueba offline en vez
 * de vivir adentro de un modal.
 *
 * **Las notas sin nada que cambiar no aparecen.** Contarlas haría que la
 * confirmación mintiera sobre en cuántas notas va a escribir, que es lo mismo
 * que `planDeReinicio` ya evita con las tareas que ya están pendientes. Y de
 * paso ninguna se abre para nada: un `process` sobre un archivo que no cambia
 * es una lectura de disco sin motivo.
 *
 * El orden es el de la lista que entra. Quién lo vuelve determinista es
 * `escribirEnVarias`, que ordena por ruta antes de escribir.
 */
export function planDeReinicioEnVarias(
  notas: readonly { archivo: string; doc: Documento; tareas: readonly Task[] }[],
  grupo: string,
): LoteDeNota[] {
  const salida: LoteDeNota[] = [];
  for (const { archivo, doc, tareas } of notas) {
    const cambios = planDeReinicio(doc, tareas, grupo);
    if (cambios.length) salida.push({ archivo, cambios });
  }
  return salida;
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
export function aplicarPlan(doc: Documento, cambios: readonly CambioDeLote[]): Documento {
  const { texto, resultado } = aplicarLote(renderDocumento(doc), cambios);
  // Sobre el mismo documento con el que se armó el plan esto no puede fallar.
  // Si falla, es un bug del plan y tiene que hacer ruido: devolver el documento
  // intacto lo convertiría en «la acción no hizo nada», que es el modo de falla
  // más caro de este plugin porque no se ve.
  if (resultado.estado !== "ok") {
    throw new Error(`un plan no se ubicó sobre su propio documento: ${resultado.estado}`);
  }
  return parseDocumento(texto);
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
