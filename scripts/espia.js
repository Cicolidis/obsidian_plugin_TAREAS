/*
 * Espía de transacciones. Se pega entero en la consola de Obsidian
 * (Ver → Alternar herramientas de desarrollo) con el foco en el editor.
 *
 * Es el §1 de las NOTAS-DE-METODO de Anotaciones: treinta segundos que
 * ahorraron tres intentos fallidos. La forma de una edición depende de qué
 * plugins haya instalados, así que la única manera de saber qué llega es
 * mirarlo.
 *
 * ## Dos cosas que este script aprendió a la mala
 *
 * 1. **Un espía que puede tirar excepción no mide: interfiere.** Si el
 *    logueo falla, la excepción sube por el `dispatch` hasta el código de
 *    Obsidian que lo llamó, la transacción nunca se despacha, y Obsidian cae
 *    a su camino de salida. El resultado es una medición que muestra un
 *    comportamiento que no existe fuera del espía. Por eso todo el logueo va
 *    dentro de un `try` y el `dispatch` original se llama **siempre**.
 *
 * 2. **No hay una sola forma de argumento.** Por `dispatch` pasan:
 *    - un `TransactionSpec` de CodeMirror, con offsets numéricos e `insert`;
 *    - una `Transaction` ya armada, con `startState` y un `ChangeSet`;
 *    - y specs de la capa `Editor` de Obsidian, con `{line, ch}` y `text`
 *      (es lo que usa `newlineAndIndentContinueMarkdownList`).
 *
 *   espiaTareas.on()    encender (también se enciende solo al pegarlo)
 *   espiaTareas.off()   apagar y restaurar el dispatch original
 */
(() => {
  const vista = app.workspace.activeEditor?.editor?.cm;
  if (!vista) {
    console.warn("Poné el cursor en una nota abierta en modo edición y volvé a pegar esto.");
    return;
  }

  const original = vista.dispatch.bind(vista);
  let n = 0;

  /** Obsidian usa `{line, ch}`; CodeMirror, un número. */
  function aOffset(pos, doc) {
    if (typeof pos === "number") return pos;
    if (pos && typeof pos.line === "number") {
      const linea = doc.line(Math.min(pos.line + 1, doc.lines));
      return Math.min(linea.from + (pos.ch ?? 0), linea.to);
    }
    return null;
  }

  function normalizar(changes, doc) {
    if (!changes) return [];
    if (typeof changes.iterChanges === "function") {
      const salida = [];
      changes.iterChanges((fromA, toA, _fromB, _toB, ins) =>
        salida.push({ from: fromA, to: toA, insert: ins.toString() }),
      );
      return salida;
    }
    const lista = Array.isArray(changes) ? changes : [changes];
    return lista.map((c) => {
      const from = aOffset(c.from, doc);
      const to = c.to === undefined ? from : aOffset(c.to, doc);
      // `insert` es de CodeMirror; `text`, de la capa Editor de Obsidian.
      const bruto = c.insert ?? c.text ?? "";
      return { from, to, insert: typeof bruto === "string" ? bruto : String(bruto) };
    });
  }

  const ver = (s) => JSON.stringify(s);

  function registrar(spec) {
    if (!spec || typeof spec !== "object") return;
    // Una `Transaction` trae su propio documento de partida; un spec, no.
    const esTransaccion = spec.startState !== undefined;
    const doc = esTransaccion ? spec.startState.doc : vista.state.doc;
    const cambios = normalizar(spec.changes, doc);
    if (cambios.length === 0 && !spec.selection) return;

    n++;
    const userEvent =
      spec.userEvent ??
      (typeof spec.annotation === "function" ? spec.annotation(Symbol.for("userEvent")) : null);
    console.groupCollapsed(
      `#${n} ${userEvent ?? "(sin userEvent)"} — ${cambios.length} cambio(s)` +
        (esTransaccion ? " — Transaction" : " — spec"),
    );
    for (const c of cambios) {
      if (c.from === null) {
        console.log("  cambio con posiciones que no supe leer:", c);
        continue;
      }
      const linea = doc.lineAt(Math.max(0, Math.min(c.from, doc.length)));
      console.log(
        `  [${c.from}, ${c.to}] ← ${ver(c.insert)}` +
          `   |  línea ${linea.number} = ${ver(linea.text)}` +
          `   |  col ${c.from - linea.from}` +
          (c.to > linea.to ? "   ← CRUZA A LA LÍNEA DE ABAJO" : ""),
      );
    }
    if (spec.selection) console.log("  selection:", ver(spec.selection));
    console.log("  argumento crudo:", spec);
    console.groupEnd();
  }

  function espiar(...args) {
    // El logueo no puede impedir que la transacción se despache: si tira, lo
    // que se mide es el espía y no Obsidian.
    try {
      for (const spec of args) registrar(spec);
    } catch (err) {
      console.warn("espía: falló el logueo, la transacción sigue igual —", err);
    }
    return original(...args);
  }

  window.espiaTareas = {
    on() {
      vista.dispatch = espiar;
      console.log("espía ENCENDIDO sobre", app.workspace.activeEditor?.file?.path);
    },
    off() {
      vista.dispatch = original;
      console.log("espía apagado");
    },
  };
  window.espiaTareas.on();
})();
