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

/** La nota de historial (spec §12). Ver `notasDeTrabajo`. */
export const NOTA_DE_LOG_POR_OMISION: string = datos.log.normalize("NFC");

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

/**
 * Las notas que el **store** parsea al arrancar: todas menos el LOG.
 *
 * La §12 es explícita: el historial «se lee cuando se abre la vista, nunca al
 * arrancar el plugin», porque es el único conjunto que solo recibe y crece sin
 * techo. Las notas de trabajo se mantienen de tamaño porque las cosas salen de
 * ellas; el LOG no.
 *
 * Que hoy no muerda —51 líneas, 0 tareas, medido— no es razón para no
 * respetarlo: el paso 6 lo empieza a llenar, y para entonces la regla ya tiene
 * que estar. La lista de notas y el LOG conviven en la configuración porque el
 * archivado necesita saber **dónde** escribir, no solo qué no leer.
 */
export function notasDeTrabajo(
  lista: readonly string[],
  notaDeLog: string,
): string[] {
  return lista.filter((n) => !esNotaDeTareas(n, [notaDeLog]));
}
