import { Menu, Modal, Notice, Setting, type App } from "obsidian";
import type { EditorState } from "@codemirror/state";
import { workbenchesDelPopover, type Favoritos } from "../botones.js";
import {
  alternarWorkbench,
  completarTarea,
  elegirEnLinea,
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
 * La §13.0 lista seis cosas en el menú. Hoy solo tres tienen capa 1 y 2 detrás
 * —prioridad, completar y descartar, y los workbenches— y las otras se dejan
 * afuera en vez de aparecer grises:
 *
 * | Del menú | Por qué no |
 * |---|---|
 * | Fecha | `setTaskToken` sabe escribir `due`, pero no hay con qué elegir una |
 * | Recurrencia | Ídem con `rec`, y el botón por grupo es de la §11 |
 * | Completar y archivar | `archivado.ts` tiene la lógica pura y ninguna escritura: toca dos archivos a la vez. Paso 6 |
 * | Eliminar | Es el descarte físico de la §12, con confirmación. Paso 6 |
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
    }
  };
}

/**
 * El ⋯: prioridad y completar. Nada más, por ahora.
 *
 * Los tres niveles van planos y no en un submenú: `setSubmenu` no está en las
 * tipificaciones públicas de Obsidian, y un rótulo con `setIsLabel` más tres
 * ítems marcables dice lo mismo sin apoyarse en API que no está prometida.
 *
 * El nivel marcado es el que **se ve** (`nivelVisible`), no el propio: una hija
 * sin `p=` se dibuja con la prioridad de su madre, y marcar «normal» sobre una
 * línea que se ve roja diría lo contrario de lo que muestra la pantalla.
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
