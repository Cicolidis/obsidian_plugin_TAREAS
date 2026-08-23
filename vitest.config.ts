import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    // El diferencial contra el vault real corre aparte, con
    // `npm run test:corpus`: necesita las siete notas, que no están en el
    // repositorio, y Obsidian abierto. Ver `vitest.corpus.config.ts`.
    exclude: ["node_modules/**", "test/corpus/**"],
  },
});
