import { describe, expect, it } from "vitest";
import {
  aplicarArchivado,
  archivarEnElLog,
  archivarPideConfirmacion,
  archivarPorDefecto,
  bloqueParaElLog,
  caminoDeArchivado,
  nodoDeTarea,
  parseLineaArchivada,
  nombreDeNota,
  parseLog,
  planDeArchivado,
} from "../src/archivado.js";
import { parseDocumento, renderDocumento } from "../src/documento.js";

const doc = parseDocumento;
const HOY = "2026-08-24";

/** El nodo cuya tarea empieza con este texto. */
function nodoDe(raw: string, empiezaCon: string) {
  const d = doc(raw);
  const l = d.lineas.find((x) => x.texto.includes(empiezaCon));
  if (!l) throw new Error(`no hay línea con ${JSON.stringify(empiezaCon)}`);
  const n = nodoDeTarea(d, l.n);
  if (!n) throw new Error(`la línea ${l.n} no es un nodo de lista`);
  return { d, n };
}

describe("bloqueParaElLog", () => {
  it("escribe bullet sin checkbox, con la fecha al final (§12)", () => {
    const { d, n } = nodoDe("- [x] pasar ejercicios a Canvas %%t:done=2026-08-22%%", "pasar");
    expect(bloqueParaElLog(d, n, HOY)).toEqual(["- pasar ejercicios a Canvas [✓ 2026-08-22]"]);
  });

  it("limpia el token: el id ya no apunta a nada vivo", () => {
    const { d, n } = nodoDe("- [x] algo %%t:id=a3f2;wb=foco;p=2;done=2026-08-22%%", "algo");
    expect(bloqueParaElLog(d, n, HOY)).toEqual(["- algo [✓ 2026-08-22]"]);
  });

  it("sin `done`, usa la fecha de archivado", () => {
    const { d, n } = nodoDe("- [x] sin fecha", "sin fecha");
    expect(bloqueParaElLog(d, n, HOY)).toEqual([`- sin fecha [✓ ${HOY}]`]);
  });

  it("va el subárbol completo, con las notas verbatim", () => {
    const raw =
      "- [x] armar la guía %%t:done=2026-08-22%%\n" +
      "\t- link al material: https://ejemplo\n" +
      "\t- [x] imprimir\n" +
      "\t\t- 30 copias, doble faz";
    const { d, n } = nodoDe(raw, "armar la guía");
    expect(bloqueParaElLog(d, n, HOY)).toEqual([
      "- armar la guía [✓ 2026-08-22]",
      "\t- link al material: https://ejemplo",
      "\t- imprimir",
      "\t\t- 30 copias, doble faz",
    ]);
  });

  it("un descendiente terminado otro día conserva su fecha", () => {
    // Sin esta excepción se perdería; con la fecha en todas las líneas, el LOG
    // se llenaría de fechas repetidas.
    const raw =
      "- [x] madre %%t:done=2026-08-22%%\n" +
      "\t- [x] misma fecha %%t:done=2026-08-22%%\n" +
      "\t- [x] otro día %%t:done=2026-08-10%%";
    const { d, n } = nodoDe(raw, "madre");
    expect(bloqueParaElLog(d, n, HOY)).toEqual([
      "- madre [✓ 2026-08-22]",
      "\t- misma fecha",
      "\t- otro día [✓ 2026-08-10]",
    ]);
  });

  it("la sangría se recalcula desde la raíz del subárbol", () => {
    const raw = "- [ ] madre\n\t- [x] la que se archiva %%t:done=2026-08-22%%\n\t\t- una nota";
    const { d, n } = nodoDe(raw, "la que se archiva");
    expect(bloqueParaElLog(d, n, HOY)).toEqual([
      "- la que se archiva [✓ 2026-08-22]",
      "\t- una nota",
    ]);
  });

  it("los `- [ ]` vacíos no llegan al LOG (invariante 8)", () => {
    const raw = "- [x] madre %%t:done=2026-08-22%%\n\t- [ ]\n\t- [x] hija %%t:done=2026-08-22%%";
    const { d, n } = nodoDe(raw, "madre");
    expect(bloqueParaElLog(d, n, HOY)).toEqual(["- madre [✓ 2026-08-22]", "\t- hija"]);
  });
});

describe("caminoDeArchivado", () => {
  it("es la nota de origen, y el proyecto si lo hay", () => {
    expect(caminoDeArchivado("0_inbox/tareas_COLE.md", "p_6_Sheets")).toEqual([
      "tareas_COLE",
      "p_6_Sheets",
    ]);
    expect(caminoDeArchivado("0_inbox/tareas_MES.md", null)).toEqual(["tareas_MES"]);
  });

  it("no arrastra los andamios de la nota de trabajo", () => {
    // `WORKBENCH`, `INBOX` y `semana 24 - 28` son secciones para organizarse
    // hoy, no categorías de lo ya hecho. El camino literal de la §12 las
    // llevaba al historial.
    const camino = caminoDeArchivado("0_inbox/tareas_COLE.md", null);
    expect(camino).toEqual(["tareas_COLE"]);
  });
});

describe("planDeArchivado", () => {
  const LOG = "# PESTALOZZI\n\n## unidad 1\n\n- algo viejo\n\n## unidad 2\n\n- otra cosa";

  it("engancha en el camino que ya existe y no duplica el heading", () => {
    const plan = planDeArchivado(doc(LOG), ["PESTALOZZI", "unidad 1"], ["- nuevo [✓ 2026-08-24]"]);
    expect(plan.headingsNuevos).toEqual([]);
    expect(renderDocumento(aplicarArchivado(doc(LOG), plan))).toBe(
      "# PESTALOZZI\n\n## unidad 1\n\n- algo viejo\n- nuevo [✓ 2026-08-24]\n\n## unidad 2\n\n- otra cosa",
    );
  });

  it("crea solo lo que falta del camino", () => {
    const plan = planDeArchivado(doc(LOG), ["PESTALOZZI", "unidad 9"], ["- nuevo"]);
    expect(plan.headingsNuevos).toEqual([{ nivel: 2, texto: "unidad 9" }]);
    expect(renderDocumento(aplicarArchivado(doc(LOG), plan))).toBe(
      "# PESTALOZZI\n\n## unidad 1\n\n- algo viejo\n\n## unidad 2\n\n- otra cosa\n\n## unidad 9\n\n- nuevo",
    );
  });

  it("crea el camino entero cuando no hay nada", () => {
    const plan = planDeArchivado(doc(""), ["ACADEMIA", "materia"], ["- nuevo"]);
    expect(plan.headingsNuevos).toEqual([
      { nivel: 1, texto: "ACADEMIA" },
      { nivel: 2, texto: "materia" },
    ]);
  });

  it("los niveles quedan consecutivos", () => {
    const camino = caminoDeArchivado("0_inbox/tareas_COLE.md", "p_6_Sheets");
    const plan = planDeArchivado(doc(""), camino, ["- x"]);
    expect(plan.headingsNuevos.map((h) => h.nivel)).toEqual([1, 2]);
  });

  it("un heading con el mismo texto en otra rama no engancha", () => {
    const log = "# RAMA A\n\n## común\n\n- de A\n\n# RAMA B\n\n- de B";
    const plan = planDeArchivado(doc(log), ["RAMA B", "común"], ["- nuevo"]);
    expect(plan.headingsNuevos).toEqual([{ nivel: 2, texto: "común" }]);
    expect(renderDocumento(aplicarArchivado(doc(log), plan))).toBe(
      "# RAMA A\n\n## común\n\n- de A\n\n# RAMA B\n\n- de B\n\n## común\n\n- nuevo",
    );
  });

  it("archivar dos veces en el mismo camino no duplica el heading (invariante 6)", () => {
    let log = doc(LOG);
    for (const t of ["- uno", "- dos"]) {
      log = aplicarArchivado(log, planDeArchivado(log, ["PESTALOZZI", "unidad 9"], [t]));
    }
    const texto = renderDocumento(log);
    expect(texto.match(/## unidad 9/g)).toHaveLength(1);
    expect(texto.endsWith("## unidad 9\n\n- uno\n- dos")).toBe(true);
  });

  it("lo que escribe sigue siendo un archivo que el parser lee igual", () => {
    const log = aplicarArchivado(
      doc(LOG),
      planDeArchivado(doc(LOG), ["PESTALOZZI", "unidad 9"], ["- nuevo"]),
    );
    const texto = renderDocumento(log);
    expect(renderDocumento(doc(texto))).toBe(texto);
  });
});

describe("archivarPorDefecto (§12)", () => {
  it("una hoja se descarta; una con subárbol o con notas se archiva", () => {
    // El default sale del tamaño del bloque. Medido el 01/09/2026 sobre todas
    // las tareas del corpus —que es lo que ve el botón—: p50 = 1 línea y 251
    // de 389 (64,5%) son hojas. La §2 dice p50 = 2 porque midió el subárbol de
    // las tareas **raíz**, que son otras.
    expect(archivarPorDefecto(nodoDe("- [x] sola", "sola").n)).toBe(false);
    expect(archivarPorDefecto(nodoDe("- [x] con nota\n\t- la nota", "con nota").n)).toBe(true);
    expect(archivarPorDefecto(nodoDe("- [x] madre\n\t- [x] hija", "madre").n)).toBe(true);
  });
});

describe("dónde crece el LOG", () => {
  const LOG = "# PESTALOZZI\n\n## unidad 1\n\n- algo viejo";

  it("una sección nueva va al final, no arriba de lo que ya estaba", () => {
    // Un log crece por abajo. Insertarla arriba dejaría lo recién archivado
    // por encima de los headings que ya existían.
    const plan = planDeArchivado(doc(LOG), ["ACADEMIA", "materia"], ["- nuevo"]);
    expect(renderDocumento(aplicarArchivado(doc(LOG), plan))).toBe(
      "# PESTALOZZI\n\n## unidad 1\n\n- algo viejo\n\n# ACADEMIA\n\n## materia\n\n- nuevo",
    );
  });

  it("en un LOG vacío no deja una línea en blanco adelante", () => {
    // El salto del final es la línea vacía que ya tenía el archivo vacío: el
    // bloque va antes de ella, no después.
    const plan = planDeArchivado(doc(""), ["ACADEMIA"], ["- nuevo"]);
    expect(renderDocumento(aplicarArchivado(doc(""), plan))).toBe("# ACADEMIA\n\n- nuevo\n");
  });

  it("en el LOG real, que no termina en salto, no agrega uno", () => {
    const plan = planDeArchivado(doc(LOG), ["ACADEMIA"], ["- nuevo"]);
    expect(renderDocumento(aplicarArchivado(doc(LOG), plan)).endsWith("- nuevo")).toBe(true);
  });
});

/**
 * Leer el LOG de vuelta.
 *
 * Es lo que convierte a `[✓ AAAA-MM-DD]` de decoración en sintaxis: el filtro
 * «archivadas» de Buscar ordena por fecha y filtra por proyecto, y esos campos
 * hay que recuperarlos del archivo. Una vista no relaja el requisito de
 * formato, lo endurece.
 */
describe("parseLineaArchivada", () => {
  it("separa el texto de la fecha", () => {
    expect(parseLineaArchivada("revisar la guía 3 [✓ 2026-08-22]")).toEqual({
      texto: "revisar la guía 3",
      fecha: "2026-08-22",
    });
  });

  it("sin marca, la línea entera es el texto", () => {
    expect(parseLineaArchivada("una nota verbatim")).toEqual({
      texto: "una nota verbatim",
      fecha: null,
    });
  });

  it("no se come los corchetes del texto de la tarea", () => {
    // El corpus tiene «armar grupos de trabajo [sólo falta: 1A]». Un regex más
    // suelto se llevaría eso por delante.
    expect(parseLineaArchivada("armar grupos [sólo falta: 1A] [✓ 2026-08-22]")).toEqual({
      texto: "armar grupos [sólo falta: 1A]",
      fecha: "2026-08-22",
    });
    expect(parseLineaArchivada("armar grupos [sólo falta: 1A]").fecha).toBeNull();
  });

  it("una marca mal formada no es una marca", () => {
    for (const l of ["x [✓ 22-08-2026]", "x [✓2026-08-22]", "x [2026-08-22]", "x [✓ hoy]"]) {
      expect(parseLineaArchivada(l).fecha, l).toBeNull();
    }
  });
});

describe("parseLog", () => {
  const LOG =
    "# tareas_COLE\n\n## p_6_Sheets\n\n- revisar la guía 3 [✓ 2026-08-22]\n\t- 30 copias, doble faz\n\n# tareas_MES\n\n- pagar el alquiler [✓ 2026-08-09]";

  it("recupera nota, proyecto, texto, fecha y notas", () => {
    expect(parseLog(doc(LOG))).toEqual([
      {
        nota: "tareas_COLE",
        proyecto: "p_6_Sheets",
        texto: "revisar la guía 3",
        fecha: "2026-08-22",
        notas: ["\t- 30 copias, doble faz"],
        linea: 4,
      },
      {
        nota: "tareas_MES",
        proyecto: null,
        texto: "pagar el alquiler",
        fecha: "2026-08-09",
        notas: [],
        linea: 9,
      },
    ]);
  });

  it("un heading de nivel 1 cierra el proyecto de la rama anterior", () => {
    const entradas = parseLog(doc(LOG));
    expect(entradas[1]!.proyecto).toBeNull();
  });

  it("archivar y volver a leer recupera lo que se archivó", () => {
    const origen = doc("- [x] revisar la guía 3 %%t:id=a3f2;wb=foco;done=2026-08-22%%\n\t- 30 copias");
    const nodo = nodoDeTarea(origen, 0)!;
    const camino = caminoDeArchivado("0_inbox/tareas_COLE.md", "p_6_Sheets");
    const log = aplicarArchivado(doc(""), planDeArchivado(doc(""), camino, bloqueParaElLog(origen, nodo, HOY)));

    expect(parseLog(log)).toEqual([
      {
        nota: "tareas_COLE",
        proyecto: "p_6_Sheets",
        texto: "revisar la guía 3",
        fecha: "2026-08-22",
        notas: ["\t- 30 copias"],
        linea: 4,
      },
    ]);
  });
});

describe("archivarEnElLog — lo que corre adentro de `vault.process()`", () => {
  const LOG = "# PESTALOZZI\n\n- algo viejo";

  it("devuelve el LOG entero, con el bloque puesto", () => {
    const { texto } = archivarEnElLog(LOG, ["tareas_X"], ["- lo nuevo [✓ 2026-08-24]"]);
    expect(texto).toBe(
      "# PESTALOZZI\n\n- algo viejo\n\n# tareas_X\n\n- lo nuevo [✓ 2026-08-24]",
    );
  });

  it("no toca una sola línea de las que ya estaban", () => {
    const { texto } = archivarEnElLog(LOG, ["tareas_X"], ["- lo nuevo"]);
    expect(texto.startsWith(LOG)).toBe(true);
  });

  it("el resultado se vuelve a leer byte por byte (invariante 9)", () => {
    const { texto } = archivarEnElLog(LOG, ["tareas_X", "p_Y"], ["- a", "\t- b"]);
    expect(renderDocumento(parseDocumento(texto))).toBe(texto);
  });

  it("dice cuántos headings creó, que es lo que el cartel necesita", () => {
    const uno = archivarEnElLog(LOG, ["tareas_X"], ["- a"]);
    expect(uno.plan.headingsNuevos).toEqual([{ nivel: 1, texto: "tareas_X" }]);
    // Y archivar de nuevo en el mismo camino no crea ninguno (invariante 6).
    const dos = archivarEnElLog(uno.texto, ["tareas_X"], ["- b"]);
    expect(dos.plan.headingsNuevos).toEqual([]);
  });

  it("recalcular es lo que evita duplicar un heading que apareció en el medio", () => {
    // El caso que decidió que el LOG **no** lleve un lote ubicado: el plan se
    // arma sobre una foto y, para cuando se escribe, otro dispositivo creó la
    // sección por Sync. Como se recalcula sobre los bytes frescos, engancha.
    const foto = LOG;
    const conLaSeccion = archivarEnElLog(foto, ["tareas_X"], ["- de otra máquina"]).texto;
    const r = archivarEnElLog(conLaSeccion, ["tareas_X"], ["- lo mío"]);
    expect(r.plan.headingsNuevos).toEqual([]);
    expect(r.texto.match(/^# tareas_X$/gm)).toHaveLength(1);
  });

  it("archivar N bloques en el mismo camino crea el camino una sola vez (inv. 6)", () => {
    let texto = LOG;
    for (let i = 0; i < 5; i++) {
      texto = archivarEnElLog(texto, ["tareas_X", "p_Y"], [`- tarea ${i}`]).texto;
    }
    expect(texto.match(/^# tareas_X$/gm)).toHaveLength(1);
    expect(texto.match(/^## p_Y$/gm)).toHaveLength(1);
    for (let i = 0; i < 5; i++) expect(texto).toContain(`- tarea ${i}`);
  });
});

describe("cuándo se pregunta antes de archivar", () => {
  it("una hoja de una línea no pregunta; dos líneas o más sí", () => {
    // El umbral sale de la medición del 01/09/2026: 251 de 389 tareas (64,5%)
    // son hojas de una línea, y la §12 existe porque tildar tiene que costar
    // menos que borrar.
    expect(archivarPideConfirmacion(["- sola"])).toBe(false);
    expect(archivarPideConfirmacion(["- madre", "\t- hija"])).toBe(true);
  });

  it("un bloque vacío tampoco pregunta: no hay nada que decir", () => {
    expect(archivarPideConfirmacion([])).toBe(false);
  });
});

describe("nombreDeNota", () => {
  it("saca la carpeta y la extensión, que es como el LOG llama a la nota", () => {
    expect(nombreDeNota("0_inbox/tareas_X.md")).toBe("tareas_X");
    expect(nombreDeNota("tareas_X.md")).toBe("tareas_X");
    expect(nombreDeNota("a/b/c.md")).toBe("c");
  });

  it("es exactamente lo que `caminoDeArchivado` pone de heading de nivel 1", () => {
    // Si los dos divergieran, el cartel diría una nota y el historial la
    // guardaría bajo otra.
    expect(caminoDeArchivado("0_inbox/tareas_X.md", null)).toEqual([
      nombreDeNota("0_inbox/tareas_X.md"),
    ]);
  });
});
