/**
 * Los dos comandos de paleta: el camino de escritura de punta a punta.
 *
 * Es el mínimo para probar todo el paso 3 sin dibujar nada. Cada uno hace el
 * mismo recorrido:
 *
 *     cursor → clave → **el store** → plan → escribir → absorber → aviso
 *
 * ## Por qué van por el store y no por el editor
 *
 * El editor tiene la línea del cursor a mano y sería más corto usarla. Se va por
 * el store a propósito, por dos razones:
 *
 * 1. Es el camino que van a usar las vistas del paso 5, donde no hay editor
 *    ninguno: el workbench actúa sobre una posición que el store recuerda.
 * 2. Es el único que ejercita `ubicar.ts` de verdad. Con el editor, el número de
 *    línea es siempre fresco por construcción y el mecanismo que más importa de
 *    esta sesión no se probaría nunca en vivo.
 *
 * El cursor se usa solo para **elegir** la tarea; lo que se escribe sale del
 * documento que el store tiene, con su `antes`, y `ubicar.ts` lo verifica contra
 * el disco en el momento de escribir.
 */
import { Notice, type App, type Editor, type MarkdownFileInfo } from "obsidian";
import {
  ilegiblesDelSubarbol,
  planDeCompletar,
  planDeWorkbench,
  yaEstaCompleta,
} from "./acciones.js";
import type { CambioDeLinea } from "./documento.js";
import { esNotaDeTareas } from "./notas.js";
import type { StoreDeTareas } from "./store.js";
import { STRINGS } from "./strings.js";
import { claveDe, type Clave } from "./tareas.js";
import { escribir, type ResultadoDeEscritura } from "./vault/escribir.js";

/** Hoy, en `AAAA-MM-DD` y en hora local. */
export function hoy(fecha = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${fecha.getFullYear()}-${p(fecha.getMonth() + 1)}-${p(fecha.getDate())}`;
}

interface Contexto {
  archivo: string;
  clave: Clave;
}

/**
 * La tarea que el cursor está eligiendo, o `null` con el aviso ya dado.
 *
 * El segundo argumento se tipa como `MarkdownFileInfo` y no como `MarkdownView`
 * porque es lo que Obsidian pasa: el comando también se dispara desde un editor
 * embebido, que no es una vista. Lo único que se necesita —`file`— lo tienen los
 * dos.
 *
 * «La tarea del cursor» es la tarea **de esa línea**, no la más cercana hacia
 * arriba. Buscar hacia arriba haría que apretar el comando sobre una nota de
 * tarea o sobre una línea en blanco escribiera en una tarea que el usuario no
 * está mirando, y eso es la clase de sorpresa que este plugin no puede permitirse.
 */
function tareaDelCursor(
  store: StoreDeTareas,
  editor: Editor,
  vista: MarkdownFileInfo,
  notas: readonly string[],
): Contexto | null {
  const archivo = vista.file?.path ?? null;
  if (!esNotaDeTareas(archivo, notas)) {
    new Notice(STRINGS.avisos.sinTarea);
    return null;
  }
  if (store.documento(archivo!) === null) {
    new Notice(STRINGS.avisos.sinIndice);
    return null;
  }

  const clave = claveDe(archivo!, editor.getCursor().line);
  if (!store.buscar(archivo!, clave)) {
    new Notice(STRINGS.avisos.sinTarea);
    return null;
  }
  return { archivo: archivo!, clave };
}

/**
 * Escribe el plan y actualiza el store con lo que quedó escrito.
 *
 * `exito` recibe cuántas líneas se escribieron para poder decirlo. El aviso de
 * fracaso lo da esta función, porque es siempre el mismo y siempre importa: una
 * escritura que no ocurrió y nadie avisó es indistinguible de un plugin roto.
 */
async function aplicar(
  app: App,
  store: StoreDeTareas,
  archivo: string,
  cambios: readonly CambioDeLinea[],
  exito: (n: number) => string,
): Promise<ResultadoDeEscritura> {
  const r = await escribir(app, archivo, cambios);

  if (r.estado === "escrito") {
    // Lo que devolvió `process` entra al store en el acto, sin esperar al
    // evento. El `changed` que llegue después trae lo mismo y no reparsea.
    store.absorber(archivo, r.contenido, "escritura");
    new Notice(exito(r.lineas) + (r.movidas > 0 ? ` (${r.movidas} se habían corrido)` : ""));
  } else if (r.estado === "no-ubicada") {
    new Notice(STRINGS.avisos.noUbicada, 8000);
  } else if (r.estado === "sin-cambios") {
    new Notice(STRINGS.avisos.sinCambios);
  }
  return r;
}

export interface DependenciasDeComandos {
  app: App;
  store: StoreDeTareas;
  /** La lista efectiva, leída en el momento: los ajustes cambian sin recargar. */
  notas: () => readonly string[];
  workbench: () => string;
  ahora?: () => string;
}

/** Los dos comandos, con la forma que `Plugin.addCommand` espera. */
export function comandos(dep: DependenciasDeComandos) {
  const fecha = dep.ahora ?? (() => hoy());

  return [
    {
      id: "completar-tarea-del-cursor",
      name: STRINGS.comandos.completar,
      editorCallback: (editor: Editor, vista: MarkdownFileInfo) => {
        const ctx = tareaDelCursor(dep.store, editor, vista, dep.notas());
        if (!ctx) return;

        const doc = dep.store.documento(ctx.archivo)!;
        const tareas = dep.store.tareasDe(ctx.archivo);
        if (yaEstaCompleta(tareas, ctx.clave)) {
          new Notice(STRINGS.avisos.yaCompleta);
          return;
        }

        // Se avisa **antes** de escribir: saltear una línea rota es lo correcto
        // (§5.3), pero saltearla en silencio deja una madre en `[x]` y una hija
        // en `[ ]` sin explicación.
        const rotas = ilegiblesDelSubarbol(doc, tareas, ctx.clave);
        if (rotas.length) new Notice(STRINGS.avisos.ilegibles(rotas.length), 8000);

        void aplicar(
          dep.app,
          dep.store,
          ctx.archivo,
          planDeCompletar(doc, tareas, ctx.clave, fecha()),
          STRINGS.avisos.completadas,
        );
      },
    },
    {
      id: "asignar-workbench-favorito",
      name: STRINGS.comandos.workbench,
      editorCallback: (editor: Editor, vista: MarkdownFileInfo) => {
        const ctx = tareaDelCursor(dep.store, editor, vista, dep.notas());
        if (!ctx) return;

        const doc = dep.store.documento(ctx.archivo)!;
        const tareas = dep.store.tareasDe(ctx.archivo);
        const wb = dep.workbench();
        // El toggle lo decide la raíz; el plan lo aplica a todo el subárbol.
        const entra = !(dep.store.buscar(ctx.archivo, ctx.clave)?.workbenches ?? []).includes(wb);

        void aplicar(
          dep.app,
          dep.store,
          ctx.archivo,
          // Los ids son de **todas** las notas: dos tareas con el mismo id
          // serían la misma para el workbench, que es peor que un error.
          planDeWorkbench(doc, tareas, ctx.clave, wb, dep.store.idsEnUso()),
          (n) =>
            entra
              ? STRINGS.avisos.entraAlWorkbench(n, wb)
              : STRINGS.avisos.saleDelWorkbench(n, wb),
        );
      },
    },
  ];
}
