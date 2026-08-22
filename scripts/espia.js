/*
 * Espía de transacciones. Se pega entero en la consola de Obsidian
 * (Ver → Alternar herramientas de desarrollo) con el foco en el editor.
 *
 * Es el §1 de las NOTAS-DE-METODO de Anotaciones: treinta segundos que
 * ahorraron tres intentos fallidos. La forma de una edición depende de qué
 * plugins haya instalados —con Outliner y `betterEnter`, Enter reemplaza la
 * línea entera; sin él, Obsidian inserta el salto— así que la única manera de
 * saber qué llega es mirarlo.
 *
 * OJO: el argumento de `dispatch` llega como **spec**, no como `Transaction`.
 * `iterChanges` no existe sobre él. Por eso esto imprime el spec crudo y
 * además lo normaliza a mano.
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

  /** Un ChangeSpec puede ser objeto, array de objetos o un ChangeSet. */
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
    return lista.map((c) => ({
      from: c.from,
      to: c.to ?? c.from,
      insert: typeof c.insert === "string" ? c.insert : (c.insert?.toString() ?? ""),
    }));
  }

  const ver = (s) => JSON.stringify(s);

  function espiar(...args) {
    const doc = vista.state.doc;
    for (const spec of args) {
      if (!spec || typeof spec !== "object") continue;
      const cambios = normalizar(spec.changes, doc);
      if (cambios.length === 0 && !spec.selection) continue;
      n++;
      console.groupCollapsed(
        `#${n} ${spec.userEvent ?? "(sin userEvent)"} — ${cambios.length} cambio(s)`,
      );
      for (const c of cambios) {
        const linea = doc.lineAt(Math.min(c.from, doc.length));
        console.log(
          `  [${c.from}, ${c.to}] ← ${ver(c.insert)}` +
            `   |  línea ${linea.number} = ${ver(linea.text)}` +
            `   |  col ${c.from - linea.from}` +
            (c.to > linea.to ? "  ← CRUZA A LA LÍNEA DE ABAJO" : ""),
        );
      }
      if (spec.selection) console.log("  selection:", ver(spec.selection));
      console.log("  spec crudo:", spec);
      console.groupEnd();
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
