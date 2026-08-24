import { describe, expect, it } from "vitest";
import { parseDocumento, renderDocumento } from "../src/documento.js";
import {
  aplicarReinicio,
  gruposDeReinicio,
  indexar,
  planDeReinicio,
  tareasDelGrupo,
} from "../src/tareas.js";

const doc = (raw: string) => parseDocumento(raw);
const reiniciar = (raw: string, grupo: string) => {
  const d = doc(raw);
  const plan = planDeReinicio(d, indexar(d, "n.md"), grupo);
  return { plan, texto: renderDocumento(aplicarReinicio(d, plan)) };
};

/**
 * El reinicio por grupo reemplaza al modelo regenerativo de la §11.
 *
 * El plugin no crea instancias, no clona hijos y no corre fechas: el usuario
 * aprieta un botón y las tareas de ese grupo vuelven a pendiente. Es lo que
 * hace que la §11 deje de chocar con la §8, donde un reinicio por calendario
 * haría que todos los dispositivos reescribieran lo mismo a la vez.
 */
describe("planDeReinicio", () => {
  it("destilda y borra el done de las tareas del grupo", () => {
    const { texto } = reiniciar(
      "- [x] sacar la basura %%t:rec=lunes;done=2026-08-24%%\n" +
        "- [x] regar las plantas %%t:rec=lunes;done=2026-08-24%%",
      "lunes",
    );
    expect(texto).toBe(
      "- [ ] sacar la basura %%t:rec=lunes%%\n- [ ] regar las plantas %%t:rec=lunes%%",
    );
  });

  it("no toca las tareas de otro grupo", () => {
    const raw =
      "- [x] semanal %%t:rec=lunes;done=2026-08-24%%\n- [x] mensual %%t:rec=mensual;done=2026-08-01%%";
    const { texto } = reiniciar(raw, "lunes");
    expect(texto.split("\n")[1]).toBe("- [x] mensual %%t:rec=mensual;done=2026-08-01%%");
  });

  it("NO toca las tareas sin etiqueta, aunque estén al lado", () => {
    // Es la parte crítica. En `tareas_MES` el registro por mes son hijos sin
    // etiqueta; barrer la nota entera los volvería tareas pendientes y
    // perdería el dato de cada mes.
    const raw =
      "- [ ] transferir a la cuenta %%t:rec=mensual%%\n" +
      "\t- [x] junio: 205.111\n" +
      "\t- [x] mayo: 198.000\n" +
      "\t- [ ] agosto:";
    const { plan, texto } = reiniciar(raw, "mensual");
    expect(plan).toEqual([]);
    expect(texto).toBe(raw);
  });

  it("una tarea del grupo que ya está pendiente no entra en el plan", () => {
    // Contarla haría que la confirmación mintiera sobre cuántas va a tocar.
    const { plan } = reiniciar("- [ ] ya pendiente %%t:rec=lunes%%", "lunes");
    expect(plan).toEqual([]);
  });

  it("una pendiente con un done colgado sí se limpia", () => {
    const { texto } = reiniciar("- [ ] rara %%t:rec=lunes;done=2026-08-24%%", "lunes");
    expect(texto).toBe("- [ ] rara %%t:rec=lunes%%");
  });

  it("conserva el workbench y el vencimiento", () => {
    // La instancia reiniciada sigue en el workbench: sin eso hay que rearmarlo
    // cada lunes, que es la fricción que la §11 quiere eliminar.
    const { texto } = reiniciar(
      "- [x] pagar %%t:wb=foco,mes;due=10;rec=mensual;done=2026-08-09%%",
      "mensual",
    );
    expect(texto).toBe("- [ ] pagar %%t:wb=foco,mes;due=10;rec=mensual%%");
  });

  it("no toca una línea con token ilegible (invariante 7)", () => {
    const raw = "- [x] rota %%t:rec=lunes;zz=1%%";
    const d = doc(raw);
    // No parsea, así que no tiene grupo y el reinicio no la ve.
    expect(planDeReinicio(d, indexar(d, "n.md"), "lunes")).toEqual([]);
    expect(renderDocumento(d)).toBe(raw);
  });

  it("el plan dice qué línea y con qué texto, para poder confirmar antes", () => {
    const raw = "## h\n- [x] a %%t:rec=lunes;done=2026-08-24%%";
    const { plan } = reiniciar(raw, "lunes");
    expect(plan).toEqual([
      {
        linea: 1,
        antes: "- [x] a %%t:rec=lunes;done=2026-08-24%%",
        despues: "- [ ] a %%t:rec=lunes%%",
      },
    ]);
  });

  it("aplicar el plan no altera ninguna otra línea", () => {
    const raw =
      "# nota\n\ntexto libre\n- [x] a %%t:rec=lunes;done=2026-08-24%%\n\t- una nota verbatim\n- [ ] otra";
    const { texto } = reiniciar(raw, "lunes");
    const antes = raw.split("\n");
    const despues = texto.split("\n");
    expect(despues.length).toBe(antes.length);
    antes.forEach((l, i) => {
      if (i !== 3) expect(despues[i], `línea ${i}`).toBe(l);
    });
  });

  it("un grupo que no existe no cambia nada", () => {
    const raw = "- [x] a %%t:rec=lunes;done=2026-08-24%%";
    expect(reiniciar(raw, "martes").texto).toBe(raw);
  });
});

describe("grupos", () => {
  it("se descubren de lo escrito, sin panel de administración", () => {
    const raw =
      "- [ ] a %%t:rec=lunes%%\n- [ ] b %%t:rec=mensual%%\n- [ ] c %%t:rec=lunes%%\n- [ ] d";
    expect(gruposDeReinicio(indexar(doc(raw), "n.md"))).toEqual(["lunes", "mensual"]);
  });

  it("tareasDelGrupo trae las del grupo, completadas o no", () => {
    const raw = "- [x] a %%t:rec=lunes%%\n- [ ] b %%t:rec=lunes%%\n- [ ] c %%t:rec=mensual%%";
    expect(tareasDelGrupo(indexar(doc(raw), "n.md"), "lunes").map((t) => t.texto)).toEqual([
      "a",
      "b",
    ]);
  });
});
