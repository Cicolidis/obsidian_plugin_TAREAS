import { App, Plugin, PluginSettingTab, Setting, editorInfoField } from "obsidian";
import type { EditorState } from "@codemirror/state";
import { checkboxAutomatico } from "./editor/autoCheckbox.js";
import { esNotaDeTareas, NOTAS_POR_OMISION } from "./notas.js";
import { cargarSettings, DEFAULT_SETTINGS, sanearNotas, type TareasSettings } from "./settingsData.js";
import { STRINGS } from "./strings.js";

/**
 * Plugin de tareas — prototipo del paso 1 de la §20 de la spec.
 *
 * Todavía no hay store, ni token, ni vistas: esto es solo lo que hace falta
 * para poner a prueba la única hipótesis que, si falla, cambia el diseño.
 */
export default class TareasPlugin extends Plugin {
  settings: TareasSettings = { ...DEFAULT_SETTINGS };

  override async onload(): Promise<void> {
    this.settings = cargarSettings(await this.loadData());

    // La extensión se registra una vez y lee la configuración por closure: así
    // tocar el interruptor o agregar una nota tiene efecto en el momento, sin
    // recargar el plugin ni reabrir la nota.
    this.registerEditorExtension([checkboxAutomatico((state) => this.filtroActivo(state))]);

    this.addSettingTab(new TareasSettingTab(this.app, this));
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
  }
}
