import {
  EditorState,
  Transaction,
  type Extension,
  type Text,
  type TransactionSpec,
} from "@codemirror/state";
import { visibleDe, sinTokens } from "../hiddenTail.js";
import { parseBullet } from "../linea.js";

/**
 * Que unir dos tareas deje **una línea**, y no dos pegadas.
 *
 * Sin esto, unir `- [ ] comprar` con `- [ ] pan` deja
 * `- [ ] comprar- [ ] pan`: el texto de abajo pegado sin espacio, y con su
 * marcador de lista metido en el medio como si fuera texto. Tiene que quedar
 * `- [ ] comprar pan`.
 *
 * ## Por qué es un módulo aparte y no una regla de `protegerTramo`
 *
 * Aquel filtro solo interviene cuando hay un token que defender. Meter la
 * limpieza ahí la haría aparecer **únicamente en las tareas que tienen
 * metadatos** — que son invisibles. O sea: un comportamiento del editor que
 * cambia según algo que no se ve, y que por lo tanto no se puede aprender. Esto
 * vale para toda unión de dos ítems de lista en una nota de tareas, con token o
 * sin él.
 *
 * ## La regla no mira la forma del cambio
 *
 * Es la lección que ya costó tres bugs en `protegerTramo`: la forma de una
 * edición depende de qué plugins haya instalados. Con Outliner, unir dos líneas
 * reemplaza las dos por una; sin él, borra el salto; y el Suprimir desde el
 * final de la de arriba es otra forma más. Así que acá tampoco se pregunta de
 * qué forma vino: se calcula **en qué quedaría el documento** y se decide sobre
 * eso.
 *
 * ## Qué NO toca
 *
 * - Uniones donde la línea absorbida no es un ítem de lista: ahí no hay
 *   marcador que sobre, y meter un espacio sería inventar.
 * - Uniones donde la absorbida no tiene contenido: no hay nada que separar.
 * - Cambios externos (`userEvent: "set"`), por la misma razón que en
 *   `protegerTramo`: es un documento que otro ya decidió.
 * - La línea de arriba, si ya termina en espacio.
 *
 * @param activo Si hay que actuar sobre este editor: nota de la lista **y** el
 *   interruptor encendido. Se inyecta para que este módulo no importe
 *   `obsidian` y se pueda probar entero contra un `EditorState` pelado.
 */
export function unirLimpio(activo: (state: EditorState) => boolean): Extension {
  return EditorState.transactionFilter.of((tr) => {
    if (!tr.docChanged) return tr;
    if (tr.isUserEvent("set")) return tr;
    if (!activo(tr.startState)) return tr;
    return corregirCambios(tr);
  });
}

interface Rango {
  from: number;
  to: number;
  insert: string;
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
  // Mismo motivo que en `protegerTramo`: la corrección agranda el rango que
  // reescribe, y CodeMirror **fusiona** los rangos superpuestos en vez de tirar,
  // así que con varios cursores se comería la edición del otro en silencio.
  if (seSuperponen(nuevos)) return tr;

  return {
    changes: nuevos,
    ...(cursor !== null && cambios === 1 ? { selection: { anchor: cursor } } : {}),
    scrollIntoView: true,
    userEvent: tr.annotation(Transaction.userEvent),
  };
}

interface Arreglo {
  cambio: Rango;
  cursor: number;
}

/** `null` significa «este cambio se deja pasar tal cual». */
function corregir(doc: Text, fromA: number, toA: number, texto: string): Arreglo | null {
  const L1 = doc.lineAt(fromA);
  const L2 = doc.lineAt(toA);
  // Camino rápido: sin líneas de por medio no hubo unión. Corre en cada tecla.
  if (L1.number === L2.number) return null;

  const crudo = (
    L1.text.slice(0, fromA - L1.from) +
    texto +
    L2.text.slice(toA - L2.from)
  ).split("\n");
  // Hubo unión si quedan menos líneas de las que se consumieron.
  if (crudo.length >= L2.number - L1.number + 1) return null;

  const abajo = parseBullet(L2.text);
  if (!parseBullet(L1.text) || !abajo) return null;

  // El texto de arriba es el **visible**: si la línea tiene token, el token es
  // cosa de `protegerTramo`, que corre después y lo devuelve al final. Acá se
  // decide el texto, allá los metadatos.
  const izq = visibleDe(L1.text).replace(FIN, "");
  const der = sinTokens(abajo.contenido).replace(FIN, "");
  if (der === "") return null; // sin contenido abajo no hay nada que separar

  // La condición que distingue **unir** de **borrar**: los dos textos tienen que
  // haber sobrevivido enteros, cada uno en su punta. Si el usuario además borró
  // parte de alguno, la unión no es limpia y no hay nada que normalizar.
  //
  // Se compara sobre el resultado y no sobre la forma del cambio, que es la
  // lección que ya costó tres bugs: con Outliner unir reemplaza las dos líneas
  // por una, sin él borra el salto, y el Suprimir desde arriba es otra forma
  // más. Las tres llegan acá iguales.
  const limpia = sinTokens(crudo[0]!).replace(FIN, "");
  if (limpia.length < izq.length + der.length) return null;
  if (!limpia.startsWith(izq) || !limpia.endsWith(der)) return null;

  const nuevo = [`${izq} ${abajo.contenido.replace(FIN, "")}`, ...crudo.slice(1)].join("\n");
  if (nuevo === crudo.join("\n")) return null; // ya estaba bien

  return {
    cambio: { from: L1.from, to: L2.to, insert: nuevo },
    // En la costura, que es donde estaba el cursor: al final del texto de
    // arriba, antes del espacio que se acaba de agregar.
    cursor: L1.from + izq.length,
  };
}

const FIN = /[ \t]+$/;

/** ¿Alguno de estos rangos pisa al anterior? */
function seSuperponen(rangos: readonly Rango[]): boolean {
  const orden = [...rangos].sort((a, b) => a.from - b.from);
  for (let i = 1; i < orden.length; i++) {
    if (orden[i]!.from < orden[i - 1]!.to) return true;
  }
  return false;
}
