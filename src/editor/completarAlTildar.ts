/**
 * Tildar el checkbox **es** completar la tarea (§12).
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
 * ## Qué escribe
 *
 * Exactamente lo mismo que «completar y descartar» del ⋯: `planDeCompletar`,
 * que escribe `done=` donde no había y **baja por el subárbol** (§9, «marcar el
 * padre completa todos los hijos»). Un solo camino para las dos puertas; dos
 * implementaciones divergirían justo en cuánto escriben.
 *
 * Lo que **no** hace es archivar. Archivar toca dos archivos y un
 * `transactionFilter` no puede hacer eso: sigue en el ⋯.
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
  EditorState,
  Transaction,
  type ChangeSpec,
  type Extension,
  type TransactionSpec,
} from "@codemirror/state";
import { planDeCompletar } from "../acciones.js";
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

    const tildadas = reciénTildadas(tr);
    if (tildadas.length === 0) return tr;

    const cambios = completar(tr, tildadas, hoy());
    if (cambios.length === 0) return tr;

    // `sequential: true` no es opcional: estos cambios están en coordenadas del
    // documento **ya modificado**, y sin esto `resolveTransaction` los
    // resolvería contra el original. Es la misma trampa que documenta
    // `cursorExterno.ts`, leída en `@codemirror/state` 6.5.0.
    return [tr, { changes: cambios, sequential: true, userEvent: "input" }];
  });
}

/**
 * Los números de línea (0-based, en el documento **nuevo**) que se acaban de
 * tildar.
 *
 * Solo se miran las líneas que la transacción tocó: recorrer el documento
 * entero por tecla costaría lo mismo que decorarlo, y acá no hace falta.
 */
function reciénTildadas(tr: Transaction): number[] {
  const salida: number[] = [];
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
      if (soloCambióElTilde(vieja.text, nueva.text)) salida.push(n - 1);
    }
  });
  return salida;
}

/**
 * ¿Estas dos líneas son la misma tarea, y lo único distinto es que ahora está
 * tildada?
 *
 * La comparación es sobre la línea **entera**, token incluido: si además del
 * tilde cambió cualquier otra cosa, no fue un completado y no se toca nada. Es
 * deliberadamente estrecho — completar y escribir en la misma transacción no se
 * reconoce — porque el costo de equivocarse es escribir en una línea que el
 * usuario está editando.
 */
function soloCambióElTilde(vieja: string, nueva: string): boolean {
  const a = parseBullet(vieja);
  const b = parseBullet(nueva);
  if (a === null || b === null) return false;
  if (estadoDe(a) !== " " || estadoDe(b) !== "x") return false;
  // Un `- [ ]` vacío no es una tarea (invariante 8) y tildarlo no completa nada.
  if (b.contenido.trim() === "") return false;
  return sinTilde(a) === sinTilde(b);
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
function completar(tr: Transaction, tildadas: readonly number[], hoy: string): ChangeSpec[] {
  const lineas: string[] = [];
  for (let i = 1; i <= tr.newDoc.lines; i++) lineas.push(tr.newDoc.line(i).text);

  const doc = documentoDeLineas(lineas);
  const tareas = indexar(doc, "");

  const porLinea = new Map<number, string>();
  for (const n of tildadas) {
    for (const c of planDeCompletar(doc, tareas, claveDe("", n), hoy)) {
      if (!porLinea.has(c.linea)) porLinea.set(c.linea, c.despues);
    }
  }

  return [...porLinea].map(([n, texto]) => {
    const linea = tr.newDoc.line(n + 1);
    return { from: linea.from, to: linea.to, insert: texto };
  });
}
