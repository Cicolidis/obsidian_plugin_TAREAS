/**
 * La prioridad como presentación: de un ordinal a una clase CSS.
 *
 * **No se porta el `color.ts` de Anotaciones.** Allá el color *es* el dato: son
 * las ocho categorías de resaltado de Zotero, que llegan con el resaltado y hay
 * que conservar tal cual. Acá el dato es un número (`p=1`, `p=2`) y el color es
 * cómo se dibuja: D12 de la spec, «ordenar necesita un ordinal, y guardar el
 * nombre del color ata la paleta para siempre».
 *
 * De ahí que este módulo sea diez líneas y aquel doscientas: lo único que hay
 * que decidir es el nombre de la clase, y la paleta vive entera en `styles.css`.
 *
 * Los tres niveles se distinguen **también sin color** (§14, accesibilidad y
 * pantallas al sol). Eso lo dibuja la hoja de estilos con dos indicadores que
 * se encienden por separado desde los ajustes; acá no cambia nada, porque la
 * clase es la misma.
 */
import { ESTILOS_DE_PRIORIDAD, type EstiloDePrioridad } from "./settingsData.js";
import type { Prioridad } from "./token.js";

export const PRIORIDAD_MINIMA: Prioridad = 0;
export const PRIORIDAD_MAXIMA: Prioridad = 2;

/**
 * La clase de la línea de la tarea, o `""` para la prioridad normal.
 *
 * Normal no dibuja nada, igual que no escribe campo: es el 95% de los casos y
 * no tiene que dejar rastro (§5.2).
 */
export function colorClass(p: Prioridad): string {
  return p === 0 ? "" : `tareas-p${p}`;
}

/**
 * La clase de un **descendiente** de una tarea con prioridad.
 *
 * §14: «el color pinta la línea de la tarea, no el subárbol. Los hijos llevan
 * un filete de 2px del mismo color en el borde izquierdo». Con árboles de 76
 * líneas, teñir todo deja media nota roja.
 */
export function claseDeHija(p: Prioridad): string {
  return p === 0 ? "" : `tareas-hija-p${p}`;
}

/**
 * Un nivel más, o el mismo si ya está arriba de todo.
 *
 * **Con tope, no da la vuelta.** Un ciclo `2 → 0` hace que apretar dos veces
 * seguidas por las dudas baje la prioridad de la tarea más urgente a normal,
 * que es exactamente el error que nadie mira.
 */
export function subir(p: Prioridad): Prioridad {
  return p >= PRIORIDAD_MAXIMA ? PRIORIDAD_MAXIMA : ((p + 1) as Prioridad);
}

/** Un nivel menos, o el mismo si ya está normal. */
export function bajar(p: Prioridad): Prioridad {
  return p <= PRIORIDAD_MINIMA ? PRIORIDAD_MINIMA : ((p - 1) as Prioridad);
}

/**
 * Las clases de `body` que enciende cada estilo de prioridad.
 *
 * Viven acá y no en `main.ts` por lo mismo que `colorClass`: es la traducción de
 * un dato a una clase de CSS, y en un solo lugar. El estilo combinado no tiene
 * clase propia —enciende las dos— así que la hoja de estilos no necesita saber
 * que existe: cada regla sigue mirando una sola clase.
 */
export function clasesDelEstilo(estilo: EstiloDePrioridad): readonly string[] {
  if (estilo === "barra-checkbox") return ["tareas-estilo-barra", "tareas-estilo-checkbox"];
  // `barra-completa` es la barra con otra altura, no otro dibujo: enciende la
  // misma clase base y una de más. Así la hoja de estilos no repite la paleta
  // ni la posición, que es lo que después diverge.
  if (estilo === "barra-completa")
    return ["tareas-estilo-barra", "tareas-estilo-barra-completa"];
  return [`tareas-estilo-${estilo}`];
}

/** Todas las clases que este módulo puede poner, para poder sacarlas al salir. */
export const CLASES_DE_ESTILO: readonly string[] = ESTILOS_DE_PRIORIDAD.flatMap((e) =>
  clasesDelEstilo(e),
).filter((c, i, xs) => xs.indexOf(c) === i);
