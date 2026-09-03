/*
 * Espía del ciclo de medición de CodeMirror. Se pega entero en la consola de
 * Obsidian (Ver → Alternar herramientas de desarrollo).
 *
 * ## Por qué existe
 *
 * La §5.5 de la spec tomó una línea de base antes de tocar el editor: con la
 * ventana angosta y scrolleando hacia arriba, la consola tira
 * `Measure loop restarted more than 5 times` ×1 y
 * `Viewport failed to stabilize` ×4. La predicción falsable era: si esa cuenta
 * sube, la regresión es del plugin.
 *
 * **Se pidió en seis verificaciones y no reprodujo la base ni una vez.** La
 * última fue explícita: «no muestra nada la consola», o sea cero, no 1 y 4. Una
 * comprobación que en seis vueltas no produjo un número no está protegiendo
 * nada: la predicción solo puede dispararse si la base es reproducible.
 *
 * De las dos explicaciones posibles —que las condiciones no se estén
 * reproduciendo a mano, o que la base fuera un accidente de aquella tarde— no se
 * puede elegir mirando la consola a ojo, que es lo que se venía haciendo. Este
 * script convierte la indicación en una medición.
 *
 * ## Las tres cosas que hace, y por qué cada una
 *
 * 1. **Cuenta los avisos.** Salen por `console.warn`, verificado adentro del
 *    asar 1.13.7 instalado y no deducido:
 *
 *        if(c>5){console.warn(this.measureRequests.length
 *          ? "Measure loop restarted more than 5 times"
 *          : "Viewport failed to stabilize");break}
 *
 * 2. **Demuestra que el parche está puesto**, haciendo pasar un aviso
 *    sintético por él antes de medir. Es la lección de la sesión 6, donde una
 *    sonda informó cero tres veces y el cero era del instrumento: parcheaba una
 *    instancia en vez del prototipo, y se cerraba antes de empezar. **Antes de
 *    creerle a un cero, hay que comprobar que el instrumento mide lo que dice.**
 *
 * 3. **Scrollea solo.** Es lo que más probablemente faltaba: «angostá la ventana
 *    y scrolleá hacia arriba» son condiciones que a mano se cumplen distinto
 *    cada vez. Acá el recorrido es el mismo siempre y queda dicho cuántos pasos
 *    y desde dónde.
 *
 * ## Y no tiene reloj propio
 *
 * Se consulta a mano con `medicion.leer()`. La sonda de la sesión 6 medía diez
 * segundos **desde que se pegaba** y se cerraba antes de que uno volviera a
 * Obsidian: un instrumento con reloj propio miente sin avisar; los que se
 * consultan a mano, no.
 */

(() => {
  if (window.medicion) {
    console.log("%s", "Ya había un espía puesto. Corré medicion.soltar() antes de volver a pegarlo.");
    return;
  }

  const cuenta = { measure: 0, viewport: 0 };
  const original = console.warn;

  console.warn = function (...args) {
    const texto = String(args[0] ?? "");
    if (texto.includes("Measure loop restarted")) cuenta.measure++;
    else if (texto.includes("Viewport failed to stabilize")) cuenta.viewport++;
    return original.apply(this, args);
  };

  // --- La demostración de que el parche ve lo que dice ver ----------------
  // Va **antes** de medir y se descuenta: un verde tiene que significar
  // «conté y no hubo», no «no conté».
  console.warn("Measure loop restarted more than 5 times");
  console.warn("Viewport failed to stabilize");
  const parcheado = cuenta.measure === 1 && cuenta.viewport === 1;
  cuenta.measure = 0;
  cuenta.viewport = 0;

  const vista = () => window.app?.workspace?.activeEditor?.editor?.cm ?? null;

  const medicion = {
    /** Lo que se contó desde el último `reiniciar()`. */
    leer() {
      const v = vista();
      const ancho = v ? Math.round(v.scrollDOM.clientWidth) : null;
      const envuelve = v ? v.contentDOM.classList.contains("cm-lineWrapping") : null;
      console.log("%s", "─".repeat(56));
      console.log("%s", `parche comprobado: ${parcheado ? "sí" : "NO — no le creas al cero"}`);
      console.log("%s", `ancho del editor: ${ancho ?? "?"} px · lineWrapping: ${envuelve ?? "?"}`);
      console.log("%s", `Measure loop restarted:      ${cuenta.measure}   (base de la §5.5: 1)`);
      console.log("%s", `Viewport failed to stabilize: ${cuenta.viewport}   (base de la §5.5: 4)`);
      return { ...cuenta, ancho, envuelve, parcheado };
    },

    reiniciar() {
      cuenta.measure = 0;
      cuenta.viewport = 0;
      console.log("%s", "Contadores en cero.");
    },

    /**
     * El recorrido, siempre el mismo: hasta el fondo, y de ahí hacia **arriba**
     * en `pasos` tramos, con una espera entre cada uno para que el ciclo de
     * medición corra. Hacia abajo no sirve: lo que se mide queda **debajo** del
     * ancla y `diff` es 0 (§5.5).
     */
    async subir(pasos = 40, esperaMs = 60) {
      const v = vista();
      if (!v) {
        console.log("%s", "No hay editor activo. Abrí una nota larga y probá de nuevo.");
        return;
      }
      const dom = v.scrollDOM;
      dom.scrollTop = dom.scrollHeight;
      await new Promise((r) => setTimeout(r, 300));
      this.reiniciar();

      const salto = dom.scrollHeight / pasos;
      for (let i = pasos; i >= 0; i--) {
        dom.scrollTop = salto * i;
        await new Promise((r) => setTimeout(r, esperaMs));
      }
      console.log("%s", `Recorrido: ${pasos} pasos hacia arriba, ${esperaMs} ms cada uno.`);
      return this.leer();
    },

    soltar() {
      console.warn = original;
      delete window.medicion;
      console.log("%s", "Espía sacado.");
    },
  };

  window.medicion = medicion;

  console.log("%s", "─".repeat(56));
  console.log("%s", `Espía de medición puesto. Parche comprobado: ${parcheado ? "sí" : "NO"}`);
  console.log("%s", "  await medicion.subir()   ← el recorrido de la §5.5, y la cuenta");
  console.log("%s", "  medicion.leer()          ← la cuenta de ahora, sin scrollear");
  console.log("%s", "  medicion.reiniciar()     ← contadores en cero");
  console.log("%s", "  medicion.soltar()        ← sacar el espía");
  console.log("%s", "Angostá la ventana antes de correrlo: la base se tomó así.");
})();
