/**
 * Extrae el CSS interno de Obsidian desde su archivo `.asar`.
 *
 * Sirve para resolver **por lectura** —y no por prueba y error— los casos en
 * que una regla propia no se aplica. Obsidian usa `!important` y selectores
 * compuestos que le ganan en especificidad a lo obvio, y el síntoma siempre es
 * el mismo: se escribe una propiedad, no pasa nada, y parece un valor mal
 * elegido. Ver `CLAUDE.md` y las notas de método de Anotaciones.
 *
 *   npm run obsidian-css -- /tmp/obsidian-css
 *
 * ## Qué se cambió respecto del de Anotaciones
 *
 * Aquel lee `/Applications/Obsidian.app/…/obsidian.asar`, que es la versión que
 * vino con el instalador. Obsidian se **actualiza solo** y deja la versión que
 * de verdad corre en `~/Library/Application Support/obsidian/obsidian-N.asar`.
 * Leer la del instalador puede dar el CSS de una versión vieja y eso es peor
 * que no medir: es medir otra cosa y creerle.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

/** El `.asar` que Obsidian está corriendo de verdad: el más nuevo que haya. */
function asarVigente() {
  const dir = join(homedir(), "Library", "Application Support", "obsidian");
  try {
    const versiones = readdirSync(dir)
      .filter((n) => /^obsidian-[\d.]+\.asar$/.test(n))
      .sort((a, b) => comparar(version(a), version(b)));
    const ultima = versiones.at(-1);
    if (ultima) return join(dir, ultima);
  } catch {
    // No está actualizado o no es macOS: se cae al del instalador.
  }
  return "/Applications/Obsidian.app/Contents/Resources/obsidian.asar";
}

const version = (n) => n.replace(/^obsidian-|\.asar$/g, "").split(".").map(Number);
const comparar = (a, b) => a[0] - b[0] || a[1] - b[1] || (a[2] ?? 0) - (b[2] ?? 0);

const ASAR = process.env["OBSIDIAN_ASAR"] ?? asarVigente();
const outDir = process.argv[2] ?? ".";

const data = readFileSync(ASAR);
const jsonLen = data.readUInt32LE(12);
const header = JSON.parse(data.subarray(16, 16 + jsonLen).toString("utf8"));
let base = 16 + jsonLen;
base += (4 - (base % 4)) % 4;

function* recorrer(nodo, camino = "") {
  for (const [nombre, info] of Object.entries(nodo.files ?? {})) {
    const p = camino ? `${camino}/${nombre}` : nombre;
    if (info.files) yield* recorrer(info, p);
    else yield [p, info];
  }
}

mkdirSync(outDir, { recursive: true });
let encontrados = 0;
for (const [camino, info] of recorrer(header)) {
  if (!camino.endsWith("app.css")) continue;
  const destino = join(outDir, "app.css");
  writeFileSync(destino, data.subarray(base + Number(info.offset), base + Number(info.offset) + Number(info.size)));
  console.log(`extraído de ${ASAR}\n       a ${destino} (${info.size} bytes)`);
  encontrados++;
}
if (encontrados === 0) {
  console.error(`no se encontró app.css dentro de ${ASAR}`);
  process.exit(1);
}
