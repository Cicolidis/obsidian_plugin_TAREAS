import { describe, expect, it } from "vitest";
import {
  aplicarArchivado,
  archivarPorDefecto,
  bloqueParaElLog,
  caminoDeHeadings,
  nodoDeTarea,
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

describe("caminoDeHeadings", () => {
  it("da el camino, sin los headings que ya se cerraron", () => {
    const raw = "# INBOX\n## una sección\n# OTRA RAMA\n#### MATERIA\n- [x] la tarea";
    const d = doc(raw);
    expect(caminoDeHeadings(d, 4)).toEqual(["OTRA RAMA", "MATERIA"]);
  });

  it("sin headings arriba, el camino es vacío", () => {
    expect(caminoDeHeadings(doc("- [x] suelta"), 0)).toEqual([]);
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

  it("los niveles quedan consecutivos aunque el origen tenga huecos", () => {
    // En `tareas_COLE` un h4 cuelga directo de un h1: copiar los niveles
    // dejaría el LOG mal formado.
    const origen = doc("# INBOX\n#### MATERIA 1\n- [x] x");
    const camino = caminoDeHeadings(origen, 2);
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
    // El default sale del tamaño del bloque: p50 = 2 líneas, la mayoría son
    // hojas.
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
