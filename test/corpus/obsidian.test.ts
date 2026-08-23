import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { headingsDe, parseDocumento } from "../../src/documento.js";
import { notasReales, VAULT } from "./vault.js";

/**
 * El tercer instrumento: el parser de headings **de Obsidian**.
 *
 * `medir-tareas.mjs` y `src/linea.ts` son las dos gramáticas mías, y las dos
 * podrían estar equivocadas del mismo modo: las escribí yo mirando el mismo
 * corpus. Obsidian es independiente, y además es el que manda: si el plugin ve
 * un heading donde Obsidian no ve ninguno, el que está mal es el plugin.
 *
 * Obsidian no expone ítems de lista por esta vía, así que para las tareas no
 * hay diferencial por este lado. Solo headings: nivel, texto y línea.
 *
 * ## Por qué un volcado y no una llamada HTTP
 *
 * El servidor MCP corre en `127.0.0.1:27200` y pide API key. Un cliente escrito
 * acá y nunca ejecutado sería un instrumento sin verificar, que es justo lo que
 * midió mal en la sesión 1. El volcado, en cambio, se produce con la
 * aplicación abierta y se compara acá: verificado de punta a punta.
 *
 * Va a `outline-obsidian.local.json`, **ignorado por git**: lleva los títulos
 * reales de las notas y este repositorio es público. Sin el archivo, se saltea.
 *
 * ## Por qué el volcado lleva el hash del archivo
 *
 * Porque envejece rápido, y está medido: entre tomarlo y correr el test por
 * primera vez, dos de las siete notas ya habían cambiado en disco y la
 * comparación falló por líneas corridas. Obsidian y el parser coincidían; lo
 * viejo era la foto. Un volcado viejo tiene que **saltearse diciéndolo**, no
 * fallar como si el parser estuviera mal: una alarma falsa que se repite es
 * una alarma que se ignora.
 */
const RUTA = fileURLToPath(new URL("../../outline-obsidian.local.json", import.meta.url));

interface HeadingObsidian {
  level: number;
  text: string;
  line_number: number;
}
interface NotaVolcada {
  sha256: string;
  headings: HeadingObsidian[];
}

const volcado: Record<string, NotaVolcada> | null = existsSync(RUTA)
  ? (JSON.parse(readFileSync(RUTA, "utf8")).notas as Record<string, NotaVolcada>)
  : null;

const sha = (raw: string) => createHash("sha256").update(raw).digest("hex");

describe.skipIf(!VAULT || !volcado)("headings: el parser contra el de Obsidian", () => {
  const notas = notasReales();
  /** Las notas que no cambiaron desde que se tomó la foto. */
  const frescas = notas.filter((n) => volcado![n.rel]?.sha256 === sha(n.raw));

  it("el volcado cubre las siete notas", () => {
    expect(Object.keys(volcado!).sort()).toEqual(notas.map((n) => n.rel).sort());
  });

  it("informa cuáles notas cambiaron desde el volcado", () => {
    const viejas = notas.filter((n) => !frescas.includes(n));
    if (viejas.length) {
      console.warn(
        `\n  ⚠ el volcado de Obsidian quedó viejo para ${viejas.length} nota(s):\n` +
          viejas.map((n) => `    ${n.rel}`).join("\n") +
          "\n    Regeneralo con Obsidian abierto (get_note_outline) o esas notas no se comparan.\n",
      );
    }
    // No falla: que las notas cambien es lo normal, son notas de trabajo. Lo
    // que sí sería un problema es que quedaran viejas **todas**, porque
    // entonces este bloque no estaría comprobando nada.
    expect(frescas.length, "ninguna nota fresca: el volcado no sirve").toBeGreaterThan(0);
  });

  it.each(frescas.map((n) => n.rel))("%s: mismo nivel, mismo texto, misma línea", (rel) => {
    const { raw } = frescas.find((n) => n.rel === rel)!;
    const mios = headingsDe(parseDocumento(raw)).map((h) => ({
      level: h.heading.nivel,
      // `texto` es verbatim, con los espacios finales; Obsidian los recorta.
      text: h.heading.texto.trim(),
      // El volcado trae líneas 1-based; el documento las guarda 0-based.
      line_number: h.n + 1,
    }));
    expect(mios).toEqual(volcado![rel]!.headings);
  });

  it("Obsidian tampoco ve un proyecto donde el parser no ve ninguno", () => {
    // No comprueba el parser sino la premisa de la decisión: los headings en
    // texto plano no llevan enlace, así que Obsidian no resuelve ninguno a una
    // nota de proyecto. Es la medición que justifica la migración del paso 8.
    const conWikilinkSemantico = frescas
      .flatMap((n) => volcado![n.rel]!.headings)
      .filter((h) => /\[\[[pa]_/.test(h.text));
    expect(conWikilinkSemantico).toHaveLength(0);
  });
});
