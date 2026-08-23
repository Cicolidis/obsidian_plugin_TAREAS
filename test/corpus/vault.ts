/**
 * El acceso al vault real, para el diferencial.
 *
 * **Nada de esto lo importa `src/`.** El plugin tiene que funcionar con
 * Obsidian cerrado; esto es un instrumento de medición, no una dependencia.
 * Y no escribe: lee y compara.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
// La misma lista que usa el plugin y que usa `medir-tareas.mjs`. Un solo lugar.
import { NOTAS_POR_OMISION } from "../../src/notas.js";

export const VAULT = process.env["OBSIDIAN_VAULT"] ?? null;

/** Las notas que existen de verdad, con su contenido en bytes. */
export function notasReales(): { rel: string; raw: string }[] {
  if (!VAULT) return [];
  const salida: { rel: string; raw: string }[] = [];
  for (const rel of NOTAS_POR_OMISION) {
    try {
      salida.push({ rel, raw: readFileSync(join(VAULT, rel), "utf8") });
    } catch {
      // Una nota que falta no rompe el diferencial: se informa y se sigue.
    }
  }
  return salida;
}
