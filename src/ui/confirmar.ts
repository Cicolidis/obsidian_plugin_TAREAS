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

    new Setting(this.contentEl)
      .addButton((b) => {
        cancelar = b.setButtonText(STRINGS.confirmar.cancelar).onClick(() => this.close());
      })
      .addButton((b) => {
        aceptar = b.setButtonText(this.c.aceptar).onClick(() => {
          this.close();
          this.alAceptar();
        });
        if (this.c.peligrosa) marcarDestructivo(b);
        else b.setCta();
      });

    // El foco arranca donde no hace daño: en el destructivo, en «Cancelar».
    window.setTimeout(() => (this.c.peligrosa ? cancelar : aceptar)?.buttonEl.focus(), 0);
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
