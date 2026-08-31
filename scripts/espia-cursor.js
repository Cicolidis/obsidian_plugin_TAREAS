/*
 * Espía del **cursor**: quién lo mueve, y adónde.
 *
 * Se pega entero en la consola de Obsidian (Ver → Alternar herramientas de
 * desarrollo) con el foco en el editor.
 *
 * Existe por dos reportes de la verificación de la sesión 5 que **no se
 * reprodujeron offline**:
 *
 * - al unir dos tareas, el cursor «a veces queda al final de la línea unida y
 *   otras en medio de la línea que subió»;
 * - con las flechas se puede llegar a las posiciones que están antes del
 *   checkbox, y ahí Live Preview desarma el `- [ ] `.
 *
 * Los tests con los tres filtros puestos dan siempre la costura, así que lo que
 * falta es lo que **no** está en los tests: Outliner interceptando el Backspace,
 * y las transacciones que Obsidian despacha detrás de la nuestra. Eso solo se ve
 * acá.
 *
 * Imprime una línea por transacción con:
 *
 *   cursor de entrada → cursor de salida · quién lo pidió · qué cambió
 *
 * y marca con **←** las transacciones que traen una selección **explícita**, que
 * son las que ganan sobre el mapeo. Si el cursor termina mal, la que lo movió es
 * la última marcada.
 *
 * Vale la lección de `espia.js`: **un espía que puede tirar no mide, interfiere.**
 * Todo el logueo va dentro de un `try` y el `dispatch` original se llama siempre.
 *
 *   espiaCursor.on()     encender (se enciende solo al pegarlo)
 *   espiaCursor.off()    apagar y restaurar
 *   espiaCursor.limpiar() reiniciar el contador
 */
(() => {
  const vista = app.workspace.activeEditor?.editor?.cm;
  if (!vista) {
    console.warn("Poné el cursor en una nota abierta en modo edición y volvé a pegar esto.");
    return;
  }

  const original = vista.dispatch.bind(vista);
  let n = 0;

  /** Dónde está el cursor, en `línea:columna` legible. */
  function donde(state, pos) {
    try {
      const l = state.doc.lineAt(pos);
      return `${l.number}:${pos - l.from}`;
    } catch {
      return `?(${pos})`;
    }
  }

  /** El texto de la línea del cursor, recortado, con «|» donde está el cursor. */
  function contexto(state, pos) {
    try {
      const l = state.doc.lineAt(pos);
      const c = pos - l.from;
      const t = `${l.text.slice(0, c)}|${l.text.slice(c)}`;
      return t.length > 70 ? `${t.slice(0, 67)}…` : t;
    } catch {
      return "";
    }
  }

  /** Una `Transaction` ya armada, o un spec: los dos pasan por `dispatch`. */
  function seleccionExplicita(a) {
    if (!a || typeof a !== "object") return false;
    // Una `Transaction` expone `selection`; un spec lo trae como campo.
    return a.selection != null;
  }

  /**
   * El `userEvent`, sin poder importar `Transaction.userEvent` desde la consola.
   *
   * Por `dispatch` pasan las dos formas —un spec, donde el campo está a la
   * vista, y una `Transaction` ya armada, donde la anotación solo se puede
   * consultar con `isUserEvent`—. Para la segunda se prueban los nombres que
   * este plugin y Obsidian usan de verdad; es una lista corta a propósito, y
   * que sea incompleta no rompe nada: devuelve «—».
   */
  const EVENTOS = [
    "input.type",
    "input.paste",
    "input.drop",
    "input.complete",
    "delete.backward",
    "delete.forward",
    "delete.selection",
    "delete.cut",
    "move.drop",
    "select.pointer",
    "select",
    "undo",
    "redo",
    "set",
  ];

  function userEvent(a) {
    if (a && typeof a.userEvent === "string") return a.userEvent;
    if (a && typeof a.isUserEvent === "function") {
      for (const e of EVENTOS) {
        try {
          if (a.isUserEvent(e)) return e;
        } catch {
          /* una transacción rara no puede tumbar el espía */
        }
      }
    }
    return "—";
  }

  vista.dispatch = (...args) => {
    const antes = vista.state;
    const posAntes = antes.selection.main.head;
    const r = original(...args);
    try {
      const despues = vista.state;
      const posDespues = despues.selection.main.head;
      const cambio = despues.doc.length - antes.doc.length;
      const explicita = args.some(seleccionExplicita);
      const salto = posDespues !== posAntes;

      // Solo lo que importa: transacciones que mueven el cursor o cambian el doc.
      if (!salto && cambio === 0) return r;

      // **`%s` y no una plantilla suelta.** La consola de Chrome —que es la de
      // Obsidian— trata el primer argumento como cadena de formato aunque sea
      // el único, y ahí `%%` es el escape de un `%` literal: el token
      // `%%t:id=…%%` salía impreso como `%t:id=…%`. O sea que el instrumento
      // mentía sobre lo único que este plugin escribe.
      //
      // Node **no** lo reproduce —con un solo argumento devuelve la cadena tal
      // cual— así que probarlo en la terminal no sirve. Apareció leyendo la
      // salida que volvió de la segunda vuelta de verificación.
      console.log(
        "%s",
        `#${++n} ${donde(antes, posAntes)} → ${donde(despues, posDespues)}` +
          `${explicita ? "  ← selección explícita" : ""}` +
          `  · doc ${cambio >= 0 ? "+" : ""}${cambio}` +
          `  · ${userEvent(args[0])}`,
      );
      console.log("%s", `     «${contexto(despues, posDespues)}»`);
    } catch (err) {
      console.warn("[espia-cursor] no se pudo loguear:", err);
    }
    return r;
  };

  globalThis.espiaCursor = {
    on() {
      console.log("El espía del cursor ya está puesto. Hacé el gesto y mirá.");
    },
    off() {
      vista.dispatch = original;
      console.log("Espía del cursor apagado.");
    },
    limpiar() {
      n = 0;
      console.clear();
    },
  };

  console.log(
    "Espía del cursor puesto. Hacé el gesto —unir con Backspace, o flecha izquierda\n" +
      "desde el comienzo del texto— y mirá cuál transacción lo movió.\n" +
      "La que trae «← selección explícita» es la que manda.\n" +
      "espiaCursor.off() para sacarlo.",
  );
})();
