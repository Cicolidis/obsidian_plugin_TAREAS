import {
  App,
  MarkdownView,
  Plugin,
  PluginSettingTab,
  Setting,
  editorInfoField,
  editorLivePreviewField,
  setIcon,
} from "obsidian";
import type { EditorView } from "@codemirror/view";
import { Prec } from "@codemirror/state";
import type { EditorState } from "@codemirror/state";
import {
  CLASES_DE_FILA,
  CLASES_DE_REVELACION,
  claseDeFila,
  claseDeRevelacion,
  type Favoritos,
} from "./botones.js";
import { comandos } from "./comandos.js";
import { CLASES_DE_ESTILO, clasesDelEstilo } from "./color.js";
import { filaDeBotones, filaEnElMargen } from "./editor/filaDeBotones.js";
import { cursorExterno } from "./editor/cursorExterno.js";
import { manejarClicEnFila } from "./editor/menuDeTarea.js";
import { checkboxAutomatico } from "./editor/autoCheckbox.js";
import { clicAlFinal } from "./editor/clicAlFinal.js";
import { decoraciones } from "./editor/decoraciones.js";
import { protegerTramo } from "./editor/protegerTramo.js";
import { unirLimpio } from "./editor/unirLimpio.js";
import { esNotaDeTareas, notasDeTrabajo, NOTAS_POR_OMISION } from "./notas.js";
import {
  cargarSettings,
  DEFAULT_SETTINGS,
  ESTILOS_DE_FILA,
  ESTILOS_DE_PRIORIDAD,
  MODOS_OFRECIDOS,
  sanearEstilo,
  sanearEstiloDeFila,
  sanearNotas,
  sanearRevelacion,
  sanearWorkbench,
  sanearWorkbenchOpcional,
  type TareasSettings,
} from "./settingsData.js";
import { StoreDeTareas } from "./store.js";
import { STRINGS } from "./strings.js";
import { puertoObsidian } from "./vault/puertoObsidian.js";

/**
 * Plugin de tareas — pasos 1, 3, 4a y 4b de la §20 de la spec.
 *
 * Están el camino completo de lectura y escritura —el índice en memoria que se
 * mantiene solo y los comandos que escriben por él—, la decoración pasiva sobre
 * la nota —el token invisible en Live Preview y el color de la prioridad— y la
 * fila de botones de la §13.0. Todavía no hay vistas.
 *
 * Este archivo es el único de la capa 3 que importa `obsidian`, y por eso es el
 * único que traduce «un editor de CodeMirror» a «un archivo del vault». Los
 * módulos de `editor/` reciben esa decisión como función y se prueban enteros
 * contra un `EditorState` pelado, sin abrir la aplicación.
 */
/** La clase del glifo. Las de los estilos las da `color.ts`. */
const CLASE_DE_GLIFO = "tareas-ind-glifo";

export default class TareasPlugin extends Plugin {
  settings: TareasSettings = { ...DEFAULT_SETTINGS };
  store!: StoreDeTareas;

  override async onload(): Promise<void> {
    this.settings = cargarSettings(await this.loadData());

    // El store se arma **antes** que las extensiones: la fila de botones lo
    // captura por closure y necesita que exista. Armarlo no lee ningún archivo
    // —eso pasa en `arrancar()`, dentro de `onLayoutReady`—, así que adelantarlo
    // no cambia nada del arranque.
    this.store = new StoreDeTareas(
      puertoObsidian(this.app, () => this.notasDelStore(), (ref) => this.registerEvent(ref)),
    );
    this.store.congelado = this.settings.congelarStore;
    this.store.alActualizar((e) => {
      if (!this.settings.registrarEventos) return;
      console.log(
        `[tareas] ${e.path} · ${e.tareas} tareas · ${e.ms.toFixed(2)} ms · ${e.origen}`,
      );
    });

    // Las extensiones se registran una vez y leen la configuración por closure:
    // así tocar un interruptor o agregar una nota tiene efecto en el momento,
    // sin recargar el plugin ni reabrir la nota.
    //
    // **El orden importa y no es cosmético.** `filterTransaction` recorre los
    // filtros en orden inverso de precedencia —leído en @codemirror/state
    // 6.5.0—, así que `Prec.low` hace que `protegerTramo` corra **primero** y
    // `autoCheckbox` reciba el Enter con el token ya devuelto a su línea. Al
    // revés, el checkbox automático deja de andar en toda tarea con token. Hay
    // un test que lo fija.
    this.registerEditorExtension([
      // El orden de los tres filtros es una decisión de diseño y está fijado por
      // tests: `unirLimpio` decide el **texto** de la línea unida, `protegerTramo`
      // acomoda el **token** sobre ese resultado, y `autoCheckbox` mira el
      // checkbox al final. Van de menor a mayor precedencia porque es el orden en
      // que `filterTransaction` los recorre.
      Prec.lowest(unirLimpio((state) => this.unirActivo(state))),
      Prec.low(protegerTramo((state) => this.enNotaDeTareas(state))),
      checkboxAutomatico((state) => this.filtroActivo(state)),
      // Va con el mismo predicado que las decoraciones: sin token escondido no
      // hay nada que corregir en el clic, y con el interruptor apagado tampoco.
      clicAlFinal((state) => this.decorarActivo(state)),
      decoraciones(
        (state) => this.decorarActivo(state),
        (ms, lineas) => {
          if (!this.settings.registrarEventos) return;
          console.log(`[tareas] decorar · ${lineas} líneas · ${ms.toFixed(2)} ms`);
        },
      ),
      // La fila va en un `ViewPlugin` y no en un `StateField`, y eso **no**
      // contradice la §5.5: un widget inline de ancho cero sin `estimatedHeight`
      // ni `lineBreaks` no entra al mapa de alturas venga de donde venga.
      // Verificado adentro del asar instalado; el porqué está en
      // `editor/filaDeBotones.ts` y hay un test que falla si el widget declara
      // altura alguna vez.
      // Que un cambio externo no le mueva el cursor al usuario. Va con el mismo
      // alcance que el resto: solo en las notas de la lista.
      cursorExterno((state) => this.enNotaDeTareas(state)),
      filaDeBotones(
        (state) => this.filaActiva(state),
        this.opcionesDeFila(),
        (ms, lineas) => {
          if (!this.settings.registrarEventos) return;
          console.log(`[tareas] fila · ${lineas} líneas visibles · ${ms.toFixed(2)} ms`);
        },
      ),
      // La misma fila, en un margen propio a la derecha de los números de línea.
      // `Prec.lowest` es lo que la pone **después** del margen de Obsidian: «el
      // orden en que aparecen los márgenes lo decide la precedencia de su
      // extensión». Los dos no pueden estar encendidos a la vez, y de eso se
      // encargan `filaActiva` y `filaEnMargenActiva`.
      Prec.lowest(filaEnElMargen((state) => this.filaEnMargenActiva(state), this.opcionesDeFila())),
    ]);

    this.sincronizarIndicadores();

    // `onLayoutReady` y no `onload`: al arrancar, Obsidian dispara eventos de
    // creación por cada archivo del vault mientras indexa, y leer notas en el
    // medio de eso pelea con el arranque de la aplicación.
    this.app.workspace.onLayoutReady(() => {
      void this.store.arrancar();
    });

    for (const c of comandos({
      app: this.app,
      store: this.store,
      notas: () => this.notasDelStore(),
      workbench: () => this.settings.workbenchFavorito,
    })) {
      this.addCommand(c);
    }

    this.addSettingTab(new TareasSettingTab(this.app, this));
  }

  override onunload(): void {
    this.store?.detener();
    // Las clases viven en `body` y no en el editor, así que no se van solas.
    for (const c of CLASES_DE_ESTILO) document.body.removeClass(c);
    for (const c of CLASES_DE_REVELACION) document.body.removeClass(c);
    for (const c of CLASES_DE_FILA) document.body.removeClass(c);
    document.body.removeClass(CLASE_DE_GLIFO);
  }

  /**
   * Los indicadores de forma de la prioridad viajan como clases en `body`.
   *
   * La decoración pone siempre la misma clase de nivel y **la hoja de estilos
   * decide qué dibuja**. Es lo más barato que tiene efecto sin recargar y sin
   * tocar la extensión: alternar un ajuste no puede obligar a reconstruir el
   * `StateField` de cada editor abierto.
   */
  private sincronizarIndicadores(): void {
    const encendidas = new Set(clasesDelEstilo(this.settings.estiloDePrioridad));
    for (const c of CLASES_DE_ESTILO) document.body.toggleClass(c, encendidas.has(c));
    document.body.toggleClass(CLASE_DE_GLIFO, this.settings.indicadorGlifo);

    // El modo de revelación de la fila, por lo mismo: el widget dibuja siempre
    // lo mismo y la hoja de estilos decide si se ve (§15 punto 1).
    const modo = claseDeRevelacion(this.settings.modoDeRevelacion);
    for (const c of CLASES_DE_REVELACION) document.body.toggleClass(c, c === modo);

    const donde = claseDeFila(this.settings.estiloDeFila);
    for (const c of CLASES_DE_FILA) document.body.toggleClass(c, c === donde);
  }

  /**
   * Las notas que el índice parsea: las de la lista **menos el LOG**.
   *
   * La §12: el historial se lee cuando se abre la vista, nunca al arrancar. Es
   * el único conjunto que solo recibe y crece sin techo.
   */
  private notasDelStore(): readonly string[] {
    return notasDeTrabajo(this.settings.notasDeTareas, this.settings.notaDeLog);
  }

  /**
   * ¿Este editor está sobre una nota de la lista?
   *
   * Es el único lugar del plugin que traduce «un editor de CodeMirror» a «un
   * archivo del vault». Vive acá y no en `editor/` para que aquellos módulos no
   * importen `obsidian` —que además es un paquete de solo tipos— y se puedan
   * probar enteros offline.
   */
  private enNotaDeTareas(state: EditorState): boolean {
    const info = state.field(editorInfoField, false);
    return esNotaDeTareas(info?.file?.path ?? null, this.settings.notasDeTareas);
  }

  /** ¿Se limpia la línea al unir dos tareas acá? */
  private unirActivo(state: EditorState): boolean {
    return this.settings.unirLimpio && this.enNotaDeTareas(state);
  }

  /** ¿Corrige el checkbox automático acá? */
  private filtroActivo(state: EditorState): boolean {
    return this.settings.checkboxAutomatico && this.enNotaDeTareas(state);
  }

  /**
   * Lo que las dos formas de la fila necesitan del mundo.
   *
   * Se arma una vez y la comparten el widget y el margen: si cada uno tuviera
   * su propio `alClic`, un arreglo entraría en uno y no en el otro.
   */
  private opcionesDeFila() {
    return {
      favoritos: () => this.favoritos(),
      alClic: manejarClicEnFila({
        app: this.app,
        store: this.store,
        notas: () => this.notasDelStore(),
        favoritos: () => this.favoritos(),
        archivoDe: (state: EditorState) =>
          state.field(editorInfoField, false)?.file?.path ?? null,
      }),
      dibujarIcono: (el: HTMLElement, icono: string) => setIcon(el, icono),
    };
  }

  /** Los dos botones fijos de la fila (§13.0: «asignables en settings»). */
  private favoritos(): Favoritos {
    return {
      primario: this.settings.workbenchFavorito,
      secundario: this.settings.workbenchSecundario,
    };
  }

  /**
   * ¿Va la fila de botones acá?
   *
   * Mismo alcance que las decoraciones —Live Preview y nota de la lista— con su
   * propio interruptor. Son dos ajustes y no uno porque hacen cosas distintas:
   * apagar el color no tiene por qué apagar los botones, y al revés tampoco.
   */
  private filaActiva(state: EditorState): boolean {
    // `columna` la dibuja el margen, no el widget: los dos encendidos a la vez
    // pondrían dos filas por tarea.
    if (this.settings.estiloDeFila === "columna") return false;
    return this.filaEncendida(state);
  }

  /** ¿Va la fila en su margen propio acá? Es `columna` y nada más. */
  private filaEnMargenActiva(state: EditorState): boolean {
    return this.settings.estiloDeFila === "columna" && this.filaEncendida(state);
  }

  private filaEncendida(state: EditorState): boolean {
    if (!this.settings.filaDeBotones) return false;
    if (!state.field(editorLivePreviewField, false)) return false;
    return this.enNotaDeTareas(state);
  }

  /**
   * ¿Se decora acá?
   *
   * Solo en Live Preview: en modo fuente el token **tiene que verse**, que es
   * donde uno va a arreglarlo a mano, y en modo lectura se esconde solo porque
   * `%%…%%` es comentario nativo de Obsidian (§5.1).
   */
  private decorarActivo(state: EditorState): boolean {
    if (!this.settings.decoracionesEnLaNota) return false;
    if (!state.field(editorLivePreviewField, false)) return false;
    return this.enNotaDeTareas(state);
  }

  async guardar(): Promise<void> {
    await this.saveData(this.settings);
    this.sincronizarIndicadores();
    this.redibujar();
    // Los ajustes tienen efecto sin recargar: es lo que hace que agregar una
    // nota o encender el congelado se pueda probar en el momento.
    if (this.store) {
      this.store.congelado = this.settings.congelarStore;
      await this.store.resincronizar();
    }
  }

  /**
   * Despacha una transacción vacía en cada editor markdown abierto.
   *
   * Las extensiones leen la configuración por closure, así que un ajuste tiene
   * efecto en la próxima transacción — y cambiar un ajuste **no produce
   * ninguna**. Sin esto, renombrar un workbench favorito dejaría el ★ mirando
   * el nombre viejo hasta la próxima tecla, que es el peor tipo de bug: se
   * arregla solo y por eso no se reporta nunca.
   *
   * Una transacción sin cambios no toca el documento ni ensucia el buffer: no
   * dispara `modify` ni `changed`, y no llega a `vault.process`. Nada que ver
   * con una escritura (§8, regla 2).
   */
  private redibujar(): void {
    for (const hoja of this.app.workspace.getLeavesOfType("markdown")) {
      if (!(hoja.view instanceof MarkdownView)) continue;
      // `editor.cm` no está en las tipificaciones públicas: es la vista de
      // CodeMirror que Obsidian expone de hecho, y es la que ya usa el espía de
      // transacciones de `scripts/espia.js`.
      const cm = (hoja.view.editor as unknown as { cm?: EditorView }).cm;
      cm?.dispatch({});
    }
  }
}

class TareasSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: TareasPlugin,
  ) {
    super(app, plugin);
  }

  override display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName(STRINGS.ajustes.checkboxAutomatico.nombre)
      .setDesc(STRINGS.ajustes.checkboxAutomatico.descripcion)
      .addToggle((t) =>
        t.setValue(this.plugin.settings.checkboxAutomatico).onChange(async (v) => {
          this.plugin.settings.checkboxAutomatico = v;
          await this.plugin.guardar();
        }),
      );

    const notas = new Setting(containerEl)
      .setName(STRINGS.ajustes.notas.nombre)
      .setDesc(STRINGS.ajustes.notas.descripcion);
    notas.settingEl.addClass("tareas-ajustes-notas");
    notas.addTextArea((ta) => {
      ta.setPlaceholder(STRINGS.ajustes.notas.marcador)
        .setValue(this.plugin.settings.notasDeTareas.join("\n"))
        // Se sanea lo guardado pero **no se reescribe el campo**: normalizar
        // mientras alguien escribe le borra la línea en blanco que acaba de
        // abrir para agregar una nota.
        .onChange(async (v) => {
          this.plugin.settings.notasDeTareas = sanearNotas(v.split("\n"));
          await this.plugin.guardar();
        });
      ta.inputEl.rows = 8;
    });
    notas.addExtraButton((b) =>
      b
        .setIcon("rotate-ccw")
        .setTooltip(STRINGS.ajustes.notas.restaurar)
        .onClick(async () => {
          this.plugin.settings.notasDeTareas = [...NOTAS_POR_OMISION];
          await this.plugin.guardar();
          this.display();
        }),
    );

    new Setting(containerEl)
      .setName(STRINGS.ajustes.unirLimpio.nombre)
      .setDesc(STRINGS.ajustes.unirLimpio.descripcion)
      .addToggle((t) =>
        t.setValue(this.plugin.settings.unirLimpio).onChange(async (v) => {
          this.plugin.settings.unirLimpio = v;
          await this.plugin.guardar();
        }),
      );

    new Setting(containerEl)
      .setName(STRINGS.ajustes.notaDeLog.nombre)
      .setDesc(STRINGS.ajustes.notaDeLog.descripcion)
      .addText((t) =>
        t.setValue(this.plugin.settings.notaDeLog).onChange(async (v) => {
          this.plugin.settings.notaDeLog = v.trim().normalize("NFC");
          await this.plugin.guardar();
        }),
      );

    new Setting(containerEl)
      .setName(STRINGS.ajustes.workbenchFavorito.nombre)
      .setDesc(STRINGS.ajustes.workbenchFavorito.descripcion)
      .addText((t) =>
        t.setValue(this.plugin.settings.workbenchFavorito).onChange(async (v) => {
          this.plugin.settings.workbenchFavorito = sanearWorkbench(v);
          await this.plugin.guardar();
        }),
      );

    new Setting(containerEl)
      .setName(STRINGS.ajustes.workbenchSecundario.nombre)
      .setDesc(STRINGS.ajustes.workbenchSecundario.descripcion)
      .addText((t) =>
        t
          .setPlaceholder(STRINGS.ajustes.workbenchSecundario.marcador)
          .setValue(this.plugin.settings.workbenchSecundario)
          // Vacío es una respuesta válida y no cae al de por omisión: significa
          // «este botón no existe», y la fila dibuja tres en vez de cuatro.
          .onChange(async (v) => {
            this.plugin.settings.workbenchSecundario = sanearWorkbenchOpcional(v);
            await this.plugin.guardar();
          }),
      );

    new Setting(containerEl)
      .setName(STRINGS.ajustes.filaDeBotones.nombre)
      .setDesc(STRINGS.ajustes.filaDeBotones.descripcion)
      .addToggle((t) =>
        t.setValue(this.plugin.settings.filaDeBotones).onChange(async (v) => {
          this.plugin.settings.filaDeBotones = v;
          await this.plugin.guardar();
        }),
      );

    new Setting(containerEl)
      .setName(STRINGS.ajustes.estiloDeFila.nombre)
      .setDesc(STRINGS.ajustes.estiloDeFila.descripcion)
      .addDropdown((d) => {
        // Los cinco conviven y se comparan **en Obsidian**, que es el único
        // lugar donde se puede juzgar cómo se ve algo (patrón `designFlags.ts`).
        for (const e of ESTILOS_DE_FILA) {
          d.addOption(e, STRINGS.ajustes.estiloDeFila.opciones[e]);
        }
        d.setValue(this.plugin.settings.estiloDeFila).onChange(async (v) => {
          this.plugin.settings.estiloDeFila = sanearEstiloDeFila(v);
          await this.plugin.guardar();
        });
      });

    new Setting(containerEl)
      .setName(STRINGS.ajustes.modoDeRevelacion.nombre)
      .setDesc(STRINGS.ajustes.modoDeRevelacion.descripcion)
      .addDropdown((d) => {
        // Solo los modos **ofrecidos**: `swipe` existe en el tipo y no acá,
        // porque hoy no hace nada (§15). Un modo que no funciona es lo mismo
        // que un ítem gris en el ⋯.
        for (const m of MODOS_OFRECIDOS) {
          d.addOption(m, STRINGS.ajustes.modoDeRevelacion.opciones[m]);
        }
        d.setValue(this.plugin.settings.modoDeRevelacion).onChange(async (v) => {
          this.plugin.settings.modoDeRevelacion = sanearRevelacion(v);
          await this.plugin.guardar();
        });
      });

    new Setting(containerEl)
      .setName(STRINGS.ajustes.decoraciones.nombre)
      .setDesc(STRINGS.ajustes.decoraciones.descripcion)
      .addToggle((t) =>
        t.setValue(this.plugin.settings.decoracionesEnLaNota).onChange(async (v) => {
          this.plugin.settings.decoracionesEnLaNota = v;
          await this.plugin.guardar();
        }),
      );

    // Los tres estilos conviven y se comparan **en Obsidian**, que es el único
    // lugar donde se puede juzgar cómo se ve algo. Es el patrón `designFlags.ts`:
    // un diseño nuevo se prueba encendiéndolo, no tirando el anterior.
    new Setting(containerEl)
      .setName(STRINGS.ajustes.estiloDePrioridad.nombre)
      .setDesc(STRINGS.ajustes.estiloDePrioridad.descripcion)
      .addDropdown((d) => {
        for (const e of ESTILOS_DE_PRIORIDAD) {
          d.addOption(e, STRINGS.ajustes.estiloDePrioridad.opciones[e]);
        }
        d.setValue(this.plugin.settings.estiloDePrioridad).onChange(async (v) => {
          this.plugin.settings.estiloDePrioridad = sanearEstilo(v);
          await this.plugin.guardar();
        });
      });

    new Setting(containerEl)
      .setName(STRINGS.ajustes.indicadorGlifo.nombre)
      .setDesc(STRINGS.ajustes.indicadorGlifo.descripcion)
      .addToggle((t) =>
        t.setValue(this.plugin.settings.indicadorGlifo).onChange(async (v) => {
          this.plugin.settings.indicadorGlifo = v;
          await this.plugin.guardar();
        }),
      );

    // Andamiaje de verificación (patrón `designFlags.ts` de Anotaciones): se
    // enciende para probar, no reemplaza nada, y apagado no cambia nada.
    new Setting(containerEl).setName(STRINGS.ajustes.verificacion.titulo).setHeading();
    containerEl.createEl("p", {
      text: STRINGS.ajustes.verificacion.descripcion,
      cls: "setting-item-description",
    });

    new Setting(containerEl)
      .setName(STRINGS.ajustes.verificacion.congelarStore.nombre)
      .setDesc(STRINGS.ajustes.verificacion.congelarStore.descripcion)
      .addToggle((t) =>
        t.setValue(this.plugin.settings.congelarStore).onChange(async (v) => {
          this.plugin.settings.congelarStore = v;
          await this.plugin.guardar();
        }),
      );

    new Setting(containerEl)
      .setName(STRINGS.ajustes.verificacion.registrarEventos.nombre)
      .setDesc(STRINGS.ajustes.verificacion.registrarEventos.descripcion)
      .addToggle((t) =>
        t.setValue(this.plugin.settings.registrarEventos).onChange(async (v) => {
          this.plugin.settings.registrarEventos = v;
          await this.plugin.guardar();
        }),
      );
  }
}
