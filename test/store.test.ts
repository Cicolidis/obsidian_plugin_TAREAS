import { describe, expect, it, vi } from "vitest";
import { StoreDeTareas, type EventoDeStore, type PuertoDeNotas } from "../src/store.js";
import { notasDeTrabajo } from "../src/notas.js";

/**
 * El store con un puerto falso: sin Obsidian, sin DOM, sin temporizadores.
 *
 * Que esto se pueda escribir es el punto de que el store reciba un puerto y no
 * `App`. El debounce no aparece por ningún lado a propósito: vive en el
 * adaptador, porque es un asunto del evento de Obsidian y no del índice.
 */

class PuertoFalso implements PuertoDeNotas {
  cambio: ((path: string, contenido: string) => void)[] = [];
  renombre: ((viejo: string, nuevo: string) => void)[] = [];
  borrado: ((path: string) => void)[] = [];
  lecturas = 0;

  constructor(
    public archivos: Record<string, string>,
    public lista = Object.keys(archivos),
  ) {}

  notas() {
    return this.lista;
  }
  async leer(path: string) {
    this.lecturas++;
    return this.archivos[path] ?? null;
  }
  alCambiar(fn: (p: string, c: string) => void) {
    this.cambio.push(fn);
    return () => {};
  }
  alRenombrar(fn: (v: string, n: string) => void) {
    this.renombre.push(fn);
    return () => {};
  }
  alBorrar(fn: (p: string) => void) {
    this.borrado.push(fn);
    return () => {};
  }

  /** Simula que alguien escribió en disco y Obsidian avisó. */
  emitir(path: string, contenido: string) {
    this.archivos[path] = contenido;
    for (const fn of this.cambio) fn(path, contenido);
  }
}

const NOTA = "0_inbox/tareas_X.md";
const OTRA = "0_inbox/tareas_Y.md";
const base = "# lista\n- [ ] una\n\t- [ ] hija\n\t- nota suelta\n- [x] hecha %%t:id=aaaa%%";

async function store(archivos: Record<string, string> = { [NOTA]: base }) {
  const puerto = new PuertoFalso(archivos);
  const s = new StoreDeTareas(puerto);
  await s.arrancar();
  return { s, puerto };
}

describe("arranque", () => {
  it("parsea las notas de la lista y las indexa", async () => {
    const { s } = await store();
    expect(s.cargadas()).toEqual([NOTA]);
    expect(s.tareas().map((t) => t.texto)).toEqual(["una", "hija", "hecha"]);
    expect(s.documento(NOTA)?.lineas.length).toBe(5);
  });

  it("una nota que no existe no rompe el arranque", async () => {
    const puerto = new PuertoFalso({}, [NOTA, OTRA]);
    const s = new StoreDeTareas(puerto);
    await s.arrancar();
    expect(s.cargadas()).toEqual([]);
    expect(s.tareas()).toEqual([]);
  });

  it("los ids son de todas las notas juntas, no de una", async () => {
    const { s } = await store({
      [NOTA]: "- [ ] a %%t:id=aaaa%%",
      [OTRA]: "- [ ] b %%t:id=bbbb%%",
    });
    expect([...s.idsEnUso()].sort()).toEqual(["aaaa", "bbbb"]);
  });
});

describe("absorber — la entrada principal", () => {
  it("lo que devuelve process entra sin esperar el evento", async () => {
    const { s } = await store();
    expect(s.absorber(NOTA, "- [ ] nueva")).toBe(true);
    expect(s.tareas().map((t) => t.texto)).toEqual(["nueva"]);
  });

  it("un contenido idéntico no reparsea ni notifica", async () => {
    // Es el `changed` que llega detrás de nuestra propia escritura. Sin esto,
    // cada acción provocaría dos redibujos: uno correcto y uno de regalo.
    const { s, puerto } = await store();
    const visto: EventoDeStore[] = [];
    s.alActualizar((e) => visto.push(e));

    puerto.emitir(NOTA, base);
    expect(visto).toEqual([]);
    expect(s.absorber(NOTA, base)).toBe(false);
  });

  it("congelado, no absorbe nada: el store queda atrasado a propósito", async () => {
    const { s, puerto } = await store();
    s.congelado = true;
    puerto.emitir(NOTA, "- [ ] otra cosa");
    expect(s.absorber(NOTA, "- [ ] y otra")).toBe(false);
    expect(s.tareas().map((t) => t.texto)).toEqual(["una", "hija", "hecha"]);

    s.congelado = false;
    puerto.emitir(NOTA, "- [ ] al fin");
    expect(s.tareas().map((t) => t.texto)).toEqual(["al fin"]);
  });

  it("un evento de una nota que no está en la lista se ignora", async () => {
    const { s, puerto } = await store();
    puerto.emitir("0_inbox/otra cosa.md", "- [ ] intrusa");
    expect(s.cargadas()).toEqual([NOTA]);
  });
});

describe("renombre y borrado — lo que `changed` no avisa", () => {
  it("renombrar reindexa con la ruta nueva sin volver a leer del disco", async () => {
    const { s, puerto } = await store();
    const lecturas = puerto.lecturas;
    puerto.lista = [OTRA];
    for (const fn of puerto.renombre) fn(NOTA, OTRA);

    expect(s.cargadas()).toEqual([OTRA]);
    expect(s.tareas().every((t) => t.archivo === OTRA)).toBe(true);
    expect(puerto.lecturas).toBe(lecturas);
  });

  it("renombrar fuera de la lista es sacarla del store", async () => {
    const { s, puerto } = await store();
    for (const fn of puerto.renombre) fn(NOTA, "otra carpeta/cualquiera.md");
    expect(s.cargadas()).toEqual([]);
  });

  it("borrar la saca, y borrar una que no estaba no avisa", async () => {
    const { s, puerto } = await store();
    const visto: EventoDeStore[] = [];
    s.alActualizar((e) => visto.push(e));

    for (const fn of puerto.borrado) fn("0_inbox/nunca estuvo.md");
    expect(visto).toEqual([]);

    for (const fn of puerto.borrado) fn(NOTA);
    expect(s.cargadas()).toEqual([]);
    expect(visto.map((e) => e.origen)).toEqual(["borrado"]);
  });
});

describe("resincronizar — la lista cambió en ajustes", () => {
  it("parsea las nuevas y olvida las que salieron", async () => {
    const { s, puerto } = await store({ [NOTA]: base, [OTRA]: "- [ ] b" });
    puerto.lista = [OTRA];
    await s.resincronizar();
    expect(s.cargadas()).toEqual([OTRA]);

    puerto.lista = [NOTA, OTRA];
    await s.resincronizar();
    expect(s.cargadas().sort()).toEqual([NOTA, OTRA]);
  });

  it("no vuelve a leer las que ya tenía", async () => {
    const { s, puerto } = await store();
    const lecturas = puerto.lecturas;
    await s.resincronizar();
    expect(puerto.lecturas).toBe(lecturas);
  });
});

describe("el canal de actualización", () => {
  it("avisa con la nota, el origen y cuántas tareas quedaron", async () => {
    const { s } = await store();
    const visto: EventoDeStore[] = [];
    s.alActualizar((e) => visto.push(e));

    s.absorber(NOTA, "- [ ] a\n- [ ] b");
    expect(visto).toHaveLength(1);
    expect(visto[0]).toMatchObject({ path: NOTA, origen: "escritura", tareas: 2 });
    expect(visto[0]!.ms).toBeGreaterThanOrEqual(0);
  });

  it("un oyente que tira no corta a los demás", async () => {
    const { s } = await store();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const bueno = vi.fn();
    s.alActualizar(() => {
      throw new Error("oyente roto");
    });
    s.alActualizar(bueno);

    s.absorber(NOTA, "- [ ] a");
    expect(bueno).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("darse de baja deja de recibir", async () => {
    const { s } = await store();
    const visto: EventoDeStore[] = [];
    const baja = s.alActualizar((e) => visto.push(e));
    s.absorber(NOTA, "- [ ] a");
    baja();
    s.absorber(NOTA, "- [ ] b");
    expect(visto).toHaveLength(1);
  });
});

describe("notasDeTrabajo — el LOG no se parsea al arrancar (§12)", () => {
  const lista = ["0_inbox/tareas_VIDA.md", "0_inbox/tareas_LOG.md"];

  it("saca el LOG y deja el resto", () => {
    expect(notasDeTrabajo(lista, "0_inbox/tareas_LOG.md")).toEqual(["0_inbox/tareas_VIDA.md"]);
  });

  it("si el LOG no está en la lista, no saca nada", () => {
    expect(notasDeTrabajo(lista, "0_inbox/otro_LOG.md")).toEqual(lista);
  });

  it("compara en NFC, como el resto del filtro de notas", () => {
    // `tareas_CÍCLICAS.md` lleva acento y basta que el archivo pase por Sync o
    // por un readdir de macOS para que llegue en NFD.
    const conAcento = "0_inbox/tareas_CÍCLICAS.md";
    expect(notasDeTrabajo([conAcento.normalize("NFD")], conAcento.normalize("NFC"))).toEqual([]);
  });
});
