import { Menu, Modal, Notice, Setting, type App } from "obsidian";
import type { EditorState } from "@codemirror/state";
import { workbenchesDelPopover, type Favoritos } from "../botones.js";
import {
  alternarWorkbench,
  archivarTarea,
  completarTarea,
  elegirEnLinea,
  eliminarTarea,
  fijarFecha,
  fijarPrioridad,
  fijarRecurrencia,
  hoy,
  nivelVisible,
  type Contexto,
} from "../comandos.js";
import { atajosDeDiaDelMes, atajosDeFecha } from "../fechas.js";
import { elegirFecha } from "../ui/elegirFecha.js";
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
 * ## El ⋯ está completo desde el paso 6b
 *
 * La §13.0 lista seis cosas —fecha, prioridad, recurrencia, completar y
 * descartar, completar y archivar, eliminar— y **están las seis**. Las dos
 * últimas en llegar son fecha y recurrencia, que hasta acá no aparecían ni
 * grises: `setTaskToken` sabía escribir `due` y `rec` desde el paso 2, pero no
 * había con qué elegir una fecha ni cómo reiniciar un grupo, y un ítem gris
 * ocupa el mismo lugar que uno que anda y no hace nada. Es la misma decisión
 * que deja al ◐ sin dibujar cuando no tiene workbench.
 *
 * **Lo que queda afuera y no es del ⋯:** el botón de reinicio por grupo, que la
 * §11 pone en la vista y por ahora vive en un comando de paleta, y «archivar y
 * reiniciar», que es el archivado multiplicado por N y va con la pestaña.
 *
 * El orden **no** es el de la §13.0. Prioridad va primera porque ya estaba, y
 * mover el primer ítem de un menú que se usa todos los días cuesta más de lo
 * que ordena. Fecha y recurrencia entran detrás, antes de los dos verbos de
 * terminar.
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

/**
 * Qué pasa con un Cmd+clic sobre el checkbox: completar y archivar.
 *
 * Mismo recorrido que la fila —`elegirEnLinea` traduce la coordenada de ahora a
 * la del índice, que puede ser de hace un rato— y misma negativa sobre una
 * línea ilegible. Es una puerta más a `archivarTarea`, no un camino nuevo.
 */
export function manejarClicEnCheckbox(
  dep: DependenciasDeMenu,
): (view: { state: EditorState }, linea: number, texto: string) => void {
  const fecha = dep.ahora ?? (() => hoy());

  return (view, linea, texto) => {
    if (parseTaskToken(texto).estado === "ilegible") {
      new Notice(STRINGS.avisos.tokenIlegible, 8000);
      return;
    }
    const ctx = elegirEnLinea(dep.store, dep.notas(), dep.archivoDe(view.state), linea, texto);
    if (!ctx) return;
    void archivarTarea(
      dep.app,
      dep.store,
      ctx,
      fecha(),
      dep.notaDeLog(),
      dep.confirmarAlArchivar(),
    );
  };
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
        abrirMenu(dep, ctx, clic.evento, fecha, clic.texto);
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
  texto: string,
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
  // Los dos abren **su propio `Menu`**, no un submenú: `setSubmenu` no está en
  // las tipificaciones públicas de Obsidian, que es la misma razón por la que
  // los tres niveles de prioridad van planos. Se posicionan con el mismo
  // `MouseEvent`, como hace el → con su popover.
  menu.addItem((i) =>
    i
      .setTitle(STRINGS.menu.fecha)
      .setIcon("calendar")
      .onClick(() => abrirSubmenuDeFecha(dep, ctx, evento, fecha, texto)),
  );
  menu.addItem((i) =>
    i
      .setTitle(STRINGS.menu.recurrencia)
      .setIcon("repeat")
      .onClick(() => abrirSubmenuDeRecurrencia(dep, ctx, evento, texto)),
  );

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
 * El submenú de fecha: atajos primero, el campo como salida.
 *
 * **Los atajos dependen de si la tarea es cíclica**, y eso se lee del **texto
 * de ahora**, no del store: `due` guarda una fecha en una tarea normal y el día
 * del mes en una cíclica (§11), y entre que el ⋯ se dibujó y que se hizo clic
 * pudo entrar una tecla. Es la misma regla con la que `manejarClicEnFila`
 * decide si la línea es legible.
 *
 * **La fecha resuelta va en la etiqueta.** «El lunes» sobre un lunes es
 * ambiguo, y la regla que lo resuelve —hoy cuenta como hoy, igual que
 * `resolverDue` con el día del mes— no se puede adivinar desde un menú.
 * Mostrarla lo contesta sin que haya nada que aprender, y de paso deja ver cuál
 * de las dos formas va a escribir, que en la nota no se ve porque el token está
 * oculto.
 */
function abrirSubmenuDeFecha(
  dep: DependenciasDeMenu,
  ctx: Contexto,
  evento: MouseEvent,
  fecha: () => string,
  texto: string,
): void {
  const a = parseTaskToken(texto);
  const ciclica = a.estado === "ok" && a.meta.rec !== null;
  const actual = a.estado === "ok" ? a.meta.due : null;
  const menu = new Menu().setUseNativeMenu(false);
  const poner = (due: string | null) => fijarFecha(dep.app, dep.store, ctx, due);

  if (ciclica) {
    for (const { clave, valor } of atajosDeDiaDelMes(fecha())) {
      menu.addItem((i) =>
        i
          .setTitle(
            STRINGS.menu.atajo(
              STRINGS.menu.atajosDeDiaDelMes[clave],
              STRINGS.menu.diaDelMes(valor),
            ),
          )
          .setChecked(valor === actual)
          .onClick(() => poner(valor)),
      );
    }
  } else {
    for (const { clave, valor } of atajosDeFecha(fecha())) {
      menu.addItem((i) =>
        i
          .setTitle(
            STRINGS.menu.atajo(STRINGS.menu.atajosDeFecha[clave], STRINGS.menu.fechaCorta(valor)),
          )
          .setChecked(valor === actual)
          .onClick(() => poner(valor)),
      );
    }
  }

  menu.addSeparator();
  menu.addItem((i) =>
    i
      .setTitle(STRINGS.menu.otraFecha)
      .setIcon("calendar-days")
      .onClick(() => elegirFecha(dep.app, { ciclica, actual }, poner)),
  );
  menu.addItem((i) =>
    i
      .setTitle(STRINGS.menu.sinFecha)
      .setChecked(actual === null)
      .onClick(() => poner(null)),
  );

  menu.showAtMouseEvent(evento);
}

/**
 * El submenú de recurrencia: los grupos que ya existen, y uno nuevo.
 *
 * Mismo esqueleto que el → (§11: los grupos «se crean escribiéndolos, como los
 * workbenches»), con dos diferencias que salen de que un grupo **no** es un
 * workbench: no hay atajo numérico —no es la acción más frecuente del plugin, y
 * el 1-9 del → existe porque aquella sí lo es— y hay un ítem para sacarlo, que
 * el → resuelve con el toggle sobre el mismo nombre.
 *
 * Los grupos son **globales**: salen de `gruposEnUso()`, que mira todas las
 * notas. Un grupo de reinicio no es de una nota — el botón de la §11 lo barre
 * entero.
 */
function abrirSubmenuDeRecurrencia(
  dep: DependenciasDeMenu,
  ctx: Contexto,
  evento: MouseEvent,
  texto: string,
): void {
  const a = parseTaskToken(texto);
  const actual = a.estado === "ok" ? a.meta.rec : null;
  const menu = new Menu().setUseNativeMenu(false);
  const etiquetar = (rec: string | null) => fijarRecurrencia(dep.app, dep.store, ctx, rec);

  const grupos = dep.store.gruposEnUso();
  for (const g of grupos) {
    menu.addItem((i) =>
      i
        .setTitle(g)
        .setChecked(g === actual)
        .onClick(() => etiquetar(g)),
    );
  }
  if (grupos.length) menu.addSeparator();

  menu.addItem((i) =>
    i
      .setTitle(STRINGS.menu.grupoNuevo)
      .setIcon("plus")
      .onClick(() =>
        new NombreNuevoModal(dep.app, STRINGS.menu.nuevoGrupo, etiquetar).open(),
      ),
  );
  menu.addItem((i) =>
    i
      .setTitle(STRINGS.menu.noEsCiclica)
      .setChecked(actual === null)
      .onClick(() => etiquetar(null)),
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
      .onClick(() => new NombreNuevoModal(dep.app, STRINGS.menu.nuevoWorkbench, mandar).open()),
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
 * «Workbench nuevo…» y «Grupo nuevo…»: un nombre y listo.
 *
 * **Un solo modal para los dos**, y no por ahorrar líneas: los workbenches
 * (§10) y los grupos de reinicio (§11) «se crean escribiendo un nombre, sin
 * panel de administración», y los dos viven en el mismo token con la misma
 * gramática —`NOMBRE_RE` en `token.ts` es literalmente la misma para `wb` y
 * para `rec`—. Dos clases con el mismo saneo divergirían justo en si aceptan un
 * `;`, y un `;` deja la línea ilegible para siempre (§5.3).
 *
 * El nombre se sanea con `sanearWorkbenchOpcional`, **reusado**: `;`, `,` y `%`
 * romperían el `%%t:…%%`. Vale más negarse que dejar que un campo de texto
 * corrompa tareas.
 */
interface TextosDeNombre {
  titulo: string;
  descripcion: string;
  marcador: string;
  aceptar: string;
  cancelar: string;
  invalido: string;
}

class NombreNuevoModal extends Modal {
  constructor(
    app: App,
    private readonly t: TextosDeNombre,
    private readonly alAceptar: (nombre: string) => void,
  ) {
    super(app);
  }

  override onOpen(): void {
    const t = this.t;
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
