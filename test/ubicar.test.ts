import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { CambioDeLinea } from "../src/documento.js";
import {
  aplicarLote,
  loteInverso,
  seEncontro,
  ubicarLinea,
  ubicarLote,
} from "../src/ubicar.js";
import { documento } from "./arbitrarios.js";

/**
 * Lo que este archivo prueba es una sola cosa, dicha de muchas maneras:
 * **ninguna escritura toca una línea cuyo texto no era el esperado.**
 *
 * Es el invariante 10, y es el riesgo que el paso 3 existe para matar. Los
 * casos de abajo cubren las cuatro respuestas posibles; las propiedades cubren
 * el caso que a nadie se le ocurrió.
 */

const L = (texto: string) => texto.split("\n");

describe("ubicarLinea — las cuatro respuestas", () => {
  const lineas = L("# nota\n\n- [ ] una\n- [ ] otra\n- [ ] una");

  it("la sugerida coincide: se escribe ahí", () => {
    expect(ubicarLinea(lineas, 3, "- [ ] otra")).toEqual({ estado: "ok", linea: 3 });
  });

  it("la sugerida coincide **aunque** el texto se repita en otro lado", () => {
    // Buscar es el camino de excepción. Si la línea que se planeó sigue
    // diciendo lo que se esperaba, la duplicación de más abajo no importa.
    expect(ubicarLinea(lineas, 2, "- [ ] una")).toEqual({ estado: "ok", linea: 2 });
    expect(ubicarLinea(lineas, 4, "- [ ] una")).toEqual({ estado: "ok", linea: 4 });
  });

  it("la sugerida no coincide y el texto es único: se corrió", () => {
    expect(ubicarLinea(lineas, 0, "- [ ] otra")).toEqual({
      estado: "movida",
      linea: 3,
      sugerida: 0,
    });
  });

  it("el texto no está: no se escribe", () => {
    expect(ubicarLinea(lineas, 3, "- [ ] tercera")).toEqual({ estado: "ausente" });
  });

  it("el texto está dos veces y la sugerida no coincide: no se adivina", () => {
    expect(ubicarLinea(lineas, 0, "- [ ] una")).toEqual({ estado: "ambigua", lineas: [2, 4] });
  });

  it("una sugerida fuera del documento no es un error: se busca", () => {
    // Pasa siempre que el archivo se acortó desde que se armó el plan.
    expect(ubicarLinea(lineas, 99, "- [ ] otra")).toEqual({
      estado: "movida",
      linea: 3,
      sugerida: 99,
    });
    expect(ubicarLinea(lineas, -1, "- [ ] otra")).toMatchObject({ estado: "movida", linea: 3 });
  });

  it("una línea en blanco corrida queda ambigua, y está bien que así sea", () => {
    // No hay forma de saber cuál de treinta líneas vacías era. Por eso ningún
    // plan de `acciones.ts` produce cambios sobre líneas en blanco.
    const conBlancos = L("a\n\nb\n\nc");
    expect(ubicarLinea(conBlancos, 0, "")).toEqual({ estado: "ambigua", lineas: [1, 3] });
  });

  it("con una sola línea en blanco, se ubica igual", () => {
    expect(ubicarLinea(L("a\n\nb"), 0, "")).toMatchObject({ estado: "movida", linea: 1 });
  });
});

describe("ubicarLote — todo o nada", () => {
  const texto = "# nota\n- [ ] una\n- [ ] otra\n\t- [ ] hija";

  it("todas ubicadas: se aplican todas", () => {
    const { texto: despues, resultado } = aplicarLote(texto, [
      { linea: 1, antes: "- [ ] una", despues: "- [x] una" },
      { linea: 3, antes: "\t- [ ] hija", despues: "\t- [x] hija" },
    ]);
    expect(resultado.estado).toBe("ok");
    expect(despues).toBe("# nota\n- [x] una\n- [ ] otra\n\t- [x] hija");
  });

  it("una sola no ubicada y no se escribe ninguna", () => {
    const { texto: despues, resultado } = aplicarLote(texto, [
      { linea: 1, antes: "- [ ] una", despues: "- [x] una" },
      { linea: 2, antes: "- [ ] la que alguien borró", despues: "- [x] ídem" },
    ]);
    expect(resultado.estado).toBe("no-ubicada");
    expect(despues).toBe(texto);
  });

  it("el aviso dice **cuáles** fallaron, no solo que falló", () => {
    const r = ubicarLote(L(texto), [
      { linea: 1, antes: "- [ ] una", despues: "x" },
      { linea: 9, antes: "- [ ] fantasma", despues: "x" },
      { linea: 9, antes: "- [ ] otro fantasma", despues: "x" },
    ]);
    expect(r.estado).toBe("no-ubicada");
    if (r.estado !== "no-ubicada") throw new Error("imposible");
    expect(r.fallas.map((f) => f.cambio.antes)).toEqual([
      "- [ ] fantasma",
      "- [ ] otro fantasma",
    ]);
  });

  it("dos cambios que caen en la misma línea: colisión, y no se escribe nada", () => {
    // Dos tareas de texto idéntico que se corrieron: ninguna de las dos se
    // puede atribuir, y elegir una es exactamente lo que no se hace.
    const dup = "- [ ] igual\n- [ ] igual";
    const r = aplicarLote(dup, [
      { linea: 5, antes: "- [ ] igual", despues: "- [x] igual" },
      { linea: 6, antes: "- [ ] igual", despues: "- [x] igual" },
    ]);
    // Las dos dan ambigua antes de llegar a la colisión, que es lo mismo de
    // fondo: no se escribe.
    expect(r.resultado.estado).toBe("no-ubicada");
    expect(r.texto).toBe(dup);
  });

  it("la colisión se detecta cuando una es exacta y la otra se buscó", () => {
    const r = ubicarLote(L("- [ ] a\n- [ ] b"), [
      { linea: 0, antes: "- [ ] a", despues: "1" },
      { linea: 7, antes: "- [ ] a", despues: "2" },
    ]);
    expect(r).toMatchObject({ estado: "colisión", linea: 0 });
  });

  it("un lote vacío devuelve el mismo texto sin partirlo", () => {
    const raro = "sin salto final\r\ncon CRLF   ";
    expect(aplicarLote(raro, []).texto).toBe(raro);
  });

  it("cuenta cuántas hubo que buscar", () => {
    const r = ubicarLote(L(texto), [
      { linea: 1, antes: "- [ ] una", despues: "x" },
      { linea: 99, antes: "- [ ] otra", despues: "y" },
    ]);
    expect(r).toMatchObject({ estado: "ok", movidas: 1 });
  });
});

// --------------------------------------------------------------- propiedades

/** Corridas por propiedad. Son microsegundos cada una. */
const corridas = { numRuns: 500 };

/** Un documento y unos cuantos índices de línea distintos de adentro. */
const docConLineas = documento.chain((texto) => {
  const n = texto.split("\n").length;
  return fc
    .uniqueArray(fc.nat({ max: n - 1 }), { minLength: 1, maxLength: Math.min(5, n) })
    .map((indices) => ({ texto, indices }));
});

/** El lote que marca esas líneas, con un sufijo que garantiza que cambian. */
function loteDe(texto: string, indices: readonly number[]): CambioDeLinea[] {
  const lineas = texto.split("\n");
  return indices.map((i) => ({ linea: i, antes: lineas[i]!, despues: `${lineas[i]} ✎` }));
}

describe("invariante 10 — nada se escribe sin verificar qué había", () => {
  it("si la sugerida coincide, se escribe ahí, haya duplicados donde haya", () => {
    fc.assert(
      fc.property(docConLineas, ({ texto, indices }) => {
        const lineas = texto.split("\n");
        for (const i of indices) {
          expect(ubicarLinea(lineas, i, lineas[i]!)).toEqual({ estado: "ok", linea: i });
        }
      }),
      corridas,
    );
  });

  it("correr el archivo k líneas hacia abajo mueve la ubicación k líneas", () => {
    fc.assert(
      fc.property(docConLineas, fc.nat({ max: 8 }), ({ texto, indices }, k) => {
        const lineas = texto.split("\n");
        // El relleno no puede coincidir con ninguna línea del documento, o
        // crearía duplicados y la ubicación pasaría a ser ambigua con razón.
        const relleno = Array.from({ length: k }, (_, j) => `«relleno ${j}»`);
        const corrido = [...relleno, ...lineas];

        for (const i of indices) {
          // Solo tiene sentido para líneas únicas: con una repetida, no saber
          // cuál era es la respuesta correcta, no una falla.
          if (lineas.filter((l) => l === lineas[i]).length !== 1) continue;
          const u = ubicarLinea(corrido, i, lineas[i]!);
          expect(seEncontro(u) && u.linea, `línea ${i}, k=${k}`).toBe(i + k);
        }
      }),
      corridas,
    );
  });

  it("aplicar un lote cambia exactamente las líneas ubicadas y ninguna otra", () => {
    fc.assert(
      fc.property(docConLineas, ({ texto, indices }) => {
        const cambios = loteDe(texto, indices);
        const { texto: despues, resultado } = aplicarLote(texto, cambios);
        expect(resultado.estado).toBe("ok");
        if (resultado.estado !== "ok") return;

        const antes = texto.split("\n");
        const ahora = despues.split("\n");
        expect(ahora.length).toBe(antes.length);

        const tocadas = new Map(
          resultado.ubicados.map((u) => [u.ubicacion.linea, u.cambio.despues]),
        );
        for (let i = 0; i < antes.length; i++) {
          expect(ahora[i], `línea ${i}`).toBe(tocadas.has(i) ? tocadas.get(i) : antes[i]);
        }
      }),
      corridas,
    );
  });

  it("aplicar el lote y su inverso devuelve el archivo byte por byte", () => {
    fc.assert(
      fc.property(docConLineas, ({ texto, indices }) => {
        const ida = aplicarLote(texto, loteDe(texto, indices));
        expect(ida.resultado.estado).toBe("ok");
        const vuelta = aplicarLote(ida.texto, loteInverso(ida.resultado));
        expect(vuelta.resultado.estado).toBe("ok");
        expect(vuelta.texto).toBe(texto);
      }),
      corridas,
    );
  });

  it("un solo cambio no ubicable deja el archivo intacto, sin importar cuántos otros iban", () => {
    fc.assert(
      fc.property(docConLineas, fc.nat({ max: 20 }), ({ texto, indices }, donde) => {
        const validos = loteDe(texto, indices);
        const roto: CambioDeLinea = {
          linea: donde,
          antes: "«línea que este documento no tiene»",
          despues: "no debería escribirse jamás",
        };
        const cambios = [...validos];
        cambios.splice(Math.min(donde, cambios.length), 0, roto);

        const { texto: despues, resultado } = aplicarLote(texto, cambios);
        expect(resultado.estado).toBe("no-ubicada");
        expect(despues).toBe(texto);
      }),
      corridas,
    );
  });

  it("un lote vacío no toca un byte, sea cual sea el archivo", () => {
    fc.assert(
      fc.property(documento, (texto) => {
        expect(aplicarLote(texto, []).texto).toBe(texto);
      }),
      corridas,
    );
  });
});
