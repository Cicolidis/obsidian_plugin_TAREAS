/**
 * La verificación de la sesión 9: las alternativas de diseño que se borraron
 * al elegir, y la sección «Desarrollo» de los ajustes.
 *
 *   node scripts/verificar/sesion-9.mjs
 *
 * Mismos identificadores que `sesiones/VERIFICAR-sesion-9.md`. El informe va a
 * `sesiones/RESULTADOS-sesion-9-cli.md`.
 *
 * Lo que se eligió el 30/09/2026: la fila en la columna del margen, revelada al
 * pasar el mouse; la prioridad como barra + checkbox; los atajos de fecha
 * discontinuos; «Otra fecha…» con la grilla. Lo que esto comprueba es que lo
 * demás **ya no está** —ni en el DOM, ni en `body`, ni en los ajustes— y que una
 * configuración de antes carga sin romper nada.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { comprobar, esperar, evaluar, informe, instalar, obs, reiniciarVault, vt } from "./lib.mjs";
import { RUTA } from "../vault-prueba.mjs";

const P = "0_inbox/tareas_PRUEBA.md";
const DATA = join(RUTA, ".obsidian", "plugins", "tareas-outline", "data.json");

const BORRADOS = [
  "Prioridad: cómo se dibuja",
  "Fila de botones: dónde va",
  "Fila de botones: cuándo se ve",
  "Fecha: en qué orden se ofrecen los atajos",
  "«Otra fecha…»: cómo se elige",
];
const DE_DESARROLLO = ["Decoraciones en la nota", "Congelar el índice en memoria", "Registrar eventos en la consola"];

async function abrir(rel) {
  vt(`await vt.cerrarMenus(); await vt.cerrarModales(); await vt.abrir(${JSON.stringify(rel)}); return true;`);
  await esperar(300);
}

/** Lo que el plugin dibuja y pone en `body`, para leerlo de una vez. */
const estadoDelDom = () =>
  vt(`await vt.celda("tarea urgente");
    const hoja = document.querySelector(".workspace-leaf.mod-active");
    return {
      enLinea: hoja.querySelectorAll(".cm-line .tareas-fila").length,
      enMargen: hoja.querySelectorAll(".tareas-margen .tareas-fila").length,
      body: [...document.body.classList].filter((c) => c.startsWith("tareas-")).sort(),
    };`);

instalar();
vt(`const w = require("@electron/remote").getCurrentWindow(); w.showInactive(); w.moveTop();
  if (!w.isFullScreen()) { if (w.isMaximized()) w.unmaximize(); w.setSize(1600, 1000); await vt.esperar(600); }
  return true;`);
await reiniciarVault();
await abrir(P);

await comprobar("S1", "la fila vive solo en el margen: ninguna adentro de una línea", () => {
  const e = estadoDelDom();
  return { ok: e.enLinea === 0 && e.enMargen > 0, dato: `${e.enLinea} adentro de una línea · ${e.enMargen} en el margen` };
});

await comprobar("S2", "en `body` solo las clases de lo elegido", () => {
  const e = estadoDelDom();
  const esperadas = ["tareas-estilo-barra", "tareas-estilo-checkbox", "tareas-revelar-hover"];
  const sobran = e.body.filter((c) => !esperadas.includes(c) && c !== "tareas-ind-glifo");
  return { ok: esperadas.every((c) => e.body.includes(c)) && sobran.length === 0, dato: e.body.join(" ") };
});

await comprobar("S3", "los cinco ajustes de las alternativas ya no están", () => {
  const r = vt(`app.setting.open(); app.setting.openTabById("tareas-outline"); await vt.esperar(400);
    const nombres = [...app.setting.activeTab.containerEl.querySelectorAll(".setting-item-name")].map((n) => n.textContent.trim());
    app.setting.close(); await vt.esperar(300); return nombres;`);
  const quedan = BORRADOS.filter((b) => r.includes(b));
  return { ok: quedan.length === 0, dato: quedan.length ? `quedan: ${quedan.join(", ")}` : `${r.length} ajustes, ninguno de los cinco` };
});

await comprobar("S4", "«Desarrollo» es la última sección, con los tres instrumentos adentro", () => {
  const r = vt(`app.setting.open(); app.setting.openTabById("tareas-outline"); await vt.esperar(400);
    const items = [...app.setting.activeTab.containerEl.querySelectorAll(".setting-item")].map((s) => ({
      nombre: s.querySelector(".setting-item-name")?.textContent.trim() ?? "",
      titulo: s.classList.contains("setting-item-heading"),
    }));
    app.setting.close(); await vt.esperar(300); return items;`);
  const i = r.findIndex((x) => x.titulo && x.nombre === "Desarrollo");
  const despues = r.slice(i + 1).map((x) => x.nombre);
  const antes = r.slice(0, Math.max(i, 0)).map((x) => x.nombre);
  return {
    ok: i >= 0 && DE_DESARROLLO.every((n) => despues.includes(n)) && !DE_DESARROLLO.some((n) => antes.includes(n)) && !r.slice(i + 1).some((x) => x.titulo),
    dato: i < 0 ? "no hay sección «Desarrollo»" : `después del título: ${despues.join(", ")}`,
  };
});

await comprobar("S5", "la prioridad muy alta: barra en el margen y color en el checkbox", () => {
  const r = vt(`await vt.celda("tarea urgente");
    const l = [...document.querySelectorAll(".workspace-leaf.mod-active .cm-line")].find((e) => e.textContent.includes("tarea urgente"));
    const h = [...document.querySelectorAll(".workspace-leaf.mod-active .cm-line")].find((e) => e.textContent.includes("hija de la urgente"));
    const antes = getComputedStyle(l, "::before");
    return { clases: l.className, ancho: antes.width, tamano: antes.backgroundSize,
             checkbox: getComputedStyle(l).getPropertyValue("--checkbox-border-color").trim(),
             color: getComputedStyle(l).getPropertyValue("--tareas-color").trim(),
             hija: h ? getComputedStyle(h, "::before").width : null, fondo: getComputedStyle(l).backgroundColor };`);
  return {
    ok: /tareas-p2/.test(r.clases) && r.ancho === "3px" && r.checkbox !== "" && r.checkbox === r.color && r.hija === "1px",
    dato: `barra ${r.ancho} (${r.tamano}) · checkbox ${r.checkbox} · hija ${r.hija} · fondo ${r.fondo}`,
  };
});

await comprobar("S6", "el menú de fecha: los seis atajos discontinuos, y «Otra fecha…» abre la grilla", async () => {
  vt(`await vt.clic("tarea sin fecha ni grupo", "fecha"); return true;`);
  const m = vt(`return vt.menu().map((i) => i.titulo);`);
  vt(`await vt.elegir("Otra fecha"); await vt.esperar(400); return true;`);
  const grilla = vt(`return !!vt.m()?.querySelector(".tareas-calendario-grilla");`);
  vt(`await vt.cerrarModales(); return true;`);
  const atajos = m.filter((t) => !/^(Otra fecha|Sin fecha)/.test(t));
  return {
    ok: atajos.length === 6 && atajos.at(-1).startsWith("En 30 días") && grilla,
    dato: `${atajos.join(" · ")} · grilla: ${grilla}`,
  };
});

await comprobar("S7", "una configuración de antes carga sin romper, y al guardar se limpia", async () => {
  const semilla = JSON.parse(readFileSync(DATA, "utf8"));
  const vieja = {
    ...semilla,
    estiloDeFila: "derecha",
    modoDeRevelacion: "siempre",
    estiloDePrioridad: "fondo",
    ordenDeAtajos: "semana",
    selectorDeFecha: "nativo",
  };
  writeFileSync(DATA, JSON.stringify(vieja, null, 2));
  obs("plugin:reload", "id=tareas-outline");
  await esperar(1500);
  instalar();
  await abrir(P);
  const e = estadoDelDom();
  // Guardar cualquier cosa: dos veces el mismo interruptor deja todo igual.
  vt(`await vt.ajuste("Unir tareas deja una línea limpia", false); await vt.ajuste("Unir tareas deja una línea limpia", true); return true;`);
  await esperar(500);
  const guardado = JSON.parse(readFileSync(DATA, "utf8"));
  const quedan = ["estiloDeFila", "modoDeRevelacion", "estiloDePrioridad", "ordenDeAtajos", "selectorDeFecha"].filter((k) => k in guardado);
  return {
    ok: e.enLinea === 0 && e.enMargen > 0 && !e.body.includes("tareas-estilo-fondo") && quedan.length === 0,
    dato: `cargó: ${e.enMargen} filas en el margen, body ${e.body.join(" ")} · después de guardar ${quedan.length ? `quedan ${quedan.join(", ")}` : "no queda ninguna clave vieja"}`,
  };
});

await reiniciarVault();
void evaluar;
writeFileSync(
  new URL("../../sesiones/RESULTADOS-sesion-9-cli.md", import.meta.url),
  informe("Verificación de la sesión 9, corrida por Claude Code con la CLI"),
);
