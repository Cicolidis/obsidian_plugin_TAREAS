/**
 * El acceso al vault real, para el diferencial.
 *
 * **Nada de esto lo importa `src/`.** El plugin tiene que funcionar con
 * Obsidian cerrado; esto es un instrumento de medición, no una dependencia.
 * Y no escribe: lee y compara.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * La misma lista que usa `medir-tareas.mjs`: `notas-de-tareas.json`, en la
 * raíz, **fuera de git** porque lleva las rutas del vault real. Hasta el
 * 29/09/2026 se importaba de `src/notas.ts`, que la compilaba en el bundle.
 */
function listaLocal(): string[] | null {
  try {
    const datos = JSON.parse(
      readFileSync(new URL("../../notas-de-tareas.json", import.meta.url), "utf8"),
    ) as { notas: string[] };
    return datos.notas.map((n) => n.normalize("NFC"));
  } catch {
    return null;
  }
}

export const NOTAS_LOCALES: readonly string[] = listaLocal() ?? [];

/**
 * El vault, o `null` si falta algo para medir contra él. Sin la lista local el
 * diferencial no tiene qué leer, y eso se dice en vez de fallar: sería una
 * alarma de configuración disfrazada de bug.
 */
export const VAULT = (() => {
  const vault = process.env["OBSIDIAN_VAULT"] ?? null;
  if (vault && NOTAS_LOCALES.length === 0) {
    console.warn(
      "[corpus] falta notas-de-tareas.json (ver notas-de-tareas.ejemplo.json): se saltea todo.",
    );
    return null;
  }
  return vault;
})();

/** Las notas que existen de verdad, con su contenido en bytes. */
export function notasReales(): { rel: string; raw: string }[] {
  if (!VAULT) return [];
  const salida: { rel: string; raw: string }[] = [];
  for (const rel of NOTAS_LOCALES) {
    try {
      salida.push({ rel, raw: readFileSync(join(VAULT, rel), "utf8") });
    } catch {
      // Una nota que falta no rompe el diferencial: se informa y se sigue.
    }
  }
  return salida;
}
