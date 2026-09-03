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
 *
 * ## Las dos formas de elegir (paso 6c)
 *
 * Pedido al verificar el 6b: «"Otra fecha…" con un calendario chico». Se ofrecen
 * las dos y conviven, que es el patrón `designFlags.ts`:
 *
 * | | Qué es | Cuánto cuesta |
 * |---|---|---|
 * | `nativo` | el `<input type="date">` que ya estaba, con `showPicker()` | seis líneas |
 * | `grilla` | un calendario dibujado acá | ~30 líneas puras en `fechas.ts` + el DOM de abajo |
 *
 * **Lo que paga la grilla es el caso cíclico.** Ahí el campo es un número del 1
 * al 31 (§11) y el navegador no ofrece **ningún** selector: `showPicker()` sobre
 * un `type="number"` no abre nada. Una grilla de 1 a 31 sí es un selector de día
 * del mes, y hace visible de una sola mirada que lo que se elige no es una fecha.
 *
 * Y un clic en la grilla **elige, no acepta**. Es a propósito: la línea «va a
 * escribir» existe para que se vea cuál de las dos formas queda antes de
 * confirmar, y aceptar de un clic la saltearía justo en el caso que la necesita.
 */
import { Modal, Notice, Setting, type App } from "obsidian";
import { diasDelMes, esDiaDelMes, esFechaReal, grillaDelMes, mesVecino } from "../fechas.js";
import type { SelectorDeFecha } from "../settingsData.js";
import { DIAS_INICIALES, STRINGS } from "../strings.js";
import { formaDeDue } from "../token.js";

export interface OpcionesDeFecha {
  /** Si la tarea tiene `rec`: se guarda el día del mes, no la fecha (§11). */
  ciclica: boolean;
  /** Lo que ya tiene escrito, para arrancar ahí. */
  actual: string | null;
  /** Hoy, en `AAAA-MM-DD`: de dónde arranca la grilla y qué celda se marca. */
  hoy: string;
  /** Cuál de las dos formas de elegir. Ver `SELECTORES_DE_FECHA`. */
  selector: SelectorDeFecha;
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
    const { ciclica, hoy } = this.opciones;
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
    // Quién repinta la grilla, si la hay. Se declara antes porque el campo de
    // texto también la tiene que poner al día: se puede escribir la fecha a mano.
    let repintar: (() => void) | null = null;
    let campoEl: HTMLInputElement | null = null;

    const refrescar = (): void => {
      previa.setText(valor === "" ? "" : t.vaAEscribir(valor));
      repintar?.();
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
      campoEl = campo.inputEl;
      window.setTimeout(() => campo.inputEl.focus(), 0);
    });

    /** Lo que un clic en la grilla —o el selector nativo— deja elegido. */
    const elegir = (v: string): void => {
      valor = v;
      if (campoEl) campoEl.value = v;
      refrescar();
    };

    if (this.opciones.selector === "grilla") {
      repintar = ciclica
        ? this.grillaDeDias(elegir, () => valor)
        : this.grillaDeFechas(hoy, elegir, () => valor);
    } else if (!ciclica) {
      // `showPicker` es de Chromium 99 y Obsidian corre Electron, pero el
      // manifiesto declara `minAppVersion` 1.6.0 y llamar a lo que no existe
      // rompería **el modal entero** — o sea que no habría con qué elegir la
      // fecha, justo en la pantalla que existe para eso. Es la misma guardia que
      // `setDestructive` en `confirmar.ts`.
      window.setTimeout(() => {
        const el = campoEl as (HTMLInputElement & { showPicker?: () => void }) | null;
        try {
          el?.showPicker?.();
        } catch {
          // Chromium lo tira si no hubo gesto del usuario en esta ventana. No
          // es un error: el campo sigue estando y su ícono lo abre igual.
        }
      }, 0);
    }

    refrescar();

    new Setting(this.contentEl)
      .addButton((b) => b.setButtonText(t.cancelar).onClick(() => this.close()))
      .addButton((b) => b.setButtonText(t.aceptar).setCta().onClick(aceptar));
  }

  /**
   * El calendario de un mes, con `‹ mes año ›`.
   *
   * Todo lo que decide qué día cae en qué celda vive en `grillaDelMes`, que es
   * capa 1 y se prueba sin abrir Obsidian: acá solo se pintan botones. Es la
   * misma división que `botones.ts` con `filaDeBotones.ts`, y por la misma
   * razón — un error de un día en un calendario no se ve mirándolo.
   *
   * Devuelve el repintado: el campo de texto también puede cambiar el valor, y
   * la celda marcada tiene que seguirlo.
   */
  private grillaDeFechas(
    hoy: string,
    elegir: (v: string) => void,
    valorActual: () => string,
  ): () => void {
    const t = STRINGS.menu.elegirFecha;
    const caja = this.contentEl.createDiv({ cls: "tareas-calendario" });

    // El mes que se está mirando. Arranca en el valor escrito si lo hay, y si
    // no en hoy: abrir el calendario de una tarea con fecha en otro mes y que
    // muestre este mes obligaría a navegar hasta lo que uno ya tenía.
    let ancla = valorActual() === "" ? hoy : valorActual();

    const cabecera = caja.createDiv({ cls: "tareas-calendario-cabecera" });
    const atras = cabecera.createEl("button", { text: "‹", cls: "tareas-calendario-mover" });
    atras.setAttribute("aria-label", t.mesAnterior);
    const titulo = cabecera.createSpan({ cls: "tareas-calendario-titulo" });
    const adelante = cabecera.createEl("button", { text: "›", cls: "tareas-calendario-mover" });
    adelante.setAttribute("aria-label", t.mesSiguiente);

    const dias = caja.createDiv({ cls: "tareas-calendario-dias" });
    for (const d of DIAS_INICIALES) dias.createSpan({ text: d });

    const grilla = caja.createDiv({ cls: "tareas-calendario-grilla" });

    const pintar = (): void => {
      const g = grillaDelMes(ancla);
      titulo.setText(t.mesYAnio(g.mes, g.anio));
      grilla.empty();
      for (const semana of g.semanas) {
        for (const fecha of semana) {
          if (fecha === null) {
            grilla.createSpan({ cls: "tareas-calendario-hueco" });
            continue;
          }
          const b = grilla.createEl("button", {
            text: String(Number(fecha.slice(8, 10))),
            cls: "tareas-calendario-celda",
          });
          b.type = "button";
          b.setAttribute("aria-label", t.celda(fecha));
          if (fecha === hoy) b.addClass("is-hoy");
          if (fecha === valorActual()) b.addClass("is-elegido");
          b.addEventListener("click", (e) => {
            e.preventDefault();
            elegir(fecha);
          });
        }
      }
    };

    const mover = (n: number) => (e: MouseEvent) => {
      e.preventDefault();
      ancla = mesVecino(ancla, n);
      pintar();
    };
    atras.addEventListener("click", mover(-1));
    adelante.addEventListener("click", mover(1));

    return () => {
      // Si el valor cambió a otro mes —lo escribieron a mano— la grilla lo
      // sigue. Si no, el mes que se está mirando se respeta: navegar y que se
      // vuelva solo al mes de la fecha elegida sería imposible de usar.
      const v = valorActual();
      if (v !== "" && v.slice(0, 7) !== ancla.slice(0, 7)) ancla = v;
      pintar();
    };
  }

  /**
   * La grilla de una cíclica: los días del mes, del 1 al 31 (§11).
   *
   * No es un calendario y no tiene que parecerlo: no hay mes, no hay día de la
   * semana, y el 31 es válido siempre —`resolverDue` recorta al último día del
   * mes que toque—. Es el caso que justifica que esta grilla exista, porque el
   * selector nativo de un `<input type="number">` no existe.
   */
  private grillaDeDias(elegir: (v: string) => void, valorActual: () => string): () => void {
    const t = STRINGS.menu.elegirFecha;
    const caja = this.contentEl.createDiv({ cls: "tareas-calendario" });
    const grilla = caja.createDiv({ cls: "tareas-calendario-grilla is-dias" });

    const pintar = (): void => {
      grilla.empty();
      for (const dia of diasDelMes()) {
        const b = grilla.createEl("button", { text: dia, cls: "tareas-calendario-celda" });
        b.type = "button";
        b.setAttribute("aria-label", t.celdaDelMes(dia));
        if (dia === valorActual()) b.addClass("is-elegido");
        b.addEventListener("click", (e) => {
          e.preventDefault();
          elegir(dia);
        });
      }
    };

    return pintar;
  }

  override onClose(): void {
    this.contentEl.empty();
  }
}
