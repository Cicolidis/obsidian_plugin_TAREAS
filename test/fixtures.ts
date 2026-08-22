/**
 * Las fixtures sintéticas, leídas como bytes.
 *
 * Son **inventadas**: reproducen las formas medidas en la §2 de la spec —tabs,
 * los tipos de heading en sus tres formas reales, bullets sin checkbox como
 * agrupadores y como notas de tarea, los `- [ ]` vacíos de separador, tabla,
 * imagen, texto libre, profundidad 6— sin una línea del vault. El repositorio
 * es público.
 *
 * El corpus real se compara aparte, en `npm run test:corpus`.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const NOMBRES = ["basico", "headings", "arbol", "ruido"] as const;

export function fixture(nombre: (typeof NOMBRES)[number]): string {
  return readFileSync(fileURLToPath(new URL(`./fixtures/${nombre}.md`, import.meta.url)), "utf8");
}
