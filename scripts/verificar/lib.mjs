/**
 * Lo que comparten las verificaciones en vivo: hablar con el vault de prueba,
 * leer el disco y anotar resultados.
 *
 * Cada verificación es un archivo de `scripts/verificar/` que sigue la guía
 * `VERIFICAR-*.md` de su sesión, con **los mismos identificadores**: así el
 * informe se lee al lado de la guía y lo que queda a mano se ve por
 * diferencia.
 *
 * ## Tres reglas que vienen del método (CLAUDE.md)
 *
 * - **Un instrumento miente antes que el código.** Cada comprobación dice qué
 *   midió, con el número, no solo «ok». Un verde sin dato no se distingue de un
 *   instrumento roto.
 * - **Sobre qué binario.** El informe arranca con el commit y el `mtime` del
 *   `main.js` que corrió.
 * - **Lo que no se puede medir se dice.** Una comprobación que depende de mirar
 *   —un color, si «se ve bien»— sale como `a mano`, nunca como verde.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { evaluar, obs } from "../obs.mjs";
import { RUTA } from "../vault-prueba.mjs";

export { evaluar, obs };

export const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/** Los bytes de una nota del vault de prueba, leídos del disco y no del índice. */
export function leer(rel) {
  return readFileSync(join(RUTA, rel), "utf8");
}

/** La línea que contiene `texto`, o `null`. Del disco. */
export function lineaEnDisco(rel, texto) {
  return leer(rel).split("\n").find((l) => l.includes(texto)) ?? null;
}

/**
 * Los ayudantes del lado de la página, en `window.__vt`.
 *
 * Van como texto porque corren adentro de Obsidian. Se instalan una vez por
 * corrida y se reinstalan si el plugin se recargó —el `window` sobrevive, pero
 * `p()` y `v()` se piden cada vez, así que nunca apuntan a una instancia vieja—.
 */
const AYUDANTES = String.raw`
// Nada de esperas encadenadas largas acá adentro: con la ventana en segundo
// plano, Chromium espacia los timers encadenados hasta uno por minuto (el
// «intensive throttling», a los 5 minutos de estar oculta). Un recorrido de 40
// pasos con \`setTimeout\` tardaba 40 minutos y la CLI parecía colgada —pasó con
// \`medicion.subir()\` en la primera corrida entera—. Los recorridos largos los
// maneja Node, un paso por \`eval\`. Apagar el freno con
// \`setBackgroundThrottling(false)\` se probó y es peor: los eventos de
// \`dev:cdp\` quedaron esperando un cuadro que no llegaba.
window.__vt = {
  p: () => app.plugins.plugins["tareas-outline"],
  v: () => app.workspace.activeEditor?.editor?.cm ?? null,
  esperar: (ms) => new Promise((r) => setTimeout(r, ms)),

  async abrir(rel) {
    const f = app.vault.getFileByPath(rel);
    if (!f) throw new Error("no existe " + rel);
    const hoja = app.workspace.getMostRecentLeaf() ?? app.workspace.getLeaf(false);
    await hoja.openFile(f, { state: { mode: "source", source: false } });
    app.workspace.setActiveLeaf(hoja, { focus: true });
    await __vt.esperar(700);
  },

  linea(texto) {
    const d = __vt.v().state.doc;
    for (let i = 1; i <= d.lines; i++) if (d.line(i).text.includes(texto)) return d.line(i);
    return null;
  },

  /** La celda del margen de la línea que contiene el texto, trayéndola a la vista. */
  async celda(texto) {
    const v = __vt.v();
    const l = __vt.linea(texto);
    if (!l) return null;
    v.scrollDOM.scrollTop = Math.max(0, v.lineBlockAt(l.from).top - 120);
    await __vt.esperar(250);
    v.requestMeasure();
    await __vt.esperar(150);
    for (const e of document.querySelectorAll(".workspace-leaf.mod-active .tareas-margen .cm-gutterElement")) {
      const r = e.getBoundingClientRect();
      if (r.height === 0) continue;
      const b = v.lineBlockAtHeight(r.top - v.documentTop + 2);
      if (b.from === l.from) return e;
    }
    return null;
  },

  async fila(texto) {
    const c = await __vt.celda(texto);
    if (!c) return null;
    return [...c.querySelectorAll(".tareas-boton")].map((b) => {
      const r = b.getBoundingClientRect();
      return {
        accion: (b.className.match(/tareas-boton-([a-z-]+)/) || [])[1] ?? null,
        activo: b.classList.contains("is-activo"),
        inerte: b.classList.contains("is-inerte") || b.classList.contains("is-apagado") || b.hasAttribute("disabled") || b.getAttribute("aria-disabled") === "true",
        label: b.getAttribute("aria-label") ?? "",
        opacidad: getComputedStyle(b).opacity,
        x: Math.round(r.x * 10) / 10,
        ancho: Math.round(r.width * 10) / 10,
      };
    });
  },

  async clic(texto, accion) {
    const c = await __vt.celda(texto);
    const b = c?.querySelector(".tareas-boton-" + accion);
    if (!b) throw new Error("no hay botón " + accion + " en «" + texto + "»");
    const r = b.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, button: 0 };
    b.dispatchEvent(new MouseEvent("mousedown", o));
    b.dispatchEvent(new MouseEvent("mouseup", o));
    b.dispatchEvent(new MouseEvent("click", o));
    await __vt.esperar(400);
  },

  menu() {
    const m = [...document.querySelectorAll(".menu")].at(-1);
    if (!m) return null;
    return [...m.querySelectorAll(".menu-item")].map((i) => ({
      titulo: i.querySelector(".menu-item-title")?.textContent ?? "",
      marcado: i.classList.contains("mod-checked") || !!i.querySelector(".menu-item-icon svg.lucide-check, .mod-checked"),
    }));
  },

  async elegir(prefijo) {
    const m = [...document.querySelectorAll(".menu")].at(-1);
    const i = [...(m?.querySelectorAll(".menu-item") ?? [])].find((x) =>
      (x.querySelector(".menu-item-title")?.textContent ?? "").startsWith(prefijo));
    if (!i) throw new Error("no hay ítem «" + prefijo + "» en el menú");
    i.click();
    await __vt.esperar(600);
  },

  async tecla(key, destino) {
    const o = { key, bubbles: true, cancelable: true };
    (destino ?? document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent("keydown", o));
    await __vt.esperar(400);
  },

  /**
   * Cierra los menús **por donde los cierra Obsidian**: un clic afuera. Sacarlos
   * del DOM a mano no corre su \`onHide\`, y ahí se sueltan los oyentes de
   * teclado que el menú puso —que es justo lo que D8 mide—.
   */
  async cerrarMenus() {
    for (let i = 0; i < 3 && document.querySelector(".menu"); i++) {
      const o = { bubbles: true, cancelable: true, clientX: 2, clientY: 2 };
      document.body.dispatchEvent(new MouseEvent("mousedown", o));
      document.body.dispatchEvent(new MouseEvent("mouseup", o));
      await __vt.esperar(200);
    }
    return document.querySelectorAll(".menu").length;
  },

  modal() {
    const m = [...document.querySelectorAll(".modal-container .modal")].at(-1);
    if (!m) return null;
    return {
      texto: m.innerText,
      botones: [...m.querySelectorAll("button")].map((b) => b.textContent.trim()),
      foco: m.contains(document.activeElement) ? (document.activeElement.textContent || document.activeElement.value || document.activeElement.tagName).trim() : null,
      alto: Math.round(m.getBoundingClientRect().height),
    };
  },

  /** El modal de arriba de todo. Siempre el último: puede haber otro abajo. */
  m: () => [...document.querySelectorAll(".modal-container .modal")].at(-1) ?? null,

  /**
   * Cierra los modales con un clic en el fondo, que es lo que hace Obsidian.
   * En 1.13 el botón de cerrar ya no es \`.modal-close-button\`, y un ayudante que
   * buscaba ese dejaba modales viejos abajo: la comprobación siguiente leía el
   * modal equivocado. Devuelve cuántos quedaron, para que eso no pase callado.
   */
  async cerrarModales() {
    for (let i = 0; i < 5 && document.querySelector(".modal-container"); i++) {
      const bg = [...document.querySelectorAll(".modal-container .modal-bg")].at(-1);
      const o = { bubbles: true, cancelable: true, clientX: 5, clientY: 5 };
      bg?.dispatchEvent(new MouseEvent("mousedown", o));
      bg?.dispatchEvent(new MouseEvent("mouseup", o));
      bg?.dispatchEvent(new MouseEvent("click", o));
      await __vt.esperar(300);
    }
    return document.querySelectorAll(".modal-container").length;
  },

  async boton(texto) {
    const m = [...document.querySelectorAll(".modal-container .modal")].at(-1);
    const b = [...(m?.querySelectorAll("button") ?? [])].find((x) => x.textContent.trim() === texto);
    if (!b) throw new Error("no hay botón «" + texto + "» en el modal");
    b.click();
    await __vt.esperar(900);
  },

  avisos() {
    return [...document.querySelectorAll(".notice")].map((n) => n.innerText.trim());
  },
  limpiarAvisos() {
    document.querySelectorAll(".notice").forEach((n) => n.remove());
  },

  cursor(texto, col) {
    const v = __vt.v();
    const l = __vt.linea(texto);
    const pos = col === "fin" ? l.to : l.from + col;
    v.focus();
    v.dispatch({ selection: { anchor: pos } });
  },

  sel() {
    const v = __vt.v();
    const h = v.state.selection.main.head;
    const l = v.state.doc.lineAt(h);
    return { linea: l.number, col: h - l.from, texto: l.text };
  },

  async comando(id) {
    const ok = app.commands.executeCommandById("tareas-outline:" + id);
    await __vt.esperar(500);
    return ok;
  },

  /** Un ajuste, por la pestaña de ajustes de verdad: pasa por los mismos saneos. */
  async ajuste(nombre, valor) {
    app.setting.open();
    app.setting.openTabById("tareas-outline");
    await __vt.esperar(400);
    const cont = app.setting.activeTab.containerEl;
    const item = [...cont.querySelectorAll(".setting-item")].find(
      (s) => (s.querySelector(".setting-item-name")?.textContent.trim() ?? "").startsWith(nombre));
    if (!item) { app.setting.close(); throw new Error("no hay ajuste «" + nombre + "»"); }
    const toggle = item.querySelector(".checkbox-container");
    const sel = item.querySelector("select");
    const inp = item.querySelector("input[type=text], textarea");
    if (toggle && typeof valor === "boolean") {
      if (toggle.classList.contains("is-enabled") !== valor) toggle.click();
    } else if (sel) {
      sel.value = valor;
      sel.dispatchEvent(new Event("change"));
    } else if (inp) {
      inp.value = valor;
      inp.dispatchEvent(new Event("input"));
    } else { app.setting.close(); throw new Error("no sé cambiar «" + nombre + "»"); }
    await __vt.esperar(500);
    app.setting.close();
    await __vt.esperar(300);
  },

  /** Los interruptores del ajuste con varios toggles: el n-ésimo de un ítem. */
  async ajusteToggle(nombre, n, valor) {
    app.setting.open();
    app.setting.openTabById("tareas-outline");
    await __vt.esperar(400);
    const cont = app.setting.activeTab.containerEl;
    const item = [...cont.querySelectorAll(".setting-item")].find(
      (s) => (s.querySelector(".setting-item-name")?.textContent.trim() ?? "").startsWith(nombre));
    const t = item?.querySelectorAll(".checkbox-container")[n];
    if (!t) { app.setting.close(); throw new Error("no hay toggle " + n + " en «" + nombre + "»"); }
    if (t.classList.contains("is-enabled") !== valor) t.click();
    await __vt.esperar(500);
    app.setting.close();
    await __vt.esperar(300);
  },

  /** El centro del checkbox de la tarea, en coordenadas de la ventana. */
  async centroCheckbox(texto) {
    await __vt.celda(texto);
    const l = [...document.querySelectorAll(".workspace-leaf.mod-active .cm-line")].find((e) => e.textContent.includes(texto));
    const c = l?.querySelector("input.task-list-item-checkbox");
    if (!c) throw new Error("no hay checkbox en «" + texto + "»");
    const r = c.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  },

  /** Dónde está la línea: su borde derecho, el fin del texto y el centro vertical. */
  async rectLinea(texto) {
    await __vt.celda(texto);
    const l = [...document.querySelectorAll(".workspace-leaf.mod-active .cm-line")].find((e) => e.textContent.includes(texto));
    if (!l) throw new Error("no hay línea «" + texto + "»");
    const r = l.getBoundingClientRect();
    const rango = document.createRange();
    rango.selectNodeContents(l);
    const t = rango.getBoundingClientRect();
    return { derecha: r.right, finTexto: t.right, izquierda: r.left, y: r.y + r.height / 2 };
  },

  /** Dispara el comando de reinicio y elige el grupo en el selector. */
  async reiniciar(grupo) {
    __vt.limpiarAvisos();
    await __vt.comando("reiniciar-grupo-ciclico");
    await __vt.esperar(300);
    const item = [...document.querySelectorAll(".suggestion-item")].find((i) => i.textContent.trim().startsWith(grupo));
    if (!item) return { elegido: false, avisos: __vt.avisos() };
    item.click();
    await __vt.esperar(700);
    return { elegido: true, modal: __vt.modal(), avisos: __vt.avisos() };
  },

  anchoMargen() {
    const g = document.querySelector(".workspace-leaf.mod-active .tareas-margen");
    return g ? Math.round(g.getBoundingClientRect().width * 10) / 10 : null;
  },
};
return true;`;

// ---------------------------------------------------------------- teclas y mouse
//
// Por el protocolo de Chrome (\`dev:cdp\`), no con eventos sintéticos: un
// \`KeyboardEvent\` armado a mano no escribe nada en el editor, y un clic sintético
// no pasa por el mismo camino que uno real (lo encontró COMENTARIOS: la tabla de
// Live Preview reacciona a uno y no al otro).

let depurando = false;
function cdp(method, params) {
  if (!depurando) {
    // «already attached» no es un error: lo deja una corrida cortada.
    try {
      obs("dev:debug", "on");
    } catch {}
    depurando = true;
    // Una corrida cortada a mitad de un clic deja el botón **apretado** del lado
    // de Chromium, y el próximo `mousePressed` espera para siempre: así se
    // encadenaron los cuelgues de la sesión 9. Soltarlo en una esquina no hace
    // nada si no estaba apretado.
    obs("dev:cdp", "method=Input.dispatchMouseEvent",
      `params=${JSON.stringify({ type: "mouseReleased", x: 2, y: 2, button: "left", clickCount: 1 })}`);
  }
  return obs("dev:cdp", `method=${method}`, `params=${JSON.stringify(params)}`);
}

/**
 * La ventana de prueba al frente, sin quitarle el foco a nadie, **antes de cada
 * evento real**.
 *
 * Con la ventana tapada por otra aplicación, Chromium la da por oculta y
 * `Input.dispatchMouseEvent` espera un cuadro que no llega: la CLI se quedaba
 * colgada minutos en un `mousePressed`. Pasó tres veces en la sesión 9, siempre
 * con el usuario usando la Mac al mismo tiempo. Traerla una vez al empezar no
 * alcanza; hay que traerla cada vez, y si igual no se ve, fallar diciéndolo en
 * vez de colgarse.
 */
function alFrente() {
  const vis = evaluar(`const w = require("@electron/remote").getCurrentWindow();
    if (document.visibilityState !== "visible") { w.showInactive(); w.moveTop(); }
    for (let i = 0; i < 10 && document.visibilityState !== "visible"; i++) await new Promise((r) => setTimeout(r, 200));
    return document.visibilityState;`);
  if (vis !== "visible") {
    throw new Error("la ventana del vault de prueba está tapada y no se pudo traer al frente: un clic real se colgaría");
  }
}

const TECLAS = {
  Enter: { code: "Enter", keyCode: 13, text: "\r" },
  Backspace: { code: "Backspace", keyCode: 8 },
  Escape: { code: "Escape", keyCode: 27 },
  ArrowRight: { code: "ArrowRight", keyCode: 39 },
  ArrowLeft: { code: "ArrowLeft", keyCode: 37 },
};

/** Una tecla real. Un dígito o una letra se escriben como texto. */
export async function tecla(key, modificadores = 0) {
  alFrente();
  const t = TECLAS[key] ?? { code: `Digit${key}`, keyCode: key.charCodeAt(0), text: key };
  const base = { key, code: t.code, windowsVirtualKeyCode: t.keyCode, modifiers: modificadores };
  cdp("Input.dispatchKeyEvent", { type: t.text ? "keyDown" : "rawKeyDown", ...base, ...(t.text ? { text: t.text } : {}) });
  cdp("Input.dispatchKeyEvent", { type: "keyUp", ...base });
  await esperar(250);
}

/** Un clic real en coordenadas de la ventana. \`modificadores\`: 4 = Cmd. */
export async function clicEn(x, y, modificadores = 0) {
  alFrente();
  const b = { x, y, button: "left", clickCount: 1, modifiers: modificadores };
  cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, modifiers: modificadores });
  cdp("Input.dispatchMouseEvent", { type: "mousePressed", ...b });
  cdp("Input.dispatchMouseEvent", { type: "mouseReleased", ...b });
  await esperar(400);
}

export async function moverA(x, y) {
  alFrente();
  cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await esperar(200);
}

export function soltarDepurador() {
  if (depurando) obs("dev:debug", "off");
  depurando = false;
}

export function instalar() {
  return evaluar(AYUDANTES);
}

/** Evalúa código con los ayudantes a mano: `vt` es `window.__vt`. */
export function vt(codigo) {
  return evaluar(`const vt = window.__vt; ${codigo}`);
}

/** Recarga el plugin y restaura las notas y los ajustes de la semilla. */
export async function reiniciarVault() {
  // Primero se cierran los editores. Restaurar el disco con una nota abierta y
  // su buffer sin guardar no restaura nada: a los dos segundos el editor
  // guarda lo suyo encima. Pasó en una sonda —la segunda vuelta arrancó con la
  // unión de la primera— y habría hecho que una sección midiera sobre lo que
  // dejó la anterior.
  evaluar(`for (const h of app.workspace.getLeavesOfType("markdown")) { await h.view.save?.(); h.detach(); } return true;`);
  await esperar(300);
  execFileSync("node", [join(RUTA, "..", "scripts", "vault-prueba.mjs"), "notas"]);
  await esperar(800);
  obs("plugin:reload", "id=tareas-outline");
  await esperar(1200);
  instalar();
}

// ------------------------------------------------------------------ informe

const resultados = [];

/**
 * Una comprobación con el id de la guía. `fn` devuelve `{ ok, dato }`; si
 * tira, cuenta como falla con el mensaje. `aMano` la anota sin correrla.
 */
export async function comprobar(id, que, fn) {
  try {
    const r = await fn();
    resultados.push({ id, que, estado: r.ok ? "ok" : "falla", dato: r.dato ?? "" });
  } catch (err) {
    resultados.push({ id, que, estado: "falla", dato: `error: ${err.message.split("\n")[0]}` });
  }
  const u = resultados.at(-1);
  console.log(`${u.estado === "ok" ? "✅" : "❌"} ${id} ${que} — ${u.dato}`);
}

export function aMano(id, que, porque) {
  resultados.push({ id, que, estado: "a mano", dato: porque });
  console.log(`✋ ${id} ${que} — ${porque}`);
}

/** Una comprobación de la guía que dejó de tener sentido: lo que miraba se borró. */
export function noAplica(id, que, porque) {
  resultados.push({ id, que, estado: "no aplica", dato: porque });
  console.log(`— ${id} ${que} — ${porque}`);
}

/** El commit y el `main.js` desplegado en el vault de prueba. */
export function binario() {
  const commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
  const sucio = execFileSync("git", ["status", "--porcelain", "--", "src", "styles.css"], { encoding: "utf8" }).trim() !== "";
  const js = join(RUTA, ".obsidian", "plugins", "tareas-outline", "main.js");
  const st = statSync(js);
  return `commit ${commit}${sucio ? " (con cambios sin commitear en src/ o styles.css)" : ""} · main.js ${st.size} bytes, ${st.mtime.toISOString()}`;
}

export function informe(titulo) {
  const n = (e) => resultados.filter((r) => r.estado === e).length;
  const filas = resultados.map(
    (r) => `| ${r.id} | ${r.que} | ${{ ok: "✅", falla: "❌", "a mano": "✋ a mano", "no aplica": "— no aplica" }[r.estado]} | ${String(r.dato).replace(/\|/g, "\\|").replace(/\n/g, " ")} |`,
  );
  return [
    `# ${titulo}`,
    "",
    `Corrido con \`scripts/verificar/\` sobre el vault de prueba. ${binario()}.`,
    "",
    `**${n("ok")} en verde · ${n("falla")} fallas · ${n("a mano")} a mano**${n("no aplica") ? ` · ${n("no aplica")} que ya no aplican` : ""}, de ${resultados.length}.`,
    "",
    "| # | Qué | Estado | Qué midió |",
    "|---|---|---|---|",
    ...filas,
    "",
  ].join("\n");
}
