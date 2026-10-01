/**
 * La CLI de Obsidian, **atada al vault de prueba**.
 *
 *   node scripts/obs.mjs <comando> [clave=valor …]
 *   node scripts/obs.mjs eval-archivo <ruta.js>      corre un archivo con eval
 *
 * Es el único camino por el que Claude Code le habla a Obsidian en este repo, y
 * los permisos de `.claude/settings.json` lo reflejan: se permite este script,
 * no `obsidian` a secas.
 *
 * ## Por qué un envoltorio y no la CLI directa
 *
 * `obsidian eval` ejecuta JavaScript con el `app` entero en la mano: puede
 * escribir en el vault real, que está en Sync, y la regla dura de `CLAUDE.md`
 * dice que no se escribe ahí. La CLI elige el vault por un argumento
 * `vault=…`; olvidarlo manda el comando **al vault que tenga el foco**. Este
 * script pone siempre el de prueba y se niega a recibir otro.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { NOMBRE } from "./vault-prueba.mjs";

/** Corre un comando de la CLI sobre el vault de prueba y devuelve la salida. */
export function obs(...args) {
  for (const a of args) {
    if (/^vault=/.test(a)) throw new Error(`obs.mjs no acepta «${a}»: solo habla con ${NOMBRE}`);
  }
  return execFileSync("obsidian", [`vault=${NOMBRE}`, ...args], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    // Un instrumento que se cuelga sin decir nada es peor que uno que falla:
    // la CLI no tiene tiempo límite propio, y un `eval` que espera algo que no
    // llega la deja esperando para siempre.
    timeout: 150_000,
    // SIGTERM no alcanza: la CLI lo ignora y `execFileSync` se queda esperando.
    killSignal: "SIGKILL",
  }).trimEnd();
}

/**
 * Evalúa JavaScript en el vault de prueba y devuelve el valor, parseado.
 *
 * El código se envuelve para que pueda usar `await` y devolver cualquier cosa
 * serializable: la CLI imprime `=> ` y el valor, y un objeto sin serializar
 * llegaría como `[object Object]`.
 */
export function evaluar(codigo) {
  const envuelto =
    "(async () => { try { const __r = await (async () => {" +
    codigo +
    "\n})(); return JSON.stringify({ v: __r === undefined ? null : __r }); }" +
    " catch (e) { return JSON.stringify({ error: String(e && e.message || e) }); } })()";
  const salida = obs("eval", `code=${envuelto}`);
  // Lo que el código imprime con `console.log` puede llegar antes del valor
  // (con `dev:debug` puesto, la CLI captura la consola): se toma la última
  // línea que empieza con «=> ».
  const m = /(?:^|\n)=> ([^\n]*)$/.exec(salida);
  if (!m) throw new Error(`eval no devolvió un valor:\n${salida}`);
  const r = JSON.parse(m[1]);
  // Un error adentro de Obsidian vuelve con su mensaje, no como «no devolvió
  // nada»: un instrumento que se calla la causa obliga a adivinarla.
  if ("error" in r) throw new Error(`en Obsidian: ${r.error}`);
  return r.v;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [primero, ...resto] = process.argv.slice(2);
  if (!primero) {
    console.error("Uso: node scripts/obs.mjs <comando> [clave=valor …] | eval-archivo <ruta.js>");
    process.exit(1);
  }
  try {
    if (primero === "eval-archivo") {
      console.log(obs("eval", `code=${readFileSync(resto[0], "utf8")}`));
    } else {
      console.log(obs(primero, ...resto));
    }
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
