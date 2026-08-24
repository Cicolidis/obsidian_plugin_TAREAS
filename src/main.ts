import { App, Plugin, PluginSettingTab, Setting, editorInfoField } from "obsidian";
import type { EditorState } from "@codemirror/state";
import { comandos } from "./comandos.js";
import { checkboxAutomatico } from "./editor/autoCheckbox.js";
import { esNotaDeTareas, notasDeTrabajo, NOTAS_POR_OMISION } from "./notas.js";
import {
  cargarSettings,
  DEFAULT_SETTINGS,
  sanearNotas,
  sanearWorkbench,
  type TareasSettings,
} from "./settingsData.js";
import { StoreDeTareas } from "./store.js";
import { STRINGS } from "./strings.js";
import { puertoObsidian } from "./vault/puertoObsidian.js";

/**
 * Plugin de tareas — pasos 1 y 3 de la §20 de la spec.
 *
 * Todavía no hay decoraciones ni vistas. Lo que hay es el camino completo de
 * lectura y escritura: el índice en memoria que se mantiene solo, y dos comandos
 * que escriben por él. Antes de dibujar nada, garantizar que leer y escribir no
 * corrompe.
 */
export default class TareasPlugin extends Plugin {
  settings: TareasSettings = { ...DEFAULT_SETTINGS };
  store!: StoreDeTareas;

  override async onload(): Promise<void> {
    this.settings = cargarSettings(await this.loadData());

    // La extensión se registra una vez y lee la configuración por closure: así
    // tocar el interruptor o agregar una nota tiene efecto en el momento, sin
    // recargar el plugin ni reabrir la nota.
    this.registerEditorExtension([checkboxAutomatico((state) => this.filtroActivo(state))]);

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
   * ¿El filtro actúa sobre este editor?
   *
   * Es el único lugar del plugin que traduce «un editor de CodeMirror» a «un
   * archivo del vault». Vive acá y no en `autoCheckbox.ts` para que aquel
   * módulo no importe `obsidian` y se pueda probar entero offline.
   */
  private filtroActivo(state: EditorState): boolean {
    if (!this.settings.checkboxAutomatico) return false;
    const info = state.field(editorInfoField, false);
    return esNotaDeTareas(info?.file?.path ?? null, this.settings.notasDeTareas);
  }

  async guardar(): Promise<void> {
    await this.saveData(this.settings);
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
