/*
 * Qué hay entre los números de línea y el primer botón.
 *
 * Se pega entero en la consola de Obsidian (Ver → Alternar herramientas de
 * desarrollo) con una nota de tareas abierta en Live Preview y el estilo de fila
 * en «Columna en el margen izquierdo».
 *
 * Existe porque una cuenta y una pantalla no coincidieron. La cuenta decía que
 * el hueco entre el número y el ★ era de unos 7 px —3 del `padding` del margen
 * de números de CodeMirror, 2 de la pastilla y el aire del botón— y en pantalla
 * se veían unos 45. **Hay algo en el medio que la cuenta no contempla**, y la
 * única forma de saber qué es preguntárselo al navegador.
 *
 * Imprime, en orden de izquierda a derecha, cada margen que CodeMirror está
 * dibujando, con su ancho y sus rellenos. Si aparece uno que no es ni el de los
 * números ni el nuestro, ese es el que sobra — y la respuesta no es correr el
 * nuestro con un margen negativo, sino cambiar dónde se registra.
 */
(() => {
  const vista = app.workspace.activeEditor?.editor?.cm;
  if (!vista) {
    console.warn("Abrí una nota de tareas en modo edición y volvé a pegar esto.");
    return;
  }

  const contenedor = vista.dom.querySelector(".cm-gutters");
  if (!contenedor) {
    console.warn("Esta nota no tiene márgenes: encendé los números de línea.");
    return;
  }

  const px = (v) => `${Math.round(parseFloat(v) * 10) / 10}px`;

  const filas = [];
  const marco = contenedor.getBoundingClientRect();
  for (const g of contenedor.children) {
    const c = getComputedStyle(g);
    const r = g.getBoundingClientRect();
    filas.push({
      clases: g.className,
      "izquierda (rel.)": px(r.left - marco.left),
      ancho: px(r.width),
      "margin-inline-start": px(c.marginInlineStart || c.marginLeft),
      "padding-start": px(c.paddingInlineStart || c.paddingLeft),
      "padding-end": px(c.paddingInlineEnd || c.paddingRight),
    });
  }
  console.log("%s", `márgenes de izquierda a derecha (${filas.length}):`);
  console.table(filas);

  const c = getComputedStyle(contenedor);
  console.log(
    "%s",
    `.cm-gutters → ancho ${px(contenedor.getBoundingClientRect().width)} · ` +
      `margin-inline-end ${px(c.marginInlineEnd || c.marginRight)}`,
  );

  // Y lo que se ve de verdad: del último dígito al primer botón.
  const numero = contenedor.querySelector(".cm-lineNumbers .cm-gutterElement");
  const boton = contenedor.querySelector(".tareas-margen .tareas-boton");
  if (numero && boton) {
    const a = numero.getBoundingClientRect();
    const b = boton.getBoundingClientRect();
    console.log(
      "%s",
      `hueco visible: del borde derecho del número (${px(a.right)}) ` +
        `al borde izquierdo del botón (${px(b.left)}) → ${px(b.left - a.right)}`,
    );
  } else {
    console.log("%s", "no encontré un número o un botón: ¿la nota tiene tareas a la vista?");
  }

  // ------------------------------------------------------ el eje vertical
  //
  // Lo mismo para el otro eje, y por la misma razón: dos correcciones a ojo no
  // alcanzaron. Lo que importa no son los bordes sino los **centros**, que es
  // lo que el ojo compara: el centro del botón contra el centro del checkbox y
  // contra el del número de su misma línea.
  const celda = [...contenedor.querySelectorAll(".tareas-margen .cm-gutterElement")].find(
    (e) => e.querySelector(".tareas-boton"),
  );
  if (!celda) {
    console.log("%s", "no hay ninguna fila de botones a la vista para medir el alto.");
    return;
  }

  const rCelda = celda.getBoundingClientRect();
  const centro = (r) => r.top + r.height / 2;

  /** La línea de contenido que está a la misma altura que esta celda. */
  const linea = [...vista.dom.querySelectorAll(".cm-content .cm-line")]
    .map((l) => ({ l, r: l.getBoundingClientRect() }))
    .find(({ r }) => r.top <= rCelda.top + 2 && r.bottom >= rCelda.top + 2);

  const primerBoton = celda.querySelector(".tareas-boton");
  const filas2 = [
    {
      qué: "celda del margen",
      top: px(rCelda.top),
      alto: px(rCelda.height),
      centro: px(centro(rCelda)),
    },
    {
      qué: "botón ★",
      top: px(primerBoton.getBoundingClientRect().top),
      alto: px(primerBoton.getBoundingClientRect().height),
      centro: px(centro(primerBoton.getBoundingClientRect())),
    },
  ];

  if (linea) {
    const c = getComputedStyle(linea.l);
    filas2.push({
      qué: "línea de texto",
      top: px(linea.r.top),
      alto: px(linea.r.height),
      centro: px(centro(linea.r)),
    });
    console.log(
      "%s",
      `la línea: padding-top ${c.paddingTop} · padding-bottom ${c.paddingBottom} · ` +
        `line-height ${c.lineHeight} · clases «${linea.l.className}»`,
    );

    const caja = linea.l.querySelector('input[type="checkbox"]');
    if (caja) {
      const r = caja.getBoundingClientRect();
      filas2.push({ qué: "checkbox", top: px(r.top), alto: px(r.height), centro: px(centro(r)) });
    }
    const antes = getComputedStyle(linea.l, "::before");
    if (antes && antes.content !== "none") {
      console.log(
        "%s",
        `el filete (::before): top ${antes.top} · height ${antes.height} · ` +
          `background-size ${antes.backgroundSize}`,
      );
    }
  }

  const numeroDeEsaLinea = [...contenedor.querySelectorAll(".cm-lineNumbers .cm-gutterElement")]
    .map((e) => ({ e, r: e.getBoundingClientRect() }))
    .find(({ r }) => Math.abs(r.top - rCelda.top) < 2);
  if (numeroDeEsaLinea) {
    filas2.push({
      qué: "número de línea",
      top: px(numeroDeEsaLinea.r.top),
      alto: px(numeroDeEsaLinea.r.height),
      centro: px(centro(numeroDeEsaLinea.r)),
    });
  }

  console.log("%s", "alturas (lo que importa es la columna «centro»):");
  console.table(filas2);

  if (linea) {
    const dBoton = centro(primerBoton.getBoundingClientRect());
    const caja = linea.l.querySelector('input[type="checkbox"]');
    if (caja) {
      const d = dBoton - centro(caja.getBoundingClientRect());
      console.log(
        "%s",
        `desfasaje del botón contra el checkbox: ${px(d)} ` +
          `(negativo = el botón está más arriba). Ese es el valor que hay que ` +
          `sumarle a --tareas-margen-nudge.`,
      );
    }
  }

})();
