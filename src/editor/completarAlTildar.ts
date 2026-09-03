/**
 * Tildar el checkbox **es** completar la tarea, y destildarlo es descompletarla (§12).
 *
 * Pedido al verificar el paso 6a. Hoy tildar a mano deja la tarea `[x]` y nada
 * más: sin `done=`, y sin bajar por el subárbol. O sea que el gesto más natural
 * y más frecuente es el único que **no** pasa por el plugin, y la fecha de
 * completado —que es lo que el historial y la vista de archivadas necesitan—
 * solo existe si uno se acordó de usar el ⋯.
 *
 * ## Reconoce el hecho, no el gesto
 *
 * Es la regla que la §5.5 punto 5 dejó escrita con sangre: **las reglas que
 * preguntan de qué forma vino un cambio fallan.** Acá eso significa que no se
 * intercepta ningún clic ni ninguna tecla. Se calcula en qué quedó el
 * documento y se pregunta una sola cosa:
 *
 * > ¿Hay alguna línea cuya **única** diferencia con la de antes sea el tilde?
 *
 * Si la hay, esa tarea se acaba de completar, venga de donde venga: del clic en
 * el checkbox de Live Preview, de escribir la `x` a mano, de un comando de
 * Obsidian, de Outliner, o del teléfono. Y si la línea cambió en algo más que
 * el tilde, no se toca: es alguien editando, no completando.
 *
 * ## Qué escribe, en las dos direcciones
 *
 * **Al tildar**, exactamente lo mismo que «completar y descartar» del ⋯:
 * `planDeCompletar`, que escribe `done=` donde no había y **baja por el
 * subárbol** (§9, «marcar el padre completa todos los hijos»). Un solo camino
 * para las dos puertas; dos implementaciones divergirían justo en cuánto
 * escriben.
 *
 * **Al destildar**, `planDeDestildar`: le borra el `done` y **no baja por el
 * subárbol**. La asimetría no es un olvido, está decidida en `idsADestildar`:
 * destildar en cascada borraría trabajo terminado de un clic, y volver a tildar
 * la madre los completa de nuevo igual. Una fecha de completado sobre una tarea
 * pendiente es un dato que miente, y es el que el historial lee.
 *
 * Lo que **no** hace es archivar. Archivar toca dos archivos y un
 * `transactionFilter` no puede hacer eso: sigue en el ⋯ y en el Cmd+clic.
 *
 * ## Tres guardias, y cada uno tiene su razón
 *
 * - **`userEvent: "set"`**: un cambio externo, que incluye lo que el propio
 *   plugin acaba de escribir (§5.5 punto 5). Nuestras escrituras ya traen el
 *   `done=`, así que el efecto sería nulo, pero el guardia va igual: es más
 *   barato que razonar sobre si alguna vez deja de serlo.
 * - **`undo` y `redo`**: deshacer un completado volvería a completarlo. El
 *   usuario pidió lo contrario de lo que este filtro haría.
 * - **`activo`**: fuera de las notas de la lista el plugin no toca una tecla.
 *
 * ## Y corre último
 *
 * Con `Prec.high`. Los `transactionFilter` se encadenan de **menor a mayor**
 * precedencia (§5.5 punto 2), así que este ve el texto ya corregido por
 * `unirLimpio`, `protegerTramo` y `autoCheckbox`. Tiene que ser así: si viera
 * una línea a la que `protegerTramo` todavía no le devolvió el token,
 * `planDeCompletar` escribiría sobre un token movido. Hay un test que fija el
 * orden.
 */
import {
  ChangeSet,
  EditorSelection,
  EditorState,
  Transaction,
  type ChangeSpec,
  type Extension,
  type TransactionSpec,
} from "@codemirror/state";
import { planDeCompletar, planDeDestildar } from "../acciones.js";
import { documentoDeLineas } from "../documento.js";
import { estadoDe, parseBullet, renderBullet, type Bullet } from "../linea.js";
import { claveDe, indexar } from "../tareas.js";

export function completarAlTildar(
  activo: (state: EditorState) => boolean,
  hoy: () => string,
): Extension {
  return EditorState.transactionFilter.of((tr): TransactionSpec | readonly TransactionSpec[] => {
    if (!tr.docChanged) return tr;
    if (tr.isUserEvent("set") || tr.isUserEvent("undo") || tr.isUserEvent("redo")) return tr;
    if (!activo(tr.startState)) return tr;

    const movidas = cambiosDeTilde(tr);
    if (movidas.length === 0) return tr;

    const cambios = replanificar(tr, movidas, hoy());
    if (cambios.length === 0) return tr;

    // `sequential: true` no es opcional: estos cambios están en coordenadas del
    // documento **ya modificado**, y sin esto `resolveTransaction` los
    // resolvería contra el original. Es la misma trampa que documenta
    // `cursorExterno.ts`, leída en `@codemirror/state` 6.5.0.
    const selection = sostenerElCursor(tr, cambios);
    return [tr, { changes: cambios, sequential: true, userEvent: "input", ...(selection ? { selection } : {}) }];
  });
}

/**
 * Dónde queda el cursor después de que el filtro reescribe la línea.
 *
 * ## Por qué hace falta
 *
 * `replanificar` reemplaza la línea **entera** —`{from: linea.from, to:
 * linea.to}`— y `ChangeSet.mapPos` de una posición adentro de un rango
 * reemplazado devuelve el **comienzo del rango**. Sin selección explícita, el
 * mapeo mandaba el cursor a la columna 0 en cada tildado.
 *
 * Es exactamente el mecanismo que `cursor.ts` documenta para los cambios
 * externos, por otra puerta: allá lo trae `vault.process()` y acá lo produce
 * este filtro. Reportado usando el plugin en la verificación del 6b —«tildar el
 * checkbox de una tarea hija lleva el cursor al margen izquierdo»— y en una
 * tarea de primer nivel pasaba igual: la columna 0 cae donde empieza el
 * `- [ ] ` y casi no se nota. El mismo bug, menos visible.
 *
 * ## En qué coordenadas
 *
 * La selección de un spec `sequential` se interpreta **después** de los cambios
 * de ese spec. Verificado en `mergeTransaction` de `@codemirror/state` 6.5.0, no
 * deducido: con `sequential` es `mapForB = ChangeSet.empty(b.changes.length)`,
 * o sea la identidad sobre el documento ya reescrito.
 *
 * ## Y por qué la columna, no la posición
 *
 * Lo que este filtro escribe es el token del final y, a lo sumo, el carácter
 * del tilde —que mide lo mismo—. O sea que el **texto visible no se mueve** y la
 * columna sigue valiendo. Se recorta al largo nuevo por si el cursor estaba
 * apoyado en el borde del tramo oculto.
 *
 * Devuelve `null` —«que decida CodeMirror»— si la cuenta de líneas cambiara.
 * Hoy no puede: son puros reemplazos de línea. Si algún día un plan insertara,
 * esta cuenta dejaría de valer **en silencio**, y ese es justo el modo de falla
 * que no se ve.
 */
function sostenerElCursor(tr: Transaction, cambios: readonly ChangeSpec[]) {
  const doc = ChangeSet.of(cambios, tr.newDoc.length).apply(tr.newDoc);
  if (doc.lines !== tr.newDoc.lines) return null;

  const mover = (pos: number): number => {
    const vieja = tr.newDoc.lineAt(pos);
    const nueva = doc.line(vieja.number);
    return nueva.from + Math.min(pos - vieja.from, nueva.length);
  };

  return EditorSelection.create(
    tr.newSelection.ranges.map((r) => EditorSelection.range(mover(r.anchor), mover(r.head))),
    tr.newSelection.mainIndex,
  );
}

/** Una línea que cambió de tilde, y hacia dónde. */
interface CambioDeTilde {
  /** Número de línea 0-based en el documento **nuevo**. */
  linea: number;
  /** `true` si pasó a `[x]`; `false` si volvió a `[ ]`. */
  completa: boolean;
}

/**
 * Las líneas que acaban de cambiar de tilde, y en qué dirección.
 *
 * Solo se miran las líneas que la transacción tocó: recorrer el documento
 * entero por tecla costaría lo mismo que decorarlo, y acá no hace falta.
 */
function cambiosDeTilde(tr: Transaction): CambioDeTilde[] {
  const salida: CambioDeTilde[] = [];
  const vistas = new Set<number>();
  const inverso = tr.changes.invert(tr.startState.doc);

  tr.changes.iterChanges((_fromA, _toA, fromB, toB) => {
    const desde = tr.newDoc.lineAt(fromB).number;
    const hasta = tr.newDoc.lineAt(toB).number;
    for (let n = desde; n <= hasta; n++) {
      if (vistas.has(n)) continue;
      vistas.add(n);
      const nueva = tr.newDoc.line(n);
      const vieja = tr.startState.doc.lineAt(inverso.mapPos(nueva.from, 1));
      const completa = direccionDelTilde(vieja.text, nueva.text);
      if (completa !== null) salida.push({ linea: n - 1, completa });
    }
  });
  return salida;
}

/**
 * ¿Estas dos líneas son la misma tarea con el tilde cambiado? Y si sí, ¿hacia
 * dónde?
 *
 * `null` es «no fue un cambio de tilde»: cualquier otra cosa, incluida una
 * línea que no es tarea.
 *
 * La comparación es sobre la línea **entera**, token incluido: si además del
 * tilde cambió cualquier otra cosa, no fue un completado y no se toca nada. Es
 * deliberadamente estrecho — completar y escribir en la misma transacción no se
 * reconoce — porque el costo de equivocarse es escribir en una línea que el
 * usuario está editando.
 */
function direccionDelTilde(vieja: string, nueva: string): boolean | null {
  const a = parseBullet(vieja);
  const b = parseBullet(nueva);
  if (a === null || b === null) return null;

  const antes = estadoDe(a);
  const despues = estadoDe(b);
  if (antes === null || despues === null || antes === despues) return null;
  // Solo los dos estados de la §4.2: `[ ]` y `[x]`. Cualquier otro no es un
  // tilde y no significa nada para el plugin (D7).
  if (![" ", "x"].includes(antes) || ![" ", "x"].includes(despues)) return null;
  // Un `- [ ]` vacío no es una tarea (invariante 8) y tildarlo no completa nada.
  if (b.contenido.trim() === "") return null;
  if (sinTilde(a) !== sinTilde(b)) return null;

  return despues === "x";
}

/** La línea con el tilde borrado, para poder comparar todo lo demás. */
function sinTilde(b: Bullet): string {
  return renderBullet({ ...b, checkbox: b.checkbox?.replace(/\[.\]/, "[·]") ?? null });
}

/**
 * Los cambios que hay que sumarle a la transacción, en coordenadas del
 * documento nuevo.
 *
 * Sale de `planDeCompletar`, que es el mismo plan que usan el ⋯ y la paleta.
 * Acá no hace falta `ubicar.ts`: el documento sobre el que se planea es el
 * mismo sobre el que se escribe, en la misma transacción, sin ninguna ventana
 * en el medio.
 *
 * Dos tildadas del mismo subárbol pueden reclamar la misma línea —tildar madre
 * e hija en un solo gesto—: gana la primera, y da lo mismo cuál, porque las dos
 * escriben el mismo `done`.
 */
function replanificar(
  tr: Transaction,
  movidas: readonly CambioDeTilde[],
  hoy: string,
): ChangeSpec[] {
  const lineas: string[] = [];
  for (let i = 1; i <= tr.newDoc.lines; i++) lineas.push(tr.newDoc.line(i).text);

  const doc = documentoDeLineas(lineas);
  const tareas = indexar(doc, "");

  const porLinea = new Map<number, string>();
  for (const { linea, completa } of movidas) {
    const clave = claveDe("", linea);
    const plan = completa
      ? planDeCompletar(doc, tareas, clave, hoy)
      : planDeDestildar(doc, tareas, clave);
    for (const c of plan) {
      if (!porLinea.has(c.linea)) porLinea.set(c.linea, c.despues);
    }
  }

  return [...porLinea].map(([n, texto]) => {
    const linea = tr.newDoc.line(n + 1);
    return { from: linea.from, to: linea.to, insert: texto };
  });
}
