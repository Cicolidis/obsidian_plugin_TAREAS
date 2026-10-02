/**
 * Los colores de prioridad, medidos en los dos temas.
 *
 *   node scripts/verificar/colores.mjs [#candidato …]
 *
 * Pone en `tareas_PRUEBA` tres tareas —sin prioridad, alta, muy alta—, cambia
 * de tema, y de cada tema saca:
 *
 * - el color que de verdad le llega a la línea (`--tareas-color` computado) y
 *   el fondo de la nota, y el **contraste WCAG** entre los dos, calculado acá;
 * - una captura recortada a esas tres líneas.
 *
 * Con candidatos en la línea de comandos, además saca una captura del tema
 * claro con cada uno puesto en lugar de `--tareas-alta`, para compararlos
 * lado a lado sin tocar `styles.css`.
 *
 * Termina con una lista `ok`/`MAL` contra la vara de cada marca —3:1 para la
 * barra y el checkbox, que son componentes (WCAG 1.4.11); 4,5:1 para el signo
 * `!`, que es texto (1.4.3), con su opacidad ya mezclada— y sale con 1 si algo
 * no llega. Que los números estén en regla no alcanza: el ocre de antes daba
 * 5,28:1 y en pantalla no se distinguía del rojo. Las capturas están para mirarlas.
 *
 * Las capturas van a `tareas-vault-prueba/.capturas/` (gitignored, y la carpeta
 * con punto Obsidian no la indexa). Al terminar vuelve el tema que estaba y
 * restaura las notas de la semilla.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { esperar, evaluar, obs, reiniciarVault } from "./lib.mjs";
import { RUTA } from "../vault-prueba.mjs";

const P = "0_inbox/tareas_PRUEBA.md";
const DIR = join(RUTA, ".capturas");
mkdirSync(DIR, { recursive: true });
const candidatos = process.argv.slice(2);

function luminancia([r, g, b]) {
  const f = (x) => {
    x /= 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function rgb(css) {
  css = css.trim();
  if (css.startsWith("#")) {
    const h = css.length === 4 ? [...css.slice(1)].map((c) => c + c).join("") : css.slice(1);
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  const m = css.match(/[\d.]+/g);
  return m.slice(0, 3).map(Number);
}
/** El color que se ve de algo pintado con opacidad sobre un fondo. */
function mezcla(color, fondo, opacidad) {
  const [c, f] = [rgb(color), rgb(fondo)];
  return `rgb(${c.map((x, i) => opacidad * x + (1 - opacidad) * f[i]).join(", ")})`;
}
function contraste(a, b) {
  const [x, y] = [luminancia(rgb(a)), luminancia(rgb(b))].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const LINEAS = [
  "- [ ] muestra sin prioridad",
  "- [ ] muestra de prioridad alta %%t:p=1%%",
  "- [ ] muestra de prioridad muy alta %%t:p=2%%",
];

async function preparar() {
  await reiniciarVault();
  evaluar(`
    const f = app.vault.getFileByPath(${JSON.stringify(P)});
    const hoja = app.workspace.getLeaf(false);
    await hoja.openFile(f, { state: { mode: "source", source: false } });
    app.workspace.setActiveLeaf(hoja, { focus: true });
    await new Promise((r) => setTimeout(r, 600));
    const cm = app.workspace.activeEditor.editor.cm;
    const d = cm.state.doc;
    let pos = 0;
    for (let i = 1; i <= d.lines; i++) if (d.line(i).text === "## WORKBENCH") { pos = d.line(i).to; break; }
    cm.dispatch({ changes: { from: pos, insert: "\\n\\n" + ${JSON.stringify(LINEAS.join("\n"))} } });
    // El cursor lejos, para que la línea no se muestre en crudo.
    cm.dispatch({ selection: { anchor: 0 } });
    cm.contentDOM.blur();
    await new Promise((r) => setTimeout(r, 600));
    return true;
  `);
}

async function tema(nombre) {
  evaluar(`app.changeTheme(${JSON.stringify(nombre)}); await new Promise((r) => setTimeout(r, 1500)); return true;`);
}

function sobrescribir(color) {
  return evaluar(`
    let s = document.getElementById("tareas-sonda-colores");
    if (!${JSON.stringify(color)}) { s?.remove(); await new Promise((r) => setTimeout(r, 300)); return true; }
    if (!s) { s = document.createElement("style"); s.id = "tareas-sonda-colores"; document.head.append(s); }
    s.textContent = "body.theme-light.theme-light { --tareas-alta: " + ${JSON.stringify(color)} + "; }";
    await new Promise((r) => setTimeout(r, 300));
    return true;
  `);
}

/** El color que le llega a cada línea, el fondo, y el rectángulo a recortar. */
function medir() {
  return evaluar(`
    const cm = app.workspace.activeEditor.editor.cm;
    const lineas = [...cm.contentDOM.querySelectorAll(".cm-line")].filter((l) => l.textContent.includes("muestra"));
    const fondoDe = (el) => {
      for (let e = el; e; e = e.parentElement) {
        const c = getComputedStyle(e).backgroundColor;
        if (c && !/rgba\\(0, 0, 0, 0\\)|transparent/.test(c)) return c;
      }
      return "rgb(255, 255, 255)";
    };
    const r = lineas.map((l) => l.getBoundingClientRect());
    // El signo «!» del final es un ajuste apagado por omisión: se prende un
    // momento para leer su color y su opacidad, y se deja como estaba.
    const tenia = document.body.classList.contains("tareas-ind-glifo");
    document.body.classList.add("tareas-ind-glifo");
    const glifos = lineas.map((l) => {
      const a = getComputedStyle(l, "::after");
      return a.content === "none" ? null : { color: a.color, opacidad: Number(a.opacity) };
    });
    if (!tenia) document.body.classList.remove("tareas-ind-glifo");
    // La barra va en el margen, a la izquierda del renglón: se deja lugar.
    const izq = Math.min(...r.map((x) => x.left)) - 60;
    return {
      lineas: lineas.map((l, i) => ({
        texto: l.textContent.trim(),
        clase: [...l.classList].filter((c) => c.startsWith("tareas-")).join(" "),
        color: getComputedStyle(l).getPropertyValue("--tareas-color").trim(),
        borde: getComputedStyle(l.querySelector("input[type=checkbox]") ?? l).borderColor,
        glifo: glifos[i],
      })),
      fondo: fondoDe(lineas[0]),
      dpr: devicePixelRatio,
      rect: { x: izq, y: Math.min(...r.map((x) => x.top)) - 8, w: Math.min(Math.max(...r.map((x) => x.right)) - izq + 16, 420), h: Math.max(...r.map((x) => x.bottom)) - Math.min(...r.map((x) => x.top)) + 16 },
    };
  `);
}

async function captura(nombre) {
  const ruta = join(DIR, nombre + ".png");
  // `dev:screenshot` devuelve el cuadro anterior: se sacan dos. Después de un
  // cambio de tema, ni dos alcanzaron —la primera corrida dio el tema claro
  // pintado de oscuro—, así que son tres, separadas.
  for (let i = 0; i < 3; i++) {
    obs("dev:screenshot", `path=${ruta}`);
    await esperar(500);
  }
  return ruta;
}

const temaAntes = evaluar(`return app.vault.getConfig("theme") ?? "system";`);
const salida = { temas: {}, candidatos: {} };
try {
  await preparar();
  for (const [clave, nombre] of [["claro", "moonstone"], ["oscuro", "obsidian"]]) {
    await tema(nombre);
    const m = medir();
    for (const l of m.lineas) {
      if (l.color) l.contraste = Number(contraste(l.color, m.fondo).toFixed(2));
      if (l.glifo) l.glifo.contraste = Number(contraste(mezcla(l.glifo.color, m.fondo, l.glifo.opacidad), m.fondo).toFixed(2));
    }
    m.captura = await captura(`tema-${clave}`);
    salida.temas[clave] = m;
  }
  if (candidatos.length) {
    await tema("moonstone");
    for (const c of candidatos) {
      sobrescribir(c);
      const m = medir();
      salida.candidatos[c] = {
        contraste: Number(contraste(c, m.fondo).toFixed(2)),
        contraVsMuyAlta: Number(contraste(c, m.lineas[2].color).toFixed(2)),
        llega: m.lineas[1].color,
        rect: m.rect,
        dpr: m.dpr,
        captura: await captura(`claro-${c.slice(1)}`),
      };
    }
    sobrescribir("");
  }
} finally {
  sobrescribir("");
  await tema(temaAntes === "system" ? "system" : temaAntes);
  evaluar(`app.vault.setConfig?.("theme", ${JSON.stringify(temaAntes)}); return true;`);
  await reiniciarVault();
}
writeFileSync(join(DIR, "colores.json"), JSON.stringify(salida, null, 2));

// La vara: 3:1 para la barra y el checkbox (componentes, WCAG 1.4.11), 4,5:1
// para el signo, que es texto (1.4.3). Y alta y muy alta no pueden ser el mismo
// color, que es lo que de verdad falló el 01/10/2026 con números en regla.
let mal = 0;
for (const [tema, m] of Object.entries(salida.temas)) {
  const [, alta, muy] = m.lineas;
  const filas = [
    [`${tema}: barra y checkbox de alta`, alta.contraste, 3],
    [`${tema}: barra y checkbox de muy alta`, muy.contraste, 3],
    [`${tema}: signo de alta`, alta.glifo?.contraste, 4.5],
    [`${tema}: signo de muy alta`, muy.glifo?.contraste, 4.5],
  ];
  for (const [que, valor, vara] of filas) {
    const ok = typeof valor === "number" && valor >= vara;
    if (!ok) mal++;
    console.log(`${ok ? "ok  " : "MAL "} ${que}: ${valor}:1 (vara ${vara}:1)`);
  }
  const distintos = alta.color.toLowerCase() !== muy.color.toLowerCase();
  if (!distintos) mal++;
  console.log(`${distintos ? "ok  " : "MAL "} ${tema}: alta ${alta.color} y muy alta ${muy.color} son colores distintos`);
}
console.log(`\nCapturas y medidas en ${DIR}`);
process.exitCode = mal ? 1 : 0;
