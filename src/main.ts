import {
  App,
  Plugin,
  PluginSettingTab,
  Setting,
  editorInfoField,
  editorLivePreviewField,
} from "obsidian";
import { Prec } from "@codemirror/state";
import type { EditorState } from "@codemirror/state";
import { comandos } from "./comandos.js";
import { CLASES_DE_ESTILO, clasesDelEstilo } from "./color.js";
import { checkboxAutomatico } from "./editor/autoCheckbox.js";
import { clicAlFinal } from "./editor/clicAlFinal.js";
import { decoraciones } from "./editor/decoraciones.js";
import { protegerTramo } from "./editor/protegerTramo.js";
import { unirLimpio } from "./editor/unirLimpio.js";
import { esNotaDeTareas, notasDeTrabajo, NOTAS_POR_OMISION } from "./notas.js";
import {
  cargarSettings,
  DEFAULT_SETTINGS,
  ESTILOS_DE_PRIORIDAD,
  sanearEstilo,
  sanearNotas,
  sanearWorkbench,
  type TareasSettings,
} from "./settingsData.js";
import { StoreDeTareas } from "./store.js";
import { STRINGS } from "./strings.js";
import { puertoObsidian } from "./vault/puertoObsidian.js";

/**
 * Plugin de tareas — pasos 1, 3 y 4a de la §20 de la spec.
 *
 * Están el camino completo de lectura y escritura —el índice en memoria que se
 * mantiene solo y los comandos que escriben por él— y la decoración pasiva
 * sobre la nota: el token invisible en Live Preview y el color de la prioridad.
 * Todavía no hay botones, menús ni vistas.
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
    ]);

    this.sincronizarIndicadores();

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
    // Los ajustes tienen efecto sin recargar: es lo que hace que agregar una
    // nota o encender el congelado se pueda probar en el momento.
    if (this.store) {
      this.store.congelado = this.settings.congelarStore;
      await this.store.resincronizar();
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
