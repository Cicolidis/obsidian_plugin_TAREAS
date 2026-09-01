import { Menu, Modal, Notice, Setting, type App } from "obsidian";
import type { EditorState } from "@codemirror/state";
import { workbenchesDelPopover, type Favoritos } from "../botones.js";
import {
  alternarWorkbench,
  archivarTarea,
  completarTarea,
  elegirEnLinea,
  eliminarTarea,
  fijarPrioridad,
  hoy,
  nivelVisible,
  type Contexto,
} from "../comandos.js";
import { sanearWorkbenchOpcional } from "../settingsData.js";
import { STRINGS } from "../strings.js";
import { parseTaskToken, type Prioridad } from "../token.js";
import type { StoreDeTareas } from "../store.js";
import type { AlClicEnFila } from "./filaDeBotones.js";

/**
 * Qué pasa cuando se toca un botón de la fila (§13.0).
 *
 * ## Ningún camino de escritura nuevo
 *
 * Los cuatro botones terminan en las mismas tres funciones que ya usan los
 * comandos de paleta —`alternarWorkbench`, `fijarPrioridad`, `completarTarea`—
 * y por lo tanto en el mismo recorrido:
 *
 *     posAtDOM → elegirEnLinea → plan puro → escribir → absorber
 *
 * `elegirEnLinea` es la pieza que importa: traduce la coordenada **de ahora**
 * del editor a la del índice, que puede ser de hace un rato, y sabe negarse
 * cuando no puede saber (invariante 10). Sin eso, un clic sobre una tarea con
 * cinco líneas tecleadas arriba escribiría impecablemente en la tarea de al
 * lado.
 *
 * ## Qué **no** está en el ⋯, y por qué
 *
 * La §13.0 lista seis cosas en el menú. Con el paso 6a entraron «completar y
 * archivar» y «eliminar», así que quedan dos afuera:
 *
 * | Del menú | Por qué no |
 * |---|---|
 * | Fecha | `setTaskToken` sabe escribir `due`, pero no hay con qué elegir una |
 * | Recurrencia | Ídem con `rec`, y el botón por grupo es de la §11 |
 *
 * Un ítem gris ocupa el mismo lugar que uno que anda y no hace nada: es la
 * misma decisión que dejó al ◐ sin dibujar cuando no tiene workbench.
 */
export interface DependenciasDeMenu {
  app: App;
  store: StoreDeTareas;
  /** La lista efectiva, leída en el momento: los ajustes cambian sin recargar. */
  notas: () => readonly string[];
  favoritos: () => Favoritos;
  /** A dónde archiva (§12). Se lee en el momento, como el resto. */
  notaDeLog: () => string;
  /** ¿Archivar pregunta antes? Ver `TareasSettings.confirmarAlArchivar`. */
  confirmarAlArchivar: () => boolean;
  /** ¿Eliminar pregunta antes? Ver `TareasSettings.confirmarAlEliminar`. */
  confirmarAlEliminar: () => boolean;
  /**
   * De un editor a un archivo del vault.
   *
   * Se inyecta porque esa traducción vive en `main.ts` y en un solo lugar: es
   * lo que decide dónde actúa el plugin, y dos copias divergirían.
   */
  archivoDe: (state: EditorState) => string | null;
  ahora?: () => string;
}

export function manejarClicEnFila(dep: DependenciasDeMenu): AlClicEnFila {
  const fecha = dep.ahora ?? (() => hoy());

  return (clic) => {
    // Se pregunta por el texto **de ahora**, no por el estado con que se dibujó
    // el widget: entre que se dibujó y que se hizo clic pudo entrar una tecla.
    // Es la misma razón por la que la línea tampoco se guarda.
    // La gramática del token vive en `token.ts` y en ningún otro lado: una
    // gramática repetida en dos archivos diverge, y la de acá decidiría si se
    // escribe o no sobre una tarea.
    if (parseTaskToken(clic.texto).estado === "ilegible") {
      new Notice(STRINGS.avisos.tokenIlegible, 8000);
      return;
    }

    const ctx = elegirEnLinea(
      dep.store,
      dep.notas(),
      dep.archivoDe(clic.view.state),
      clic.linea,
      clic.texto,
    );
    if (!ctx) return;

    switch (clic.boton.accion) {
      case "wb-primario":
      case "wb-secundario":
        // Callado: el ★ que se rellena **es** el aviso, y llega solo — la
        // escritura vuelve al editor como cambio externo y el widget se
        // reconstruye. Un cartel por clic sería ruido sobre lo más frecuente.
        alternarWorkbench(dep.app, dep.store, ctx, clic.boton.workbench!, true);
        break;
      case "popover":
        abrirPopover(dep, ctx, clic.evento);
        break;
      case "menu":
        abrirMenu(dep, ctx, clic.evento, fecha);
        break;
      case "eliminar":
        // El mismo camino que el ítem del ⋯: son la misma acción por dos
        // puertas, y dos implementaciones divergirían justo en si pregunta.
        eliminarTarea(dep.app, dep.store, ctx, dep.confirmarAlEliminar());
        break;
    }
  };
}

/**
 * El ⋯: prioridad, los dos verbos de terminar una tarea, y el descarte.
 *
 * Los tres niveles van planos y no en un submenú: `setSubmenu` no está en las
 * tipificaciones públicas de Obsidian, y un rótulo con `setIsLabel` más tres
 * ítems marcables dice lo mismo sin apoyarse en API que no está prometida.
 *
 * El nivel marcado es el que **se ve** (`nivelVisible`), no el propio: una hija
 * sin `p=` se dibuja con la prioridad de su madre, y marcar «normal» sobre una
 * línea que se ve roja diría lo contrario de lo que muestra la pantalla.
 *
 * ## El orden es fijo, y no se acomoda a la tarea
 *
 * La §12 dice que el default —descartar o archivar— se deriva del tamaño del
 * bloque, y `archivarPorDefecto` sabe calcularlo. **Acá no se usa para mover
 * los ítems de lugar.** Un menú cuyo primer ítem cambia según la tarea es un
 * menú que no se puede aprender, y estos dos son la acción más frecuente del
 * plugin: la memoria muscular vale más que la sugerencia. El default va a
 * importar cuando haya **un solo** gesto de completar —un botón de la fila— y
 * entonces sí decide cuál corre.
 *
 * «Eliminar» va después de un separador y con `setWarning`: es la única entrada
 * del menú que pierde texto, y tiene que verse distinta antes de abrirla, no
 * solo en el modal.
 */
function abrirMenu(
  dep: DependenciasDeMenu,
  ctx: Contexto,
  evento: MouseEvent,
  fecha: () => string,
): void {
  const menu = new Menu();
  const actual = nivelVisible(dep.store, ctx);

  menu.addItem((i) => i.setTitle(STRINGS.menu.prioridad).setIsLabel(true));
  for (const n of [0, 1, 2] as const) {
    menu.addItem((i) =>
      i
        .setTitle(STRINGS.menu.niveles[n])
        .setChecked(n === actual)
        .onClick(() => fijarPrioridad(dep.app, dep.store, ctx, n as Prioridad)),
    );
  }

  menu.addSeparator();
  menu.addItem((i) =>
    i
      .setTitle(STRINGS.menu.completarYDescartar)
      .setIcon("check")
      .onClick(() => completarTarea(dep.app, dep.store, ctx, fecha())),
  );
  menu.addItem((i) =>
    i
      .setTitle(STRINGS.menu.completarYArchivar)
      .setIcon("archive")
      .onClick(() =>
        void archivarTarea(dep.app, dep.store, ctx, fecha(), dep.notaDeLog(), dep.confirmarAlArchivar()),
      ),
  );

  menu.addSeparator();
  menu.addItem((i) =>
    i
      .setTitle(STRINGS.menu.eliminar)
      .setIcon("trash-2")
      .setWarning(true)
      .onClick(() => eliminarTarea(dep.app, dep.store, ctx, dep.confirmarAlEliminar())),
  );

  menu.showAtMouseEvent(evento);
}

/**
 * El →: todos los workbenches, numerados 1-9 (§13.0: «un clic más una tecla»).
 *
 * `setUseNativeMenu(false)` no es cosmético: con el menú nativo de macOS las
 * teclas no llegan al documento y el atajo numérico —que es la mitad del diseño
 * de este botón— no existiría.
 *
 * Del noveno en adelante los ítems van sin número. La §13.0 dice 1-9 y el
 * teclado no da más; que los siguientes se puedan clickear igual es mejor que
 * esconderlos.
 */
function abrirPopover(dep: DependenciasDeMenu, ctx: Contexto, evento: MouseEvent): void {
  const nombres = workbenchesDelPopover(dep.favoritos(), dep.store.workbenchesEnUso());
  const puestos = new Set(dep.store.buscar(ctx.archivo, ctx.clave)?.workbenches ?? []);
  const menu = new Menu().setUseNativeMenu(false);

  const mandar = (wb: string) => alternarWorkbench(dep.app, dep.store, ctx, wb, false);

  nombres.forEach((wb, i) => {
    menu.addItem((it) =>
      it
        .setTitle(i < 9 ? `${i + 1} · ${wb}` : wb)
        .setChecked(puestos.has(wb))
        .onClick(() => mandar(wb)),
    );
  });
  if (nombres.length) menu.addSeparator();

  menu.addItem((it) =>
    it
      .setTitle(STRINGS.menu.workbenchNuevo)
      .setIcon("plus")
      .onClick(() => new WorkbenchNuevoModal(dep.app, mandar).open()),
  );

  // El atajo numérico. En captura, para llegar antes que la navegación propia
  // del menú, y solo sobre un dígito pelado: cualquier modificador tiene su
  // propio significado y no se toca.
  const teclas = (e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey || !/^[1-9]$/.test(e.key)) return;
    const wb = nombres[Number(e.key) - 1];
    if (wb === undefined) return;
    e.preventDefault();
    e.stopPropagation();
    menu.hide();
    mandar(wb);
  };
  document.addEventListener("keydown", teclas, true);
  menu.onHide(() => document.removeEventListener("keydown", teclas, true));

  menu.showAtMouseEvent(evento);
}

/**
 * «Workbench nuevo…»: un nombre y listo.
 *
 * La §10: los workbenches «se crean escribiendo un nombre. No hay panel de
 * administración». Sin esto el popover no pasaría nunca de los dos de ajustes,
 * porque un workbench solo existe si alguna tarea lo tiene escrito.
 *
 * El nombre se sanea con `sanearWorkbenchOpcional`, que es el mismo criterio
 * que el token: `;`, `,` y `%` romperían el `%%t:…%%` y dejarían la línea
 * ilegible — y una línea ilegible no se vuelve a escribir nunca (§5.3). Vale
 * más negarse que dejar que un campo de texto corrompa tareas.
 */
class WorkbenchNuevoModal extends Modal {
  constructor(
    app: App,
    private readonly alAceptar: (nombre: string) => void,
  ) {
    super(app);
  }

  override onOpen(): void {
    const t = STRINGS.menu.nuevoWorkbench;
    this.setTitle(t.titulo);
    this.contentEl.createEl("p", { text: t.descripcion, cls: "setting-item-description" });

    let valor = "";
    const aceptar = (): void => {
      const crudo = valor.trim();
      if (crudo === "") return; // nada escrito: no es un error, no hay nada que decir
      const limpio = sanearWorkbenchOpcional(crudo);
      if (limpio === "") {
        new Notice(t.invalido, 8000);
        return;
      }
      this.close();
      this.alAceptar(limpio);
    };

    new Setting(this.contentEl).addText((campo) => {
      campo.setPlaceholder(t.marcador).onChange((v) => {
        valor = v;
      });
      campo.inputEl.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        aceptar();
      });
      window.setTimeout(() => campo.inputEl.focus(), 0);
    });

    new Setting(this.contentEl)
      .addButton((b) => b.setButtonText(t.cancelar).onClick(() => this.close()))
      .addButton((b) => b.setButtonText(t.aceptar).setCta().onClick(aceptar));
  }

  override onClose(): void {
    this.contentEl.empty();
  }
}
