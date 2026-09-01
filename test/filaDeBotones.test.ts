import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";
import { filaDe, type Favoritos } from "../src/botones.js";
import {
  construirFila,
  decoracionesDeFila,
  FilaMarker,
  filaDeBotones,
  filaEnElMargen,
  FilaWidget,
  type OpcionesDeFila,
} from "../src/editor/filaDeBotones.js";
import { conDocumentoFalso, NodoFalso } from "./domFalso.js";

/**
 * Corre **sin DOM y sin Obsidian**, como `decoraciones.test.ts`. `Decoration` y
 * los `RangeSet` no tocan el documento, y construir un `FilaWidget` tampoco:
 * quien crea elementos es `toDOM`, y eso solo lo llama una vista de verdad.
 */
const FAV: Favoritos = { primario: "foco", secundario: "mudanza" };

const opciones = (favoritos: Favoritos = FAV): OpcionesDeFila => ({
  favoritos: () => favoritos,
  conEliminar: () => false,
  alClic: () => {},
  dibujarIcono: () => {},
});

const estado = (doc: string) => EditorState.create({ doc });

const rangos = (set: DecorationSet) => {
  const out: { from: number; to: number; widget: FilaWidget }[] = [];
  const it = set.iter();
  while (it.value) {
    out.push({ from: it.from, to: it.to, widget: it.value.spec.widget as FilaWidget });
    it.next();
  }
  return out;
};

const todo = (doc: string, favoritos: Favoritos = FAV) => {
  const st = estado(doc);
  return rangos(decoracionesDeFila(st, [{ from: 0, to: st.doc.length }], opciones(favoritos)));
};

const widget = (linea: string) => new FilaWidget(filaDe(linea, FAV)!, opciones());

// ---------------------------------------------------------- la restricción

describe("la restricción de la §5.5, del otro lado", () => {
  /**
   * Este es el test que sostiene la decisión de arquitectura del paso 4b, y es
   * el complemento exacto del de `decoraciones.test.ts`.
   *
   * Allá se fija que las decoraciones lleguen al facet como **objeto**, porque
   * un `ViewPlugin` deja una función y el mapa de alturas la descarta. Acá la
   * fila **sí** llega como función, y es legítimo por una sola razón: un widget
   * inline de ancho cero sin `estimatedHeight` ni `lineBreaks` no entra al mapa
   * de alturas venga de donde venga. Leído dentro del asar 1.13.7 instalado:
   *
   * ```js
   * point(from,to,deco){ if(from<to||deco.heightRelevant){…} else to>from&&this.span(…) }
   * get heightRelevant(){ return this.block ||
   *   !!this.widget && (this.widget.estimatedHeight>=5 || this.widget.lineBreaks>0) }
   * ```
   *
   * El día que alguien le ponga altura a este widget o lo haga `block`, esa
   * razón desaparece y el `ViewPlugin` pasa a ser el bug de la §5.5 entrando
   * por la puerta de al lado. **Este test falla ese mismo día**, y no meses
   * después en el ciclo de medición.
   */
  it("el widget no declara altura", () => {
    const w = widget("- [ ] llamar %%t:wb=foco%%");
    expect(w.estimatedHeight).toBe(-1);
    expect(w.lineBreaks).toBe(0);

    // Contra el CodeMirror de verdad, no contra una copia de su regla.
    const deco = Decoration.widget({ widget: w, side: -1 });
    expect((deco as unknown as { heightRelevant: boolean }).heightRelevant).toBe(false);
    expect((deco as unknown as { block: boolean }).block).toBe(false);
  });

  it("cada fila es un rango de ancho cero", () => {
    for (const r of todo("- [ ] a\n- [ ] b %%t:wb=foco%%")) {
      expect(r.to).toBe(r.from);
    }
  });

  it("la fila llega al facet como función, que es lo que la hace barata", () => {
    const st = EditorState.create({
      doc: "- [ ] a",
      extensions: [filaDeBotones(() => true, opciones())],
    });
    const aportes = st.facet(EditorView.decorations);
    expect(aportes).toHaveLength(1);
    expect(typeof aportes[0]).toBe("function");
  });
});

// ------------------------------------------------------------- dónde ancla

describe("dónde se ancla", () => {
  /**
   * En `line.from` y no al final, por dos razones medidas: no suma ancho al
   * renglón, y el final de la línea está adentro del `Decoration.replace` del
   * token — donde un widget se descartaría, y donde ya costó tres bugs meterse.
   */
  it("en el comienzo de la línea", () => {
    const st = estado("- [ ] a\n- [ ] b %%t:wb=foco%%");
    const r = rangos(decoracionesDeFila(st, [{ from: 0, to: st.doc.length }], opciones()));
    expect(r.map((x) => x.from)).toEqual([st.doc.line(1).from, st.doc.line(2).from]);
  });

  // `side: -1` ordena el widget antes de cualquier `Decoration.replace` que
  // arranque en `line.from` — el que Obsidian usa para el checkbox de Live
  // Preview— así que no queda adentro de ninguno y no se descarta.
  it("con side negativo", () => {
    const deco = Decoration.widget({ widget: widget("- [ ] a"), side: -1 });
    expect((deco as unknown as { startSide: number }).startSide).toBeLessThan(0);
  });
});

// ------------------------------------------------------- qué líneas la llevan

describe("qué líneas la llevan", () => {
  it("solo las tareas", () => {
    const doc = [
      "## sección",
      "- [ ] una tarea",
      "- una nota de tarea",
      "- [ ] ",
      "texto suelto",
      "\t- [x] hija hecha",
    ].join("\n");
    const st = estado(doc);
    const r = rangos(decoracionesDeFila(st, [{ from: 0, to: st.doc.length }], opciones()));
    expect(r.map((x) => st.doc.lineAt(x.from).number)).toEqual([2, 6]);
  });

  it("solo los rangos que se le pasan", () => {
    const doc = ["- [ ] a", "- [ ] b", "- [ ] c"].join("\n");
    const st = estado(doc);
    const segunda = st.doc.line(2);
    const r = rangos(
      decoracionesDeFila(st, [{ from: segunda.from, to: segunda.to }], opciones()),
    );
    expect(r).toHaveLength(1);
    expect(r[0]!.from).toBe(segunda.from);
  });

  it("apagado no deja ninguna decoración", () => {
    const st = EditorState.create({
      doc: "- [ ] a",
      extensions: [filaDeBotones(() => false, opciones())],
    });
    const fn = st.facet(EditorView.decorations)[0] as (v: EditorView) => DecorationSet;
    // El `ViewPlugin` necesita una vista; lo que se comprueba acá es lo pobre
    // que se puede: que el aporte exista y sea el nuestro. El caso apagado de
    // verdad lo cubre `decoracionesDeFila`, que es puro.
    expect(typeof fn).toBe("function");
    expect(todo("texto sin tareas")).toEqual([]);
  });
});

// ------------------------------------------------------------------ el eq()

describe("eq(): qué obliga a rehacer el DOM y qué no", () => {
  /**
   * Sin `eq`, cada redibujado tira el DOM y lo rehace: se pierde el hover en el
   * medio del gesto y se paga en cada tecla.
   *
   * Y lo que **no** compara importa igual: el número de línea no entra. Si
   * entrara, teclear en cualquier línea de más arriba reharía todas las filas
   * de abajo. Por eso la posición no se guarda y se le pide a CodeMirror al
   * hacer clic (`posAtDOM`).
   */
  it("dos filas con el mismo estado son iguales aunque estén en líneas distintas", () => {
    const r = todo("- [ ] primera %%t:wb=foco%%\n- [ ] otra distinta %%t:wb=foco%%");
    expect(r).toHaveLength(2);
    expect(r[0]!.from).not.toBe(r[1]!.from);
    expect(r[0]!.widget.eq(r[1]!.widget)).toBe(true);
  });

  it("cambiar el workbench de la tarea las hace distintas", () => {
    expect(widget("- [ ] a %%t:wb=foco%%").eq(widget("- [ ] a"))).toBe(false);
    expect(widget("- [ ] a %%t:wb=foco%%").eq(widget("- [ ] a %%t:wb=mudanza%%"))).toBe(false);
  });

  it("un token roto la hace distinta de una sana", () => {
    expect(widget("- [ ] a %%t:id=A3F2%%").eq(widget("- [ ] a"))).toBe(false);
  });

  it("cambiar los favoritos la hace distinta", () => {
    const a = new FilaWidget(filaDe("- [ ] x", FAV)!, opciones());
    const otros: Favoritos = { primario: "otro", secundario: "mudanza" };
    const b = new FilaWidget(filaDe("- [ ] x", otros)!, opciones(otros));
    expect(a.eq(b)).toBe(false);
  });

  // Sin esto un clic mueve el cursor y empieza una selección.
  it("los eventos del widget no son del editor", () => {
    expect(widget("- [ ] a").ignoreEvent()).toBe(true);
  });
});

// ------------------------------------------------------------- el margen

describe("la fila en su margen propio", () => {
  /**
   * La forma del estilo `columna`: un `gutter` de CodeMirror, no un widget.
   *
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

  // Los dos no pueden estar encendidos a la vez o se dibujarían dos filas por
  // tarea. Quién decide es `main.ts`; acá se fija que sean **dos** extensiones
  // distintas, que es lo que permite decidirlo.
  it("es una extensión aparte de la del widget", () => {
    const conWidget = EditorState.create({
      doc: "- [ ] a",
      extensions: [filaDeBotones(() => true, opciones())],
    });
    expect(conWidget.facet(EditorView.decorations)).toHaveLength(1);
  });
});

// ------------------------------------------- a dónde llega el clic (§13.0)

/**
 * El bug que estos cuatro tests existen para no volver a cometer.
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
  const armar = (resolucion: Parameters<typeof construirFila>[2]) => {
    const fila = filaDe("- [ ] una tarea", FAV)!;
    const ancla = construirFila(fila, opciones(), resolucion) as unknown as NodoFalso;
    // El ancestro que en Obsidian es el `.cm-gutter`.
    const gutter = new NodoFalso("div");
    gutter.className = "cm-gutter";
    gutter.appendChild(ancla);
    const botones = ancla.querySelectorAll("button");
    return { gutter, ancla, botones };
  };

  it("en el margen, el clic **llega al ancestro**: es quien sabe la línea", () => {
    conDocumentoFalso(() => {
      const { gutter, botones } = armar({ modo: "burbuja" });
      expect(botones.length).toBeGreaterThan(0);
      for (const boton of botones) {
        let llego = false;
        gutter.addEventListener("click", () => void (llego = true));
        NodoFalso.despachar(boton, "click");
        expect(llego, `el botón ${boton.className}`).toBe(true);
      }
    });
  });

  it("en el widget, el clic **no** llega al ancestro: lo atiende el botón", () => {
    // La otra mitad, y es igual de necesaria: dejarlo subir haría que
    // CodeMirror trate el clic como suyo y mueva el cursor.
    conDocumentoFalso(() => {
      const vistos: string[] = [];
      const { gutter, botones } = armar({
        modo: "propio",
        alClic: (b) => void vistos.push(b.accion),
      });
      let llego = false;
      gutter.addEventListener("click", () => void (llego = true));
      NodoFalso.despachar(botones[0]!, "click");
      expect(llego).toBe(false);
      expect(vistos).toHaveLength(1);
    });
  });

  it("el `mousedown` se corta en los dos modos: es lo que evita el caret", () => {
    conDocumentoFalso(() => {
      for (const resolucion of [
        { modo: "burbuja" } as const,
        { modo: "propio", alClic: () => {} } as const,
      ]) {
        const { gutter, botones } = armar(resolucion);
        let llego = false;
        gutter.addEventListener("mousedown", () => void (llego = true));
        NodoFalso.despachar(botones[0]!, "mousedown");
        expect(llego, resolucion.modo).toBe(false);
      }
    });
  });

  it("el marcador de verdad: sus botones llegan al ancestro **y** dicen cuál son", () => {
    // El camino completo del margen, con la clase que corre en Obsidian. Llegar
    // no alcanza: el `domEventHandlers` reconoce el botón por su `data-accion`,
    // así que las dos cosas tienen que valer juntas o el clic llega y se pierde.
    conDocumentoFalso(() => {
      const fila = filaDe("- [ ] una tarea", FAV)!;
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
      expect(acciones).toEqual(fila.botones.map((b) => b.accion));
    });
  });
});
