import { defineConfig } from "vitest/config";

/**
 * El diferencial contra el vault real. Aparte de la suite normal a propósito:
 *
 * - Necesita las siete notas, que no están en el repositorio y no pueden
 *   estarlo: es público.
 * - Uno de los bloques habla con Obsidian, que puede estar cerrado, y lee del
 *   `metadataCache`, que puede ir atrasado respecto del disco.
 *
 * Un test que depende de que una aplicación esté abierta no puede vivir en
 * `npm test`. Se corre a mano con `npm run test:corpus`.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/corpus/**/*.test.ts"],
  },
});
