/**
 * La verificación del paso 6c (`sesiones/VERIFICAR-sesion-8.md`), corrida por
 * Claude Code sobre el vault de prueba. Mismos identificadores que la guía.
 *
 *   node scripts/verificar/paso-6c.mjs [secciones]    p. ej. «A B» o nada = todas
 *
 * Deja el informe en `sesiones/RESULTADOS-sesion-8-cli.md`. Restaura el vault
 * de prueba antes de cada sección, así que el orden de las secciones no cambia
 * lo que mide ninguna.
 */
import { readFileSync, writeFileSync } from "node:fs";
import {
  aMano, clicEn, comprobar, esperar, informe, instalar, leer, lineaEnDisco, moverA, obs,
  reiniciarVault, soltarDepurador, tecla, vt,
} from "./lib.mjs";

const P = "0_inbox/tareas_PRUEBA.md";
const P2 = "0_inbox/tareas_PRUEBA_2.md";
const LOG = "0_inbox/tareas_LOG.md";

const fecha = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
// Funciones y no constantes: una corrida entera dura diez minutos, y la primera
// que cruzó la medianoche comparó el `done` de hoy con la fecha de ayer.
const hoyD = () => new Date();
const mananaD = () => { const h = hoyD(); return new Date(h.getFullYear(), h.getMonth(), h.getDate() + 1); };

const pedidas = process.argv.slice(2).map((s) => s.toUpperCase());
const corre = (s) => pedidas.length === 0 || pedidas.includes(s);

async function abrir(rel) {
  const quedan = vt(`await vt.cerrarMenus(); return await vt.cerrarModales();`);
  if (quedan) throw new Error(`quedaron ${quedan} modales abiertos: la sección leería el equivocado`);
  vt(`await vt.abrir(${JSON.stringify(rel)}); return true;`);
  await esperar(300);
}

// -------------------------------------------------------------------- A
async function seccionA() {
  await reiniciarVault();
  await abrir(P);

  await comprobar("A1", "sin fecha ni grupo: los dos indicadores apagados, y ocultos sin hover", () => {
    const f = vt(`return await vt.fila("tarea sin fecha ni grupo");`);
    const fe = f.find((b) => b.accion === "fecha");
    const re = f.find((b) => b.accion === "recurrencia");
    return {
      ok: fe && re && !fe.activo && !re.activo && fe.opacidad === "0" && re.opacidad === "0",
      dato: `${f.length} botones · 📅 activo=${fe?.activo} opacidad=${fe?.opacidad} · 🔁 activo=${re?.activo} opacidad=${re?.opacidad}`,
    };
  });

  await comprobar("A2", "poner fecha desde el 📅 (Mañana): queda encendido y visible sin hover", async () => {
    vt(`await vt.clic("tarea sin fecha ni grupo", "fecha"); await vt.elegir("Mañana"); return true;`);
    await esperar(600);
    const f = vt(`return await vt.fila("tarea sin fecha ni grupo");`);
    const fe = f.find((b) => b.accion === "fecha");
    const disco = lineaEnDisco(P, "tarea sin fecha ni grupo");
    return {
      ok: fe.activo && fe.opacidad !== "0" && disco.includes(`due=${fecha(mananaD())}`),
      dato: `activo=${fe.activo} opacidad=${fe.opacidad} · disco: «${disco.trim()}»`,
    };
  });

  await comprobar("A3", "el tooltip del 📅 dice la fecha con el año", () => {
    const fe = vt(`return (await vt.fila("tarea sin fecha ni grupo")).find(b => b.accion === "fecha");`);
    return { ok: /Vence/.test(fe.label) && fe.label.includes(String(mananaD().getFullYear())), dato: `«${fe.label}»` };
  });

  await comprobar("A4", "poner un grupo: el 🔁 queda encendido y dice el grupo", async () => {
    vt(`await vt.clic("tarea para ponerle grupo", "recurrencia"); return true;`);
    const menu = vt(`return vt.menu();`);
    vt(`await vt.elegir("1 ·"); return true;`);
    await esperar(600);
    const re = vt(`return (await vt.fila("tarea para ponerle grupo")).find(b => b.accion === "recurrencia");`);
    const disco = lineaEnDisco(P, "tarea para ponerle grupo");
    return {
      ok: re.activo && /grupo/.test(re.label) && /rec=/.test(disco),
      dato: `menú: ${menu.map((m) => m.titulo).join(" / ")} · «${re.label}» · disco: «${disco.trim()}»`,
    };
  });

  await comprobar("A5", "cíclica con due=5 (hoy ya pasó el 5): dice el día y la fecha del mes que viene", () => {
    const fe = vt(`return (await vt.fila("podar el limonero")).find(b => b.accion === "fecha");`);
    const d = hoyD().getDate() > 5
      ? new Date(hoyD().getFullYear(), hoyD().getMonth() + 1, 5)
      : new Date(hoyD().getFullYear(), hoyD().getMonth(), 5);
    const mes = d.toLocaleDateString("es-AR", { month: "short" }).replace(".", "");
    return { ok: /día 5/.test(fe.label) && fe.label.includes(`5 ${mes}`), dato: `«${fe.label}» (esperaba «5 ${mes}»)` };
  });

  await comprobar("A6", "clic en el 📅 abre el submenú y no escribe", async () => {
    const antes = leer(P);
    vt(`await vt.clic("tarea con fecha absoluta", "fecha"); return true;`);
    const menu = vt(`return vt.menu();`);
    vt(`await vt.cerrarMenus(); return true;`);
    await esperar(400);
    return {
      ok: menu !== null && menu.some((m) => m.titulo.startsWith("Otra fecha")) && leer(P) === antes,
      dato: `${menu?.length ?? 0} ítems · archivo ${leer(P) === antes ? "intacto" : "CAMBIÓ"}`,
    };
  });

  await comprobar("A7", "clic en el 🔁 abre el submenú de recurrencia", async () => {
    vt(`await vt.clic("tarea con fecha absoluta", "recurrencia"); return true;`);
    const menu = vt(`return vt.menu();`);
    vt(`await vt.cerrarMenus(); return true;`);
    return { ok: menu !== null && menu.length > 0, dato: menu?.map((m) => m.titulo).join(" / ") ?? "sin menú" };
  });

  await comprobar("A8", "«Sin fecha» apaga el 📅 y el ★ no se corre", async () => {
    vt(`await vt.clic("tarea sin fecha ni grupo", "fecha"); await vt.elegir("Sin fecha"); return true;`);
    await esperar(600);
    const sin = vt(`return await vt.fila("tarea sin fecha ni grupo");`);
    const con = vt(`return await vt.fila("tarea con fecha absoluta");`);
    const x = (f, a) => f.find((b) => b.accion === a)?.x;
    return {
      ok: !sin.find((b) => b.accion === "fecha").activo && x(sin, "wb-primario") === x(con, "wb-primario"),
      dato: `★ en x=${x(sin, "wb-primario")} sin fecha y x=${x(con, "wb-primario")} con fecha`,
    };
  });

  await comprobar("A9", "token roto: los siete inertes y dicen que es ilegible", () => {
    const f = vt(`return await vt.fila("tarea con el token roto");`);
    return {
      ok: f.length === 7 && f.every((b) => b.inerte && /ilegible/i.test(b.label)),
      dato: `${f.length} botones · inertes ${f.filter((b) => b.inerte).length} · «${f[0]?.label}»`,
    };
  });

  aMano("A10", "con la ventana angosta, ¿el margen se come demasiado texto?", "es un juicio sobre cómo se ve");

  let anchos = [];
  await comprobar("A11", "apagar los dos indicadores: cinco botones sin recargar, margen más angosto", async () => {
    const antes = vt(`await vt.celda("tarea sin fecha ni grupo"); return vt.anchoMargen();`);
    vt(`await vt.ajusteToggle("Indicadores de fecha y de recurrencia", 0, false); await vt.ajusteToggle("Indicadores de fecha y de recurrencia", 1, false); return true;`);
    await esperar(500);
    const f = vt(`return await vt.fila("tarea sin fecha ni grupo");`);
    const despues = vt(`return vt.anchoMargen();`);
    anchos = [antes, despues];
    vt(`await vt.ajusteToggle("Indicadores de fecha y de recurrencia", 0, true); await vt.ajusteToggle("Indicadores de fecha y de recurrencia", 1, true); return true;`);
    return { ok: f.length === 5 && despues < antes, dato: `${f.length} botones · margen ${antes} → ${despues} px` };
  });

  await comprobar("A12", "cuánto cuestan los dos indicadores en el ancho del margen", () => ({
    ok: anchos.length === 2 && anchos[0] > anchos[1],
    dato: `${Math.round((anchos[0] - anchos[1]) * 10) / 10} px (${anchos[0]} con, ${anchos[1]} sin)`,
  }));
}

// -------------------------------------------------------------------- B
async function seccionB() {
  await reiniciarVault();
  await abrir(P);
  const ORDEN = {
    semana: "Hoy, mañana y la semana de lunes a domingo",
    cronologico: "En orden de fecha",
    discontinuo: "Hoy, mañana, pasado, en una semana",
  };
  const listas = {};
  for (const [clave] of Object.entries(ORDEN)) {
    vt(`await vt.ajuste("Fecha: en qué orden se ofrecen los atajos", ${JSON.stringify(clave)}); return true;`);
    vt(`await vt.clic("tarea sin fecha ni grupo", "fecha"); return true;`);
    listas[clave] = vt(`return vt.menu();`)
      .filter((m) => !/^(Otra fecha|Sin fecha)/.test(m.titulo));
    vt(`await vt.cerrarMenus(); return true;`);
  }
  const titulos = (k) => listas[k].map((m) => m.titulo).join(" · ");
  await comprobar("B1", "«semana»: siete ítems, los días de lunes a domingo", () => ({
    ok: listas.semana.length === 7,
    dato: `hoy es ${hoyD().toLocaleDateString("es-AR", { weekday: "long" })}: ${titulos("semana")}`,
  }));
  const dias = (k) => listas[k].map((m) => m.titulo.split("·")[1]?.trim() ?? m.titulo);
  await comprobar("B2", "«cronológico»: arranca en hoy, día por día, siete ítems", () => ({
    ok: listas.cronologico.length === 7 && listas.cronologico[0].titulo.startsWith("Hoy"),
    dato: titulos("cronologico"),
  }));
  await comprobar("B3", "«discontinuo»: seis ítems y el último es «En 30 días»", () => ({
    ok: listas.discontinuo.length === 6 && listas.discontinuo.at(-1).titulo.startsWith("En 30 días"),
    dato: titulos("discontinuo"),
  }));
  await comprobar("B4", "en ninguno de los tres se repite una fecha", () => {
    const rep = Object.keys(listas).filter((k) => new Set(dias(k)).size !== dias(k).length);
    return { ok: rep.length === 0, dato: rep.length ? `repiten: ${rep.join(", ")}` : "ninguna repetida, en los tres" };
  });
  await comprobar("B5", "sobre una tarea con fecha de mañana, el tilde marca uno solo", async () => {
    vt(`await vt.clic("tarea sin fecha ni grupo", "fecha"); await vt.elegir("Mañana"); return true;`);
    await esperar(500);
    const r = {};
    for (const clave of Object.keys(ORDEN)) {
      vt(`await vt.ajuste("Fecha: en qué orden se ofrecen los atajos", ${JSON.stringify(clave)}); return true;`);
      vt(`await vt.clic("tarea sin fecha ni grupo", "fecha"); return true;`);
      r[clave] = vt(`return vt.menu();`).filter((m) => m.marcado).map((m) => m.titulo);
      vt(`await vt.cerrarMenus(); return true;`);
    }
    vt(`await vt.ajuste("Fecha: en qué orden se ofrecen los atajos", "semana"); return true;`);
    return {
      ok: Object.values(r).every((m) => m.length === 1),
      dato: Object.entries(r).map(([k, m]) => `${k}: ${m.join(", ") || "ninguno"}`).join(" · "),
    };
  });
  aMano("B6", "cuál de los tres órdenes convence", "es una elección");
}


// -------------------------------------------------------------------- C
async function seccionC() {
  await reiniciarVault();
  await abrir(P);
  aMano("C1", "el selector nativo aparece solo al abrir «Otra fecha…»", "el selector del navegador no está en el DOM: no se puede leer desde la CLI");
  vt(`await vt.ajuste("«Otra fecha…»: cómo se elige", "grilla"); return true;`);

  const abrirGrilla = (texto) => {
    vt(`await vt.clic(${JSON.stringify(texto)}, "fecha"); await vt.elegir("Otra fecha"); await vt.esperar(400); return true;`);
    return vt(`const c = vt.m().querySelector(".tareas-calendario");
      if (!c) return null;
      return { titulo: c.querySelector(".tareas-calendario-titulo")?.textContent ?? null,
               celdas: c.querySelectorAll(".tareas-calendario-celda").length,
               hoy: c.querySelector(".tareas-calendario-celda.is-hoy")?.getAttribute("aria-label") ?? null,
               dias: !!c.querySelector(".tareas-calendario-dias"),
               alto: Math.round(vt.m().getBoundingClientRect().height) };`);
  };

  let g;
  await comprobar("C2", "con la grilla: el mes actual, lunes primero, y hoy marcado", () => {
    g = abrirGrilla("tarea para la grilla");
    const mes = hoyD().toLocaleDateString("es-AR", { month: "long" });
    const cab = vt(`return [...vt.m().querySelectorAll(".tareas-calendario-dias > *")].map(e => e.textContent).join(" ");`);
    return {
      ok: g !== null && g.titulo?.includes(mes) && g.titulo?.includes(String(hoyD().getFullYear())) && g.hoy !== null && /^l/i.test(cab.trim()),
      dato: `«${g?.titulo}» · ${g?.celdas} celdas · hoy: «${g?.hoy}» · columnas: ${cab}`,
    };
  });

  await comprobar("C3", "un clic en un día elige y no acepta: el campo cambia y aparece «Va a escribir»", () => {
    const r = vt(`const c = [...vt.m().querySelectorAll(".tareas-calendario-celda")].find(b => b.textContent.trim() === "20");
      c.click(); await vt.esperar(300);
      const m = vt.modal();
      return { abierto: m !== null, campo: vt.m().querySelector("input")?.value, texto: m?.texto };`);
    const esperado = `${fecha(hoyD()).slice(0, 8)}20`;
    return {
      ok: r.abierto && r.campo === esperado && r.texto.includes(`Va a escribir: ${esperado}`),
      dato: `campo=${r.campo} · modal ${r.abierto ? "abierto" : "CERRADO"}`,
    };
  });

  await comprobar("C4", "aceptar escribe lo mismo que decía «Va a escribir»", async () => {
    const esperado = `${fecha(hoyD()).slice(0, 8)}20`;
    vt(`await vt.boton("Poner la fecha"); return true;`);
    await esperar(500);
    const d = lineaEnDisco(P, "tarea para la grilla");
    return { ok: d.includes(`due=${esperado}`), dato: `disco: «${d.trim()}»` };
  });

  await comprobar("C5", "navegar dos meses adelante y dos atrás: la grilla no cambia de alto", () => {
    abrirGrilla("tarea para la grilla");
    const r = vt(`const [atras, adelante] = vt.m().querySelectorAll(".tareas-calendario-mover");
      const altos = [], titulos = [];
      const medir = () => { altos.push(Math.round(vt.m().getBoundingClientRect().height)); titulos.push(vt.m().querySelector(".tareas-calendario-titulo").textContent); };
      medir();
      for (const b of [adelante, adelante, atras, atras]) { b.click(); await vt.esperar(150); medir(); }
      return { altos, titulos };`);
    return {
      ok: new Set(r.altos).size === 1 && new Set(r.titulos).size === 3,
      dato: `altos ${r.altos.join("/")} · ${r.titulos.join(" → ")}`,
    };
  });

  await comprobar("C6", "escribir a mano una fecha de otro mes: la grilla se va a ese mes y la marca", () => {
    const r = vt(`const i = vt.m().querySelector("input");
      i.value = "2027-02-14"; i.dispatchEvent(new Event("input", { bubbles: true })); await vt.esperar(300);
      return { titulo: vt.m().querySelector(".tareas-calendario-titulo").textContent,
               elegido: vt.m().querySelector(".tareas-calendario-celda.is-elegido")?.textContent };`);
    vt(`await vt.cerrarModales(); return true;`);
    return { ok: /febrero 2027/.test(r.titulo) && r.elegido?.trim() === "14", dato: `«${r.titulo}», elegido ${r.elegido}` };
  });

  await comprobar("C7", "en una cíclica la grilla son los 31 días, sin semanas", () => {
    const c = abrirGrilla("regar los canteros");
    return { ok: c?.celdas === 31 && !c.dias, dato: `${c?.celdas} celdas · cabecera de días: ${c?.dias}` };
  });

  await comprobar("C8", "elegir el 31 y aceptar: due=31, y el aviso dice que guarda el día", async () => {
    vt(`vt.limpiarAvisos();
      [...vt.m().querySelectorAll(".tareas-calendario-celda")].find(b => b.textContent.trim() === "31").click();
      await vt.esperar(200); await vt.boton("Poner la fecha"); return true;`);
    await esperar(500);
    const d = lineaEnDisco(P, "regar los canteros");
    const avisos = vt(`return vt.avisos();`);
    return {
      ok: d.includes("due=31") && avisos.some((a) => /día 31/.test(a)),
      dato: `disco: «${d.trim()}» · aviso: «${avisos.join(" | ")}»`,
    };
  });
  vt(`await vt.ajuste("«Otra fecha…»: cómo se elige", "nativo"); return true;`);
}

// -------------------------------------------------------------------- D
async function seccionD() {
  await reiniciarVault();
  await abrir(P);
  const submenu = (texto) => {
    vt(`await vt.clic(${JSON.stringify(texto)}, "recurrencia"); return true;`);
    const m = vt(`return vt.menu();`);
    return m.map((i) => i.titulo);
  };

  let d1;
  await comprobar("D1", "el submenú ofrece los grupos en uso y después la semilla, numerados", () => {
    d1 = submenu("tarea sin fecha ni grupo");
    // La semilla del vault de prueba ya usa «mensual», así que la guía —pensada
    // para un vault sin grupos— se lee al revés: en uso primero, semilla detrás.
    return { ok: d1[0] === "1 · mensual" && d1[1] === "2 · semanal", dato: d1.join(" / ") };
  });

  await comprobar("D2", "la tecla 2 con el menú abierto etiqueta y cierra", async () => {
    await tecla("2");
    await esperar(500);
    const d = lineaEnDisco(P, "tarea sin fecha ni grupo");
    const abiertos = vt(`return document.querySelectorAll(".menu").length;`);
    return { ok: d.includes("rec=semanal") && abiertos === 0, dato: `disco: «${d.trim()}» · menús abiertos: ${abiertos}` };
  });

  await comprobar("D3", "un grupo nuevo desde «Grupo nuevo…»", () => {
    submenu("tarea para la grilla");
    vt(`await vt.elegir("Grupo nuevo"); await vt.esperar(300);
      const i = vt.m().querySelector("input"); i.value = "lunes"; i.dispatchEvent(new Event("input", { bubbles: true }));
      i.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); await vt.esperar(600); return true;`);
    const d = lineaEnDisco(P, "tarea para la grilla");
    return { ok: d.includes("rec=lunes"), dato: `disco: «${d.trim()}»` };
  });

  await comprobar("D4", "reabierto: ordenado por uso, sin repetir los sugeridos", () => {
    const m = submenu("tarea con fecha absoluta");
    vt(`await vt.cerrarMenus(); return true;`);
    const nombres = m.filter((t) => /^\d · /.test(t)).map((t) => t.slice(4));
    return {
      ok: nombres[0] === "mensual" && new Set(nombres).size === nombres.length && nombres.includes("lunes") && nombres.includes("semanal"),
      dato: m.join(" / "),
    };
  });

  await comprobar("D5", "sugeridos «quincenal, anual»: aparecen detrás de los que están en uso", () => {
    vt(`await vt.ajuste("Grupos de reinicio sugeridos", "quincenal, anual"); return true;`);
    const m = submenu("tarea con fecha absoluta");
    vt(`await vt.cerrarMenus(); return true;`);
    const n = m.filter((t) => /^\d · /.test(t)).map((t) => t.slice(4));
    const iq = n.indexOf("quincenal");
    return { ok: iq > n.indexOf("mensual") && iq > n.indexOf("lunes") && n.includes("anual"), dato: m.join(" / ") };
  });

  await comprobar("D6", "sugeridos vacío: no sugiere nada, y los que existen siguen", () => {
    vt(`await vt.ajuste("Grupos de reinicio sugeridos", ""); return true;`);
    const m = submenu("tarea con fecha absoluta");
    vt(`await vt.cerrarMenus(); return true;`);
    const n = m.filter((t) => /^\d · /.test(t)).map((t) => t.slice(4));
    return { ok: !n.includes("quincenal") && !n.includes("anual") && n.includes("mensual"), dato: m.join(" / ") };
  });

  await comprobar("D7", "«con;punto» se descarta: rompería el token", () => {
    vt(`await vt.ajuste("Grupos de reinicio sugeridos", "con;punto, anual"); return true;`);
    const g = vt(`return vt.p().settings.gruposSugeridos;`);
    return { ok: !g.some((x) => x.includes(";")) && g.includes("anual"), dato: `guardado: ${JSON.stringify(g)}` };
  });

  await comprobar("D8", "abrir el submenú, cerrarlo con Escape y teclear 2: se escribe el dígito", async () => {
    vt(`vt.cursor("tarea con fecha absoluta", 6); return true;`);
    submenu("tarea con fecha absoluta");
    await tecla("Escape");
    const abiertos = vt(`return document.querySelectorAll(".menu").length;`);
    vt(`vt.cursor("tarea con fecha absoluta", 6); return true;`);
    await tecla("2");
    const r = vt(`return { escrito: vt.linea("2tarea con fecha absoluta")?.text ?? null, sel: vt.sel() };`);
    await esperar(2500); // el guardado del editor, para mirar el disco
    const d = lineaEnDisco(P, "tarea con fecha absoluta");
    return {
      ok: abiertos === 0 && r.escrito !== null && !/rec=/.test(d),
      dato: `menús abiertos tras Escape: ${abiertos} · línea: «${(r.escrito ?? r.sel.texto).slice(0, 45)}» · disco sin rec: ${!/rec=/.test(d)}`,
    };
  });
  vt(`await vt.ajuste("Grupos de reinicio sugeridos", "semanal, mensual"); return true;`);
}


// -------------------------------------------------------------------- E
/** Tilda una tarea con un clic real en su checkbox, que es el gesto de 0f. */
async function tildar(texto, modificadores = 0) {
  const c = vt(`return await vt.centroCheckbox(${JSON.stringify(texto)});`);
  await clicEn(c.x, c.y, modificadores);
  await esperar(300);
}
/** Espera a que el editor guarde y el índice lo vea: el `requestSave` es de 2 s. */
const guardado = () => esperar(3000);
const MENSUALES_P = ["regar los canteros", "podar el limonero"];
const MENSUAL_P2 = "pagar la cuota del club";
const headings1 = () => leer(LOG).split("\n").filter((l) => /^# /.test(l));

async function completarMensuales({ fechaVieja } = {}) {
  await abrir(P);
  for (const t of MENSUALES_P) await tildar(t);
  if (fechaVieja) {
    // E9: la fecha de completado a mano, para que la marca del historial
    // discrimine. Es un cambio del editor, como el de tipearla.
    vt(`const l = vt.linea("podar el limonero"); const i = l.text.indexOf("done=");
      vt.v().dispatch({ changes: { from: l.from + i + 5, to: l.from + i + 15, insert: ${JSON.stringify(fechaVieja)} } }); return true;`);
  }
  await abrir(P2);
  await tildar(MENSUAL_P2);
  await guardado();
  await abrir(P);
}

async function seccionE() {
  await reiniciarVault();
  const VIEJA = "2026-09-15";
  await completarMensuales({ fechaVieja: VIEJA });

  const antes = { p: leer(P), p2: leer(P2), log: leer(LOG) };
  const prep = [MENSUALES_P[0], MENSUALES_P[1]].map((t) => lineaEnDisco(P, t)).concat(lineaEnDisco(P2, MENSUAL_P2));
  console.log(`   preparación (0e, 0f): ${prep.map((l) => l.trim()).join(" | ")}`);

  let r;
  await comprobar("E1", "el modal tiene tres botones y el foco en «Cancelar»", () => {
    r = vt(`return await vt.reiniciar("mensual");`);
    return {
      ok: r.modal?.botones.length === 3 && r.modal.foco === "Cancelar",
      dato: `botones: ${r.modal?.botones.join(" / ")} · foco: ${r.modal?.foco}`,
    };
  });
  await comprobar("E2", "dice cuántas tareas y notas, y cuánto va al historial", () => ({
    ok: /destildan 3 tareas/.test(r.modal.texto) && /2 notas/.test(r.modal.texto) && /al historial/.test(r.modal.texto),
    dato: r.modal.texto.replace(/\s+/g, " ").slice(0, 300),
  }));
  await comprobar("E3", "Enter sin tocar nada no escribe", async () => {
    await tecla("Enter");
    await esperar(800);
    const intacto = leer(P) === antes.p && leer(P2) === antes.p2 && leer(LOG) === antes.log;
    return { ok: intacto, dato: `modal ${vt(`return vt.modal() ? "abierto" : "cerrado";`)} · archivos ${intacto ? "intactos" : "CAMBIARON"}` };
  });
  await comprobar("E4", "Cancelar: nada escrito en ningún lado", async () => {
    if (vt(`return !!vt.modal();`)) vt(`await vt.boton("Cancelar"); return true;`);
    await esperar(500);
    const intacto = leer(P) === antes.p && leer(P2) === antes.p2 && leer(LOG) === antes.log;
    return { ok: intacto, dato: intacto ? "las tres notas y el historial, byte a byte iguales" : "ALGO CAMBIÓ" };
  });
  await comprobar("E5", "«Archivar y reiniciar»: el aviso dice tareas, notas y líneas", async () => {
    vt(`await vt.reiniciar("mensual"); await vt.boton("Archivar y reiniciar"); return true;`);
    const a = vt(`return vt.avisos();`);
    return { ok: a.some((x) => /3 tareas reiniciadas en 2 notas, y \d+ líneas al historial/.test(x)), dato: a.join(" | ") };
  });
  const log = leer(LOG);
  await comprobar("E6", "el historial tiene una sección por nota de origen", () => ({
    ok: /^# tareas_PRUEBA$/m.test(log) && /^# tareas_PRUEBA_2$/m.test(log),
    dato: `headings: ${log.split("\n").filter((l) => /^#+ /.test(l)).join(" · ")}`,
  }));
  await comprobar("E7", "un heading de nivel 1 por nota, aunque una aportó dos tareas", () => {
    const h = headings1();
    return { ok: h.filter((x) => x === "# tareas_PRUEBA").length === 1 && h.filter((x) => x === "# tareas_PRUEBA_2").length === 1, dato: h.join(" · ") };
  });
  await comprobar("E8", "el bloque con hijos va entero, sin checkboxes ni token", () => {
    const l = log.split("\n");
    const i = l.findIndex((x) => x.includes("regar los canteros"));
    const bloque = l.slice(i, i + 3);
    return {
      ok: i >= 0 && bloque.some((x) => x.includes("revisar el riego")) && bloque.some((x) => x.includes("anotar cuánto tardó")) && !bloque.join("\n").includes("[ ]") && !bloque.join("\n").includes("%%"),
      dato: bloque.map((x) => x.replace(/\t/g, "⇥")).join(" ⏎ "),
    };
  });
  await comprobar("E9", "la raíz lleva la fecha de completado, no la de hoy", () => {
    const l = log.split("\n").find((x) => x.includes("podar el limonero")) ?? "";
    return { ok: l.includes(`[✓ ${VIEJA}]`), dato: `«${l.trim()}»` };
  });
  await comprobar("E10", "las etiquetadas quedan [ ] y sin done; due y rec siguen", () => {
    const ls = MENSUALES_P.map((t) => lineaEnDisco(P, t)).concat(lineaEnDisco(P2, MENSUAL_P2));
    return {
      ok: ls.every((l) => l.startsWith("- [ ]") && !l.includes("done=") && l.includes("rec=mensual")) && ls[1].includes("due=5"),
      dato: ls.map((l) => l.trim()).join(" | "),
    };
  });
  await comprobar("E11", "las tareas sin etiqueta no se tocaron", () => {
    const a = lineaEnDisco(P, "tarea ya hecha sin grupo");
    const b = lineaEnDisco(P2, "completada sin etiqueta");
    return { ok: a.startsWith("- [x]") && a.includes("done=2026-09-01") && b.startsWith("- [x]"), dato: `${a.trim()} | ${b.trim()}` };
  });
  await comprobar("E12", "otra vuelta de archivar y reiniciar: no crea headings nuevos", async () => {
    const h = log.split("\n").filter((l) => /^#+ /.test(l)).length;
    await completarMensuales();
    vt(`await vt.reiniciar("mensual"); await vt.boton("Archivar y reiniciar"); return true;`);
    const log2 = leer(LOG);
    const h2 = log2.split("\n").filter((l) => /^#+ /.test(l)).length;
    const veces = log2.split("\n").filter((l) => l.includes("regar los canteros")).length;
    return { ok: h2 === h && veces === 2, dato: `headings ${h} → ${h2} · «regar los canteros» ${veces} veces en el historial` };
  });
  await comprobar("E13", "«Reiniciar» a secas destilda y no escribe en el historial", async () => {
    await completarMensuales();
    const l0 = leer(LOG);
    vt(`await vt.reiniciar("mensual"); await vt.boton("Reiniciar"); return true;`);
    const ls = MENSUALES_P.map((t) => lineaEnDisco(P, t));
    return { ok: leer(LOG) === l0 && ls.every((l) => l.startsWith("- [ ]")), dato: `historial ${leer(LOG) === l0 ? "igual" : "CAMBIÓ"} · ${ls.map((l) => l.slice(0, 5)).join(" ")}` };
  });
  await comprobar("E14", "con todo pendiente: «no hay nada que reiniciar» y no escribe", () => {
    const a0 = { p: leer(P), log: leer(LOG) };
    const x = vt(`return await vt.reiniciar("mensual");`);
    return {
      ok: x.avisos.some((t) => /No hay nada que reiniciar en «mensual»/.test(t)) && !x.modal && leer(P) === a0.p && leer(LOG) === a0.log,
      dato: x.avisos.join(" | ") || `modal: ${x.modal?.texto?.slice(0, 80)}`,
    };
  });
  await comprobar("E15", "con la nota de historial inexistente, el segundo botón no aparece y dice por qué", async () => {
    await completarMensuales();
    vt(`await vt.ajuste("Nota de historial", "0_inbox/no-existe.md"); return true;`);
    const x = vt(`const r = await vt.reiniciar("mensual"); await vt.cerrarModales(); return r;`);
    vt(`await vt.ajuste("Nota de historial", "0_inbox/tareas_LOG.md"); return true;`);
    return {
      ok: x.modal && !x.modal.botones.includes("Archivar y reiniciar") && /No encuentro la nota de historial/.test(x.modal.texto),
      dato: `botones: ${x.modal?.botones.join(" / ")}`,
    };
  });
}

// -------------------------------------------------------------------- F
async function seccionF() {
  await reiniciarVault();
  await abrir(P);
  await tildar("regar los canteros");
  await abrir(P2);
  await tildar(MENSUAL_P2);
  await guardado();
  await abrir(P);

  await comprobar("F1", "el modal cuenta 2 tareas en 2 notas", () => {
    const x = vt(`const r = await vt.reiniciar("mensual"); await vt.boton("Cancelar"); return r;`);
    return { ok: /destildan 2 tareas/.test(x.modal?.texto ?? "") && /2 notas/.test(x.modal?.texto ?? ""), dato: (x.modal?.texto ?? x.avisos.join(" | ")).replace(/\s+/g, " ").slice(0, 160) };
  });
  vt(`await vt.ajuste("Congelar el índice en memoria", true); return true;`); // F2
  // F3: cambiarle el texto a la tarea completada, en el editor.
  vt(`const l = vt.linea("regar los canteros"); const i = l.text.indexOf("canteros");
    vt.v().dispatch({ changes: { from: l.from + i + 8, insert: " del fondo" } }); return true;`);
  await guardado();
  const f4 = leer(LOG).split("\n").length;
  const p2antes = leer(P2);
  await comprobar("F5", "congelado y con el texto cambiado: se niega y dice que no escribió nada", () => {
    vt(`await vt.reiniciar("mensual"); await vt.boton("Archivar y reiniciar"); return true;`);
    const a = vt(`return vt.avisos();`);
    return { ok: a.some((t) => /No se escribió nada, en ninguna nota NI en el historial/.test(t)), dato: a.join(" | ") };
  });
  await comprobar("F6", "el historial tiene las mismas líneas que antes", () => {
    const n = leer(LOG).split("\n").length;
    return { ok: n === f4, dato: `${f4} → ${n} líneas` };
  });
  await comprobar("F7", "la otra nota quedó intacta, con su tarea en [x]", () => {
    const l = lineaEnDisco(P2, MENSUAL_P2);
    return { ok: leer(P2) === p2antes && l.startsWith("- [x]") && l.includes("done="), dato: `«${l.trim()}»` };
  });
  vt(`await vt.ajuste("Congelar el índice en memoria", false); return true;`); // F8
  await esperar(800);
  await comprobar("F9", "descongelado y sin tocar nada: ahora escribe en las dos y en el historial", () => {
    vt(`await vt.reiniciar("mensual"); await vt.boton("Archivar y reiniciar"); return true;`);
    const a = vt(`return vt.avisos();`);
    const ok = lineaEnDisco(P, "regar los canteros del fondo").startsWith("- [ ]") && lineaEnDisco(P2, MENSUAL_P2).startsWith("- [ ]") && leer(LOG).includes("regar los canteros del fondo");
    return { ok, dato: a.join(" | ") };
  });
}

// -------------------------------------------------------------------- G
async function seccionG() {
  await reiniciarVault();
  await abrir(P);

  await comprobar("G1", "clic en el vacío a la derecha de una tarea: el cursor cae en esa línea", async () => {
    const r = vt(`return await vt.rectLinea("tarea con fecha absoluta");`);
    await clicEn(Math.min(r.derecha - 8, r.finTexto + 120), r.y);
    const s = vt(`return vt.sel();`);
    return { ok: s.texto.includes("tarea con fecha absoluta"), dato: `línea ${s.linea}, col ${s.col}: «${s.texto.slice(0, 40)}»` };
  });

  await comprobar("G2", "flecha derecha desde el fin del texto cruza el token de un teclazo", async () => {
    const l = vt(`const l = vt.linea("tarea para partir con token"); vt.cursor("tarea para partir con token", l.text.indexOf(" %%")); return vt.sel();`);
    await tecla("ArrowRight");
    const s = vt(`return vt.sel();`);
    return { ok: s.linea === l.linea + 1 && s.col === 0, dato: `de ${l.linea}:${l.col} a ${s.linea}:${s.col}` };
  });

  await comprobar("G3", "Backspace desde el comienzo de la línea de abajo: saca el checkbox, y el segundo une limpio", async () => {
    // El «comienzo» que ve el usuario es después del checkbox, columna 6: en
    // Live Preview el `- [ ] ` es un widget. Ahí el primer Backspace convierte
    // la tarea en bullet (§5.5, «borrar el checkbox convierte la tarea en bullet
    // aunque tenga texto») y el segundo une. La guía decía «une las dos» a secas,
    // y la primera versión de esta comprobación ponía el cursor en la columna 0,
    // una forma que el gesto real no produce.
    vt(`vt.cursor("tarea de abajo para unir", 6); return true;`);
    await tecla("Backspace");
    const uno = vt(`return vt.linea("tarea de abajo para unir")?.text ?? null;`);
    await tecla("Backspace");
    await esperar(300);
    const u = vt(`return vt.linea("tarea de arriba para unir")?.text ?? null;`);
    return {
      ok: uno === "- tarea de abajo para unir" && u === "- [ ] tarea de arriba para unir tarea de abajo para unir",
      dato: `1.º «${uno}» · 2.º «${u}»`,
    };
  });

  await comprobar("G4", "Enter al final de una tarea: nace «- [ ] » y el token se queda arriba", async () => {
    const l = vt(`const l = vt.linea("tarea para partir con token"); vt.cursor("tarea para partir con token", l.text.indexOf(" %%")); return vt.sel();`);
    await tecla("Enter");
    await esperar(300);
    const r = vt(`const d = vt.v().state.doc; return { arriba: d.line(${l.linea}).text, abajo: d.line(${l.linea + 1}).text };`);
    return { ok: r.arriba.includes("%%t:id=c3d4") && r.abajo === "- [ ] ", dato: `«${r.arriba}» ⏎ «${r.abajo}»` };
  });

  await comprobar("G5", "tildar una tarea con fecha: completa, no toca el due y el cursor no se mueve", async () => {
    vt(`vt.cursor("tarea sin fecha ni grupo", 10); return true;`);
    const antes = vt(`return vt.sel();`);
    await tildar("tarea para tildar con fecha");
    const despues = vt(`return vt.sel();`);
    await guardado();
    const d = lineaEnDisco(P, "tarea para tildar con fecha");
    return {
      ok: d.startsWith("- [x]") && d.includes(`done=${fecha(hoyD())}`) && d.includes("due=2026-11-20") && despues.texto === antes.texto && despues.col === antes.col,
      dato: `disco: «${d.trim()}» · cursor ${antes.linea}:${antes.col} → ${despues.linea}:${despues.col}`,
    };
  });

  await comprobar("G6", "Cmd+clic en el checkbox archiva al historial", async () => {
    await tildar("tarea sin fecha ni grupo", 4);
    await esperar(800);
    const log = leer(LOG);
    return { ok: log.includes("tarea sin fecha ni grupo"), dato: `historial: ${log.split("\n").filter((l) => /^#|sin fecha/.test(l)).join(" · ")}` };
  });

  await comprobar("G7", "una nota que no es de tareas, al lado de una que sí: no se le cobra margen", () => {
    const r = vt(`const hoja = app.workspace.getLeaf("split", "vertical");
      await hoja.openFile(app.vault.getFileByPath("0_inbox/otra-nota.md")); await vt.esperar(800);
      const ed = hoja.view.containerEl.querySelector(".cm-editor");
      const g = ed.querySelector(".tareas-margen");
      const res = { conMargen: ed.classList.contains("tareas-con-margen"), ancho: g ? Math.round(g.getBoundingClientRect().width * 10) / 10 : 0,
        vecina: document.querySelector(".cm-editor.tareas-con-margen") !== null };
      hoja.detach(); return res;`);
    return { ok: !r.conMargen && r.ancho === 0 && r.vecina, dato: `otra-nota: clase ${r.conMargen} · margen ${r.ancho} px · la de tareas conserva el suyo: ${r.vecina}` };
  });

  await comprobar("G8", "pasar el mouse: aparecen los siete y no se apagan yendo hacia ellos", async () => {
    await abrir(P);
    const r = vt(`return await vt.rectLinea("tarea con fecha absoluta");`);
    const c = vt(`const c = await vt.celda("tarea con fecha absoluta"); const b = c.getBoundingClientRect(); return { x: b.right - 4, y: b.y + b.height / 2 };`);
    await moverA(r.izquierda + 40, r.y);
    // La clase de la línea con el mouse llega en la próxima transacción, y con
    // la ventana en segundo plano el cuadro tarda: se espera hasta un segundo
    // y medio antes de leer. Una lectura sin espera falló una vez de dos.
    let sobreTexto = [];
    for (let i = 0; i < 6; i++) {
      sobreTexto = vt(`return (await vt.fila("tarea con fecha absoluta")).map(b => b.opacidad);`);
      if (sobreTexto.filter((o) => o !== "0").length >= 5) break;
      await esperar(250);
    }
    const pasos = [];
    for (let x = r.izquierda + 30; x > c.x; x -= 12) {
      await moverA(x, r.y);
      pasos.push(vt(`return (await vt.fila("tarea con fecha absoluta")).filter(b => b.opacidad !== "0").length;`));
    }
    return {
      ok: sobreTexto.filter((o) => o !== "0").length >= 5 && pasos.every((n) => n > 0),
      dato: `sobre el texto: ${sobreTexto.join(",")} · botones visibles yendo al margen: ${pasos.join(",")}`,
    };
  });
}

// -------------------------------------------------------------------- H
async function seccionH() {
  await reiniciarVault();
  await abrir("0_inbox/tareas_LARGA.md");
  // El espía se carga del archivo, igual que pegarlo en la consola. Pero el
  // recorrido no es `medicion.subir()`: sus 40 pasos con `setTimeout` en una
  // ventana en segundo plano tardan un minuto cada uno. Los da Node, uno por
  // `eval`, con la misma cuenta y el mismo sentido —de abajo hacia arriba—.
  obs("eval", `code=${readFileSync(new URL("../espia-medicion.js", import.meta.url), "utf8")}`);
  // Una ventana maximizada o a pantalla completa ignora `setSize`: la primera
  // corrida midió con el editor en 1561 px y devolvió 0 y 0, que es el cero en
  // el que no hay que creer. Se sale de esos dos estados y se vuelve al final.
  const inicio = vt(`const w = require("@electron/remote").getCurrentWindow();
    const estado = { max: w.isMaximized(), full: w.isFullScreen() };
    if (estado.full) { w.setFullScreen(false); await vt.esperar(1500); }
    if (w.isMaximized()) { w.unmaximize(); await vt.esperar(500); }
    const [a, h] = w.getSize();
    w.setSize(700, h); await vt.esperar(800);
    const d = vt.v().scrollDOM; d.scrollTop = d.scrollHeight; await vt.esperar(300);
    window.medicion.reiniciar(); return { a, h, alto: d.scrollHeight, ...estado };`);
  const PASOS = 40;
  for (let i = PASOS; i >= 0; i--) {
    vt(`vt.v().scrollDOM.scrollTop = ${(inicio.alto / PASOS) * i}; await vt.esperar(60); return true;`);
  }
  await esperar(500);
  const r = vt(`const m = window.medicion.leer(); window.medicion.soltar();
    const w = require("@electron/remote").getCurrentWindow(); w.setSize(${inicio.a}, ${inicio.h});
    if (${inicio.max}) w.maximize(); if (${inicio.full}) w.setFullScreen(true);
    return { ...m, visible: document.visibilityState };`);
  await comprobar("H1", "el espía demuestra que el parche está puesto", () => ({ ok: r.parcheado === true, dato: `parche comprobado: ${r.parcheado}` }));
  await comprobar("H2", "la cuenta del ciclo de medición, con la ventana angosta y subiendo", () => ({
    // Sin la condición de la §5.5 —el editor angosto— el número no dice nada.
    ok: typeof r.measure === "number" && typeof r.viewport === "number" && r.ancho < 800,
    dato: `Measure loop restarted ${r.measure} · Viewport failed ${r.viewport} · editor ${r.ancho} px, lineWrapping ${r.envuelve} · ${PASOS} pasos · ventana ${r.visible === "visible" ? "visible" : "en segundo plano"}`,
  }));
}

// ------------------------------------------------------------------ main
instalar();
// Un tamaño de ventana fijo. La primera corrida entera después de la sección
// H arrancó con la ventana en 700 px —la había dejado así una corrida cortada—
// y tres comprobaciones de la A fallaron sin nada roto: con el editor angosto
// las líneas envuelven y la fila se buscaba en el renglón equivocado. Lo que
// se mide con la ventana angosta es la H, y la H la angosta y la devuelve.
//
// Y al frente, sin quitarle el foco a nadie: tapada, la ventana cuenta como
// oculta y Chromium frena sus timers hasta colgar un `eval` minutos enteros.
const ventana = vt(`const w = require("@electron/remote").getCurrentWindow();
  w.showInactive(); w.moveTop();
  if (!w.isFullScreen()) { if (w.isMaximized()) w.unmaximize(); w.setSize(1600, 1000); await vt.esperar(600); }
  return { tamano: w.getSize(), completa: w.isFullScreen() };`);
console.log(`   ventana: ${ventana.completa ? "pantalla completa" : ventana.tamano.join("×")}`);
const secciones = { A: seccionA, B: seccionB, C: seccionC, D: seccionD, E: seccionE, F: seccionF, G: seccionG, H: seccionH };
for (const [s, fn] of Object.entries(secciones)) if (corre(s)) await fn();
vt(`await vt.cerrarMenus(); await vt.cerrarModales(); return true;`);
soltarDepurador();
writeFileSync(
  new URL("../../sesiones/RESULTADOS-sesion-8-cli.md", import.meta.url),
  informe("Verificación del paso 6c, corrida por Claude Code con la CLI"),
);
void obs;
