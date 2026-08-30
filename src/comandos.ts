/**
 * Los comandos de paleta: el camino de escritura de punta a punta.
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
  elegirTarea,
  ilegiblesDelSubarbol,
  planDeCompletar,
  planDePrioridad,
  planDeWorkbench,
  yaEstaCompleta,
  type Eleccion,
} from "./acciones.js";
import { bajar, subir } from "./color.js";
import type { Prioridad } from "./token.js";
import type { CambioDeLinea } from "./documento.js";
import type { StoreDeTareas } from "./store.js";
import { STRINGS } from "./strings.js";
import { prioridadEfectiva, type Clave } from "./tareas.js";
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

/** El aviso que corresponde a cada modo de fracaso de `elegirTarea`. */
function aviso(e: Exclude<Eleccion, { estado: "ok" }>): string {
  switch (e.estado) {
    case "fuera-de-la-lista":
      return STRINGS.avisos.fueraDeLaLista;
    case "sin-indice":
      return STRINGS.avisos.sinIndice;
    case "sin-tarea":
      return STRINGS.avisos.sinTarea;
    case "ausente":
      return STRINGS.avisos.lineaAusente;
    case "ambigua":
      return STRINGS.avisos.lineaAmbigua(e.veces);
  }
}

/**
 * La tarea que el cursor está eligiendo, o `null` con el aviso ya dado.
 *
 * Toda la decisión vive en `elegirTarea`, que es pura y está probada. Acá queda
 * lo que solo se puede hacer con Obsidian delante: sacarle al editor la línea
 * **y su texto**, y convertir el resultado en un cartel.
 *
 * Que se le pida el **texto** y no solo el número es el arreglo del bug de B5:
 * la línea del cursor es de ahora y el índice puede ser de hace un rato, así que
 * el número solo no alcanza para saber de qué tarea se está hablando.
 *
 * El segundo argumento se tipa como `MarkdownFileInfo` y no como `MarkdownView`
 * porque es lo que Obsidian pasa: el comando también se dispara desde un editor
 * embebido, que no es una vista. Lo único que se necesita —`file`— lo tienen los
 * dos.
 */
function tareaDelCursor(
  store: StoreDeTareas,
  editor: Editor,
  vista: MarkdownFileInfo,
  notas: readonly string[],
): Contexto | null {
  const archivo = vista.file?.path ?? null;
  const linea = editor.getCursor().line;
  const eleccion = elegirTarea(archivo, notas, archivo ? store.documento(archivo) : null, archivo ? store.tareasDe(archivo) : [], {
    linea,
    texto: editor.getLine(linea),
  });

  if (eleccion.estado !== "ok") {
    new Notice(aviso(eleccion), 8000);
    return null;
  }
  return { archivo: archivo!, clave: eleccion.clave };
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

/**
 * Subir o bajar la prioridad de la tarea del cursor.
 *
 * Los dos comandos son el mismo camino con una función distinta, y existen
 * porque sin ellos **no hay forma de mirar los colores**: hoy no hay una sola
 * tarea con `p=1` ni con `p=2` en ninguna nota. Cuando el ⋯ de la §13.0 tenga
 * su barra de prioridad, van a llamar a este mismo plan.
 *
 * `subir` y `bajar` topan en vez de dar la vuelta, así que hay un caso en que
 * no hay nada que escribir. Se dice, porque un comando que no hace nada y no
 * avisa es indistinguible de un comando roto.
 */
function moverPrioridad(
  dep: DependenciasDeComandos,
  editor: Editor,
  vista: MarkdownFileInfo,
  mover: (p: Prioridad) => Prioridad,
): void {
  const ctx = tareaDelCursor(dep.store, editor, vista, dep.notas());
  if (!ctx) return;

  // Se parte del nivel que **se ve**, no del propio: una hija sin `p=` se dibuja
  // con la prioridad de su madre, y actuar sobre el 0 hacía que subirle la
  // prioridad a una hija que heredaba «muy alta» la dejara en «alta».
  const tareas = dep.store.tareasDe(ctx.archivo);
  const { nivel, deArriba } = prioridadEfectiva(tareas, ctx.clave);
  const nueva = mover(nivel);

  if (nueva === nivel) {
    new Notice(STRINGS.avisos.prioridadEnElTope(STRINGS.prioridades[nivel]));
    return;
  }
  // El agujero del modelo, dicho en vez de tapado: escribir «normal» no escribe
  // ningún campo (§5.2), y sin campo la hija vuelve a heredar. O sea que no hay
  // forma de declararla normal adentro de un bloque urgente sin un `p=0`
  // explícito, que cambiaría el formato del token. Callarlo sería un comando
  // que no hace nada.
  //
  // Se mira `deArriba` y no de dónde venía el nivel actual: una hija con `p=1`
  // propio adentro de un bloque `p=2` **sí** tiene prioridad propia, y bajarla
  // igual la deja heredando rojo. Esa era la falla A3.
  if (nueva === 0 && deArriba !== 0) {
    new Notice(STRINGS.avisos.prioridadHeredada, 8000);
    return;
  }

  void aplicar(
    dep.app,
    dep.store,
    ctx.archivo,
    planDePrioridad(dep.store.documento(ctx.archivo)!, tareas, ctx.clave, nueva),
    () => STRINGS.avisos.prioridad(STRINGS.prioridades[nueva]),
  );
}

export interface DependenciasDeComandos {
  app: App;
  store: StoreDeTareas;
  /** La lista efectiva, leída en el momento: los ajustes cambian sin recargar. */
  notas: () => readonly string[];
  workbench: () => string;
  ahora?: () => string;
}

/** Los comandos, con la forma que `Plugin.addCommand` espera. */
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
    {
      id: "subir-prioridad-del-cursor",
      name: STRINGS.comandos.subirPrioridad,
      editorCallback: (editor: Editor, vista: MarkdownFileInfo) =>
        moverPrioridad(dep, editor, vista, subir),
    },
    {
      id: "bajar-prioridad-del-cursor",
      name: STRINGS.comandos.bajarPrioridad,
      editorCallback: (editor: Editor, vista: MarkdownFileInfo) =>
        moverPrioridad(dep, editor, vista, bajar),
    },
  ];
}
