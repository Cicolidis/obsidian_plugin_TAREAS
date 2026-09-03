/**
 * El selector de fecha del ⋯ (spec §5.2, §11).
 *
 * Capa 3 y sin ninguna decisión adentro: recibe si la tarea es cíclica, valida
 * con las funciones puras de `fechas.ts` y devuelve lo que hay que escribir.
 * Quién decide la **forma** —`AAAA-MM-DD` o el día del mes— es
 * `dueParaLaLinea` en `acciones.ts`, que lee la línea; acá se usa solo para
 * mostrar y validar lo correcto.
 *
 * ## Por qué el campo es la salida y no la entrada
 *
 * Los atajos van en el menú y esto se abre desde «Otra fecha…». Sale de medir:
 * de las 24 líneas del corpus con una fecha en prosa **solo 9 caen sobre una
 * tarea**, y las señales temporales que sí abundan son relativas —un día de la
 * semana, o «antes del día N»—. Un `<input type="date">` suelto obligaría a
 * traducir «el lunes» a mano cada vez.
 *
 * ## Y por qué muestra lo que va a escribir
 *
 * Es la misma razón por la que los atajos llevan la fecha resuelta en la
 * etiqueta: `due` guarda dos cosas distintas y cuál depende de `rec`, así que
 * «cuál de las dos escribió» tiene que verse **antes** de aceptar. En la nota
 * no se ve: el token está oculto.
 */
import { Modal, Notice, Setting, type App } from "obsidian";
import { esDiaDelMes, esFechaReal } from "../fechas.js";
import { STRINGS } from "../strings.js";
import { formaDeDue } from "../token.js";

export interface OpcionesDeFecha {
  /** Si la tarea tiene `rec`: se guarda el día del mes, no la fecha (§11). */
  ciclica: boolean;
  /** Lo que ya tiene escrito, para arrancar ahí. */
  actual: string | null;
}

/** Abre el selector. Si aceptan, llama con el valor ya validado. */
export function elegirFecha(
  app: App,
  opciones: OpcionesDeFecha,
  alAceptar: (due: string) => void,
): void {
  new ElegirFechaModal(app, opciones, alAceptar).open();
}

class ElegirFechaModal extends Modal {
  constructor(
    app: App,
    private readonly opciones: OpcionesDeFecha,
    private readonly alAceptar: (due: string) => void,
  ) {
    super(app);
  }

  override onOpen(): void {
    const t = STRINGS.menu.elegirFecha;
    const { ciclica } = this.opciones;
    this.setTitle(ciclica ? t.tituloCiclica : t.titulo);
    this.contentEl.createEl("p", {
      text: ciclica ? t.descripcionCiclica : t.descripcion,
      cls: "setting-item-description",
    });

    // Se arranca en lo que ya está escrito, pero solo si tiene la forma que
    // corresponde: un `due=10` en el campo de fecha de una tarea normal no
    // sería una fecha, y el navegador lo mostraría vacío igual.
    const forma = formaDeDue(this.opciones.actual);
    let valor = forma === (ciclica ? "dia" : "fecha") ? this.opciones.actual! : "";

    const previa = this.contentEl.createEl("p", { cls: "tareas-confirmar-detalle" });
    const refrescar = (): void => {
      previa.setText(valor === "" ? "" : t.vaAEscribir(valor));
    };

    const aceptar = (): void => {
      if (valor === "") return; // nada escrito: no es un error, no hay nada que decir
      if (!(ciclica ? esDiaDelMes(valor) : esFechaReal(valor))) {
        // `esFechaReal` mira el calendario y no solo la forma: `2026-02-31`
        // pasa el parser del token y no existe.
        new Notice(ciclica ? t.diaInvalido : t.invalida, 8000);
        return;
      }
      this.close();
      this.alAceptar(valor);
    };

    new Setting(this.contentEl).addText((campo) => {
      // El tipo se pone sobre el input y no con `addText` vs otro helper porque
      // Obsidian no expone uno para fecha ni para número.
      campo.inputEl.type = ciclica ? "number" : "date";
      if (ciclica) {
        campo.inputEl.min = "1";
        campo.inputEl.max = "31";
        campo.setPlaceholder(t.marcadorDia);
      }
      campo.setValue(valor).onChange((v) => {
        valor = v.trim();
        refrescar();
      });
      campo.inputEl.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        aceptar();
      });
      window.setTimeout(() => campo.inputEl.focus(), 0);
    });

    refrescar();

    new Setting(this.contentEl)
      .addButton((b) => b.setButtonText(t.cancelar).onClick(() => this.close()))
      .addButton((b) => b.setButtonText(t.aceptar).setCta().onClick(aceptar));
  }

  override onClose(): void {
    this.contentEl.empty();
  }
}
