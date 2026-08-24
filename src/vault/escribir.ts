/**
 * El **único** lugar del plugin que escribe en el vault (spec §8).
 *
 * Delgado a propósito: toda la lógica está en `ubicar.ts`, que se prueba
 * offline. Acá quedan las tres cosas que solo se pueden hacer con Obsidian
 * delante, y las tres tienen una razón medida o documentada.
 *
 * ## 1. Vaciar el buffer del editor antes de leer el disco
 *
 * `TextFileView.requestSave` está documentado como «Debounced save in 2 seconds
 * from now». O sea: mientras una nota está abierta y recién tecleada, **el disco
 * está atrasado respecto del editor hasta 2 segundos**, y `vault.process` lee
 * del disco.
 *
 * Esa es una falla que `ubicar.ts` **no puede atajar**: adentro de `process` el
 * disco se ve consistente —la línea está donde el store dijo, con el texto que
 * esperaba—, se escribe bien, y dos segundos después el editor vuelca su buffer
 * y pisa la escritura. El síntoma sería «el comando a veces no hace nada», que
 * es el peor modo de falla posible: silencioso e intermitente.
 *
 * Por eso, antes de tocar el disco, se fuerza `save()` sobre toda vista abierta
 * de ese archivo. Después de eso, lo que `ubicar.ts` ve es la verdad.
 *
 * ## 2. Verificar adentro de `fn`, no antes
 *
 * `vault.process(file, fn)` es lectura-modificación-escritura atómica y `fn` es
 * **síncrona**: ve el contenido de disco del momento. Verificar afuera y
 * escribir adentro sería exactamente la carrera que este paso vino a matar.
 *
 * ## 3. Alimentar al store con lo que devuelve
 *
 * `process` devuelve **lo que quedó escrito**. Eso entra al store en el acto,
 * sin esperar al `changed`, que llega después y trae lo mismo.
 */
import { Notice, TFile, type App } from "obsidian";
import type { CambioDeLinea } from "../documento.js";
import { aplicarLote, type ResultadoDeLote } from "../ubicar.js";

export type ResultadoDeEscritura =
  | { estado: "escrito"; contenido: string; movidas: number; lineas: number }
  | { estado: "sin-cambios"; contenido: string }
  | { estado: "sin-archivo" }
  | { estado: "no-ubicada"; lote: ResultadoDeLote };

/**
 * Aplica el lote sobre el archivo, o no escribe nada.
 *
 * **O se aplican todos los cambios del lote o ninguno**: media operación deja el
 * árbol en un estado que el usuario no pidió, y `vault.process()` no pasa por el
 * editor, así que Ctrl-Z no lo deshace.
 */
export async function escribir(
  app: App,
  archivo: string,
  cambios: readonly CambioDeLinea[],
): Promise<ResultadoDeEscritura> {
  const file = app.vault.getFileByPath(archivo);
  if (!(file instanceof TFile)) return { estado: "sin-archivo" };
  if (cambios.length === 0) return { estado: "sin-cambios", contenido: await app.vault.cachedRead(file) };

  await volcarEditores(app, archivo);

  // `fn` no puede devolver nada más que el texto, así que el diagnóstico sale
  // por closure. Es el precio de que la verificación corra adentro de `process`,
  // que es el único lugar donde no hay carrera.
  // La caja es para que TypeScript no dé por sentado que sigue en `null`: no
  // ve que `fn` corre, y narrowear una variable suelta la dejaría en `never`.
  const salida: { lote?: ResultadoDeLote } = {};
  const contenido = await app.vault.process(file, (data) => {
    const r = aplicarLote(data, cambios);
    salida.lote = r.resultado;
    return r.texto;
  });

  const resultado = salida.lote;
  if (resultado === undefined) return { estado: "sin-archivo" }; // `fn` no corrió
  if (resultado.estado !== "ok") return { estado: "no-ubicada", lote: resultado };
  return {
    estado: "escrito",
    contenido,
    movidas: resultado.movidas,
    lineas: resultado.ubicados.length,
  };
}

/**
 * Fuerza el guardado de toda vista abierta de este archivo.
 *
 * Se recorren las hojas y no se usa `getActiveViewOfType`: la nota puede estar
 * abierta en un panel que no tiene el foco —o en dos—, y el buffer sin volcar de
 * cualquiera de ellos pisaría la escritura igual.
 *
 * Una vista que falla al guardar no puede impedir la operación entera, pero sí
 * tiene que dejar rastro: si esto falla, lo que sigue escribe sobre un disco
 * atrasado.
 */
async function volcarEditores(app: App, archivo: string): Promise<void> {
  const vistas = app.workspace.getLeavesOfType("markdown").filter((hoja) => {
    const vista = hoja.view as { file?: { path: string } | null };
    return vista.file?.path === archivo;
  });

  await Promise.all(
    vistas.map(async (hoja) => {
      const vista = hoja.view as unknown as { save?: () => Promise<void> };
      try {
        await vista.save?.();
      } catch (err) {
        console.error(`[tareas] no se pudo volcar el editor de ${archivo}:`, err);
        new Notice(`No se pudo guardar el editor de ${archivo} antes de escribir.`);
      }
    }),
  );
}
