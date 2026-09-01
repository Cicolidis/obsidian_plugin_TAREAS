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
//   transactionFilter       el checkbox automático, la defensa del tramo y la unión
//   unirLimpio              el ajuste que la enciende; sin él el filtro no corre nunca
//   editorInfoField         el alcance por archivo; sin él intercepta el vault
//   editorLivePreviewField  las decoraciones solo van en Live Preview (§4a)
//   StateField              las decoraciones entran al mapa de alturas (§5.5)
//   atomicRanges            sin esto el cursor recorre el token carácter a carácter
//   domEventHandlers        el clic al final de la línea, que si no salta abajo
//   tareas-p                las clases de prioridad (§14)
//   tareas-estilo-          el estilo de prioridad, que viaja como clase de `body`
//   0_inbox/tareas_         la lista de notas, que viaja como JSON importado
//   [ ]                     lo que el filtro escribe
//   onLayoutReady           el arranque del store (spec §20 paso 3)
//   vault.process           el único camino de escritura (§8)
//   ViewPlugin              la fila de botones (§13.0, paso 4b)
//   posAtDOM                cómo la fila sabe en qué línea está: sin esto, escribe a ciegas
//   tareas-fila             el ancla y la fila; si se cae, los botones no se ven
//   tareas-revelar-         el modo de revelación, que viaja como clase de `body`
//   setIcon                 sin esto los botones son cuatro cuadrados vacíos
//   los cuatro ids          un comando que se cae del bundle no da error: no aparece
//
// El id del plugin no se busca acá: vive en el manifiesto y se valida abajo.
for (const marca of [
  "transactionFilter",
  "unirLimpio",
  "editorInfoField",
  "editorLivePreviewField",
  "StateField",
  "atomicRanges",
  "domEventHandlers",
  "tareas-p",
  "tareas-estilo-",
  "0_inbox/tareas_",
  "[ ] ",
  "onLayoutReady",
  ".process(",
  "ViewPlugin",
  "posAtDOM",
  // El margen propio de la fila (estilo `columna`) y el guardia del cursor.
  "GutterMarker",
  "lineMarkerChange",
  "gutterLineClass",
  "tareas-hover",
  "tareas-fila",
  "tareas-revelar-",
  "setIcon",
  "completar-tarea-del-cursor",
  "asignar-workbench-favorito",
  "subir-prioridad-del-cursor",
  "bajar-prioridad-del-cursor",
]) {
  if (!src.includes(marca)) fallas.push(`falta "${marca}" en el bundle`);
}

// 4b) el CSS que el bundle no lleva: se copia aparte y se cae aparte.
//
// Sin `styles.css` en su lugar, las decoraciones se aplican y **no se ve nada**:
// el token queda escondido —eso lo hace `Decoration.replace`— pero la prioridad
// no pinta. Es un modo de falla que parece «la prioridad no anda».
try {
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  for (const clase of [
    "tareas-p1",
    "tareas-p2",
    "tareas-hija-p1",
    "tareas-ind-glifo",
    // Los tres estilos: si uno se cae del CSS, el ajuste sigue estando y no
    // dibuja nada, que parece «la prioridad no anda».
    "tareas-estilo-barra",
    "tareas-estilo-checkbox",
    "tareas-estilo-fondo",
    // La fila: sin esto los botones se dibujan **en el flujo del renglón**, o
    // sea empujando el corte de línea, que es exactamente lo que el diseño
    // evita. No es «se ve feo»: es la regresión de la §5.5.
    "tareas-fila-ancla",
    "tareas-boton",
    "tareas-revelar-hover",
    "tareas-revelar-siempre",
    // Los cinco estilos de fila: si uno se cae del CSS, el ajuste sigue en el
    // desplegable y la fila se queda sin posición, o sea pegada al comienzo de
    // la línea encima del checkbox. Parece «la fila se rompió».
    "tareas-fila-derecha",
    "tareas-fila-derecha-plana",
    "tareas-fila-pastilla",
    "tareas-fila-margen",
    "tareas-fila-izquierda",
    "tareas-fila-columna",
    "tareas-margen",
    "tareas-hover",
    "tareas-estilo-barra-completa",
  ]) {
    if (!css.includes(clase)) fallas.push(`falta ".${clase}" en styles.css`);
  }
} catch {
  fallas.push("no se pudo leer styles.css");
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
