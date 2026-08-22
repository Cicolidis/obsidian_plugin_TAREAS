/**
 * Publica una release en GitHub con los archivos que Obsidian necesita.
 *
 * BRAT no lee el repositorio: lee la **última release** y baja de sus adjuntos
 * `main.js`, `manifest.json` y `styles.css`. Por eso `main.js` está fuera del
 * control de versiones y entra acá, y por eso la etiqueta tiene que ser
 * exactamente la `version` del manifiesto: es lo que BRAT compara para saber si
 * hay una versión nueva.
 *
 *   node scripts/release.mjs [--dry-run]
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const dryRun = process.argv.includes("--dry-run");
const sh = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8" }).trim();

const fallas = [];
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const version = manifest.version;

// 1) los tres archivos existen. `main.js` lo produce `npm run build`.
const adjuntos = ["main.js", "manifest.json", "styles.css"];
for (const f of adjuntos) if (!existsSync(f)) fallas.push(`falta ${f} (¿corriste \`npm run build\`?)`);

// 2) no se publica algo que no está commiteado: la release quedaría apuntando a
//    un código que no existe en ninguna parte.
if (sh("git", ["status", "--porcelain"]) !== "") fallas.push("hay cambios sin commitear");

// 3) la etiqueta no puede existir ya: reusarla deja a BRAT con la versión vieja.
if (sh("git", ["tag", "--list", version]) !== "") fallas.push(`la etiqueta ${version} ya existe`);

// 4) `gh` autenticado
try {
  execFileSync("gh", ["auth", "status"], { stdio: "ignore" });
} catch {
  fallas.push("`gh` no está autenticado: corré `gh auth login`");
}

if (fallas.length > 0) {
  console.error("No se publica:");
  for (const f of fallas) console.error(`  - ${f}`);
  process.exit(1);
}

const args = [
  "release", "create", version,
  ...adjuntos,
  "--title", version,
  "--notes", `Versión ${version} de ${manifest.name}.`,
];

if (dryRun) {
  console.log(`gh ${args.join(" ")}`);
  process.exit(0);
}

console.log(sh("gh", args));
