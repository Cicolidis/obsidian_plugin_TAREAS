/**
 * Prueba de humo del bundle desplegado.
 *
 * `npm run deploy` puede dejar un `main.js` que no carga —un import que no
 * resolvió, un ciclo, una API que no existe— y eso no se descubre hasta que
 * alguien activa el plugin y ve que no pasa nada. Cargarlo en Node cuesta un
 * segundo y ataja esa clase entera.
 *
 * No puede *ejecutar* el plugin: necesita las APIs de Obsidian y de CodeMirror
 * que solo existen adentro de la app. Lo que sí verifica es que el archivo
 * parsea, que exporta un plugin, y que no arrastra referencias a módulos de
 * Node que en Obsidian no están.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const ruta = process.argv[2] ?? "main.js";
const src = readFileSync(ruta, "utf8");
const fallas = [];

// 1) parsea
try {
  new Function(src);
} catch (err) {
  fallas.push(`no parsea: ${err.message}`);
}

// 2) es un bundle CommonJS con exportación por defecto (lo que Obsidian carga)
if (!/module\.exports/.test(src)) fallas.push("no exporta con `module.exports`");

// 3) no quedó ningún `require` de módulos de Node que Obsidian no provee
const permitidos = new Set([
  "obsidian",
  "@codemirror/view",
  "@codemirror/state",
  "@codemirror/language",
]);
for (const m of src.matchAll(/require\(["']([^"']+)["']\)/g)) {
  if (!permitidos.has(m[1]) && !m[1].startsWith(".")) {
    fallas.push(`require de un módulo externo: "${m[1]}"`);
  }
}

// 4) las piezas que tienen que estar
//
// Cada marca es un mecanismo que, si se cae del bundle, deja al plugin
// cargando sin hacer nada —el peor modo de falla, porque no se nota—:
//
//   transactionFilter       el checkbox automático, la defensa del tramo y la unión
//   unirLimpio              el ajuste que la enciende; sin él el filtro no corre nunca
//   editorInfoField         el alcance por archivo; sin él intercepta el vault
//   editorLivePreviewField  las decoraciones solo van en Live Preview (§4a)
//   StateField              las decoraciones entran al mapa de alturas (§5.5)
//   atomicRanges            sin esto el cursor recorre el token carácter a carácter
//   domEventHandlers        el clic al final de la línea, que si no salta abajo
//   tareas-p                las clases de prioridad (§14)
//   tareas-estilo-          el estilo de prioridad, que viaja como clase de `body`
//   0_inbox/tareas_         la lista de notas, que viaja como JSON importado
//   [ ]                     lo que el filtro escribe
//   onLayoutReady           el arranque del store (spec §20 paso 3)
//   vault.process           el único camino de escritura (§8)
//   ViewPlugin              la fila de botones (§13.0, paso 4b)
//   posAtDOM                cómo la fila sabe en qué línea está: sin esto, escribe a ciegas
//   tareas-fila             el ancla y la fila; si se cae, los botones no se ven
//   tareas-revelar-         el modo de revelación, que viaja como clase de `body`
//   setIcon                 sin esto los botones son cuatro cuadrados vacíos
//   los seis ids            un comando que se cae del bundle no da error: no aparece
//   escribirArchivado       la escritura en dos archivos (§12, paso 6a)
//   tareas-confirmar        el modal; sin él, archivar y eliminar no preguntan nada
//   reiniciar-grupo-ciclico la única puerta del reinicio hasta que exista la pestaña
//   escribirEnVarias        el paso en seco sobre las N: «o todas o ninguna» (§11)
//
// El id del plugin no se busca acá: vive en el manifiesto y se valida abajo.
/**
 * El bundle **sin comentarios**, que es contra lo que se buscan las marcas.
 *
 * El build de producción no minifica, así que los comentarios de `src/` viajan
 * enteros al bundle — y eso volvía falsa cualquier marca que además apareciera
 * en un comentario. Encontrado en la sesión 7: `resolverDue` estaba en la lista
 * y **no lo llama nadie todavía**; la marca pasaba por una línea de
 * documentación que lo nombra. Un guardia que un comentario puede satisfacer no
 * es un guardia.
 *
 * El barrido es deliberadamente conservador —bloques `/* … *\/`, líneas que
 * arrancan con `//` y las continuaciones `*` de un JSDoc— porque una alarma
 * falsa que se repite es una alarma que se ignora. Si alguna vez deja pasar un
 * comentario raro, el guardia queda tan flojo como antes; nunca más estricto de
 * lo que corresponde.
 */
const codigo = src
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .split("\n")
  .filter((l) => !/^\s*(\/\/|\*)/.test(l))
  .join("\n");

for (const marca of [
  "transactionFilter",
  "unirLimpio",
  "editorInfoField",
  "editorLivePreviewField",
  "StateField",
  "atomicRanges",
  "domEventHandlers",
  "tareas-p",
  "tareas-estilo-",
  "0_inbox/tareas_",
  "[ ] ",
  "onLayoutReady",
  ".process(",
  "ViewPlugin",
  "posAtDOM",
  // El margen propio de la fila (estilo `columna`) y el guardia del cursor.
  "GutterMarker",
  "lineMarkerChange",
  "gutterLineClass",
  "tareas-hover",
  "tareas-fila",
  "tareas-revelar-",
  "setIcon",
  "completar-tarea-del-cursor",
  "asignar-workbench-favorito",
  "subir-prioridad-del-cursor",
  "bajar-prioridad-del-cursor",
  // Paso 6a: terminar una tarea. El modal es lo que separa «eliminar» de
  // «eliminar sin preguntar», así que su clase también se busca.
  "completar-y-archivar-la-tarea-del-cursor",
  "eliminar-la-tarea-del-cursor",
  "tareas-confirmar",
  // Lo que salió de la verificación del paso 6a: el tilde que completa, el
  // Cmd+clic que archiva, y el oyente del hover en el scroller — los tres son
  // mecanismos que, si se caen del bundle, no dan error: dejan de andar.
  "completarAlTildar",
  "task-list-item-checkbox",
  "scrollDOM",
  // Paso 6b: fecha, recurrencia y reinicio (§5.2, §11). Los tres se caen en
  // silencio: un ítem que no está en el ⋯ y un comando que no aparece en la
  // paleta no dan error, y `escribirEnVarias` es lo que hace que el reinicio
  // sea «o todas o ninguna» — sin él se escribiría nota por nota.
  "reiniciar-grupo-ciclico",
  "escribirEnVarias",
  "FuzzySuggestModal",
]) {
  if (!codigo.includes(marca)) fallas.push(`falta "${marca}" en el código del bundle`);
}

// 4b) el CSS que el bundle no lleva: se copia aparte y se cae aparte.
//
// Sin `styles.css` en su lugar, las decoraciones se aplican y **no se ve nada**:
// el token queda escondido —eso lo hace `Decoration.replace`— pero la prioridad
// no pinta. Es un modo de falla que parece «la prioridad no anda».
try {
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  for (const clase of [
    "tareas-p1",
    "tareas-p2",
    "tareas-hija-p1",
    "tareas-ind-glifo",
    // Los tres estilos: si uno se cae del CSS, el ajuste sigue estando y no
    // dibuja nada, que parece «la prioridad no anda».
    // El 🗑 borra sin preguntar por omisión, así que su color al pasar el
    // mouse es lo único que lo distingue del resto **antes** de apretarlo.
    "tareas-boton-eliminar",
    "tareas-estilo-barra",
    "tareas-estilo-checkbox",
    "tareas-estilo-fondo",
    // La fila: sin esto los botones se dibujan **en el flujo del renglón**, o
    // sea empujando el corte de línea, que es exactamente lo que el diseño
    // evita. No es «se ve feo»: es la regresión de la §5.5.
    "tareas-fila-ancla",
    "tareas-boton",
    "tareas-revelar-hover",
    "tareas-revelar-siempre",
    // Los cinco estilos de fila: si uno se cae del CSS, el ajuste sigue en el
    // desplegable y la fila se queda sin posición, o sea pegada al comienzo de
    // la línea encima del checkbox. Parece «la fila se rompió».
    "tareas-fila-derecha",
    "tareas-fila-derecha-plana",
    "tareas-fila-pastilla",
    "tareas-fila-margen",
    "tareas-fila-izquierda",
    "tareas-fila-columna",
    "tareas-margen",
    "tareas-con-margen",
    "tareas-hover",
    "tareas-estilo-barra-completa",
  ]) {
    if (!css.includes(clase)) fallas.push(`falta ".${clase}" en styles.css`);
  }

  // 4c) **Toda regla que apague o encienda la fila tiene que decir de cuál
  // habla.**
  //
  // Hay dos formas de la misma fila —el widget, adentro de `.cm-line`, y el
  // marcador del margen, afuera— y se revelan de manera distinta, porque el
  // `:hover` de la línea no llega al margen. Una regla que diga `.tareas-fila`
  // a secas alcanza a las dos, y ahí el modo «con el mouse encima» apaga los
  // botones del margen para siempre: no hay nada que los vuelva a encender.
  //
  // Costó una vuelta entera de verificación, y no lo agarró ningún test porque
  // no hay forma de resolver una cascada de CSS sin un navegador. Esto sí:
  // cada bloque que toque `opacity` o `pointer-events` sobre `.tareas-fila`
  // tiene que nombrar `.cm-line` o `.cm-gutter`.
  // Se miran los bloques **sin comentarios**: adentro de uno hay cualquier cosa,
  // y un comentario que nombre la clase no es una regla.
  const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const bloque of sinComentarios.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const cuerpo = bloque[2];
    if (!/(^|[;\s])(opacity|pointer-events)\s*:/.test(cuerpo)) continue;

    for (const selector of bloque[1].split(",")) {
      // Solo cuando la regla apunta **a la fila misma**: si el último tramo es
      // otra cosa —un `.tareas-boton`, por ejemplo— la fila es contexto y no
      // el objetivo, y ahí no hay nada que decidir.
      const ultimo = selector.trim().split(/\s+/).at(-1) ?? "";
      if (!/\.tareas-fila\b/.test(ultimo)) continue;
      if (/\.cm-line|\.cm-gutter/.test(selector)) continue;
      fallas.push(
        `regla de visibilidad de la fila sin decir a cuál de las dos: "${selector.trim()}"`,
      );
    }
  }

  // 4d) **El ancho del margen solo se le puede cobrar a quien lo usa.**
  //
  // Un `gutter()` de CodeMirror es una extensión registrada en **todos** los
  // editores: no se prende por nota. `lineMarker` puede devolver `null` fuera de
  // las notas de tareas —y lo hace— pero la columna existe igual, así que
  // cualquier `padding` o `margin` que se le ponga corre el texto de **todas**
  // las notas del vault.
  //
  // Pasó: la verificación del 6b lo reportó como «se corre el margen de las
  // notas que no son de tareas», ~22px, y el comentario de `styles.css` afirmaba
  // exactamente lo contrario sin haberlo medido. No lo agarró ningún test porque
  // una cascada de CSS no se resuelve sin un navegador; esto sí. La clase
  // `tareas-con-margen` la pone `EditorView.editorAttributes` solo donde el
  // margen está activo, así que toda regla que dé ancho tiene que nombrarla.
  for (const bloque of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = bloque[1];
    const cuerpo = bloque[2];
    if (!/\.tareas-margen\b/.test(selector)) continue;
    if (!/(^|[;\s])(padding|margin|width|min-width)(-[a-z-]+)?\s*:/.test(cuerpo)) continue;
    // Solo cuando la regla apunta al **margen mismo**: sobre un descendiente
    // —`.cm-gutterElement`, `.tareas-fila`— el ancho lo da el contenido, y sin
    // marcadores no hay contenido.
    const ultimo = selector.trim().split(/\s+/).at(-1) ?? "";
    if (!/\.tareas-margen\b/.test(ultimo)) continue;
    if (/\.tareas-con-margen\b/.test(selector)) continue;
    fallas.push(
      `regla que le da ancho al margen sin acotarla a .tareas-con-margen: "${selector.trim()}"`,
    );
  }

} catch {
  fallas.push("no se pudo leer styles.css");
}

// 5) el manifest apunta a este archivo
const require_ = createRequire(import.meta.url);
try {
  const manifest = require_("../manifest.json");
  if (!manifest.id || !manifest.version) fallas.push("manifest.json sin id o version");
  if (manifest.id !== "tareas-outline") fallas.push(`id inesperado: "${manifest.id}"`);
} catch {
  fallas.push("no se pudo leer manifest.json");
}

// ---------------------------------------------------------------------------
// Las guías de verificación dicen cuántas comprobaciones son. Dos veces dije un
// número y era otro —24 cuando eran 36, 18 cuando eran 29—, y las dos veces lo
// encontré contando a mano después de entregarla. Es exactamente el caso de la
// §«mirar la salida»: cuando el ojo no llega, la regla se convierte en algo que
// el pipeline pueda comprobar.
// ---------------------------------------------------------------------------
try {
  const { readdirSync } = await import("node:fs");
  const raiz = new URL("../", import.meta.url);
  for (const nombre of readdirSync(raiz).filter((f) => /^VERIFICAR-.*\.md$/.test(f))) {
    const guia = readFileSync(new URL(nombre, raiz), "utf8");
    const filas = (guia.match(/^\| [A-Z]\d+ /gm) ?? []).length;
    const dice = /Son \*\*(\d+) comprobaciones\*\*/.exec(guia);
    if (!dice) continue; // una guía que no promete un número no miente
    if (Number(dice[1]) !== filas) {
      fallas.push(`${nombre} dice ${dice[1]} comprobaciones y tiene ${filas}`);
    }
  }
} catch (err) {
  fallas.push(`no se pudieron contar las comprobaciones de las guías: ${err.message}`);
}

if (fallas.length > 0) {
  console.error(`Prueba de humo FALLIDA sobre ${ruta}:`);
  for (const f of fallas) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`Prueba de humo OK: ${ruta} (${(src.length / 1024).toFixed(0)} kB)`);
