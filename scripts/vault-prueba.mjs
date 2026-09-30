/**
 * El vault de prueba: dónde Claude Code verifica el plugin **sin tocar el vault
 * real**.
 *
 *   node scripts/vault-prueba.mjs preparar   arma o restaura el vault entero
 *   node scripts/vault-prueba.mjs notas      restaura solo las notas y los ajustes
 *   node scripts/vault-prueba.mjs abrir      lo abre en Obsidian (macOS)
 *   node scripts/vault-prueba.mjs ruta       imprime la ruta
 *
 * ## Por qué existe
 *
 * Hasta el 29/09/2026 toda verificación en vivo corría sobre el vault real
 * —con notas de prueba adentro— y la hacía el usuario, a mano: 216
 * comprobaciones pedidas entre las sesiones 6 y 8. La CLI de Obsidian (1.12+)
 * permite que las corra Claude Code, pero `obsidian eval` puede escribir en
 * cualquier vault abierto, y el real está en Sync. De ahí las dos reglas de
 * este archivo:
 *
 * 1. **El vault de prueba vive adentro del repo** (`tareas-vault-prueba/`,
 *    fuera de git) y se reconstruye desde `test/vault-semilla/`, que sí está en
 *    git. El repo es público: la semilla es inventada y reproduce **formas**.
 * 2. **Se puede restaurar en un segundo.** Una verificación que archiva y
 *    reinicia deja las notas cambiadas; la siguiente tiene que arrancar igual
 *    que la anterior, o dos corridas miden cosas distintas.
 *
 * ## Outliner va adentro, y no es opcional
 *
 * La forma de una edición depende de qué plugins haya (CLAUDE.md): con
 * Outliner, Enter reemplaza la línea entera. Verificar sin él es verificar otro
 * editor. Se copia del vault real —`OBSIDIAN_VAULT`— porque su código no es de
 * este repo y no se versiona acá.
 */
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
/** El nombre es lo que la CLI usa para elegir el vault: tiene que ser único. */
export const NOMBRE = "tareas-vault-prueba";
export const RUTA = join(RAIZ, NOMBRE);
const SEMILLA = join(RAIZ, "test", "vault-semilla");
const REAL = process.env.OBSIDIAN_VAULT ?? join(process.env.HOME ?? "", "Downloads/obsidian/mental palace");

/**
 * Una nota larga, generada y no versionada: la §5.5 pide «una nota larga de
 * tareas» con tokens para el ciclo de medición, y 400 líneas inventadas en git
 * no dicen nada que el generador no diga.
 */
function notaLarga() {
  const lineas = ["# LARGA", ""];
  for (let s = 1; s <= 20; s++) {
    lineas.push(`## sección ${s}`, "");
    for (let t = 1; t <= 18; t++) {
      const n = (s - 1) * 18 + t;
      // Largas a propósito: la §5.5 dice que el error de estimación del mapa de
      // alturas aparece cuando las líneas superan el promedio por renglón.
      const texto = `tarea ${n} con un texto bastante más largo que el promedio para que envuelva al angostar la ventana`;
      const token = n % 3 === 0 ? ` %%t:id=l${n};wb=foco;due=2026-10-${String((n % 28) + 1).padStart(2, "0")};p=${n % 2 + 1}%%` : "";
      lineas.push(`- [ ] ${texto}${token}`);
      if (n % 5 === 0) lineas.push(`\t- nota de la tarea ${n}`);
    }
    lineas.push("");
  }
  return lineas.join("\n");
}

function notas() {
  mkdirSync(join(RUTA, "0_inbox"), { recursive: true });
  cpSync(join(SEMILLA, "0_inbox"), join(RUTA, "0_inbox"), { recursive: true });
  writeFileSync(join(RUTA, "0_inbox", "tareas_LARGA.md"), notaLarga());
  const plugin = join(RUTA, ".obsidian", "plugins", "tareas-outline");
  mkdirSync(plugin, { recursive: true });
  cpSync(join(SEMILLA, "ajustes-tareas.json"), join(plugin, "data.json"));
}

function preparar() {
  mkdirSync(join(RUTA, ".obsidian"), { recursive: true });
  for (const f of ["app.json", "community-plugins.json"]) {
    cpSync(join(SEMILLA, ".obsidian", f), join(RUTA, ".obsidian", f));
  }
  notas();

  const outliner = join(REAL, ".obsidian", "plugins", "obsidian-outliner");
  if (existsSync(join(outliner, "main.js"))) {
    cpSync(outliner, join(RUTA, ".obsidian", "plugins", "obsidian-outliner"), { recursive: true });
  } else {
    console.warn(`No encontré Outliner en ${outliner}: el vault de prueba queda sin él, y eso es otro editor.`);
  }

  const plugin = join(RUTA, ".obsidian", "plugins", "tareas-outline");
  for (const f of ["main.js", "manifest.json", "styles.css"]) {
    if (!existsSync(join(RAIZ, f))) throw new Error(`falta ${f}: corré npm run build`);
    cpSync(join(RAIZ, f), join(plugin, f));
  }
  console.log(`Vault de prueba listo en ${RUTA}`);
}

/**
 * Abre el vault de prueba en una ventana propia.
 *
 * La CLI no tiene un comando para abrir un vault que Obsidian todavía no
 * conoce, y `obsidian://open?path=…` no registra una carpeta nueva: se probó y
 * no pasa nada. Lo que sí anda es lo mismo que hace el selector de vaults de
 * Obsidian —leído en el asar 1.13.7—:
 * `ipcRenderer.sendSync("vault-open", ruta, false)`.
 *
 * Hay que pedírselo a una ventana que ya esté abierta, y esa es **la única
 * vez** que este repo le habla a otro vault: no lee ni escribe nada de él, solo
 * le pide que abra otra ventana. Si el de prueba ya está abierto, no hace nada.
 */
function abrir() {
  const conocidos = execFileSync("obsidian", ["vaults"], { encoding: "utf8" }).split("\n");
  if (conocidos.some((v) => v.trim() === NOMBRE)) {
    console.log(`${NOMBRE} ya está abierto.`);
    return;
  }
  const codigo = `window.electron.ipcRenderer.sendSync("vault-open", ${JSON.stringify(RUTA)}, false)`;
  const salida = execFileSync("obsidian", ["eval", `code=${codigo}`], { encoding: "utf8" });
  console.log(salida.trim() === "=> true" ? `${NOMBRE} abierto.` : `No se pudo abrir: ${salida}`);
}

// Solo como programa: `obs.mjs` y las verificaciones lo importan por `NOMBRE`
// y `RUTA`, y ahí `process.argv` es el de ellos.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const orden = process.argv[2];
  if (orden === "preparar") preparar();
  else if (orden === "notas") {
    notas();
    console.log("Notas y ajustes restaurados.");
  } else if (orden === "abrir") {
    abrir();
  } else if (orden === "ruta") console.log(RUTA);
  else if (orden !== undefined) {
    console.error("Uso: node scripts/vault-prueba.mjs preparar|notas|abrir|ruta");
    process.exit(1);
  }
}
