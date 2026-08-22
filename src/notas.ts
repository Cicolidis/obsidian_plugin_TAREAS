/**
 * Qué notas mira el plugin.
 *
 * La decisión D2 de la spec: **una lista explícita, no el vault**. Son 2.394
 * notas; recorrerlas sería inaceptable, sobre todo en móvil. Y acá, además,
 * decide dónde se intercepta el teclado: fuera de esta lista el plugin no toca
 * ni una tecla.
 *
 * La lista por omisión vive en `notas-de-tareas.json`, en la raíz, porque la
 * comparte con `scripts/medir-tareas.mjs`. La lista **efectiva** sale de la
 * configuración: el usuario agrega notas nuevas sin recompilar.
 */
import datos from "../notas-de-tareas.json";

export const NOTAS_POR_OMISION: readonly string[] = Object.freeze(
  datos.notas.map((n) => n.normalize("NFC")),
);

/**
 * ¿Esta ruta es una nota de tareas?
 *
 * Compara en NFC de los dos lados. Los nombres en disco de este vault están en
 * NFC —verificado—, pero `tareas_CÍCLICAS.md` lleva acento y basta que el
 * archivo pase por otro sistema de archivos, por Sync o por un `readdir` de
 * macOS para que llegue en NFD. La comparación fallaría sin decir nada: el
 * plugin simplemente no haría nada en esa nota, y eso es indistinguible de un
 * bug del filtro.
 */
export function esNotaDeTareas(path: string | null | undefined, lista: readonly string[]): boolean {
  if (!path) return false;
  const buscado = path.normalize("NFC");
  return lista.some((n) => n.normalize("NFC") === buscado);
}
