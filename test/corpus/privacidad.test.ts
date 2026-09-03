import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { notasReales, VAULT } from "./vault.js";

/**
 * **El repositorio es público**, y en `src/` y `test/` no puede entrar contenido
 * real de las notas (CLAUDE.md, regla dura). Esto lo comprueba contra las notas
 * de verdad, que **no están en el repositorio** y por eso el test vive acá.
 *
 * Nació de un hallazgo: al preparar el commit del paso 6b apareció el nombre
 * real del colegio como fixture de heading en dos archivos de test, 12 veces,
 * desde la sesión 4 y ya pusheado. Ningún test lo miraba porque el único lugar
 * donde está la lista de lo que es «real» es el vault.
 *
 * ## Qué mira, y qué deja pasar a propósito
 *
 * Solo **títulos de heading de varias palabras**. Una palabra suelta se deja
 * pasar y no es pereza: `WORKBENCH`, `CLAUDE`, `CÍCLICAS` y `ACADEMIA` son a la
 * vez headings de sus notas y **vocabulario del plugin o nombres de archivo que
 * `notas-de-tareas.json` ya publica**, así que marcarlos sería 26 alarmas falsas
 * por corrida — y una alarma falsa que se repite es una alarma que se ignora.
 * Lo que delata contenido copiado es una frase, no un sustantivo.
 *
 * ## El límite, dicho en vez de tapado
 *
 * **Solo ve los headings que existen hoy.** Una fixture copiada en agosto deja
 * de detectarse cuando esa sección de la nota cambia — pasó con un rótulo de
 * semana que estaba en `archivado.ts` y que ya no era un heading vigente cuando
 * esto se escribió, así que este test **no lo habría encontrado**. Sirve contra
 * el copiado fresco, que es el camino por el que entró el del colegio.
 *
 * Y la primera corrida lo demostró mejor que cualquier prueba sintética:
 * **falló contra este mismo archivo**, porque el comentario de arriba citaba
 * ese rótulo textualmente.
 */
describe.skipIf(!VAULT)("nada del vault entra al repositorio", () => {
  /** Los títulos de heading de varias palabras que hay hoy en las notas. */
  const titulosReales = (): string[] => {
    const salida = new Set<string>();
    for (const { raw } of notasReales()) {
      for (const l of raw.split("\n")) {
        const m = /^#{1,6}\s+(.+?)\s*$/.exec(l);
        if (!m) continue;
        const t = m[1]!
          .replace(/\[\[([^\]|]+)(\|[^\]]*)?\]\]/g, "$1") // wikilink → destino
          .replace(/:[A-Za-z]\w+:/g, "") // etiquetas de icono
          .replace(/[⮕|].*$/, "") // lo que va después del separador
          .trim();
        if (t.length >= 8 && /\s/.test(t)) salida.add(t);
      }
    }
    return [...salida];
  };

  const archivosDelRepo = (): { ruta: string; texto: string }[] => {
    const salida: { ruta: string; texto: string }[] = [];
    const recorrer = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) recorrer(p);
        else if (/\.(ts|js|mjs)$/.test(e.name)) salida.push({ ruta: p, texto: readFileSync(p, "utf8") });
      }
    };
    recorrer("src");
    recorrer("test");
    return salida;
  };

  /**
   * **Que el detector pueda encontrar algo, antes de creerle que no encontró
   * nada.** Es la lección de la sonda de la sesión 6 y de la comprobación de la
   * consola, que lleva seis vueltas informando cero: un verde tiene que
   * significar «busqué y no hay», no «no busqué».
   */
  it("el detector encuentra una frase que sí está en el repositorio", () => {
    const archivos = archivosDelRepo();
    const testigo = "el repositorio es público";
    const golpes = archivos.filter((a) => a.texto.toLowerCase().includes(testigo));
    expect(golpes.length, "el testigo tiene que aparecer en algún archivo").toBeGreaterThan(0);
  });

  it("ningún título de heading real aparece en src/ ni en test/", () => {
    const titulos = titulosReales();
    const archivos = archivosDelRepo();
    console.log(
      `  ${titulos.length} títulos de varias palabras en las notas de hoy · ` +
        `${archivos.length} archivos del repositorio revisados`,
    );

    const golpes: string[] = [];
    for (const t of titulos) {
      for (const a of archivos) {
        // El nombre del título **no** se imprime: este mensaje va a la consola
        // de alguien y el punto es justamente no publicarlo.
        if (a.texto.includes(t)) golpes.push(`${a.ruta} (${t.length} caracteres)`);
      }
    }
    expect(golpes, `contenido real de las notas en: ${golpes.join(", ")}`).toEqual([]);
  });
});
