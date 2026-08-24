/**
 * El puerto del store, implementado sobre Obsidian.
 *
 * Es lo único que sabe que Obsidian existe del lado de la lectura. El store no
 * importa `obsidian` y no puede: así se prueba entero offline con un puerto
 * falso (§17).
 *
 * ## Por qué el debounce vive acá y no en el store
 *
 * Porque es un asunto del **evento**, no del índice. El costo del parseo no es
 * el argumento —parsear las siete notas enteras cuesta 0,31 ms, medido—; lo que
 * importa es cada cuánto llega `changed`, que lo decide Obsidian. Puesto acá, el
 * store queda sin temporizadores y sus tests son síncronos.
 */
import type { App, EventRef, TAbstractFile, TFile } from "obsidian";
import { debounce, TFile as TFileClass } from "obsidian";
import type { Baja, PuertoDeNotas } from "../store.js";

/**
 * Cuánto se espera antes de reparsear una nota que cambió.
 *
 * **Este número sale de medir, no de suponer.** La §7 de la spec afirmaba que
 * reparsear `tareas_COLE` en cada tecla «es perceptible en móvil»; eso no estaba
 * verificado y el costo medido lo contradice. Lo que sí decide este valor es
 * cada cuánto llega `metadataCache.on("changed")`, que se mide con
 * `scripts/espia-eventos.js` pegado en la consola de Obsidian.
 *
 * Si Obsidian ya espacia el evento —y su indexado lo hace—, un debounce propio
 * **solo agrega latencia entre la acción y el redibujo**. Por eso el valor es
 * chico: junta la ráfaga de un guardado sin poner al store atrasado respecto de
 * lo que el usuario ve.
 *
 * Un solo lugar, a propósito: una constante repetida en dos archivos diverge.
 */
export const DEBOUNCE_MS = 150;

/** El puerto sobre `App`, con las suscripciones ya registradas para su baja. */
export function puertoObsidian(
  app: App,
  notas: () => readonly string[],
  registrar: (ref: EventRef) => void,
): PuertoDeNotas {
  /** La ruta de un evento del vault, o `null` si no es un archivo. */
  const rutaDe = (f: TAbstractFile): string | null =>
    f instanceof TFileClass ? f.path : null;

  return {
    notas,

    async leer(path) {
      const file = app.vault.getFileByPath(path);
      // `cachedRead` y no `read`: esto corre en el arranque, sobre cinco
      // archivos, y no hace falta forzar una lectura de disco para cada uno.
      return file ? await app.vault.cachedRead(file) : null;
    },

    alCambiar(fn): Baja {
      // El evento ya trae el contenido: el store no tiene que releer nada.
      const pendiente = debounce(
        (path: string, contenido: string) => fn(path, contenido),
        DEBOUNCE_MS,
        // `resetTimer: true` — mientras alguien escribe seguido, se espera a que
        // pare. Sin esto el primer cambio de una ráfaga fija el reloj y el
        // reparseo cae en el medio, con contenido que ya quedó viejo.
        true,
      );
      const ref = app.metadataCache.on("changed", (file: TFile, data: string) => {
        pendiente(file.path, data);
      });
      registrar(ref);
      return () => {
        pendiente.cancel();
        app.metadataCache.offref(ref);
      };
    },

    alRenombrar(fn): Baja {
      // `changed` **no dispara al renombrar**, por rendimiento: está en la
      // documentación de la API. Sin este, el store se quedaría con la ruta
      // vieja y `Task.archivo` apuntaría a un archivo que ya no existe.
      const ref = app.vault.on("rename", (file: TAbstractFile, viejo: string) => {
        const nuevo = rutaDe(file);
        if (nuevo !== null) fn(viejo, nuevo);
      });
      registrar(ref);
      return () => app.vault.offref(ref);
    },

    alBorrar(fn): Baja {
      const ref = app.vault.on("delete", (file: TAbstractFile) => {
        const path = rutaDe(file);
        if (path !== null) fn(path);
      });
      registrar(ref);
      return () => app.vault.offref(ref);
    },
  };
}
