import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  inicioDelTramo,
  parsea,
  sinTokens,
  tramoDe,
  visibleDe,
} from "../src/hiddenTail.js";
import { parseTaskToken, stripTaskToken } from "../src/token.js";
import { documento, tokenRoto, tokenValido, textoLibre } from "./arbitrarios.js";

const lineasDe = (doc: string) => doc.split("\n");

describe("dónde empieza el tramo oculto", () => {
  it("una tarea con token: el tramo arranca donde termina el texto", () => {
    const l = "- [ ] llamar a la escuela %%t:id=a3f2;p=2%%";
    expect(inicioDelTramo(l)).toBe("- [ ] llamar a la escuela".length);
    expect(visibleDe(l)).toBe("- [ ] llamar a la escuela");
    expect(tramoDe(l)).toBe(" %%t:id=a3f2;p=2%%");
  });

  it("el tramo se lleva el espacio separador, no lo deja colgando", () => {
    expect(tramoDe("- [ ] x %%t:id=a3f2%%").startsWith(" ")).toBe(true);
  });

  /**
   * El tramo se lleva **un** espacio, el separador que escribe el plugin, y no
   * todos los que haya.
   *
   * La primera versión se los llevaba todos, y eso tenía una consecuencia que
   * solo se ve usándolo: al escribir un espacio al final de una tarea, el
   * espacio nuevo caía adentro del tramo y desaparecía. Se apretaba la barra y
   * no pasaba nada. Es la falla B6 de la verificación de la sesión 4.
   */
  it("se lleva un solo espacio: los que el usuario escriba se ven", () => {
    expect(visibleDe("- [ ] x %%t:id=a3f2%%")).toBe("- [ ] x");
    expect(visibleDe("- [ ] x  %%t:id=a3f2%%")).toBe("- [ ] x ");
    expect(visibleDe("- [ ] x   %%t:id=a3f2%%")).toBe("- [ ] x  ");
    // Sin espacio separador tampoco se come nada del texto.
    expect(visibleDe("- [ ] x%%t:id=a3f2%%")).toBe("- [ ] x");
  });

  it("espacios después del token: el tramo llega hasta el final de la línea", () => {
    const l = "- [ ] x %%t:id=a3f2%%   ";
    expect(visibleDe(l)).toBe("- [ ] x");
    expect(tramoDe(l)).toBe(" %%t:id=a3f2%%   ");
  });

  it("sin token no hay tramo", () => {
    for (const l of ["- [ ] pelada", "", "## heading", "\t- nota de tarea"]) {
      expect(inicioDelTramo(l)).toBe(l.length);
      expect(tramoDe(l)).toBe("");
      expect(visibleDe(l)).toBe(l);
    }
  });

  // La razón está en el invariante 7: un token roto se ve, y está bien que se
  // vea. Ocultarlo lo volvería imposible de arreglar.
  it("un token que no parsea NO es tramo oculto", () => {
    fc.assert(
      fc.property(textoLibre, tokenRoto, (t, roto) => {
        const l = `- [ ] ${t} ${roto}`;
        expect(inicioDelTramo(l)).toBe(l.length);
        expect(tramoDe(l)).toBe("");
      }),
    );
  });
});

describe("propiedades del tramo", () => {
  it("visible + tramo devuelve la línea, byte por byte", () => {
    fc.assert(
      fc.property(documento, (doc) => {
        for (const l of lineasDe(doc)) expect(visibleDe(l) + tramoDe(l)).toBe(l);
      }),
    );
  });

  it("hay tramo exactamente cuando el token parsea", () => {
    fc.assert(
      fc.property(documento, (doc) => {
        for (const l of lineasDe(doc)) {
          const hayTramo = inicioDelTramo(l) < l.length;
          expect(hayTramo).toBe(parseTaskToken(l).estado === "ok" && tramoDe(l) !== "");
        }
      }),
    );
  });

  // Los dos módulos calculan «la línea sin su token» y tienen que coincidir:
  // si divergen, la decoración esconde un tramo distinto del que la escritura
  // reemplaza, y el token queda duplicado o partido.
  it("el visible coincide con lo que `stripTaskToken` deja", () => {
    fc.assert(
      fc.property(documento, (doc) => {
        for (const l of lineasDe(doc)) {
          if (parseTaskToken(l).estado !== "ok") continue;
          // `trimEnd` porque los dos recortan distinto a propósito: al escribir
          // se normaliza a un espacio, y al esconder se deja ver lo que el
          // usuario haya tecleado de más.
          expect(visibleDe(l).trimEnd()).toBe(stripTaskToken(l));
        }
      }),
    );
  });
});

describe("limpiar tokens sueltos", () => {
  it("se lleva el token esté donde esté, no solo al final", () => {
    expect(sinTokens("- [ ] a %%t:id=a3f2%% y algo más")).toBe("- [ ] a y algo más");
  });

  it("se lleva los dos cuando quedaron dos", () => {
    expect(sinTokens("- [ ] a %%t:id=a3f2%% %%t:id=b4g3%%")).toBe("- [ ] a");
  });

  // El recorte se lleva el espacio que precede al token, y `-` pelado ya no es
  // un ítem de lista para nadie.
  it("no deja el marcador de lista pelado", () => {
    expect(sinTokens("- %%t:id=a3f2%%")).toBe("- ");
    expect(sinTokens("\t\t1. %%t:id=a3f2%%")).toBe("\t\t1. ");
  });

  // El síntoma aparece una tecla después del gesto: `- [ ]` sin su espacio
  // sigue siendo un checkbox al final de línea, pero apenas se escribe una
  // letra queda `- [ ]texto`, que no es una tarea para nadie.
  it("no le come el espacio al checkbox de una tarea vacía", () => {
    expect(sinTokens("- [ ] %%t:id=a3f2%%")).toBe("- [ ] ");
    expect(sinTokens("- [ ]  %%t:id=a3f2%%")).toBe("- [ ] ");
    expect(sinTokens("\t- [x] %%t:id=a3f2%%")).toBe("\t- [x] ");
  });

  it("no toca un ítem que sí tiene contenido", () => {
    expect(sinTokens("- [ ] algo %%t:id=a3f2%%")).toBe("- [ ] algo");
    expect(sinTokens("- [ ] algo")).toBe("- [ ] algo");
    expect(sinTokens("- [ ] algo   ")).toBe("- [ ] algo   ");
  });

  it("no inventa el cierre que falta: un `%%t:` sin `%%` queda donde está", () => {
    expect(sinTokens("- [ ] a %%t:id=a3f2")).toBe("- [ ] a %%t:id=a3f2");
    expect(parsea("- [ ] a %%t:id=a3f2")).toBe(false);
  });

  it("es idempotente", () => {
    fc.assert(
      fc.property(documento, (doc) => {
        for (const l of lineasDe(doc)) expect(sinTokens(sinTokens(l))).toBe(sinTokens(l));
      }),
    );
  });

  it("sobre una línea que parsea deja el mismo texto visible", () => {
    fc.assert(
      fc.property(documento, (doc) => {
        for (const l of lineasDe(doc)) {
          if (parseTaskToken(l).estado !== "ok") continue;
          expect(sinTokens(l).trimEnd()).toBe(visibleDe(l).trimEnd());
        }
      }),
    );
  });

  // Es la garantía que usa el filtro para poder devolver el tramo al final de
  // una línea unida sin dejarla con dos tokens.
  it("limpiar y volver a pegar el tramo da una línea que parsea", () => {
    fc.assert(
      fc.property(textoLibre, textoLibre, tokenValido, tokenValido, (a, b, ta, tb) => {
        if (!ta.token || !tb.token) return;
        const unida = `- [ ] ${a} ${ta.token}- [ ] ${b} ${tb.token}`;
        const arreglada = `${sinTokens(unida)} ${ta.token}`;
        expect(parsea(arreglada)).toBe(true);
        expect(parseTaskToken(arreglada).estado).toBe("ok");
      }),
    );
  });
});
