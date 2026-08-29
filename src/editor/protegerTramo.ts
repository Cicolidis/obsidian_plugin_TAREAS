import {
  EditorState,
  Transaction,
  type Extension,
  type Line,
  type Text,
  type TransactionSpec,
} from "@codemirror/state";
import { inicioDelTramo, parsea, sinEsteToken, sinTokens, tokenDe } from "../hiddenTail.js";
import { parseBullet } from "../linea.js";

/**
 * Que editar alrededor de una tarea nunca rompa su token.
 *
 * El token no se ve, así que el cursor se para en lugares que **parecen** el
 * final de la línea y no lo son, y el rango atómico hace que un borrado de un
 * carácter se lleve cuarenta. Sin esto, tres gestos cotidianos rompen datos:
 *
 * | Gesto | Qué pasa sin este filtro |
 * |---|---|
 * | Enter al final de una tarea | el token **baja** a la línea nueva y la tarea pierde su id |
 * | Backspace desde la línea de abajo | el token queda **en el medio** de la línea unida, o se pierde |
 * | Unir dos tareas que tienen token | quedan **dos** `%%t:` en una línea |
 *
 * El tercero es el peor y es el que ordena el módulo: perder el id es
 * recuperable —«el peor caso es volver a poner la estrella», §5.4— pero una
 * línea con dos tokens es **ilegible**, y una línea ilegible queda congelada:
 * el plugin se niega a reescribirla (§5.3).
 *
 * ## Se reconoce el **defecto**, no el gesto
 *
 * La primera versión tenía cuatro reglas, una por gesto: unir, partir, borrar
 * adentro del tramo, escribir adentro del tramo. Cada una preguntaba de qué
 * forma venía el cambio —`fromA >= inicio`, «es una inserción», «es un
 * borrado»— y **las tres fallas de la verificación de la sesión 4 salieron de
 * ahí**:
 *
 * - Con Outliner, unir dos líneas no borra el salto: **reemplaza las dos líneas
 *   por una**. Ahí `fromA` queda antes del tramo, la regla de unir no se
 *   reconocía, y el token terminaba en el medio de la línea, visible.
 * - Cuando el plugin escribe en el disco, Obsidian mete el cambio en el editor
 *   abierto como un diff, y el diff de `…;wb=foco%%` → `…;wb=foco;p=1%%` es una
 *   **inserción adentro del token**. La regla de escribir adentro del tramo lo
 *   confundía con alguien tecleando y sacaba el `;p=1` afuera del token: la
 *   prioridad no se escribía nunca y quedaba `;p=1` como texto a la vista.
 *
 * Es la lección de `autoCheckbox.ts` y de Anotaciones, que yo no había aplicado
 * acá: **la forma de una edición depende de qué plugins haya instalados, y
 * enumerar formas es una lista siempre incompleta.** Ahora hay un solo camino:
 * se calcula en qué quedaría el documento, se pregunta si eso está mal, y solo
 * entonces se corrige.
 *
 * Que el criterio sea el defecto y no el gesto tiene una consecuencia que vale
 * la pena decir: **un cambio que deja todo bien pasa intacto**, venga de donde
 * venga. Es lo que deja pasar las escrituras del propio plugin.
 *
 * ## Los tres defectos
 *
 * | | Qué es | Ejemplo |
 * |---|---|---|
 * | **ilegible** | alguna línea resultante ya no parsea | dos `%%t:` en una línea |
 * | **movido** | el token de la primera línea sobrevive, pero no al final de ella | Enter: se fue abajo |
 * | **perdido** | hubo una unión, el token no sobrevive, y la línea unida conserva el texto que lo llevaba | Backspace desde una línea vacía |
 *
 * Si no hay ninguno, el cambio pasa tal cual.
 *
 * ## Un `transactionFilter` no puede encadenar specs
 *
 * Todas las que devuelva se resuelven contra el documento **original**, así que
 * no se puede reparar mirando el resultado: hay que corregir la entrada. Por
 * eso la corrección se expresa como un reemplazo sobre posiciones de
 * `tr.startState.doc`.
 *
 * ## Corre **antes** que `autoCheckbox`, y eso no es cosmético
 *
 * Leído en `@codemirror/state` 6.5.0 (`filterTransaction`): los filtros se
 * encadenan —cada uno recibe la `Transaction` que produjo el anterior— y se
 * recorren en orden **inverso de precedencia**, o sea que el de **menor**
 * precedencia corre primero. Por eso `main.ts` registra este con `Prec.low`.
 *
 * Si corriera después, `autoCheckbox` vería un Enter cuya primera línea
 * resultante perdió el token, su comparación
 * `resultado[0].trimEnd() === linea.text.trimEnd()` fallaría, y **el checkbox
 * automático dejaría de funcionar en toda tarea que tenga token**. Hay un test
 * que lo fija.
 *
 * ## No se toca ninguna línea que no se entienda
 *
 * Si alguna de las líneas del rango tiene un token que no parsea, el cambio
 * pasa tal cual. La §5.3 es explícita —nunca reparar a ciegas— y limpiar un
 * token roto «de paso», mientras se corrige otra cosa, es exactamente eso.
 *
 * @param activo Si hay que defender este editor. **No** depende del interruptor
 *   de las decoraciones: sin decoraciones el peligro no desaparece, y esto
 *   defiende un dato, no una comodidad.
 */
export function protegerTramo(activo: (state: EditorState) => boolean): Extension {
  return EditorState.transactionFilter.of((tr) => {
    if (!tr.docChanged) return tr;
    if (!activo(tr.startState)) return tr;
    return corregirCambios(tr);
  });
}

function corregirCambios(tr: Transaction): TransactionSpec | Transaction {
  const doc = tr.startState.doc;
  const nuevos: Rango[] = [];
  let corregido = false;
  let cursor: number | null = null;
  let cambios = 0;

  tr.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    cambios++;
    const texto = inserted.toString();
    const arreglo = corregir(doc, fromA, toA, texto);
    if (arreglo === null) {
      nuevos.push({ from: fromA, to: toA, insert: texto });
      return;
    }
    corregido = true;
    nuevos.push(arreglo.cambio);
    cursor = arreglo.cursor;
  });

  if (!corregido) return tr;
  // La corrección **agranda** el rango que reescribe —hasta el final de la
  // última línea tocada— y con varios cursores eso puede pisar el cambio del
  // cursor siguiente.
  //
  // Medido, porque lo primero que supuse era falso: CodeMirror **no** tira
  // excepción con rangos superpuestos, los **fusiona**. Con `[0,5)→X` y
  // `[3,7)→Y` sobre `abcdefghij` devuelve `XYhij`: el segundo cambio pierde en
  // silencio la parte que ya estaba borrada. O sea que la corrección de un
  // cursor se comería la edición del otro sin que nada avise, que es peor que
  // una excepción. Ante la duda no se corrige.
  if (seSuperponen(nuevos)) return tr;

  return {
    changes: nuevos,
    ...(cursor !== null && cambios === 1 ? { selection: { anchor: cursor } } : {}),
    scrollIntoView: true,
    // Se conserva tal cual, no se aplasta a "input": CodeMirror discrimina por
    // el subtipo y devolver "input" apaga `indentOnInput` sin que se note.
    userEvent: tr.annotation(Transaction.userEvent),
  };
}

/** Un reemplazo sobre el documento original. */
interface Rango {
  from: number;
  to: number;
  insert: string;
}

interface Arreglo {
  cambio: Rango;
  /** Posición en el documento ya corregido, o `null` para que CodeMirror mapee. */
  cursor: number | null;
}

const FIN = /[ \t]+$/;

/** `null` significa «este cambio se deja pasar tal cual». */
function corregir(doc: Text, fromA: number, toA: number, texto: string): Arreglo | null {
  const L1 = doc.lineAt(fromA);
  const L2 = doc.lineAt(toA);

  // Camino rápido, y hace falta: esto corre en cada tecla de cada nota de la
  // lista. Sin un `%%` en ninguna de las líneas tocadas no hay token que se
  // pueda romper ni mover.
  if (!algunaTiene(doc, L1.number, L2.number)) return null;
  // El guardia de la §5.3, antes de mirar nada.
  if (!todasParsean(doc, L1.number, L2.number)) return null;

  const inicioCol = inicioDelTramo(L1.text);
  const tramo = L1.text.slice(inicioCol);
  const visible = L1.text.slice(0, inicioCol).replace(FIN, "");
  const token = tokenDe(L1.text);

  // 1) En qué quedaría el documento si no se tocara nada.
  const crudo = partir(L1, L2, fromA - L1.from, toA - L2.from, texto);

  // 2) ¿Hay algo mal?
  const ilegible = crudo.some((l) => !parsea(l));
  const sobrevive = token !== null && crudo.some((l) => l.includes(token));
  const unio = crudo.length < L2.number - L1.number + 1;
  const heredera = esHeredera(crudo[0]!, visible);

  // El token se fue a otra línea, o se perdió en una unión.
  const movido = sobrevive && tokenDe(crudo[0]!) !== token && heredera;
  const perdido = token !== null && !sobrevive && unio && heredera;

  if (!ilegible && !movido && !perdido) return null;

  // 3) El arreglo. Los cortes se acotan al borde del tramo, que es atómico:
  //    partirlo por la mitad deja como texto visible una basura que nadie
  //    escribió.
  const izq = Math.min(fromA - L1.from, inicioCol);
  const inicio2 = inicioDelTramo(L2.text);
  const der = toA - L2.from > inicio2 ? L2.text.length : toA - L2.from;
  const acotado = partir(L1, L2, izq, der, texto);

  // La primera línea se limpia entera y recibe el tramo de vuelta; las otras
  // solo pierden el token que se les filtró desde arriba, porque el suyo —si lo
  // tienen— es suyo.
  const partes = acotado.map((l, i) =>
    i === 0 ? sinTokens(l) : token === null ? l : sinEsteToken(l, token),
  );

  // Se devuelve el tramo salvo cuando el cambio se lo llevó **a propósito**: un
  // cambio que se queda adentro de la línea, abarca el tramo entero y **no lo
  // vuelve a escribir en ningún lado** es alguien borrando el final de la
  // tarea, no una unión ni una partición.
  //
  // El `!sobrevive` no es defensivo: sin él, la forma con que Outliner parte
  // una línea —reemplaza la línea entera, así que abarca el tramo— se leía como
  // un borrado deliberado y el token se perdía en cada Enter.
  const aPropósito =
    !sobrevive && fromA - L1.from <= inicioCol && toA >= L1.to && L1.number === L2.number;
  if (tramo !== "" && !aPropósito && esHeredera(acotado[0]!, visible)) {
    partes[0] = pegarTramo(partes[0]!, tramo);
  }

  const nuevo = partes.join("\n");
  if (nuevo === crudo.join("\n")) return null; // ya estaba bien
  // Si el arreglo dejaría algo ilegible, no se arregla: dejar algo peor de lo
  // que había es la forma más cara de ayudar.
  if (!partes.every(parsea)) return null;

  return {
    cambio: { from: L1.from, to: L2.to, insert: nuevo },
    cursor: L1.from + (partes.length > 1
      ? partes[0]!.length + 1 + partes[1]!.length
      : Math.min(partes[0]!.length, sinTokens(L1.text.slice(0, izq) + texto).split("\n")[0]!.replace(FIN, "").length)),
  };
}

/**
 * ¿Esta línea resultante **hereda** la de arriba, y por lo tanto su token?
 *
 * Dos condiciones, y cada una atája un caso concreto:
 *
 * 1. **Su texto visible es el de la original, o un comienzo de él.** Cubre las
 *    tres formas de quedarse con la línea: partir al final (queda igual), unir
 *    (queda con lo de abajo pegado atrás) y **cortar al medio** (queda la
 *    primera parte). Que en el corte al medio el token se quede arriba es la
 *    decisión de la sesión 4: es la misma regla que en la unión —la línea que
 *    hereda la posición hereda el token— y sin eso partir una tarea la sacaba
 *    del workbench sin que se notara, porque la mitad que quedaba adentro era
 *    el texto nuevo y no la tarea que uno reconoce.
 *
 * 2. **Le queda algo escrito.** Sin esto, apretar Enter con el cursor al
 *    comienzo del texto —para abrir una línea arriba— dejaría al token en una
 *    tarea vacía, que sería la dueña del workbench. Ahí el token tiene que
 *    bajar con el texto.
 */
function esHeredera(resultante: string, visible: string): boolean {
  const limpia = sinTokens(resultante).replace(FIN, "");
  if (!tieneTexto(limpia)) return false;
  return limpia.startsWith(visible) || visible.startsWith(limpia);
}

/** ¿Queda algo escrito, más allá del marcador de lista y del checkbox? */
function tieneTexto(linea: string): boolean {
  const b = parseBullet(linea);
  return b === null ? linea.trim() !== "" : b.contenido.trim() !== "";
}

/** Las líneas que reemplazarían a `L1..L2` si el cambio se aplicara. */
function partir(L1: Line, L2: Line, izq: number, der: number, texto: string): string[] {
  return (L1.text.slice(0, izq) + texto + L2.text.slice(der)).split("\n");
}

/** El tramo pegado al final, sin duplicar el espacio que ya trae adelante. */
function pegarTramo(base: string, tramo: string): string {
  const limpia = base.replace(FIN, "");
  return limpia === "" ? tramo.replace(/^[ \t]+/, "") : limpia + tramo;
}

function algunaTiene(doc: Text, desde: number, hasta: number): boolean {
  for (let n = desde; n <= hasta; n++) if (doc.line(n).text.includes("%%")) return true;
  return false;
}

function todasParsean(doc: Text, desde: number, hasta: number): boolean {
  for (let n = desde; n <= hasta; n++) if (!parsea(doc.line(n).text)) return false;
  return true;
}

/** ¿Alguno de estos rangos pisa al anterior? */
function seSuperponen(rangos: readonly Rango[]): boolean {
  const orden = [...rangos].sort((a, b) => a.from - b.from);
  for (let i = 1; i < orden.length; i++) {
    if (orden[i]!.from < orden[i - 1]!.to) return true;
  }
  return false;
}
