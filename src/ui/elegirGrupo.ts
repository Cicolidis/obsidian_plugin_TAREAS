/**
 * «¿Qué grupo cíclico reiniciar?» (spec §11).
 *
 * Es la puerta del reinicio en esta sesión. El botón por grupo vive en la
 * pestaña Workbenches, que todavía no existe, y un comando de paleta anda sin
 * vista y sin cursor sobre una tarea — que importa, porque un grupo entero
 * puede estar completado y colapsado en cinco notas cerradas.
 *
 * Un `FuzzySuggestModal` y no un `Menu`: un comando de paleta no trae un
 * `MouseEvent`, y `showAtMouseEvent` es lo que el ⋯ y el → usan para
 * posicionarse. Y de paso los grupos se filtran escribiendo, que con veinte
 * `rec=lunes`, `rec=martes`, … de la §11 deja de ser un detalle.
 */
import { FuzzySuggestModal, type App } from "obsidian";

/** Abre el selector. Si eligen uno, llama con su nombre. */
export function elegirGrupo(
  app: App,
  grupos: readonly string[],
  titulo: string,
  alElegir: (grupo: string) => void,
): void {
  new ElegirGrupoModal(app, grupos, titulo, alElegir).open();
}

class ElegirGrupoModal extends FuzzySuggestModal<string> {
  constructor(
    app: App,
    private readonly grupos: readonly string[],
    titulo: string,
    private readonly alElegir: (grupo: string) => void,
  ) {
    super(app);
    this.setPlaceholder(titulo);
  }

  override getItems(): string[] {
    return [...this.grupos];
  }

  override getItemText(grupo: string): string {
    return grupo;
  }

  override onChooseItem(grupo: string): void {
    this.alElegir(grupo);
  }
}
