import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { filaDe, type ContextoDeFila, type Favoritos } from "../src/botones.js";
import {
  construirFila,
  FilaMarker,
  filaEnElMargen,
  marcadorDeLinea,
  type OpcionesDeFila,
} from "../src/editor/filaDeBotones.js";
import { conDocumentoFalso, NodoFalso } from "./domFalso.js";

/**
 * Corre **sin DOM y sin Obsidian**. Construir un `FilaMarker` no toca el
 * documento: quien crea elementos es `toDOM`, y para eso está `domFalso.ts`.
 *
 * Hasta el 30/09/2026 la fila tenía además una forma adentro de la línea —un
 * widget en un `ViewPlugin`— y la mitad de este archivo era sobre ella: que no
 * declarara altura (§5.5), dónde se anclaba, que su clic no subiera. Se eligió
 * el margen y esos tests se fueron con el widget.
 */
const FAV: Favoritos = { primario: "foco", secundario: "mudanza" };

/** Un día fijo: la etiqueta de una cíclica lo usa, y un test no puede depender del reloj. */
const HOY = "2026-09-03";

const opciones = (
  favoritos: Favoritos = FAV,
  indicadores = { fecha: false, recurrencia: false },
): OpcionesDeFila => ({
  favoritos: () => favoritos,
  conEliminar: () => false,
  indicadores: () => indicadores,
  hoy: () => HOY,
  alClic: () => {},
  dibujarIcono: () => {},
});

const CTX0: ContextoDeFila = { favoritos: FAV, conEliminar: false, indicadores: { fecha: false, recurrencia: false }, hoy: HOY };

const marcador = (linea: string, favoritos: Favoritos = FAV) =>
  new FilaMarker(filaDe(linea, { ...CTX0, favoritos })!, opciones(favoritos));

// ------------------------------------------------------- qué líneas la llevan

describe("qué líneas la llevan", () => {
  it("solo las tareas", () => {
    const cache = new Map<string, FilaMarker>();
    const lineas = [
      "## sección",
      "- [ ] una tarea",
      "- una nota de tarea",
      "- [ ] ",
      "texto suelto",
      "\t- [x] hija hecha",
    ];
    const con = lineas.map((l) => marcadorDeLinea(l, CTX0, opciones(), cache) !== null);
    expect(con).toEqual([false, true, false, false, false, true]);
  });
});

// ------------------------------------------------------------------ el eq()

describe("eq() y la caché: qué obliga a rehacer el DOM y qué no", () => {
  /**
   * Sin `eq`, cada redibujado tira el DOM y lo rehace: se pierde el hover en el
   * medio del gesto y se paga en cada tecla. Y la línea no entra en la clave: si
   * entrara, teclear en cualquier línea de más arriba reharía todas las de abajo.
   */
  it("dos tareas con el mismo estado comparten marcador aunque estén en líneas distintas", () => {
    const cache = new Map<string, FilaMarker>();
    const a = marcadorDeLinea("- [ ] primera %%t:wb=foco%%", CTX0, opciones(), cache);
    const b = marcadorDeLinea("- [ ] otra distinta %%t:wb=foco%%", CTX0, opciones(), cache);
    expect(a).not.toBeNull();
    expect(a).toBe(b);
  });

  it("cambiar el workbench de la tarea las hace distintas", () => {
    expect(marcador("- [ ] a %%t:wb=foco%%").eq(marcador("- [ ] a"))).toBe(false);
    expect(marcador("- [ ] a %%t:wb=foco%%").eq(marcador("- [ ] a %%t:wb=mudanza%%"))).toBe(false);
  });

  it("un token roto la hace distinta de una sana", () => {
    expect(marcador("- [ ] a %%t:id=A3F2%%").eq(marcador("- [ ] a"))).toBe(false);
  });

  it("cambiar los favoritos la hace distinta", () => {
    const otros: Favoritos = { primario: "otro", secundario: "mudanza" };
    expect(marcador("- [ ] x").eq(marcador("- [ ] x", otros))).toBe(false);
  });
});

// ------------------------------------------------------------- el margen

describe("la fila en su margen propio", () => {
  /**
   * Que **no aporte decoraciones** es lo que la mantiene afuera de la discusión
   * de la §5.5: un margen no puede cambiar la altura de una línea ni entrar al
   * mapa de alturas, porque no es una decoración. Si algún día alguien le
   * agregara una, habría que volver a pensar de dónde sale.
   */
  it("no aporta ninguna decoración", () => {
    const st = EditorState.create({
      doc: "- [ ] a",
      extensions: [filaEnElMargen(() => true, opciones())],
    });
    expect(st.facet(EditorView.decorations)).toHaveLength(0);
  });
});

// ------------------------------------------- a dónde llega el clic (§13.0)

/**
 * El bug que estos tests existen para no volver a cometer.
 *
 * En el estilo «columna» los cuatro botones se veían, daban la manito del
 * cursor y **no hacían nada**. Sin error en la consola, sin aviso, sin nada.
 *
 * El motivo: el botón hacía `stopPropagation()` en su propio `click`, y el
 * margen de CodeMirror engancha sus `domEventHandlers` **en el `.cm-gutter`**,
 * que es un ancestro, **en fase de burbujeo** (leído en `@codemirror/view`
 * 6.38.6, `SingleGutterView`). El clic moría antes de llegar.
 *
 * Ningún test lo agarró porque ninguno podía construir el DOM, y mirarlo a ojo
 * tampoco alcanzaba: lo que se ve es idéntico. Cuando el ojo no llega, la
 * regla se convierte en algo que el pipeline pueda comprobar — y para eso
 * alcanza con un DOM falso que reproduzca **la forma que importa**: burbujeo y
 * `stopPropagation`.
 */
describe("a dónde llega el clic de un botón", () => {
  const armar = () => {
    const fila = filaDe("- [ ] una tarea", { favoritos: FAV })!;
    const ancla = construirFila(fila, opciones()) as unknown as NodoFalso;
    // El ancestro que en Obsidian es el `.cm-gutter`.
    const gutter = new NodoFalso("div");
    gutter.className = "cm-gutter";
    gutter.appendChild(ancla);
    const botones = ancla.querySelectorAll("button");
    return { gutter, ancla, botones };
  };

  it("en el margen, el clic **llega al ancestro**: es quien sabe la línea", () => {
    conDocumentoFalso(() => {
      const { gutter, botones } = armar();
      expect(botones.length).toBeGreaterThan(0);
      for (const boton of botones) {
        let llego = false;
        gutter.addEventListener("click", () => void (llego = true));
        NodoFalso.despachar(boton, "click");
        expect(llego, `el botón ${boton.className}`).toBe(true);
      }
    });
  });

  it("el `mousedown` se corta: es lo que evita que un arrastre seleccione", () => {
    conDocumentoFalso(() => {
      const { gutter, botones } = armar();
      let llego = false;
      gutter.addEventListener("mousedown", () => void (llego = true));
      NodoFalso.despachar(botones[0]!, "mousedown");
      expect(llego).toBe(false);
    });
  });

  it("el marcador de verdad: sus botones llegan al ancestro **y** dicen cuál son", () => {
    // El camino completo del margen, con la clase que corre en Obsidian. Llegar
    // no alcanza: el `domEventHandlers` reconoce el botón por su `data-accion`,
    // así que las dos cosas tienen que valer juntas o el clic llega y se pierde.
    conDocumentoFalso(() => {
      const fila = filaDe("- [ ] una tarea", { favoritos: FAV })!;
      const ancla = new FilaMarker(fila, opciones()).toDOM() as unknown as NodoFalso;
      const gutter = new NodoFalso("div");
      gutter.appendChild(ancla);

      const acciones: string[] = [];
      gutter.addEventListener("click", (e) => {
        acciones.push(e.target.getAttribute("data-accion") ?? "SIN data-accion");
      });
      for (const boton of ancla.querySelectorAll("button")) {
        NodoFalso.despachar(boton, "click");
      }
      // Al revés del canónico: en el margen el mouse llega desde el texto, así
      // que el 🗑 tiene que quedar el más lejos. Ver `ordenDelMargen`.
      expect(acciones).toEqual([...fila.botones].reverse().map((b) => b.accion));
    });
  });
});

describe("el orden de la fila en el margen", () => {
  /**
   * El orden canónico de `filaDe` es el de la §13.0 —`★ ◐ → ⋯ 🗑`— y es el
   * correcto con la fila **a la derecha** del texto: el mouse llega desde la
   * izquierda y toca primero el ★, que es el más usado, y último el 🗑.
   *
   * En el margen el mouse llega **desde el texto**, o sea desde la derecha, y
   * el orden canónico deja el botón que borra sin preguntar como el primero que
   * uno se cruza. La sonda de hover de la verificación lo mostró en
   * coordenadas: `eliminar` en x=235 y `wb-primario` en x=153, con el texto
   * empezando cerca de x=280.
   */
  const conCinco = () => filaDe("- [ ] x", { favoritos: FAV, conEliminar: true })!;

  it("el orden canónico es el de la §13.0, con el 🗑 último", () => {
    expect(conCinco().botones.map((b) => b.accion)).toEqual([
      "wb-primario",
      "wb-secundario",
      "popover",
      "menu",
      "eliminar",
    ]);
  });

  it("el marcador del margen lo dibuja al revés", () => {
    conDocumentoFalso(() => {
      const ancla = new FilaMarker(conCinco(), opciones()).toDOM() as unknown as NodoFalso;
      expect(
        ancla.querySelectorAll("button").map((b) => b.getAttribute("data-accion")),
      ).toEqual(["eliminar", "menu", "popover", "wb-secundario", "wb-primario"]);
    });
  });

  it("y el 🗑 queda **el más lejos** del texto, que es el punto", () => {
    conDocumentoFalso(() => {
      const ancla = new FilaMarker(conCinco(), opciones()).toDOM() as unknown as NodoFalso;
      const acciones = ancla.querySelectorAll("button").map((b) => b.getAttribute("data-accion"));
      // El texto está a la derecha, así que el último del arreglo es el más
      // cercano a él y el primero es el más lejano.
      expect(acciones.at(-1)).toBe("wb-primario");
      expect(acciones[0]).toBe("eliminar");
    });
  });

  it("cada botón sigue llevando su `data-accion`, que es cómo se lo reconoce", () => {
    // Invertir el arreglo y no la marca dejaría el clic andando sobre el botón
    // equivocado, que es peor que no andar.
    conDocumentoFalso(() => {
      const ancla = new FilaMarker(conCinco(), opciones()).toDOM() as unknown as NodoFalso;
      for (const b of ancla.querySelectorAll("button")) {
        const accion = b.getAttribute("data-accion");
        expect(b.className, `${accion}`).toContain(`tareas-boton-${accion}`);
      }
    });
  });
});

/**
 * Los dos indicadores del paso 6c, del lado del DOM.
 *
 * Lo que estos tests fijan es lo que ningún test de `botones.ts` puede: dónde
 * quedan **en el margen**, que es donde la fila se dibuja al revés, y que dos
 * tareas con fechas distintas no compartan marcador.
 */
describe("los indicadores en la fila dibujada (paso 6c)", () => {
  const CTX = {
    favoritos: FAV,
    conEliminar: true,
    indicadores: { fecha: true, recurrencia: true },
    hoy: HOY,
  };
  const conSiete = (texto = "- [ ] x") => filaDe(texto, CTX)!;
  const ops = () => opciones(FAV, { fecha: true, recurrencia: true });

  it("en el margen quedan **los más lejos del texto**, y el ★ no se mueve", () => {
    conDocumentoFalso(() => {
      const ancla = new FilaMarker(conSiete(), ops()).toDOM() as unknown as NodoFalso;
      const acciones = ancla.querySelectorAll("button").map((b) => b.getAttribute("data-accion"));
      // El texto está a la derecha: el último del arreglo es el más cercano.
      expect(acciones.at(-1)).toBe("wb-primario");
      expect(acciones.slice(0, 2)).toEqual(["recurrencia", "fecha"]);
    });
  });

  it("dos fechas distintas NO comparten marcador", () => {
    // Sin esto, la caché de marcadores le da a una tarea el DOM de otra y el
    // tooltip muestra la fecha equivocada.
    const a = new FilaMarker(filaDe("- [ ] x %%t:due=2026-09-07%%", CTX)!, ops());
    const b = new FilaMarker(filaDe("- [ ] x %%t:due=2026-09-08%%", CTX)!, ops());
    expect(a.eq(b)).toBe(false);
  });

  it("ni dos grupos distintos", () => {
    const a = new FilaMarker(filaDe("- [ ] x %%t:rec=lunes%%", CTX)!, ops());
    const b = new FilaMarker(filaDe("- [ ] x %%t:rec=mensual%%", CTX)!, ops());
    expect(a.eq(b)).toBe(false);
  });

  it("y dos tareas en el mismo estado sí, que es para lo que existe la caché", () => {
    const a = new FilaMarker(filaDe("- [ ] una %%t:due=2026-09-07%%", CTX)!, ops());
    const b = new FilaMarker(filaDe("- [ ] otra %%t:due=2026-09-07%%", CTX)!, ops());
    expect(a.eq(b)).toBe(true);
  });

  it("el botón apagado **está en el DOM**, con su lugar y sin `display: none`", () => {
    // La regla que impide que el ★ se mueva y que el margen se ensanche al
    // scrollear: lo que apaga es la opacidad, no la ausencia.
    conDocumentoFalso(() => {
      const ancla = new FilaMarker(conSiete("- [ ] sin fecha"), ops()).toDOM() as unknown as NodoFalso;
      const botones = ancla.querySelectorAll("button");
      expect(botones).toHaveLength(7);
      const fecha = botones.find((b) => b.getAttribute("data-accion") === "fecha")!;
      expect(fecha.className).not.toContain("is-activo");
    });
  });

  it("y el DOM mide lo mismo con fecha y sin fecha", () => {
    conDocumentoFalso(() => {
      const conF = new FilaMarker(conSiete("- [ ] x %%t:due=2026-09-07%%"), ops())
        .toDOM() as unknown as NodoFalso;
      const sinF = new FilaMarker(conSiete("- [ ] x"), ops()).toDOM() as unknown as NodoFalso;
      expect(conF.querySelectorAll("button")).toHaveLength(
        sinF.querySelectorAll("button").length,
      );
    });
  });
});
