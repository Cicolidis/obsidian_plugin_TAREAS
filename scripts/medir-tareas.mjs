/**
 * Medición del corpus de notas de tareas.
 *
 * Antes de fijar la gramática del plugin, contar qué hay realmente escrito
 * en las notas: cuántas de las líneas son tareas, cuántas son contexto sin
 * checkbox, qué niveles de heading se usan y con qué enlaces, y cuán
 * profundos son los árboles de verdad.
 *
 * Uso:
 *   node scripts/medir-tareas.mjs <ruta-del-vault> [--json]
 *
 * No escribe nada. Solo lee.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Las notas de tareas activas.
 *
 * La lista vive en `notas-de-tareas.json`, en la raíz, porque la comparten
 * este script y `src/notas.ts`: una lista de valores escrita en dos archivos
 * termina divergiendo (CLAUDE.md).
 */
const NOTAS = JSON.parse(
  await readFile(new URL("../notas-de-tareas.json", import.meta.url), "utf8"),
).notas;

// ---------------------------------------------------------------- gramática

const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const BULLET_RE = /^([ \t]*)([-*+]|\d+[.)])\s+(.*)$/;
/** `- [ ]`, `- [x]`, `- [/]`, `- [-]`, … El estado es un solo carácter. */
const CHECKBOX_RE = /^\[(.)\]\s?(.*)$/;
/** Wikilink en cualquier parte de la línea. */
const WIKILINK_RE = /\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/;
/** Referencia a proyecto/área en texto plano, sin corchetes: `⮕ p_6_Sheets`. */
const REF_PLANA_RE = /(?:^|[\s⮕→>])([pa]_[^\s|]+)/;

/** Una tabulación cuenta como un nivel entero; los espacios se suman. */
function anchoIndent(ws, tabSize = 2) {
  let ancho = 0;
  for (const ch of ws) ancho += ch === "\t" ? tabSize : 1;
  return ancho;
}

function tipoDeHeading(texto) {
  const wiki = WIKILINK_RE.exec(texto);
  const destino = wiki ? wiki[1].trim() : (REF_PLANA_RE.exec(texto)?.[1] ?? null);
  if (!destino) return { tipo: "sección", destino: null, enlazado: false };
  const enlazado = Boolean(wiki);
  if (destino.startsWith("p_")) return { tipo: "proyecto", destino, enlazado };
  if (destino.startsWith("a_")) return { tipo: "área", destino, enlazado };
  return { tipo: "enlace-otro", destino, enlazado };
}

// ------------------------------------------------------------------ análisis

function analizar(nombre, contenido) {
  const lineas = contenido.split("\n");

  const m = {
    nota: nombre,
    lineas: lineas.length,
    tareas: 0,
    tareasCompletadas: 0,
    checkboxVacio: 0,
    bulletsSinCheckbox: 0,
    bulletsSinCheckboxBajoTarea: 0,
    textoLibre: 0,
    tablas: 0,
    imagenes: 0,
    headingsPorNivel: {},
    headingsProyecto: 0,
    headingsArea: 0,
    headingsSeccion: 0,
    headingsEnlaceOtro: 0,
    headingsConWikilink: 0,
    headingsConRefPlana: 0,
    estadosDeCheckbox: {},
    profundidadPorTarea: [],
    tamanoSubarbolRaiz: [],
    usaTabs: false,
    usaEspacios: false,
    anchosIndent: new Set(),
    tareasSinHeadingSemantico: 0,
    fechasEnTexto: 0,
  };

  // Pila de anchos de indentación para derivar el nivel relativo.
  let pila = [];
  // ¿La línea anterior con menos indentación era una tarea?
  const esTareaEnAncho = new Map();
  let headingSemanticoVigente = null;
  let raizActual = null;

  for (const linea of lineas) {
    if (linea.trim() === "") continue;

    const h = HEADING_RE.exec(linea);
    if (h) {
      const nivel = h[1].length;
      m.headingsPorNivel[nivel] = (m.headingsPorNivel[nivel] ?? 0) + 1;
      const { tipo, enlazado } = tipoDeHeading(h[2]);
      if (tipo === "proyecto") m.headingsProyecto++;
      else if (tipo === "área") m.headingsArea++;
      else if (tipo === "enlace-otro") m.headingsEnlaceOtro++;
      else m.headingsSeccion++;
      if (tipo !== "sección") (enlazado ? m.headingsConWikilink++ : m.headingsConRefPlana++);
      headingSemanticoVigente = tipo === "proyecto" || tipo === "área" ? tipo : headingSemanticoVigente;
      // Un heading corta los árboles abiertos.
      pila = [];
      esTareaEnAncho.clear();
      if (raizActual) { m.tamanoSubarbolRaiz.push(raizActual); raizActual = null; }
      continue;
    }

    if (/^\s*\|.*\|\s*$/.test(linea)) { m.tablas++; continue; }
    if (/!\[\[.+\]\]/.test(linea)) m.imagenes++;
    if (/\b\d{1,2}[ /-](?:de )?(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|\d{1,2})/i.test(linea))
      m.fechasEnTexto++;

    const b = BULLET_RE.exec(linea);
    if (!b) { m.textoLibre++; continue; }

    const [, ws, , resto] = b;
    if (ws.includes("\t")) m.usaTabs = true;
    if (ws.includes(" ")) m.usaEspacios = true;
    const ancho = anchoIndent(ws);
    if (ancho > 0) m.anchosIndent.add(ancho);

    // Nivel relativo: cuántos anchos menores hay abiertos en la pila.
    while (pila.length && pila[pila.length - 1] >= ancho) pila.pop();
    const nivel = pila.length;
    pila.push(ancho);
    for (const [a] of esTareaEnAncho) if (a >= ancho) esTareaEnAncho.delete(a);

    const c = CHECKBOX_RE.exec(resto);
    if (c) {
      const estado = c[1];
      const texto = c[2].trim();
      m.estadosDeCheckbox[estado] = (m.estadosDeCheckbox[estado] ?? 0) + 1;
      if (texto === "") { m.checkboxVacio++; esTareaEnAncho.set(ancho, true); continue; }
      m.tareas++;
      if (estado !== " ") m.tareasCompletadas++;
      m.profundidadPorTarea.push(nivel);
      esTareaEnAncho.set(ancho, true);
      if (headingSemanticoVigente === null) m.tareasSinHeadingSemantico++;
      if (nivel === 0) {
        if (raizActual) m.tamanoSubarbolRaiz.push(raizActual);
        raizActual = 1;
      } else if (raizActual !== null) raizActual++;
    } else {
      m.bulletsSinCheckbox++;
      // ¿Cuelga de una tarea? Hay una tarea abierta con menos indentación.
      for (const [a] of esTareaEnAncho) if (a < ancho) { m.bulletsSinCheckboxBajoTarea++; break; }
      if (raizActual !== null && nivel > 0) raizActual++;
    }
  }
  if (raizActual) m.tamanoSubarbolRaiz.push(raizActual);

  m.anchosIndent = [...m.anchosIndent].sort((a, b) => a - b);
  return m;
}

// ------------------------------------------------------------------ reporte

const pct = (n, total) => (total ? `${((n / total) * 100).toFixed(1)}%` : "—");

function percentil(xs, p) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

function reportar(medidas) {
  const t = (campo) => medidas.reduce((s, m) => s + (m[campo] ?? 0), 0);
  const todasProf = medidas.flatMap((m) => m.profundidadPorTarea);
  const todosSub = medidas.flatMap((m) => m.tamanoSubarbolRaiz);

  console.log("\n=== POR NOTA ===\n");
  const filas = medidas.map((m) => ({
    nota: m.nota.replace(/^.*\//, "").replace(/\.md$/, ""),
    líneas: m.lineas,
    tareas: m.tareas,
    "hechas": m.tareasCompletadas,
    "bullets s/cb": m.bulletsSinCheckbox,
    "cb vacíos": m.checkboxVacio,
    "prof. máx": Math.max(0, ...m.profundidadPorTarea),
    "headings": Object.values(m.headingsPorNivel).reduce((a, b) => a + b, 0),
  }));
  console.table(filas);

  console.log("=== LO QUE DECIDE LA GRAMÁTICA ===\n");
  const lineasBullet = t("tareas") + t("bulletsSinCheckbox") + t("checkboxVacio");
  console.log(`Tareas totales:                  ${t("tareas")}`);
  console.log(`  completadas:                   ${t("tareasCompletadas")} (${pct(t("tareasCompletadas"), t("tareas"))})`);
  console.log(`Bullets SIN checkbox:            ${t("bulletsSinCheckbox")} (${pct(t("bulletsSinCheckbox"), lineasBullet)} de los bullets)`);
  console.log(`  de esos, colgando de una tarea:${t("bulletsSinCheckboxBajoTarea")}  <- son "notas de tarea"`);
  console.log(`Checkboxes vacíos (separadores): ${t("checkboxVacio")}`);
  console.log(`Texto libre (ni bullet ni head): ${t("textoLibre")}`);
  console.log(`Filas de tabla:                  ${t("tablas")}`);
  console.log(`Imágenes embebidas:              ${t("imagenes")}`);
  console.log(`Fechas escritas en prosa:        ${t("fechasEnTexto")}  <- candidatas a 'due='`);

  console.log("\n--- Profundidad de los árboles (nivel de la tarea) ---");
  console.log(`  p50 ${percentil(todasProf, 50)} · p90 ${percentil(todasProf, 90)} · máx ${Math.max(0, ...todasProf)}`);
  console.log("--- Tamaño del subárbol de una tarea raíz (líneas) ---");
  console.log(`  p50 ${percentil(todosSub, 50)} · p90 ${percentil(todosSub, 90)} · máx ${Math.max(0, ...todosSub)}`);
  console.log("  ^ decide si el colapso por defecto es obligatorio en la vista de workbench");

  console.log("\n--- Estados de checkbox usados ---");
  const estados = {};
  for (const m of medidas)
    for (const [e, n] of Object.entries(m.estadosDeCheckbox)) estados[e] = (estados[e] ?? 0) + n;
  console.log("  " + Object.entries(estados).map(([e, n]) => `"${e}"×${n}`).join("  "));
  console.log("  ^ si solo aparecen \" \" y \"x\", no hace falta soportar [/] ni [-]\n");

  console.log("=== HEADINGS: LA REGLA DE PROYECTO/ÁREA ===\n");
  const porNivel = {};
  for (const m of medidas)
    for (const [n, c] of Object.entries(m.headingsPorNivel)) porNivel[n] = (porNivel[n] ?? 0) + c;
  console.log("Headings por nivel:", porNivel);
  console.log("  ^ si un mismo nivel aparece como proyecto y como sección, el nivel NO puede fijar el tipo");
  const totalH = Object.values(porNivel).reduce((a, b) => a + b, 0);
  console.log(`\nproyecto (p_): ${t("headingsProyecto")}   área (a_): ${t("headingsArea")}   otro enlace: ${t("headingsEnlaceOtro")}   sección: ${t("headingsSeccion")}   (total ${totalH})`);
  console.log(`Con wikilink [[…]]: ${t("headingsConWikilink")}   con referencia plana: ${t("headingsConRefPlana")}`);
  console.log("  ^ la referencia plana es exactamente el trabajo de migración");
  console.log(`\nTareas sin heading semántico arriba: ${t("tareasSinHeadingSemantico")}  <- irían a fleeting`);

  console.log("\n=== INDENTACIÓN ===");
  for (const m of medidas)
    console.log(`  ${m.nota.replace(/^.*\//, "")}: tabs=${m.usaTabs} espacios=${m.usaEspacios} anchos=[${m.anchosIndent}]`);
  console.log("  ^ mezclar tabs y espacios rompe el anidado al reescribir (Anotaciones §13.19)\n");
}

// --------------------------------------------------------------------- main

const vault = process.argv[2];
if (!vault) {
  console.error("Uso: node scripts/medir-tareas.mjs <ruta-del-vault> [--json]");
  process.exit(1);
}

const medidas = [];
for (const rel of NOTAS) {
  try {
    medidas.push(analizar(rel, await readFile(join(vault, rel), "utf8")));
  } catch (e) {
    if (e.code === "ENOENT") console.error(`(falta, se omite: ${rel})`);
    else throw e;
  }
}

if (process.argv.includes("--json")) console.log(JSON.stringify(medidas, null, 2));
else reportar(medidas);
