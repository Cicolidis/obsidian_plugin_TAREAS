/**
 * Prueba de humo del bundle desplegado.
 *
 * `npm run deploy` puede dejar un `main.js` que no carga —un import que no
 * resolvió, un ciclo, una API que no existe— y eso no se descubre hasta que
 * alguien activa el plugin y ve que no pasa nada. Cargarlo en Node cuesta un
 * segundo y ataja esa clase entera.
 *
 * No puede *ejecutar* el plugin: necesita las APIs de Obsidian y de CodeMirror
 * que solo existen adentro de la app. Lo que sí verifica es que el archivo
 * parsea, que exporta un plugin, y que no arrastra referencias a módulos de
 * Node que en Obsidian no están.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const ruta = process.argv[2] ?? "main.js";
const src = readFileSync(ruta, "utf8");
const fallas = [];

// 1) parsea
try {
  new Function(src);
} catch (err) {
  fallas.push(`no parsea: ${err.message}`);
}

// 2) es un bundle CommonJS con exportación por defecto (lo que Obsidian carga)
if (!/module\.exports/.test(src)) fallas.push("no exporta con `module.exports`");

// 3) no quedó ningún `require` de módulos de Node que Obsidian no provee
const permitidos = new Set([
  "obsidian",
  "@codemirror/view",
  "@codemirror/state",
  "@codemirror/language",
]);
for (const m of src.matchAll(/require\(["']([^"']+)["']\)/g)) {
  if (!permitidos.has(m[1]) && !m[1].startsWith(".")) {
    fallas.push(`require de un módulo externo: "${m[1]}"`);
  }
}

// 4) las piezas que tienen que estar
//
// Cada marca es un mecanismo que, si se cae del bundle, deja al plugin
// cargando sin hacer nada —el peor modo de falla, porque no se nota—:
//
//   transactionFilter  el mecanismo entero del prototipo (spec §20 paso 1)
//   editorInfoField    el alcance por archivo; sin él intercepta el vault
//   0_inbox/tareas_    la lista de notas, que viaja como JSON importado
//   [ ]                lo que el filtro escribe
//
// El id del plugin no se busca acá: vive en el manifiesto y se valida abajo.
for (const marca of ["transactionFilter", "editorInfoField", "0_inbox/tareas_", "[ ] "]) {
  if (!src.includes(marca)) fallas.push(`falta "${marca}" en el bundle`);
}

// 5) el manifest apunta a este archivo
const require_ = createRequire(import.meta.url);
try {
  const manifest = require_("../manifest.json");
  if (!manifest.id || !manifest.version) fallas.push("manifest.json sin id o version");
  if (manifest.id !== "tareas-outline") fallas.push(`id inesperado: "${manifest.id}"`);
} catch {
  fallas.push("no se pudo leer manifest.json");
}

if (fallas.length > 0) {
  console.error(`Prueba de humo FALLIDA sobre ${ruta}:`);
  for (const f of fallas) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`Prueba de humo OK: ${ruta} (${(src.length / 1024).toFixed(0)} kB)`);
