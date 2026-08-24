/**
 * El token oculto del final de la línea (spec §5).
 *
 * ```
 * - [ ] llamar a Flow %%t:id=a3f2;wb=foco,mudanza;due=2026-08-29;p=2%%
 * ```
 *
 * `%%…%%` es comentario nativo de Obsidian: en modo lectura se oculta solo, y
 * en Live Preview lo va a ocultar la decoración de la capa 3. Es **uno solo por
 * línea, siempre al final, con los campos en orden fijo** (D4: dos
 * `Decoration.replace` no se pueden anidar, así que todos los metadatos tienen
 * que caber en un token).
 *
 * El usuario nunca lo escribe. Lo escriben los botones.
 *
 * La regla que ordena todo el módulo es la de seguridad de la §5.3: **si el
 * token no parsea, la línea no se reescribe**. Se trata como tarea sin
 * metadatos. Nunca reparar a ciegas: un token roto es un síntoma de que algo
 * ya salió mal, y encima escribirle arriba es la forma de perder el original.
 */

/** Los metadatos de una tarea (spec §5.2). */
export interface TaskMeta {
  /** 4-8 caracteres `[a-z0-9]`. `null` hasta que la tarea entra a un workbench. */
  id: string | null;
  /** Nombres de workbench. Vacío es «en ninguno». */
  wb: string[];
  /**
   * El vencimiento, en una de dos formas:
   *
   * - `AAAA-MM-DD` — una fecha concreta, para una tarea de una sola vez.
   * - `D` o `DD` — un día del mes, **solo con `rec`**: `due=10` en una cíclica
   *   mensual es «el 10 del mes en curso». Se resuelve con `resolverDue`.
   *
   * La segunda forma existe para no tener que reescribir la fecha cada mes.
   * Guardar `2026-09-10` obligaría a que algo le corriera el mes en octubre, y
   * eso es una escritura de mantenimiento automática: justo lo que la §8
   * prohíbe. Son 3 tareas del corpus (`antes del día 10`, `antes del segundo
   * vencimiento`), todas en `tareas_MES`.
   */
  due: string | null;
  /**
   * El **grupo de reinicio** al que pertenece esta tarea cíclica.
   *
   * Es una etiqueta de nombre libre, como `wb`: `rec=lunes`, `rec=mensual`,
   * `rec=mudanza`. No es un motor. El plugin **nunca** regenera ni corre fechas
   * por su cuenta; un botón reinicia todas las tareas de un grupo cuando el
   * usuario lo aprieta.
   *
   * Es lo que evita el choque entre la §11 y la §8: el disparador es el
   * usuario, no el calendario. Un reinicio por calendario haría que todos los
   * dispositivos con Obsidian abierto reescribieran las mismas líneas en el
   * mismo momento, sobre archivos en Sync.
   */
  rec: string | null;
  /** 0 normal · 1 alta · 2 muy alta. La normal no escribe campo. */
  prioridad: 0 | 1 | 2;
  /** `AAAA-MM-DD`. */
  done: string | null;
}

export const META_VACIA: Readonly<TaskMeta> = Object.freeze({
  id: null,
  wb: [] as string[],
  due: null,
  rec: null,
  prioridad: 0,
  done: null,
});

/**
 * Qué se encontró al final de la línea.
 *
 * Los tres estados no son decorativos: `sin-token` y `ok` se pueden reescribir,
 * `ilegible` no. Tenerlos separados es lo que hace que el invariante 7 sea una
 * comprobación de tipos y no una convención.
 */
export type Analisis =
  | { estado: "sin-token"; texto: string; meta: TaskMeta }
  | { estado: "ok"; texto: string; meta: TaskMeta; token: string }
  | { estado: "ilegible" };

/**
 * Un token bien formado al final de la línea.
 *
 * Tolera espacios detrás al **leer** —un espacio suelto no puede congelar una
 * línea para siempre— pero al escribir el token queda pegado al final real.
 */
const TOKEN_RE = /%%t:([^%]*)%%([ \t]*)$/;
/** Cualquier cosa que se parezca a un token, esté donde esté. Para detectar. */
const PARECIDO_RE = /%%t:/;

const ID_RE = /^[a-z0-9]{4,8}$/;
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
/**
 * Un nombre de workbench o de grupo de reinicio: cualquier cosa menos lo que
 * rompería el token. Los dos comparten forma y por eso comparten el regex:
 * repetirlo en dos lugares es cómo empiezan a divergir.
 */
const NOMBRE_RE = /^[^;,%]+$/;
/** Un día del mes: `1` a `31`, sin ceros a la izquierda. */
const DIA_RE = /^(?:[1-9]|[12]\d|3[01])$/;

/** El orden en que se escriben los campos. Fijo, y en un solo lugar. */
const ORDEN = ["id", "wb", "due", "rec", "p", "done"] as const;

/**
 * Los campos del token, o `null` si alguno no cumple.
 *
 * Un campo desconocido **también** devuelve `null`, a propósito. Parece
 * inamistoso, pero es la única respuesta correcta hacia adelante: si una
 * versión futura agrega un campo y esta lo ignorara, reescribir la línea lo
 * borraría en silencio. Negarse a escribir conserva el dato.
 */
function parseCampos(cuerpo: string): TaskMeta | null {
  const meta: TaskMeta = { ...META_VACIA, wb: [] };
  const vistos = new Set<string>();
  if (cuerpo === "") return null;

  for (const par of cuerpo.split(";")) {
    const i = par.indexOf("=");
    if (i <= 0) return null;
    const campo = par.slice(0, i);
    const valor = par.slice(i + 1);
    if (vistos.has(campo)) return null;
    vistos.add(campo);

    switch (campo) {
      case "id":
        if (!ID_RE.test(valor)) return null;
        meta.id = valor;
        break;
      case "wb": {
        if (valor === "") return null;
        const nombres = valor.split(",");
        if (!nombres.every((n) => NOMBRE_RE.test(n))) return null;
        if (new Set(nombres).size !== nombres.length) return null;
        meta.wb = nombres;
        break;
      }
      case "due":
        if (!FECHA_RE.test(valor) && !DIA_RE.test(valor)) return null;
        meta.due = valor;
        break;
      case "rec":
        if (!NOMBRE_RE.test(valor)) return null;
        meta.rec = valor;
        break;
      case "p":
        // La prioridad normal no escribe campo (§5.2): un `p=0` explícito es
        // un token que este plugin no escribió, y por lo tanto ilegible.
        if (valor !== "1" && valor !== "2") return null;
        meta.prioridad = valor === "1" ? 1 : 2;
        break;
      case "done":
        if (!FECHA_RE.test(valor)) return null;
        meta.done = valor;
        break;
      default:
        return null;
    }
  }

  // El orden fijo también se verifica al leer: un token con los campos
  // desordenados no lo escribió este plugin.
  const leidos = [...vistos];
  const esperado = ORDEN.filter((c) => vistos.has(c));
  if (leidos.join() !== esperado.join()) return null;

  return meta;
}

/** Qué hay al final de esta línea. */
export function parseTaskToken(linea: string): Analisis {
  const m = TOKEN_RE.exec(linea);
  if (!m) {
    // Hay algo que se le parece pero no está bien formado o no está al final.
    return PARECIDO_RE.test(linea)
      ? { estado: "ilegible" }
      : { estado: "sin-token", texto: linea, meta: { ...META_VACIA, wb: [] } };
  }
  const antes = linea.slice(0, m.index);
  // Dos tokens en la misma línea: uno de los dos sobra y no se sabe cuál.
  if (PARECIDO_RE.test(antes)) return { estado: "ilegible" };
  const meta = parseCampos(m[1]!);
  if (!meta) return { estado: "ilegible" };
  return { estado: "ok", texto: antes, meta, token: m[0]!.slice(0, m[0]!.length - m[2]!.length) };
}

/** El token que corresponde a estos metadatos, o `""` si no hay nada que decir. */
function renderTaskToken(meta: TaskMeta): string {
  const campos: string[] = [];
  if (meta.id !== null) campos.push(`id=${meta.id}`);
  if (meta.wb.length) campos.push(`wb=${meta.wb.join(",")}`);
  if (meta.due !== null) campos.push(`due=${meta.due}`);
  if (meta.rec !== null) campos.push(`rec=${meta.rec}`);
  if (meta.prioridad !== 0) campos.push(`p=${meta.prioridad}`);
  if (meta.done !== null) campos.push(`done=${meta.done}`);
  return campos.length ? `%%t:${campos.join(";")}%%` : "";
}

/**
 * La línea con los metadatos aplicados.
 *
 * Dos propiedades, que son el invariante 2:
 *
 * - **Idempotencia** — aplicarla dos veces da lo mismo que una.
 * - **Estabilidad** — con un patch vacío no modifica el archivo. Esto se
 *   resuelve saliendo antes de tocar nada, y no comparando al final: es lo que
 *   protege las 20 líneas del corpus que tienen espacios al final, que si no se
 *   normalizarían de paso.
 *
 * Con un patch que sí dice algo, el token va al final **real** de la línea, así
 * que los espacios finales del texto se recortan. Solo pasa cuando el usuario
 * pidió una acción sobre esa tarea (§8, regla 2).
 */
export function setTaskToken(linea: string, patch: Partial<TaskMeta>): string {
  const a = parseTaskToken(linea);
  if (a.estado === "ilegible") return linea; // invariante 7
  if (Object.keys(patch).length === 0) return linea; // invariante 2

  const meta: TaskMeta = { ...a.meta, ...patch, wb: [...(patch.wb ?? a.meta.wb)] };
  const token = renderTaskToken(meta);
  const texto = a.texto.replace(/[ \t]+$/, "");
  if (token === "") return texto;
  return texto === "" ? token : `${texto} ${token}`;
}

/**
 * La línea sin token.
 *
 * La usa el archivado (§12: «se limpia el token», porque el id ya no apunta a
 * nada vivo). Una línea ilegible vuelve intacta, igual que en `setTaskToken`.
 */
export function stripTaskToken(linea: string): string {
  const a = parseTaskToken(linea);
  if (a.estado !== "ok") return linea;
  return a.texto.replace(/[ \t]+$/, "");
}

/**
 * Un `id` que no choca con ninguno de los que ya existen (§5.4).
 *
 * Arranca en 4 caracteres y crece solo si hace falta. Con 36⁴ = 1.679.616
 * combinaciones y 395 tareas, la probabilidad de choque es del orden de 1 en
 * 4.000: crecer casi nunca pasa, pero **no se puede depender de que no pase**,
 * porque un id repetido no rompe nada visible — hace que dos tareas distintas
 * sean la misma para el workbench, que es peor que un error.
 *
 * `aleatorio` se inyecta para poder forzar el choque en los tests. Un generador
 * que no se puede hacer chocar es un generador cuyo camino de choque no se
 * probó nunca.
 *
 * Esta función **no se llama al parsear**. El id se escribe solo cuando la
 * tarea entra a un workbench: ponerle id a las 395 tareas al arrancar tocaría
 * los cinco archivos en cada dispositivo cada vez que se abre Obsidian, que es
 * la receta de conflictos de Sync que la §5.4 evita.
 */
const ALFABETO = "abcdefghijklmnopqrstuvwxyz0123456789";
const LARGO_MINIMO = 4;
const LARGO_MAXIMO = 8;

export function nuevoId(
  existentes: ReadonlySet<string>,
  aleatorio: () => number = Math.random,
): string {
  for (let largo = LARGO_MINIMO; largo <= LARGO_MAXIMO; largo++) {
    // Unos cuantos intentos por largo antes de agrandar: agrandar es la salida
    // cuando el espacio está saturado, no cuando hubo mala suerte una vez.
    for (let intento = 0; intento < 16; intento++) {
      let id = "";
      for (let i = 0; i < largo; i++)
        id += ALFABETO[Math.floor(aleatorio() * ALFABETO.length) % ALFABETO.length];
      if (!existentes.has(id)) return id;
    }
  }
  // 36⁸ combinaciones agotadas es imposible con este corpus, pero un bucle
  // infinito silencioso sería peor que un error que se ve.
  throw new Error("no se pudo generar un id libre");
}

/**
 * El vencimiento como fecha concreta.
 *
 * `due=2026-09-10` se devuelve tal cual. `due=10` —el día del mes de una
 * cíclica— se resuelve contra `hoy`: si el 10 ya pasó, es el 10 del mes que
 * viene, porque el vencimiento de una mensual siempre está por delante.
 *
 * Es una función del reloj y no del archivo: **nadie reescribe nada** cuando
 * cambia el mes. Ese es el punto.
 *
 * `hoy` se pasa como `AAAA-MM-DD` en vez de leerse de `Date` para que los tests
 * puedan pararse en cualquier día sin tocar el reloj de la máquina.
 */
export function resolverDue(due: string | null, hoy: string): string | null {
  if (due === null) return null;
  if (FECHA_RE.test(due)) return due;
  if (!DIA_RE.test(due)) return null;

  const dia = Number(due);
  const [a, m] = [Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7))];
  const deEsteMes = enMes(a, m, dia);
  if (deEsteMes >= hoy) return deEsteMes;
  return m === 12 ? enMes(a + 1, 1, dia) : enMes(a, m + 1, dia);
}

/**
 * El día `dia` de ese mes, recortado al último día si el mes es más corto.
 *
 * `due=31` en febrero es el 28 —o el 29—, no el 3 de marzo. Un vencimiento que
 * se corre al mes siguiente por no existir el día sería peor que uno que se
 * adelanta unos días.
 */
function enMes(anio: number, mes: number, dia: number): string {
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const d = Math.min(dia, ultimo);
  return `${anio}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
