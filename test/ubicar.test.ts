import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  arbolDe,
  eliminarLineas,
  lineasDelSubarbol,
  parseDocumento,
  rangoDelSubarbol,
  recorrer,
  renderDocumento,
  type CambioDeLote,
} from "../src/documento.js";
import {
  aplicarLote,
  loteInverso,
  seEncontro,
  ubicarBloque,
  ubicarLinea,
  ubicarLote,
} from "../src/ubicar.js";
import { documento } from "./arbitrarios.js";

/**
 * Lo que este archivo prueba es una sola cosa, dicha de muchas maneras:
 * **ninguna escritura toca un tramo cuyo texto no era el esperado.**
 *
 * Es el invariante 10, y es el riesgo que el paso 3 existe para matar. Desde el
 * paso 6a un lote puede además **cambiar la cantidad de líneas** —archivar
 * verifica el bloque entero, eliminar lo borra— y eso agrega una pregunta que
 * antes no existía: **si el resultado depende del orden en que vinieron los
 * cambios.** No depende, y esa es la propiedad titular de acá.
 */

const L = (texto: string) => texto.split("\n");

/** Un reemplazo de una línea. */
const R = (linea: number, antes: string, despues: string): CambioDeLote => ({
  tipo: "reemplazo",
  linea,
  antes,
  despues,
});

/** Un tramo de N líneas por M. Con `despues: []` es un borrado. */
const B = (linea: number, antes: string[], despues: string[]): CambioDeLote => ({
  tipo: "bloque",
  linea,
  antes,
  despues,
});

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

describe("ubicarBloque — la misma regla, estirada a un tramo", () => {
  const lineas = L("# nota\n- [ ] una\n\t- nota\n- [ ] otra\n- [ ] una\n\t- nota");

  it("el tramo coincide donde se esperaba", () => {
    expect(ubicarBloque(lineas, 1, ["- [ ] una", "\t- nota"])).toEqual({ estado: "ok", linea: 1 });
  });

  it("un tramo que se corrió se encuentra entero", () => {
    expect(ubicarBloque(lineas, 0, ["- [ ] otra"])).toMatchObject({ estado: "movida", linea: 3 });
  });

  it("un tramo repetido no se adivina", () => {
    expect(ubicarBloque(lineas, 0, ["- [ ] una", "\t- nota"])).toEqual({
      estado: "ambigua",
      lineas: [1, 4],
    });
  });

  it("un tramo que se sale del final no coincide, y se busca", () => {
    expect(ubicarBloque(lineas, 5, ["\t- nota", "de más"])).toEqual({ estado: "ausente" });
  });

  it("un `antes` vacío no se ubica nunca: sin ancla no hay nada que verificar", () => {
    // Es lo que deja la **inserción** afuera de este módulo por ahora.
    expect(ubicarBloque(lineas, 0, [])).toEqual({ estado: "ausente" });
  });
});

describe("ubicarLote — todo o nada", () => {
  const texto = "# nota\n- [ ] una\n- [ ] otra\n\t- [ ] hija";

  it("todas ubicadas: se aplican todas", () => {
    const { texto: despues, resultado } = aplicarLote(texto, [
      R(1, "- [ ] una", "- [x] una"),
      R(3, "\t- [ ] hija", "\t- [x] hija"),
    ]);
    expect(resultado.estado).toBe("ok");
    expect(despues).toBe("# nota\n- [x] una\n- [ ] otra\n\t- [x] hija");
  });

  it("una sola no ubicada y no se escribe ninguna", () => {
    const { texto: despues, resultado } = aplicarLote(texto, [
      R(1, "- [ ] una", "- [x] una"),
      R(2, "- [ ] la que alguien borró", "- [x] ídem"),
    ]);
    expect(resultado.estado).toBe("no-ubicada");
    expect(despues).toBe(texto);
  });

  it("el aviso dice **cuáles** fallaron, no solo que falló", () => {
    const r = ubicarLote(L(texto), [
      R(1, "- [ ] una", "x"),
      R(9, "- [ ] fantasma", "x"),
      R(9, "- [ ] otro fantasma", "x"),
    ]);
    expect(r.estado).toBe("no-ubicada");
    if (r.estado !== "no-ubicada") throw new Error("imposible");
    expect(
      r.fallas.map((f) => (f.cambio.tipo === "reemplazo" ? f.cambio.antes : f.cambio.antes[0])),
    ).toEqual(["- [ ] fantasma", "- [ ] otro fantasma"]);
  });

  it("dos cambios que caen en la misma línea: colisión, y no se escribe nada", () => {
    // Dos tareas de texto idéntico que se corrieron: ninguna de las dos se
    // puede atribuir, y elegir una es exactamente lo que no se hace.
    const dup = "- [ ] igual\n- [ ] igual";
    const r = aplicarLote(dup, [
      R(5, "- [ ] igual", "- [x] igual"),
      R(6, "- [ ] igual", "- [x] igual"),
    ]);
    // Las dos dan ambigua antes de llegar a la colisión, que es lo mismo de
    // fondo: no se escribe.
    expect(r.resultado.estado).toBe("no-ubicada");
    expect(r.texto).toBe(dup);
  });

  it("la colisión se detecta cuando una es exacta y la otra se buscó", () => {
    const r = ubicarLote(L("- [ ] a\n- [ ] b"), [R(0, "- [ ] a", "1"), R(7, "- [ ] a", "2")]);
    expect(r).toMatchObject({ estado: "colisión", linea: 0 });
  });

  it("un reemplazo adentro de un tramo que otro cambio borra: colisión", () => {
    // El caso nuevo del paso 6a. Sin esta regla, el resultado dependería de
    // cuál se aplicara primero, que es exactamente lo que no puede pasar.
    const r = ubicarLote(L(texto), [
      B(1, ["- [ ] una", "- [ ] otra"], []),
      R(2, "- [ ] otra", "- [x] otra"),
    ]);
    expect(r.estado).toBe("colisión");
  });

  it("dos tramos que se tocan pero no se pisan sí se aplican", () => {
    const { texto: despues, resultado } = aplicarLote(texto, [
      B(1, ["- [ ] una"], ["- [x] una"]),
      B(2, ["- [ ] otra", "\t- [ ] hija"], []),
    ]);
    expect(resultado.estado).toBe("ok");
    expect(despues).toBe("# nota\n- [x] una");
  });

  it("un lote vacío devuelve el mismo texto sin partirlo", () => {
    const raro = "sin salto final\r\ncon CRLF   ";
    expect(aplicarLote(raro, []).texto).toBe(raro);
  });

  it("cuenta cuántas hubo que buscar", () => {
    const r = ubicarLote(L(texto), [R(1, "- [ ] una", "x"), R(99, "- [ ] otra", "y")]);
    expect(r).toMatchObject({ estado: "ok", movidas: 1 });
  });
});

describe("borrar y verificar — las dos formas nuevas del bloque", () => {
  const texto = "# nota\n- [ ] madre\n\t- una nota\n\t- [ ] hija\n- [ ] otra";

  it("borrar un tramo se lleva el tramo y nada más", () => {
    const { texto: despues, resultado } = aplicarLote(texto, [
      B(1, ["- [ ] madre", "\t- una nota", "\t- [ ] hija"], []),
    ]);
    expect(resultado.estado).toBe("ok");
    expect(despues).toBe("# nota\n- [ ] otra");
  });

  it("un bloque con las dos caras iguales no cambia un byte", () => {
    const { texto: despues, resultado } = aplicarLote(texto, [
      B(2, ["\t- una nota"], ["\t- una nota"]),
    ]);
    expect(resultado.estado).toBe("ok");
    expect(despues).toBe(texto);
  });

  it("una verificación cuyo texto ya no está hace fallar el lote entero", () => {
    // Es lo que hace que archivar no copie al historial una nota que cambió.
    const { texto: despues, resultado } = aplicarLote(texto, [
      R(1, "- [ ] madre", "- [x] madre"),
      B(2, ["\t- la nota que decía otra cosa"], ["\t- la nota que decía otra cosa"]),
    ]);
    expect(resultado.estado).toBe("no-ubicada");
    expect(despues).toBe(texto);
  });

  it("un tramo se reemplaza por otro de distinto largo", () => {
    const { texto: despues } = aplicarLote(texto, [
      B(1, ["- [ ] madre", "\t- una nota"], ["- [x] madre"]),
    ]);
    expect(despues).toBe("# nota\n- [x] madre\n\t- [ ] hija\n- [ ] otra");
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

/** Lo mismo, más una forma por cambio y unas claves para permutar el lote. */
const docConLoteMixto = docConLineas.chain(({ texto, indices }) =>
  fc
    .tuple(
      fc.array(fc.integer({ min: 0, max: 3 }), {
        minLength: indices.length,
        maxLength: indices.length,
      }),
      fc.array(fc.nat({ max: 1000 }), {
        minLength: indices.length,
        maxLength: indices.length,
      }),
    )
    .map(([formas, claves]) => ({ texto, indices, formas, claves })),
);

/** El lote que marca esas líneas, con un sufijo que garantiza que cambian. */
function loteDe(texto: string, indices: readonly number[]): CambioDeLote[] {
  const lineas = texto.split("\n");
  return indices.map((i) => R(i, lineas[i]!, `${lineas[i]} ✎`));
}

/**
 * Un lote con las cuatro formas mezcladas y **rangos disjuntos**.
 *
 * Los rangos se reparten recorriendo los índices en orden y llevando cuál es la
 * primera línea todavía libre: solaparlos daría `colisión`, que es correcto
 * pero prueba otra cosa. Que el lote **se entregue** desordenado es el punto de
 * la propiedad de más abajo, y de eso se encarga `permutar`.
 */
function loteMixto(
  texto: string,
  indices: readonly number[],
  formas: readonly number[],
): CambioDeLote[] {
  const lineas = texto.split("\n");
  const salida: CambioDeLote[] = [];
  let libre = 0;
  [...new Set(indices)]
    .sort((a, b) => a - b)
    .forEach((i, k) => {
      if (i < libre) return;
      const forma = formas[k] ?? 0;
      const largo = Math.min(forma === 0 ? 1 : forma, lineas.length - i);
      if (largo < 1) return;
      const antes = lineas.slice(i, i + largo);
      libre = i + largo;
      if (forma === 0) salida.push(R(i, antes[0]!, `${antes[0]} ✎`));
      else if (forma === 1) salida.push(B(i, antes, [])); // borrar
      else if (forma === 2) salida.push(B(i, antes, antes)); // verificar
      else salida.push(B(i, antes, [`${antes[0]} ✎`])); // N por 1
    });
  return salida;
}

/**
 * Una permutación guiada por el generador.
 *
 * No es uniforme —los empates conservan el orden— y no hace falta que lo sea:
 * alcanza con que el lote llegue desordenado de muchas maneras distintas para
 * exponer cualquier dependencia del orden.
 */
function permutar<T>(xs: readonly T[], claves: readonly number[]): T[] {
  return xs
    .map((x, i) => ({ x, k: claves[i] ?? i }))
    .sort((a, b) => a.k - b.k)
    .map((p) => p.x);
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

  it("un bloque de una línea da exactamente lo mismo que `ubicarLinea`", () => {
    // Son la misma decisión y por eso una delega en la otra. Esta propiedad es
    // lo que impide que vuelvan a ser dos implementaciones.
    fc.assert(
      fc.property(docConLineas, fc.integer({ min: -3, max: 40 }), ({ texto, indices }, sugerida) => {
        const lineas = texto.split("\n");
        for (const i of indices) {
          expect(ubicarBloque(lineas, sugerida, [lineas[i]!])).toEqual(
            ubicarLinea(lineas, sugerida, lineas[i]!),
          );
        }
      }),
      corridas,
    );
  });

  it("un reemplazo y el bloque equivalente escriben lo mismo", () => {
    fc.assert(
      fc.property(docConLineas, ({ texto, indices }) => {
        const lineas = texto.split("\n");
        for (const i of indices) {
          const a = aplicarLote(texto, [R(i, lineas[i]!, "✎")]);
          const b = aplicarLote(texto, [B(i, [lineas[i]!], ["✎"])]);
          expect(b.texto).toBe(a.texto);
          expect(b.resultado.estado).toBe(a.resultado.estado);
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

  it("y también mueve k líneas la ubicación de un tramo", () => {
    fc.assert(
      fc.property(docConLineas, fc.nat({ max: 8 }), ({ texto, indices }, k) => {
        const lineas = texto.split("\n");
        const relleno = Array.from({ length: k }, (_, j) => `«relleno ${j}»`);
        const corrido = [...relleno, ...lineas];

        for (const i of indices) {
          const tramo = lineas.slice(i, i + 3);
          if (tramo.length === 0) continue;
          // Ídem: un tramo repetido no se puede atribuir, y no saberlo es la
          // respuesta correcta.
          let veces = 0;
          for (let j = 0; j + tramo.length <= lineas.length; j++) {
            if (tramo.every((t, o) => lineas[j + o] === t)) veces++;
          }
          if (veces !== 1) continue;
          const u = ubicarBloque(corrido, i, tramo);
          expect(seEncontro(u) && u.linea, `tramo en ${i}, k=${k}`).toBe(i + k);
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
          resultado.ubicados.map((u) => [
            u.ubicacion.linea,
            u.cambio.tipo === "reemplazo" ? u.cambio.despues : u.cambio.despues[0],
          ]),
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
        const roto = R(donde, "«línea que este documento no tiene»", "no debería escribirse jamás");
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

describe("un lote mixto no depende del orden en que vino", () => {
  it("cualquier permutación del lote da el mismo texto", () => {
    // La propiedad titular del paso 6a. Un lote que inserta o borra corre las
    // líneas de abajo, así que aplicar «uno y después el otro» tendría que
    // renumerar. El aplicador de una pasada evita el problema en vez de
    // resolverlo, y esto es lo que lo fija.
    fc.assert(
      fc.property(docConLoteMixto, ({ texto, indices, formas, claves }) => {
        const cambios = loteMixto(texto, indices, formas);
        const a = aplicarLote(texto, cambios);
        const b = aplicarLote(texto, permutar(cambios, claves));
        expect(b.texto).toBe(a.texto);
        expect(b.resultado.estado).toBe(a.resultado.estado);
      }),
      corridas,
    );
  });

  it("y el mismo diagnóstico cuando uno no se puede ubicar", () => {
    fc.assert(
      fc.property(docConLoteMixto, fc.nat({ max: 20 }), ({ texto, indices, formas, claves }, d) => {
        const cambios = [...loteMixto(texto, indices, formas)];
        cambios.splice(Math.min(d, cambios.length), 0, B(d, ["«tramo que no existe»"], []));

        const a = aplicarLote(texto, cambios);
        const b = aplicarLote(texto, permutar(cambios, claves));
        expect(a.resultado.estado).toBe("no-ubicada");
        expect(b.resultado.estado).toBe("no-ubicada");
        expect(a.texto).toBe(texto);
        expect(b.texto).toBe(texto);
      }),
      corridas,
    );
  });

  it("las líneas que ningún cambio reclama salen idénticas y en orden", () => {
    fc.assert(
      fc.property(docConLoteMixto, ({ texto, indices, formas }) => {
        const cambios = loteMixto(texto, indices, formas);
        const { texto: despues, resultado } = aplicarLote(texto, cambios);
        if (resultado.estado !== "ok") {
          expect(despues).toBe(texto);
          return;
        }

        const antes = texto.split("\n");
        const reclamadas = new Set<number>();
        for (const u of resultado.ubicados) {
          const largo = u.cambio.tipo === "reemplazo" ? 1 : u.cambio.antes.length;
          for (let j = 0; j < largo; j++) reclamadas.add(u.ubicacion.linea + j);
        }

        const libres = antes.filter((_, i) => !reclamadas.has(i));
        const ahora = despues.split("\n");
        // Cada línea libre sigue estando, en el mismo orden relativo.
        let i = 0;
        for (const l of libres) {
          const j = ahora.indexOf(l, i);
          expect(j, `se perdió ${JSON.stringify(l.slice(0, 30))}`).toBeGreaterThanOrEqual(0);
          i = j + 1;
        }
      }),
      corridas,
    );
  });

  it("un lote de puras verificaciones no cambia un byte", () => {
    fc.assert(
      fc.property(docConLineas, ({ texto, indices }) => {
        const lineas = texto.split("\n");
        const cambios = [...new Set(indices)]
          .sort((a, b) => a - b)
          .map((i) => B(i, [lineas[i]!], [lineas[i]!]));
        const { texto: despues, resultado } = aplicarLote(texto, cambios);
        if (resultado.estado !== "ok") return; // líneas repetidas: negarse es correcto
        expect(despues).toBe(texto);
      }),
      corridas,
    );
  });
});

describe("borrar un subárbol: dos implementaciones que se controlan", () => {
  it("`aplicarLote` y `eliminarLineas` dan el mismo archivo", () => {
    // `documento.ts` sabe borrar en memoria y `ubicar.ts` sabe borrar en disco.
    // Que coincidan no es redundancia: es lo que impide que el descarte físico
    // de la §12 haga en el vault algo distinto de lo que los tests miran.
    fc.assert(
      fc.property(documento, (texto) => {
        const doc = parseDocumento(texto);
        for (const nodo of recorrer(arbolDe(doc))) {
          const { desde, hasta } = rangoDelSubarbol(nodo);
          const antes = lineasDelSubarbol(doc, nodo);
          const { texto: porLote, resultado } = aplicarLote(texto, [B(desde, antes, [])]);
          if (resultado.estado !== "ok") continue; // subárbol repetido: no se borra
          expect(porLote).toBe(renderDocumento(eliminarLineas(doc, desde, hasta)));
        }
      }),
      { numRuns: 200 },
    );
  });
});

/**
 * El reinicio de un grupo toca N notas, y cada una recibe su propio lote.
 *
 * Lo que Obsidian aporta es la **secuencia** —paso en seco sobre las N antes de
 * escribir en ninguna, que es lo que devuelve la regla «o todas o ninguna» de
 * la §8— y eso vive en `escribirEnVarias` y se verifica en vivo: el paquete
 * `obsidian` es solo tipos, así que la capa 2 no se puede importar offline.
 *
 * Lo que sí se prueba acá es lo que decide el resultado de cada nota: que el
 * lote de una nota se aplique entero o no se aplique, y que **una nota que se
 * niega no cambie un byte**. Si eso vale por nota, la secuencia solo tiene que
 * ordenar; si no valiera, ninguna secuencia lo arreglaría.
 */
describe("un lote por nota, sobre varias notas (§11, el reinicio)", () => {
  const R = (linea: number, antes: string, despues: string): CambioDeLote => ({
    tipo: "reemplazo",
    linea,
    antes,
    despues,
  });

  it("cada nota se resuelve contra su propio texto", () => {
    const notas = [
      { texto: "- [x] uno %%t:rec=lunes;done=2026-08-24%%", cambios: [R(0, "- [x] uno %%t:rec=lunes;done=2026-08-24%%", "- [ ] uno %%t:rec=lunes%%")] },
      { texto: "# h\n- [x] dos %%t:rec=lunes;done=2026-08-24%%", cambios: [R(1, "- [x] dos %%t:rec=lunes;done=2026-08-24%%", "- [ ] dos %%t:rec=lunes%%")] },
    ];
    const salida = notas.map((n) => aplicarLote(n.texto, n.cambios));
    expect(salida.every((s) => s.resultado.estado === "ok")).toBe(true);
    expect(salida[0]!.texto).toBe("- [ ] uno %%t:rec=lunes%%");
    expect(salida[1]!.texto).toBe("# h\n- [ ] dos %%t:rec=lunes%%");
  });

  it("la nota que no se puede ubicar no cambia un byte, y las otras tampoco dependen de ella", () => {
    // Es la mitad de la garantía que se prueba offline. La otra mitad —que
    // tampoco se escriba en las que **sí** se podían— es la secuencia, y esa la
    // hace `escribirEnVarias` con el paso en seco sobre todas.
    const buena = "- [x] uno %%t:rec=lunes;done=2026-08-24%%";
    const repetida = "- [x] dos %%t:rec=lunes%%\n- [x] dos %%t:rec=lunes%%";
    const a = aplicarLote(buena, [R(0, buena, "- [ ] uno %%t:rec=lunes%%")]);
    const b = aplicarLote(repetida, [R(5, "- [x] dos %%t:rec=lunes%%", "- [ ] dos %%t:rec=lunes%%")]);
    expect(a.resultado.estado).toBe("ok");
    expect(b.resultado.estado).toBe("no-ubicada");
    // Y el motivo es el que importa: aparece dos veces, no que falte.
    if (b.resultado.estado === "no-ubicada") {
      expect(b.resultado.fallas[0]!.ubicacion.estado).toBe("ambigua");
    }
    expect(b.texto).toBe(repetida);
  });

  it("con el índice atrasado, un lote de varias líneas se niega entero", () => {
    // El reinicio de un grupo son N líneas de una nota. Si una se corrió y su
    // texto aparece dos veces, no se escribe ninguna de las N.
    const texto = "- [x] a %%t:rec=lunes%%\n- [x] b %%t:rec=lunes%%\n- [x] b %%t:rec=lunes%%";
    const r = aplicarLote(texto, [
      R(0, "- [x] a %%t:rec=lunes%%", "- [ ] a %%t:rec=lunes%%"),
      R(9, "- [x] b %%t:rec=lunes%%", "- [ ] b %%t:rec=lunes%%"),
    ]);
    expect(r.resultado.estado).toBe("no-ubicada");
    expect(r.texto).toBe(texto);
  });
});
