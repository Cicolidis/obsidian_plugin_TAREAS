/**
 * El puerto del store, implementado sobre Obsidian.
 *
 * Es lo único que sabe que Obsidian existe del lado de la lectura. El store no
 * importa `obsidian` y no puede: así se prueba entero offline con un puerto
 * falso (§17).
 *
 * ## Por qué acá no hay debounce
 *
 * Porque se midió y no hace falta. Ver la constante de abajo.
 */
import type { App, EventRef, TAbstractFile, TFile } from "obsidian";
import { TFile as TFileClass } from "obsidian";
import type { Baja, PuertoDeNotas } from "../store.js";

/*
 * NO HAY DEBOUNCE, Y ESO SE MIDIÓ.
 *
 * Medido el 24/08/2026 con `scripts/espia-eventos.js` en la consola de
 * Obsidian, tecleando sin parar 15 segundos sobre una nota de 388 líneas:
 *
 *   eventos                      modify×8   changed×8
 *   hueco entre changed (ms)     mín 2023 · mediana 2100 · máx 7288
 *   demora modify → changed (ms) mín 16 · mediana 21 · máx 28
 *
 * `changed` **no llega por tecla**: llega una vez por guardado del editor, que
 * es el `requestSave` de 2 segundos de `TextFileView`. Quince segundos de
 * tecleo continuo produjeron ocho eventos.
 *
 * Un debounce encima de eso **no junta nada** —nada llega más junto que 2023 ms—
 * y lo único que agrega es su propia espera entre la acción y el redibujo. La
 * primera versión de este archivo tenía `DEBOUNCE_MS = 150` puesto por las
 * dudas; la medición lo dejó sin trabajo que hacer.
 *
 * Y el costo del otro lado tampoco lo justifica: parsear las siete notas
 * **enteras** cuesta 0,31 ms. La §7 de la spec afirmaba lo contrario y quedó
 * corregida con estos números.
 */

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
      // Directo, sin debounce: ver la medición de arriba. El evento ya trae el
      // contenido, así que el store no tiene que releer nada.
      const ref = app.metadataCache.on("changed", (file: TFile, data: string) => {
        fn(file.path, data);
      });
      registrar(ref);
      return () => app.metadataCache.offref(ref);
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
