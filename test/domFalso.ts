/**
 * Un `document` mínimo, para poder mirar lo que construye un `toDOM`.
 *
 * Los tests corren en Node sin entorno DOM, y agregar uno entero es una
 * dependencia grande para lo poco que hace falta. Esto reproduce **solo dos
 * cosas**, y son justo las dos que decidieron un bug:
 *
 * 1. **El burbujeo**: un evento sube de nodo en nodo hasta la raíz.
 * 2. **`stopPropagation`**: y ahí se corta.
 *
 * Esa es la forma del sistema que importa. `@codemirror/view` engancha los
 * `domEventHandlers` de un margen **en el `.cm-gutter`** —leído en 6.38.6,
 * `SingleGutterView`: `this.dom.addEventListener(prop, …)`— y en fase de
 * burbujeo. O sea que un botón que llama a `stopPropagation` en su propio
 * `click` deja al margen sin enterarse, y sus botones dejan de funcionar sin
 * tirar ningún error. Es exactamente lo que pasó, y no lo agarró ningún test
 * porque ninguno podía construir el DOM.
 *
 * No pretende ser un DOM: no hay estilos, ni layout, ni fase de captura, ni
 * `preventDefault` con efecto. Si algún día hace falta algo de eso, es la señal
 * de que conviene un entorno de verdad y no estirar esto.
 */

export interface EventoFalso {
  type: string;
  target: NodoFalso;
  detenido: boolean;
  preventDefault(): void;
  stopPropagation(): void;
}

export class NodoFalso {
  className = "";
  type = "";
  parentNode: NodoFalso | null = null;
  readonly hijos: NodoFalso[] = [];
  readonly atributos = new Map<string, string>();
  readonly clases = new Set<string>();
  private readonly oyentes = new Map<string, ((e: EventoFalso) => void)[]>();

  constructor(readonly tag: string) {}

  readonly classList = {
    add: (c: string) => void this.clases.add(c),
    contains: (c: string) => this.clases.has(c),
  };

  appendChild(hijo: NodoFalso): NodoFalso {
    hijo.parentNode = this;
    this.hijos.push(hijo);
    return hijo;
  }

  setAttribute(nombre: string, valor: string): void {
    this.atributos.set(nombre, valor);
  }

  getAttribute(nombre: string): string | null {
    return this.atributos.get(nombre) ?? null;
  }

  addEventListener(tipo: string, fn: (e: EventoFalso) => void): void {
    const lista = this.oyentes.get(tipo) ?? [];
    lista.push(fn);
    this.oyentes.set(tipo, lista);
  }

  /** Solo `"button"` y `"[data-x]"`: es lo único que el código usa. */
  querySelectorAll(sel: string): NodoFalso[] {
    const salida: NodoFalso[] = [];
    const visitar = (n: NodoFalso) => {
      if (sel === n.tag || (sel.startsWith("[") && n.atributos.has(sel.slice(1, -1)))) {
        salida.push(n);
      }
      n.hijos.forEach(visitar);
    };
    this.hijos.forEach(visitar);
    return salida;
  }

  /** Todos los descendientes, para buscar sin selector. */
  todos(): NodoFalso[] {
    const salida: NodoFalso[] = [];
    const visitar = (n: NodoFalso) => {
      salida.push(n);
      n.hijos.forEach(visitar);
    };
    this.hijos.forEach(visitar);
    return salida;
  }

  atiende(tipo: string): boolean {
    return (this.oyentes.get(tipo) ?? []).length > 0;
  }

  private correr(tipo: string, e: EventoFalso): void {
    for (const fn of this.oyentes.get(tipo) ?? []) fn(e);
  }

  /**
   * Despacha un evento desde este nodo y devuelve **hasta dónde llegó**.
   *
   * Es lo único que este archivo existe para poder preguntar: si el clic en un
   * botón del margen no llega a su ancestro, el margen no se entera.
   */
  static despachar(desde: NodoFalso, tipo: string): NodoFalso[] {
    const evento: EventoFalso = {
      type: tipo,
      target: desde,
      detenido: false,
      preventDefault: () => {},
      stopPropagation: () => void (evento.detenido = true),
    };
    const llegó: NodoFalso[] = [];
    for (let n: NodoFalso | null = desde; n !== null; n = n.parentNode) {
      llegó.push(n);
      n.correr(tipo, evento);
      if (evento.detenido) break;
    }
    return llegó;
  }
}

/**
 * Instala el `document` falso y devuelve cómo sacarlo.
 *
 * Se saca siempre, aunque el test falle: un `document` global que sobrevive a
 * su test contamina a los que siguen, y eso da fallas que dependen del orden.
 */
export function conDocumentoFalso<T>(fn: () => T): T {
  const previo = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = {
    createElement: (tag: string) => new NodoFalso(tag),
  };
  try {
    return fn();
  } finally {
    (globalThis as { document?: unknown }).document = previo;
  }
}
