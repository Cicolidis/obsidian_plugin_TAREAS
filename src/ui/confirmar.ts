/**
 * El modal de confirmación de las acciones que terminan una tarea (§12).
 *
 * Forma tomada de `ui/ConfirmModal.ts` de Anotaciones, con dos cambios que
 * salen de para qué se usa acá:
 *
 * 1. **El detalle son varias líneas, no un párrafo.** Lo que hay que decir son
 *    tres cosas distintas —qué se toca, cuánto, y qué pasa con Ctrl-Z— y
 *    pegadas en un párrafo se leen como ninguna. La §12 pide que la
 *    confirmación diga «cuántas líneas y en qué nota»: eso tiene que poder
 *    verse de un vistazo.
 * 2. **Hay un grado de peligro.** Archivar no pierde nada: agrega al historial
 *    y deja la tarea `[x]` en su lugar. Eliminar borra texto y no se deshace
 *    desde el plugin. Los dos modales no pueden verse igual, y el foco tampoco
 *    puede caer en el mismo lugar.
 *
 * Es capa 3 y no tiene ninguna decisión adentro: recibe el texto ya armado y
 * devuelve un clic. Quién decide **si** hay que preguntar es `archivado.ts`,
 * con el umbral medido.
 */
import { ButtonComponent, Modal, Setting, type App } from "obsidian";
import { STRINGS } from "../strings.js";

export interface Confirmacion {
  titulo: string;
  /** Una frase por línea. Ver el punto 1 de arriba. */
  detalle: readonly string[];
  /** Qué dice el botón que acepta. Nunca «Aceptar»: dice el verbo. */
  aceptar: string;
  /**
   * Pinta el botón como destructivo y **deja el foco en «Cancelar»**.
   *
   * Lo segundo importa más que lo primero: un Enter reflejo sobre un modal que
   * apareció de golpe no puede borrar el subárbol de una tarea.
   */
  peligrosa?: boolean;
  /**
   * Un **segundo camino**, con su propio botón.
   *
   * Lo pide la §11 desde que existe el reinicio: «la confirmación ofrece
   * reiniciar o archivar y reiniciar». No son dos modales encadenados ni una
   * casilla adentro de uno: son dos acciones distintas sobre el mismo plan, y la
   * §11 dice explícitamente que cuál conviene se decide **ahí**, no de antemano
   * —«así la semanal trivial no llena el LOG y la mensual del alquiler deja
   * rastro»—. Un modal que pregunta y después otro que pregunta de nuevo
   * convertiría eso en dos decisiones.
   */
  segunda?: { texto: string; alAceptar: () => void };
  /**
   * El foco arranca en «Cancelar» aunque la acción no sea destructiva.
   *
   * Está separado de `peligrosa` desde el paso 6c, y hasta acá eran lo mismo por
   * accidente: había **una sola** acción peligrosa, así que «pintar de rojo» y
   * «no recibir un Enter reflejo» iban siempre juntas. Con dos caminos deja de
   * ser cierto: ninguno de los dos es destructivo, y ninguno de los dos puede
   * ser el que un Enter elige por vos.
   */
  focoEnCancelar?: boolean;
}

/** Pregunta, y si dicen que sí llama a `alAceptar`. Cancelar no hace nada. */
export function confirmar(app: App, c: Confirmacion, alAceptar: () => void): void {
  new ConfirmarModal(app, c, alAceptar).open();
}

class ConfirmarModal extends Modal {
  constructor(
    app: App,
    private readonly c: Confirmacion,
    private readonly alAceptar: () => void,
  ) {
    super(app);
  }

  override onOpen(): void {
    this.setTitle(this.c.titulo);
    this.modalEl.addClass("tareas-confirmar");
    for (const linea of this.c.detalle) {
      this.contentEl.createEl("p", { text: linea, cls: "tareas-confirmar-detalle" });
    }

    let cancelar: ButtonComponent | null = null;
    let aceptar: ButtonComponent | null = null;

    const fila = new Setting(this.contentEl).addButton((b) => {
      cancelar = b.setButtonText(STRINGS.confirmar.cancelar).onClick(() => this.close());
    });

    // El segundo camino va **antes** del principal, que es el orden en que
    // Obsidian los dibuja de izquierda a derecha: cancelar, la alternativa, y
    // el que la acción nombra. Así el último sigue siendo el que uno espera.
    const segunda = this.c.segunda;
    if (segunda) {
      fila.addButton((b) =>
        b.setButtonText(segunda.texto).onClick(() => {
          this.close();
          segunda.alAceptar();
        }),
      );
    }

    fila.addButton((b) => {
      aceptar = b.setButtonText(this.c.aceptar).onClick(() => {
        this.close();
        this.alAceptar();
      });
      if (this.c.peligrosa) marcarDestructivo(b);
      else if (!this.c.focoEnCancelar) b.setCta();
    });

    // El foco arranca donde no hace daño: en el destructivo, en «Cancelar»; y
    // con dos caminos, tampoco en ninguno de los dos.
    const enCancelar = this.c.peligrosa || this.c.focoEnCancelar;
    window.setTimeout(() => (enCancelar ? cancelar : aceptar)?.buttonEl.focus(), 0);
  }

  override onClose(): void {
    this.contentEl.empty();
  }
}

/**
 * El estilo destructivo, sin depender de una API más nueva que el manifiesto.
 *
 * `setDestructive()` existe desde Obsidian 1.13.0 y `minAppVersion` de este
 * plugin es 1.6.0, así que llamarlo a secas rompería el modal en una versión
 * que el manifiesto declara soportada — y rompería **el modal**, o sea que la
 * confirmación no aparecería justo en la acción que más la necesita. El
 * `setWarning()` de siempre está deprecado pero sigue estando desde 0.11.0.
 */
function marcarDestructivo(b: ButtonComponent): void {
  const conDestructive = b as ButtonComponent & { setDestructive?: () => ButtonComponent };
  if (typeof conDestructive.setDestructive === "function") conDestructive.setDestructive();
  else b.setWarning();
}
