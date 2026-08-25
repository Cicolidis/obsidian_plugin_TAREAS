import {
  EditorState,
  Transaction,
  type Extension,
  type Text,
  type TransactionSpec,
} from "@codemirror/state";
import { inicioDelTramo, parsea, sinTokens } from "../hiddenTail.js";

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
 * | Backspace desde la línea de abajo | el rango atómico se borra entero: se va el token |
 * | Borrar hacia adelante desde el final | queda medio token, la línea es ilegible y **no se vuelve a escribir nunca** (§5.3) |
 *
 * El tercero es el peor de los tres y es el que ordena el módulo: perder el id
 * es recuperable —«el peor caso es volver a poner la estrella», §5.4— pero una
 * línea ilegible queda congelada, porque el plugin se niega a reescribirla.
 *
 * ## Las reglas no miran la forma del cambio
 *
 * Es la lección de `autoCheckbox.ts` y de Anotaciones: la forma de una edición
 * depende de qué plugins haya instalados. Con Outliner y `betterEnter`, Enter
 * reemplaza la línea entera; sin él, Obsidian inserta el salto desde el
 * carácter anterior al cursor; sin ninguno de los dos, CodeMirror inserta el
 * salto pelado. Enumerar formas es una lista siempre incompleta. Cada regla de
 * acá calcula **en qué quedaría el texto** y decide sobre eso.
 *
 * ## Un `transactionFilter` no puede encadenar specs
 *
 * Todas las que devuelva se resuelven contra el documento **original**, así que
 * no se puede reparar mirando el resultado: hay que corregir la entrada. Por
 * eso cada corrección se expresa como un `ChangeSpec` sobre posiciones de
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
 * automático dejaría de funcionar en toda tarea que tenga token**. Un bug en un
 * mecanismo por culpa del orden de registro de otro. Hay un test que lo fija.
 *
 * ## No se toca ninguna línea que no se entienda
 *
 * Si alguna de las líneas del rango tiene un token que no parsea, el cambio
 * pasa tal cual. La §5.3 es explícita —nunca reparar a ciegas— y limpiar un
 * token roto «de paso», mientras se corrige otra cosa, es exactamente reparar a
 * ciegas: se lo llevaría sin que nadie lo pidiera y sin que se note.
 *
 * @param activo Si hay que defender este editor. **No** depende del interruptor
 *   de las decoraciones: sin decoraciones el peligro no desaparece —un
 *   Backspace que une dos líneas con token deja dos `%%t:` en una— y esto
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
    nuevos.push(...arreglo.changes);
    cursor = arreglo.cursor;
  });

  if (!corregido) return tr;
  // R1 y R2 **agrandan** el rango que reescriben —hasta la línea de abajo, una;
  // hasta el final de la línea, la otra—, y con varios cursores el rango
  // agrandado puede pisar el cambio del cursor siguiente.
  //
  // Medido, porque lo primero que supuse era falso: CodeMirror **no** tira
  // excepción con rangos superpuestos, los **fusiona**. Con `[0,5)→X` y
  // `[3,7)→Y` sobre `abcdefghij` devuelve `XYhij`: el segundo cambio pierde en
  // silencio la parte que ya estaba borrada. O sea que la corrección de un
  // cursor se comería la edición del otro sin que nada avise, que es peor que
  // una excepción. Ante la duda no se corrige: el cambio original nunca se
  // superpone consigo mismo.
  if (seSuperponen(nuevos)) return tr;

  return {
    changes: nuevos,
    // Con varios cursores no hay una sola posición que poner: se deja que
    // CodeMirror mapee las selecciones como sepa.
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

/** ¿Alguno de estos rangos pisa al anterior? */
function seSuperponen(rangos: readonly Rango[]): boolean {
  const orden = [...rangos].sort((a, b) => a.from - b.from);
  for (let i = 1; i < orden.length; i++) {
    if (orden[i]!.from < orden[i - 1]!.to) return true;
  }
  return false;
}

/** Una corrección: los cambios sobre el documento original y dónde va el cursor. */
interface Arreglo {
  changes: Rango[];
  /** Posición en el documento ya corregido, o `null` para que CodeMirror mapee. */
  cursor: number | null;
}

/** `null` significa «este cambio se deja pasar tal cual». */
function corregir(doc: Text, fromA: number, toA: number, texto: string): Arreglo | null {
  const linea = doc.lineAt(fromA);

  // Camino rápido, y hace falta: esto corre en cada tecla de cada nota de la
  // lista. Sin `%%` en la línea no hay tramo que defender, y lo que pase en las
  // de abajo no puede romper nada — el token de la de abajo ya está al final y
  // ahí se queda.
  if (linea.text.indexOf("%%") === -1) return null;

  const inicioCol = inicioDelTramo(linea.text);
  const tramo = linea.text.slice(inicioCol);
  if (tramo === "") return null;
  const inicio = linea.from + inicioCol;

  const ultima = doc.lineAt(toA);
  if (!todasParsean(doc, linea.number, ultima.number)) return null;

  // --- R1. Unión: el cambio se sale de la línea y el tramo sobreviviría en el medio
  //
  // Es el Backspace desde la línea de abajo, y también el Delete desde el final
  // de esta. Verificado dentro del asar de Obsidian 1.13.7 (`deleteBy` →
  // `skipAtomic`): el objetivo del borrado es el salto de línea, que cae
  // adentro del rango atómico, así que se corre hasta el comienzo del rango.
  //
  // La línea unida ocupa la posición de **esta**: hereda su lugar en el árbol,
  // su proyecto y sus hijos. Así que sobrevive **este** tramo, y el token de la
  // línea absorbida se limpia — dos `%%t:` en una línea la vuelven ilegible.
  if (toA > linea.to && fromA >= inicio) {
    // El corte izquierdo se acota a donde empieza el tramo. Vale siempre —esta
    // regla solo corre con `fromA >= inicio`— y no es cosmético: si `fromA` cae
    // **adentro** del token, sin acotar el `pre` se queda con medio token
    // (`%%t:`) y la línea unida es ilegible con arreglo y sin él. Lo encontró la
    // propiedad, no un caso.
    const pre = linea.text.slice(0, inicioCol);
    const post = ultima.text.slice(toA - ultima.from);
    // Se parte primero y se limpia cada línea después: un borrado que junta el
    // principio de un token con el final de otro los deja en la misma línea, y
    // ahí `sinTokens` los ve. Y el arreglo del marcador vacío es por línea.
    const partes = (pre + texto + post).split("\n").map(sinTokens);
    // El tramo vuelve a la **primera**, que es la que hereda la posición de la
    // original. Con un pegado de varias líneas en el medio, las de abajo son
    // texto nuevo y no tienen por qué llevárselo.
    partes[0] = pegarTramo(partes[0]!, tramo);
    if (!partes.every(parsea)) return null;
    return {
      changes: [{ from: linea.from, to: ultima.to, insert: partes.join("\n") }],
      // Donde termina lo que había arriba, que es donde estaba el cursor.
      cursor:
        linea.from +
        Math.min(partes[0].length, sinTokens(pre + texto).split("\n")[0]!.replace(FIN, "").length),
    };
  }

  // --- R2. Partir la línea, sea cual sea la forma del cambio
  //
  // El cursor «al final del texto» está **antes** del tramo, así que partir ahí
  // se lo lleva abajo: la tarea de arriba pierde su id y la nueva nace con uno
  // ajeno. Es el bug que `hiddenTail.ts` de Anotaciones existe para no repetir.
  if (texto.includes("\n") && toA <= linea.to) {
    // El corte se acota al borde del tramo: puede caer adentro —el cursor
    // recorre posiciones que no se ven moverse— y ahí partir en crudo dejaría
    // medio token suelto como texto visible.
    const corteIzq = Math.min(fromA - linea.from, inicioCol);
    // Si el corte **entra** en el tramo, se lleva el tramo entero: es atómico,
    // y dejar la mitad de abajo como texto visible es basura que el usuario no
    // escribió. La corrección de más abajo se lo devuelve entero a la primera
    // línea.
    const corteDer = toA - linea.from > inicioCol ? linea.text.length : inicioCol;
    const crudo =
      linea.text.slice(0, corteIzq) + texto + linea.text.slice(corteDer);
    const resultado = crudo.split("\n");
    if (resultado.length < 2) return null;

    const arriba = sinTokens(resultado[0]!).replace(FIN, "");
    // La condición que distingue **partir al final** de **cortar al medio**: el
    // texto visible de la línea tiene que quedar igual. Si cambió, el usuario
    // cortó la tarea en dos y el token acompaña a lo que quedó abajo. Las dos
    // líneas son válidas y no hay nada congelado; cuál de las dos mitades «es»
    // la tarea original es ambiguo, y adivinar sería peor que no tocar.
    if (arriba !== linea.text.slice(0, inicioCol).replace(FIN, "")) return null;

    const primera = pegarTramo(arriba, tramo);
    const resto = resultado.slice(1).map(sinTokens);
    const nuevo = [primera, ...resto].join("\n");
    if (nuevo === crudo) return null; // ya estaba bien
    if (!nuevo.split("\n").every(parsea)) return null;
    return {
      changes: [{ from: linea.from, to: linea.to, insert: nuevo }],
      // Al final de la segunda línea: después del bullet nuevo, que es donde
      // uno espera seguir escribiendo.
      cursor: linea.from + primera.length + 1 + (resto[0]?.length ?? 0),
    };
  }

  // --- R3. Un borrado que parte el tramo en vez de llevárselo entero
  //
  // El tramo es invisible y atómico: cortarlo por la mitad no puede ser lo que
  // alguien quiso. Y el remanente —`%%t:id=a3f2` sin su cierre— vuelve la línea
  // ilegible, que es el único daño irreversible de este módulo.
  if (toA > fromA && toA > inicio && toA <= linea.to && !(fromA <= inicio && toA >= linea.to)) {
    const desde = Math.min(fromA, inicio);
    const nueva =
      linea.text.slice(0, desde - linea.from) + texto + linea.text.slice(linea.to - linea.from);
    if (!parsea(nueva)) return null;
    return {
      changes: [{ from: desde, to: linea.to, insert: texto }],
      cursor: desde + texto.length,
    };
  }

  // --- R4. Escribir adentro del tramo
  //
  // El rango atómico no deja entrar al cursor, pero el teclado por composición
  // y los plugins que despachan `replaceRange` con posiciones propias sí llegan.
  // Insertar ahí deja el token en el medio de la línea, y un token que no está
  // al final tampoco parsea.
  if (fromA === toA && texto !== "" && fromA > inicio && fromA <= linea.to) {
    const nueva = linea.text.slice(0, inicioCol) + texto + tramo;
    if (!parsea(nueva)) return null;
    return {
      changes: [{ from: inicio, to: inicio, insert: texto }],
      cursor: inicio + texto.length,
    };
  }

  return null;
}

const FIN = /[ \t]+$/;

/** El tramo pegado al final, sin duplicar el espacio que ya trae adelante. */
function pegarTramo(base: string, tramo: string): string {
  const limpia = base.replace(FIN, "");
  return limpia === "" ? tramo.replace(/^[ \t]+/, "") : limpia + tramo;
}

/**
 * ¿Todas las líneas de este rango se entienden?
 *
 * Es el guardia de §5.3 puesto **antes** de mirar nada: una línea con el token
 * roto no se toca ni de refilón. Limpiarla «de paso» mientras se corrige otra
 * cosa se la llevaría sin que nadie lo pidiera.
 */
function todasParsean(doc: Text, desde: number, hasta: number): boolean {
  for (let n = desde; n <= hasta; n++) if (!parsea(doc.line(n).text)) return false;
  return true;
}
