/*
 * Espía de eventos del vault. Se pega entero en la consola de Obsidian
 * (Ver → Alternar herramientas de desarrollo).
 *
 * Hermano de `espia.js`, y por la misma razón: la §7 de la spec afirma que
 * reparsear `tareas_COLE` en cada tecla «es perceptible en móvil», y eso no
 * está verificado. Medido offline, parsear las siete notas enteras cuesta
 * 0,31 ms, así que el costo del parseo no puede ser el argumento. Lo que sí
 * decide el debounce es **cuándo llega el evento**, y eso solo se sabe
 * mirándolo.
 *
 * Cinco preguntas que este espía responde:
 *
 *   1. ¿`metadataCache.on("changed")` dispara por tecla, por pausa o al
 *      guardar? Obsidian ya espacia su indexado; si el evento llega cada dos
 *      segundos, un debounce propio solo agrega latencia entre la acción y el
 *      redibujo.
 *   2. ¿Dispara también para las escrituras del propio plugin? Importa porque
 *      el store se va a alimentar de lo que devuelve `vault.process`, y el
 *      evento que llegue después tiene que ser idempotente y no un segundo
 *      reparseo que pise algo.
 *   3. ¿Cuánto tarda desde que se escribe hasta que llega?
 *   4. ¿Un `process` que devuelve el contenido **igual** escribe igual? De eso
 *      depende si el camino de «no se pudo ubicar la línea» puede devolver
 *      `data` intacto o tiene que tirar. Ver `probarProcess`.
 *   5. Con la nota **abierta y recién tecleada**, ¿la escritura sobrevive?
 *      `TextFileView.requestSave` está documentado como «Debounced save in 2
 *      seconds from now», así que el disco puede estar hasta 2 s atrasado
 *      respecto del editor, y el volcado posterior del buffer pisaría lo que
 *      `vault.process` acaba de escribir. Ver `probarEditorAbierto`.
 *
 * ## La lección que hereda de `espia.js`
 *
 * **Un instrumento sin verificar mide el instrumento.** Acá el riesgo es menor
 * que en el espía de transacciones —esto solo escucha, no envuelve un
 * `dispatch`— pero el logueo va igual adentro de un `try`: un error en el
 * `console.log` no puede convertirse en un error del handler de Obsidian.
 *
 *   espiaEventos.on()      encender
 *   espiaEventos.off()     apagar y desregistrar
 *   espiaEventos.marcar()  poner una marca antes de escribir, para medir la
 *                          demora hasta el evento
 *   espiaEventos.tabla()   resumen de lo registrado
 *
 *   await espiaEventos.probarProcess()        sondas 3 y 4
 *   await espiaEventos.probarEditorAbierto()  sonda 5
 */
(() => {
  const NOTAS = /tareas_/; // solo las notas que le importan al plugin

  /**
   * Las sondas que **escriben** solo tocan la nota de prueba.
   *
   * No es prudencia decorativa: `tareas_COLE.md` tiene 309 tareas y está en
   * Sync. Un instrumento de medición no tiene por qué poder tocarla, y si no
   * puede, no hay forma de que un error de tipeo en la consola la toque.
   */
  const PRUEBA = "0_inbox/tareas_PRUEBA.md";

  // Cada referencia con **su** emisor: `offref` es por emisor, y llamarlo con
  // una referencia ajena es pedirle a la instrumentación que falle sola.
  const refs = [];
  const registrar = (emisor, ref) => refs.push({ emisor, ref });
  const registro = [];
  let marca = null;

  const t = () => Math.round(performance.now());
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

  function anotar(evento, path, extra) {
    try {
      const ahora = t();
      const desdeMarca = marca === null ? null : ahora - marca;
      registro.push({ evento, path, ms: ahora, desdeMarca, ...extra });
      console.log(
        `[${String(ahora).padStart(7)}ms] ${evento.padEnd(9)} ${path}` +
          (desdeMarca === null ? "" : `   ← ${desdeMarca}ms desde la marca`) +
          (extra?.bytes === undefined ? "" : `   ${extra.bytes} bytes`),
      );
    } catch (err) {
      console.warn("espía de eventos: falló el logueo —", err);
    }
  }

  function on() {
    off();

    // El que le importa al store: trae el contenido, así que no hay que releer.
    registrar(
      app.metadataCache,
      app.metadataCache.on("changed", (file, data) => {
        if (!NOTAS.test(file.path)) return;
        anotar("changed", file.path, { bytes: data.length });
      }),
    );

    // `modify` llega antes que `changed` y sin contenido. Se registra para ver
    // la distancia entre los dos: es el retraso que el store va a tener si
    // espera al `changed` en vez de alimentarse de lo que devuelve `process`.
    registrar(
      app.vault,
      app.vault.on("modify", (file) => {
        if (!NOTAS.test(file.path)) return;
        anotar("modify", file.path, {});
      }),
    );

    // `changed` NO dispara al renombrar, por rendimiento: está en la
    // documentación de la API y por eso el store necesita estos dos.
    registrar(
      app.vault,
      app.vault.on("rename", (file, viejo) => {
        if (!NOTAS.test(file.path) && !NOTAS.test(viejo)) return;
        anotar("rename", `${viejo} → ${file.path}`, {});
      }),
    );
    registrar(
      app.vault,
      app.vault.on("delete", (file) => {
        if (!NOTAS.test(file.path)) return;
        anotar("delete", file.path, {});
      }),
    );

    console.log(
      "espía de eventos ENCENDIDO. Escribí en una nota de tareas y mirá qué llega.\n" +
        "  espiaEventos.resumen()   ← sondas 1 y 2, después de teclear un rato\n" +
        "Sondas que escriben (solo sobre " + PRUEBA + "):\n" +
        "  await espiaEventos.probarProcess()\n" +
        "  await espiaEventos.probarEditorAbierto()",
    );
  }

  function off() {
    for (const { emisor, ref } of refs.splice(0)) emisor.offref(ref);
  }

  /** El archivo de prueba, o `null` con el motivo ya impreso. */
  function archivoDePrueba() {
    const f = app.vault.getFileByPath(PRUEBA);
    if (!f) console.error(`no existe ${PRUEBA}. Creala antes de correr las sondas.`);
    return f ?? null;
  }

  /** Cuántos eventos de cada tipo hubo desde `desde`, esperando `ms`. */
  async function contarDesde(desde, ms) {
    await esperar(ms);
    const nuevos = registro.slice(desde);
    return {
      modify: nuevos.filter((r) => r.evento === "modify").length,
      changed: nuevos.filter((r) => r.evento === "changed").length,
    };
  }

  /**
   * Sondas 3 y 4: qué hace `vault.process` cuando no hay nada que cambiar.
   *
   * La 3 pregunta si devolver `data` intacto igual escribe —o sea, si el
   * camino de «no se pudo ubicar la línea» toca el archivo igual, que sobre un
   * vault en Sync es ruido que nadie pidió—. La 4 pregunta si tirar adentro de
   * `fn` es una forma limpia de abortar sin escribir.
   *
   * No suponer ninguna de las dos: `process` promete atomicidad, no promete
   * nada sobre estos dos casos.
   */
  async function probarProcess() {
    const f = archivoDePrueba();
    if (!f) return;

    const antes = await app.vault.cachedRead(f);
    const mtime0 = f.stat.mtime;

    console.log("\n=== sonda 3: process que devuelve el contenido igual ===");
    let i = registro.length;
    marca = t();
    await app.vault.process(f, (d) => d);
    const s3 = await contarDesde(i, 3000);
    const mtime3 = app.vault.getFileByPath(PRUEBA).stat.mtime;
    console.log(
      `  eventos: modify×${s3.modify} changed×${s3.changed}` +
        `   mtime ${mtime3 === mtime0 ? "IGUAL" : "CAMBIÓ"}`,
    );
    console.log(
      s3.modify === 0 && mtime3 === mtime0
        ? "  ⇒ devolver `data` intacto NO escribe. El camino de «no ubicada» puede devolverlo."
        : "  ⇒ devolver `data` intacto ESCRIBE igual. Hay que tirar para abortar.",
    );

    console.log("\n=== sonda 4: process que tira ===");
    i = registro.length;
    marca = t();
    let tiro = false;
    try {
      await app.vault.process(f, () => {
        throw new Error("sonda del espía");
      });
    } catch (err) {
      tiro = true;
      console.log(`  la promesa rechazó: ${err.message}`);
    }
    const s4 = await contarDesde(i, 2000);
    const ahora = await app.vault.cachedRead(app.vault.getFileByPath(PRUEBA));
    console.log(
      `  rechazó=${tiro}  eventos: modify×${s4.modify} changed×${s4.changed}` +
        `   contenido ${ahora === antes ? "INTACTO" : "CAMBIÓ"}`,
    );
    console.log(
      tiro && s4.modify === 0 && ahora === antes
        ? "  ⇒ tirar adentro de `fn` aborta sin escribir. Es una salida limpia."
        : "  ⇒ tirar NO es una salida limpia. Revisar antes de usarlo.",
    );
    marca = null;
  }

  /**
   * Sonda 5: la nota abierta, recién tecleada, y una escritura por `process`.
   *
   * `TextFileView.requestSave` es «Debounced save in 2 seconds from now». Si el
   * editor todavía no volcó su buffer, `process` escribe sobre un disco
   * atrasado y el volcado posterior **pisa** lo escrito. Esa es la falla que
   * `ubicarLinea` no puede atajar: adentro de `process` el disco se ve
   * consistente.
   *
   * **El tecleo lo hace la sonda**, no la mano. Para correr un comando en la
   * consola hay que salir del editor, y salir puede disparar el guardado justo
   * lo que se quiere medir: la ventana se cerraría sola y la sonda mediría el
   * instrumento. Escribiendo por la API del editor —que es el mismo camino que
   * una tecla— la ventana está garantizada abierta cuando `process` corre.
   *
   * Deja dos líneas de basura en la nota de prueba, las dos con la marca
   * «sonda del espía». Se borran a mano; para eso está la nota de prueba.
   */
  async function probarEditorAbierto({ conSave = false, tecleando = true } = {}) {
    const f = archivoDePrueba();
    if (!f) return;

    const vistas = app.workspace
      .getLeavesOfType("markdown")
      .map((l) => l.view)
      .filter((v) => v.file?.path === PRUEBA);
    if (vistas.length === 0) {
      console.error(`abrí ${PRUEBA} en una pestaña, tecleá algo, y volvé a correr esto.`);
      return;
    }

    console.log(`\n=== sonda 5: editor abierto (conSave=${conSave}) ===`);

    if (tecleando) {
      // Por la API del editor, que es por donde pasa una tecla: ensucia el
      // buffer y arranca el `requestSave` de 2 segundos, igual que la mano.
      const ed = vistas[0].editor;
      const fin = { line: ed.lastLine(), ch: ed.getLine(ed.lastLine()).length };
      ed.replaceRange(`\n<!-- sonda del espía: tecleado ${Date.now()} -->`, fin);
      console.log("  tecleado por la API del editor; el buffer quedó sucio recién ahora");
    }

    const enDisco = await app.vault.cachedRead(f);
    const enEditor = vistas[0].getViewData();
    console.log(
      `  disco ${enDisco.length} bytes · editor ${enEditor.length} bytes · ` +
        (enDisco === enEditor
          ? "IGUALES ← el editor ya guardó: la ventana no existe en este momento"
          : "DISTINTOS ← la ventana existe, la sonda vale"),
    );

    if (conSave) {
      const t0 = t();
      await Promise.all(vistas.map((v) => v.save()));
      console.log(`  save() de ${vistas.length} vista(s) en ${t() - t0}ms`);
    }

    // La marca es una línea al final: no toca ninguna tarea y se ve enseguida.
    const MARCA = `\n<!-- sonda del espía ${Date.now()} -->`;
    marca = t();
    await app.vault.process(f, (d) => d + MARCA);
    console.log("  escrito. Esperando 5s a ver si el editor lo pisa…");
    await esperar(5000);

    const despues = await app.vault.cachedRead(app.vault.getFileByPath(PRUEBA));
    const sobrevivio = despues.includes(MARCA.trim());
    console.log(
      sobrevivio
        ? "  ⇒ la escritura SOBREVIVIÓ."
        : "  ⇒ la escritura FUE PISADA por el volcado del editor. El save() previo es obligatorio.",
    );
    console.log(`  (borrá la línea de la sonda a mano: buscá «sonda del espía» en ${PRUEBA})`);
    marca = null;
    return sobrevivio;
  }

  /** La mediana de una lista de números, o `null` si está vacía. */
  function mediana(xs) {
    if (xs.length === 0) return null;
    const o = [...xs].sort((a, b) => a - b);
    return o[Math.floor(o.length / 2)];
  }

  /**
   * Sondas 1 y 2, ya calculadas: cada cuánto llega `changed` y cuánto tarda.
   *
   * Existe porque leer la tabla a ojo es donde se cuela el error. Las dos
   * preguntas que responde son las que deciden el debounce del plugin:
   *
   *   - **Cada cuánto llega `changed` mientras alguien escribe.** Si Obsidian ya
   *     lo espacia, un debounce propio solo agrega latencia entre la acción y el
   *     redibujo.
   *   - **Cuánto va de `modify` a `changed`.** Es el retraso que el store tendría
   *     si esperara al evento en vez de alimentarse de lo que devuelve `process`.
   */
  function resumen() {
    const changed = registro.filter((r) => r.evento === "changed");
    const modify = registro.filter((r) => r.evento === "modify");

    const huecos = [];
    for (let i = 1; i < changed.length; i++) {
      if (changed[i].path === changed[i - 1].path) huecos.push(changed[i].ms - changed[i - 1].ms);
    }

    // Cada `changed` con el `modify` más cercano que lo precede, del mismo archivo.
    const demoras = [];
    for (const c of changed) {
      const previos = modify.filter((m) => m.path === c.path && m.ms <= c.ms);
      if (previos.length) demoras.push(c.ms - previos[previos.length - 1].ms);
    }

    console.log("\n=== sondas 1 y 2 ===");
    console.log(`  eventos: modify×${modify.length}  changed×${changed.length}`);
    console.log(
      `  hueco entre changed consecutivos (ms): mín ${huecos.length ? Math.min(...huecos) : "-"}` +
        ` · mediana ${mediana(huecos) ?? "-"} · máx ${huecos.length ? Math.max(...huecos) : "-"}`,
    );
    console.log(
      `  demora modify → changed (ms): mín ${demoras.length ? Math.min(...demoras) : "-"}` +
        ` · mediana ${mediana(demoras) ?? "-"} · máx ${demoras.length ? Math.max(...demoras) : "-"}`,
    );
    console.log(
      "  ⇒ si el hueco mediano ya es de cientos de ms, Obsidian espacia solo\n" +
        "    y un debounce propio arriba solo agrega latencia.",
    );
    return { huecos, demoras };
  }

  window.espiaEventos = {
    on,
    off() {
      off();
      console.log("espía de eventos apagado");
    },
    marcar() {
      marca = t();
      console.log(`--- marca en ${marca}ms ---`);
    },
    tabla() {
      console.table(registro);
      return registro;
    },
    resumen,
    probarProcess,
    probarEditorAbierto,
    registro,
  };
  on();
})();
