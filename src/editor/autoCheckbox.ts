import {
  Annotation,
  EditorState,
  StateField,
  Transaction,
  type ChangeSpec,
  type Extension,
  type Text,
  type TransactionSpec,
} from "@codemirror/state";
import {
  CHECKBOX_PENDIENTE,
  columnaDelCheckbox,
  columnaDelContenido,
  parseBullet,
} from "../linea.js";

/**
 * El checkbox automático (spec §20 paso 1).
 *
 * Dos reglas, una inversa de la otra:
 *
 * | Gesto | Antes | Después |
 * |---|---|---|
 * | Enter al final de `- 1A` | nace `- ` | nace `- [ ] ` |
 * | Backspace sobre `- [ ] ` vacía | se une con la línea de arriba | queda `- ` |
 *
 * ## Por qué un `transactionFilter` y no un keymap
 *
 * La continuación de listas de Obsidian **no pasa por el keymap** (NOTAS §8):
 * un `keymap` con precedencia máxima no se entera. Y Outliner, que está
 * instalado en este vault con `betterEnter`, engancha Enter y Backspace con
 * `Prec.highest`, así que gana cualquier keymap que se le ponga al lado. Lo
 * que sí ve todo cambio, venga de donde venga, es `EditorState.transactionFilter`.
 *
 * ## Por qué las reglas no miran la forma del cambio
 *
 * Esto está **leído en el código de los dos motores**, no supuesto:
 *
 * - Obsidian (`app.js`, `newlineAndIndentContinueMarkdownList`) reemplaza
 *   desde el carácter anterior al cursor: `r.charAt(i.ch-1) + "\n" + s + w`.
 * - Outliner (`ChangesApplicator.calculateChanges`) recorta las líneas
 *   comunes por delante y por detrás, y termina reemplazando **la línea
 *   sola** por `‹línea›\n‹bullet nuevo›`.
 * - Sin ninguno de los dos, CodeMirror inserta el salto y nada más.
 *
 * Tres formas distintas para el mismo gesto, y la lista está incompleta por
 * definición: depende de qué plugins tenga instalados quien lo use. Así que
 * ninguna regla de acá pregunta «¿de qué forma vino el cambio?». Todas
 * calculan **en qué quedaría el documento** y deciden sobre eso.
 *
 * ## La restricción que ordena la implementación
 *
 * Un `transactionFilter` **no puede encadenar specs**: todas las que devuelva
 * se resuelven contra el documento **original**, así que no se puede reparar
 * mirando el resultado — hay que corregir la entrada. Por eso cada corrección
 * se expresa como un `ChangeSpec` sobre posiciones de `tr.startState.doc`.
 *
 * ## Y una tercera cosa que hace el entorno después
 *
 * Outliner no despacha una transacción, despacha **dos**: su
 * `ChangesApplicator.apply` hace `editor.replaceRange(...)` y a continuación
 * `editor.setSelections(newRoot.getSelections())`. Esa segunda transacción
 * lleva el cursor a donde Outliner cree que termina la línea nueva — y
 * Outliner no sabe nada del `[ ] ` que este filtro acaba de agregar, así que
 * lo deja **cuatro caracteres antes**.
 *
 * Con `stickCursor` encendido no se notaba: el `transactionExtender` de
 * Outliner volvía a empujar el cursor fuera del checkbox y lo dejaba, por
 * casualidad, en el lugar correcto. Con `stickCursor` en «Never» el cursor
 * queda dentro del `[ ]`, y como Live Preview muestra el marcado en crudo
 * cuando el cursor cae adentro de un token, **el checkbox deja de dibujarse**.
 * Un solo defecto con dos síntomas.
 *
 * Por eso la corrección de la regla A se anota, y la anotación vive exactamente
 * una transacción: solo se defiende el cursor contra la transacción de
 * selección que viene inmediatamente después. Sin eso habría que decidir a
 * ciegas si un cursor dentro del checkbox llegó ahí por Outliner o porque el
 * usuario apretó la flecha izquierda cuatro veces, y adivinar mal deja el
 * cursor atrapado.
 *
 * @param activo Si el filtro tiene que actuar sobre este editor. Se le pasa
 *   el estado para que la decisión —qué archivo es, si el interruptor está
 *   encendido— viva en `main.ts` y este módulo no importe `obsidian`: así se
 *   prueba entero contra un `EditorState` pelado, sin abrir la aplicación.
 */
export function checkboxAutomatico(activo: (state: EditorState) => boolean): Extension {
  return [
    cursorEsperado,
    EditorState.transactionFilter.of((tr) => {
      // Antes de mirar nada: esto corre en cada tecla de cada nota abierta.
      if (!activo(tr.startState)) return tr;
      if (!tr.docChanged) return defenderCursor(tr);
      // Ver el mismo guardia en `protegerTramo.ts`: un cambio externo llega con
      // `userEvent: "set"` y nunca hay que corregirlo. Acá no se conoce ningún
      // caso en que un diff de Obsidian tenga la forma de un Enter, pero el
      // costo de descartarlo es una comparación y el de acertar por casualidad
      // es un checkbox que aparece en una línea que nadie tocó.
      if (tr.isUserEvent("set")) return tr;
      return corregirCambios(tr);
    }),
  ];
}

/**
 * Dónde dejó el cursor la última corrección de la regla A.
 *
 * Se pone con una anotación y **cualquier otra transacción lo borra**: dura una
 * sola, que es exactamente la ventana en la que Outliner despacha su
 * `setSelections`.
 */
const CURSOR_PUESTO = Annotation.define<number>();

const cursorEsperado = StateField.define<number | null>({
  create: () => null,
  update: (_valor, tr) => tr.annotation(CURSOR_PUESTO) ?? null,
});

/**
 * Devolverle al cursor el lugar que le corresponde después de la regla A.
 *
 * Solo actúa sobre el caso exacto que se midió: la transacción siguiente a una
 * corrección nuestra, que es un cursor —no una selección— parado justo donde
 * empieza el `[ ] ` de la tarea vacía que acabamos de crear. Cualquier otra
 * cosa pasa sin tocarse.
 */
function defenderCursor(tr: Transaction): TransactionSpec | Transaction {
  const esperado = tr.startState.field(cursorEsperado, false);
  if (esperado == null || !tr.selection) return tr;
  const sel = tr.selection.main;
  if (!sel.empty || sel.head !== esperado - CHECKBOX_PENDIENTE.length) return tr;

  // Que la línea siga siendo la tarea vacía que creamos, y no otra cosa que
  // dio la misma cuenta.
  const doc = tr.startState.doc;
  if (esperado > doc.length) return tr;
  const linea = doc.lineAt(esperado);
  const b = parseBullet(linea.text);
  if (b === null || b.checkbox === null || b.contenido !== "") return tr;
  if (linea.from + columnaDelContenido(b) !== esperado) return tr;

  return { selection: { anchor: esperado } };
}

function corregirCambios(tr: Transaction): TransactionSpec | Transaction {
  const doc = tr.startState.doc;
  const nuevos: ChangeSpec[] = [];
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

  const spec: TransactionSpec = {
    changes: nuevos,
    // Con varios cursores no hay una sola posición que poner, así que se
    // deja que CodeMirror mapee las selecciones como sepa.
    ...(cursor !== null && cambios === 1
      ? { selection: { anchor: cursor }, annotations: CURSOR_PUESTO.of(cursor) }
      : {}),
    scrollIntoView: true,
    // El `userEvent` se conserva **tal cual**, no se aplasta a "input".
    // CodeMirror discrimina por el subtipo: `indentOnInput` solo reacciona a
    // "input.type", y devolver "input" lo apaga sin que se note. Un filtro
    // que reescribe una transacción no tiene por qué cambiar de qué gesto
    // vino.
    userEvent: tr.annotation(Transaction.userEvent),
  };
  return spec;
}

/** Una corrección: los cambios sobre el documento original y dónde va el cursor. */
interface Arreglo {
  changes: ChangeSpec[];
  /** Posición en el documento ya corregido, o `null` para dejar que CodeMirror mapee. */
  cursor: number | null;
}

/** `null` significa «este cambio se deja pasar tal cual». */
function corregir(doc: Text, fromA: number, toA: number, texto: string): Arreglo | null {
  // Camino rápido. La regla A necesita un salto de línea; la B, un borrado
  // puro. Escribir una letra —que es la mayoría abrumadora de las teclas— no
  // es ninguna de las dos.
  if (texto === "") return quitarCheckbox(doc, fromA, toA);
  if (!texto.includes("\n")) return null;
  return ponerCheckbox(doc, fromA, toA, texto);
}

/**
 * Regla A: el bullet que nace de un bullet nace tarea.
 *
 * Se corrige solo si las cuatro cosas son ciertas, y cada una descarta un caso
 * que no hay que tocar:
 *
 * 1. el resultado tiene exactamente dos líneas → pegar varias líneas no cuenta;
 * 2. la primera queda igual que la original → **nació** una línea, no se partió
 *    texto al medio;
 * 3. la original es un bullet → el texto libre y las líneas en blanco quedan
 *    como están;
 * 4. la nueva es un bullet **sin** checkbox → si ya lo trae (porque venía de
 *    una tarea y lo puso Obsidian u Outliner) no se toca, y si no es bullet
 *    —Enter sobre un bullet vacío, que borra el marcador— tampoco: **sigue
 *    habiendo forma de salir de una lista**.
 *
 * De 4 sale también que la regla es idempotente: aplicarla sobre su propio
 * resultado no hace nada.
 */
function ponerCheckbox(doc: Text, fromA: number, toA: number, texto: string): Arreglo | null {
  const linea = doc.lineAt(fromA);
  // El cambio se sale de la línea: es un pegado o un borrado grande, no Enter.
  if (toA > linea.to) return null;

  const original = parseBullet(linea.text);
  if (original === null) return null;

  const pre = linea.text.slice(0, fromA - linea.from);
  const post = linea.text.slice(toA - linea.from);
  const resultado = `${pre}${texto}${post}`.split("\n");
  if (resultado.length !== 2) return null;
  if (resultado[0]!.trimEnd() !== linea.text.trimEnd()) return null;

  const nueva = parseBullet(resultado[1]!);
  if (nueva === null || nueva.checkbox !== null) return null;

  // Dónde cae el checkbox **dentro del texto insertado**: la corrección tiene
  // que ir contra el documento original, no contra el resultado.
  const salto = texto.indexOf("\n");
  const cola = texto.slice(salto + 1);
  const col = columnaDelCheckbox(nueva);
  // El marcador de la línea nueva vendría en parte de `post` y no del texto
  // insertado. No pasa con ninguna de las tres formas conocidas, pero si
  // pasara, insertar acá partiría el marcador al medio.
  if (col > cola.length) return null;

  const corregido = `${texto.slice(0, salto + 1)}${cola.slice(0, col)}${CHECKBOX_PENDIENTE}${cola.slice(col)}`;
  return {
    changes: [{ from: fromA, to: toA, insert: corregido }],
    // Donde uno espera seguir escribiendo: después del `- [ ] ` recién puesto.
    cursor: linea.from + resultado[0]!.length + 1 + col + CHECKBOX_PENDIENTE.length,
  };
}

/**
 * Regla B: Backspace sobre una tarea vacía le saca el checkbox.
 *
 * Es la salida para escribir una **nota de tarea** (spec §4.3): el bullet sin
 * checkbox que cuelga de una tarea y donde viven los instructivos y los datos
 * de pago. Sin esto, con la regla A encendida, escribir uno obligaría a borrar
 * los corchetes de a un carácter.
 *
 * Se pisa un comportamiento existente y hay que saberlo: con `stickCursor` en
 * `bullet-and-checkbox` —la configuración de este vault— la columna 6 de
 * `- [ ] ` *es* el comienzo del contenido, y ahí Outliner ya tiene su
 * `DeleteTillPreviousLineContentEnd`, que une con la línea de arriba. Con esta
 * regla esa unión pasa a costar **dos** Backspace: el primero saca el
 * checkbox, el segundo une.
 *
 * Las dos formas que hay que cubrir —el borrado de un carácter de CodeMirror y
 * la unión de Outliner— se reconocen por lo mismo: el borrado **termina justo
 * donde empieza el contenido** de una línea con checkbox y sin nada escrito.
 */
function quitarCheckbox(doc: Text, fromA: number, toA: number): Arreglo | null {
  if (fromA >= toA) return null;

  const linea = doc.lineAt(toA);
  const b = parseBullet(linea.text);
  if (b === null || b.checkbox === null) return null;
  // Solo la tarea vacía. Con algo escrito, Backspace ahí es un borrado normal.
  if (b.contenido !== "") return null;
  if (toA !== linea.from + columnaDelContenido(b)) return null;

  // Que el borrado no se lleve nada más. Sin esto, seleccionar medio documento
  // hasta acá y apretar Delete se convertiría en «sacale el checkbox»: la
  // corrección tiene que preservar la intención, no solo el caso feliz.
  if (fromA < linea.from) {
    if (linea.number === 1) return null;
    const arriba = doc.line(linea.number - 1);
    if (fromA < arriba.from) return null;
    if (arriba.text.slice(fromA - arriba.from).trim() !== "") return null;
  }

  const desde = linea.from + columnaDelCheckbox(b);
  return {
    changes: [{ from: desde, to: desde + b.checkbox.length, insert: "" }],
    cursor: desde,
  };
}
