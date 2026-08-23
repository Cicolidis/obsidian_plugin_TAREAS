import { describe, expect, it } from "vitest";
import { parseDocumento, renderDocumento } from "../../src/documento.js";
import { notasReales, VAULT } from "./vault.js";

/**
 * El invariante 9 sobre las siete notas de verdad.
 *
 * La spec lo llama «la prueba diferencial más barata y la que más bugs de
 * reescritura atrapa», y es cierto: cinco de las siete notas no terminan en
 * salto de línea y veinte líneas tienen espacios al final. Cualquier
 * normalización de paso aparece acá y en ningún otro lado.
 */
describe.skipIf(!VAULT)("invariante 9 sobre el corpus real", () => {
  const notas = notasReales();

  it("encuentra las siete notas", () => {
    expect(notas.map((n) => n.rel)).toHaveLength(7);
  });

  it.each(notas.map((n) => [n.rel, n.raw] as const))(
    "%s: parsear y volver a escribir no altera un byte",
    (_rel, raw) => {
      expect(renderDocumento(parseDocumento(raw))).toBe(raw);
    },
  );

  it("y tampoco altera la longitud en bytes", () => {
    // Redundante a propósito: una comparación de strings que pase por una
    // normalización Unicode podría dar igual y no serlo. `tareas_CÍCLICAS`
    // lleva acento en el nombre y el contenido tiene acentos por todos lados.
    for (const { rel, raw } of notas) {
      const vuelta = renderDocumento(parseDocumento(raw));
      expect(Buffer.byteLength(vuelta), rel).toBe(Buffer.byteLength(raw));
    }
  });
});
