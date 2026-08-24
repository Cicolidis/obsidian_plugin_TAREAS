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
 * Tres preguntas que este espía responde:
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
 */
(() => {
  const NOTAS = /tareas_/; // solo las notas que le importan al plugin

  // Cada referencia con **su** emisor: `offref` es por emisor, y llamarlo con
  // una referencia ajena es pedirle a la instrumentación que falle sola.
  const refs = [];
  const registrar = (emisor, ref) => refs.push({ emisor, ref });
  const registro = [];
  let marca = null;

  const t = () => Math.round(performance.now());

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
        "Para medir la demora de una escritura del plugin:\n" +
        "  espiaEventos.marcar(); await app.vault.process(archivo, (d) => d + ' ');",
    );
  }

  function off() {
    for (const { emisor, ref } of refs.splice(0)) emisor.offref(ref);
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
    registro,
  };
  on();
})();
