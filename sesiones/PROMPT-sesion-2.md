# Prompt para la sesión 2 en Claude Code

> Abrir Claude Code en `~/Downloads/claude/obsidian_plugin_TAREAS`, entrar en
> **plan mode** y pegar lo de abajo.

---

Seguimos con el plugin de tareas de Obsidian. La especificación completa está en
`plugin-tareas-spec.md`, en la raíz de este repo. **Leela entera antes de
proponer nada.** El método de trabajo está en `CLAUDE.md` y no lo repito acá.

## Dónde estamos

La sesión 1 hizo el andamiaje y cerró el **paso 1 de la §20**: el prototipo del
`transactionFilter` del checkbox automático, verificado en escritorio y en el
teléfono. Está en `src/editor/autoCheckbox.ts` y **no hay que tocarlo**.

Lo que esa sesión dejó establecido y no hace falta volver a descubrir —está en
los comentarios del código y en los mensajes de commit; `git log` es corto y
vale leerlo—:

- Obsidian y Outliner **ya continúan el checkbox** desde una línea de tarea. El
  delta que agrega el plugin es `- 1A` → `- [ ] `.
- Outliner despacha **dos** transacciones, la del texto y la de la selección.
- Un filtro que reescribe una transacción tiene que **conservar el `userEvent`**:
  CodeMirror discrimina por el subtipo.
- **Un instrumento de medición sin verificar mide el instrumento.** El espía de
  transacciones tiraba excepción dentro del `dispatch` y eso fabricó un
  comportamiento que no existía. Está corregido en `scripts/espia.js`.

Ya existe capa 1 chica y probada: `src/linea.ts` (gramática del bullet),
`src/notas.ts` (qué notas mira el plugin) y `src/settingsData.ts` (configuración
con parseo tolerante). 100 tests en verde.

El repo está publicado en GitHub y se instala en el teléfono por BRAT.
**El repositorio es público**: nada de lo que se agregue puede llevar contenido
real de mis notas.

## Alcance de esta sesión: la capa 1, sin recurrencia ni archivado

Es el **paso 2 de la §20**, partido. Van tres cosas:

1. **El parser de las cuatro clases de línea** (§4). Extender `src/linea.ts` con
   headings, y un `src/documento.ts` que modele la nota **entera y sin pérdida**.
   El índice de tareas se deriva del documento, no al revés: un parser que solo
   extraiga tareas no puede reescribir el archivo, y la §8 exige escribir por
   rango.

   Ojo con esto, que lo medí y es contraintuitivo: **los headings semánticos de
   hoy están en texto plano** (`#### MINT 6 ⮕ p_6_Sheets`, `#### p_PKM`), casi
   no hay wikilinks. Obsidian, consultado por su propio índice, informa 3
   enlaces en `tareas_COLE.md` y ninguno es un proyecto. La §4.1 pide wikilink y
   la §19.1 los convierte, pero esa migración es el paso 8: un parser que solo
   entienda wikilinks no reconoce hoy ni un proyecto.
   `scripts/medir-tareas.mjs` ya resuelve las dos formas.

2. **El token** (§5): `parseTaskToken`, `setTaskToken`, `stripTaskToken`. Orden
   fijo de campos, prioridad normal sin campo, y la regla de seguridad: si no
   parsea, la línea no se reescribe. El `id` no se genera acá — se escribe solo
   al entrar a un workbench (§5.4), que es de más adelante.

3. **Los árboles** (§9) y el modelo de la §6: herencia de proyecto/área/sección
   desde una pila de headings, subárboles, notas de tarea verbatim, y las reglas
   de completado (marcar el padre completa los hijos; completar los hijos no
   completa al padre).

**Recurrencia (§11) y archivado (§12) NO entran**: son la sesión 3.

## Los tests

Los invariantes 2, 3, 7, 8 y 9 de la §18, escritos **como propiedades y no como
casos**.

El corpus sale de dos lados, y esto está decidido:

- **Fixtures sintéticas en `test/fixtures/`**, inventadas, que reproduzcan las
  formas medidas en la §2 —tabs, los cuatro tipos de heading en sus tres formas
  reales, bullets sin checkbox estructurales y como notas de tarea, los `- [ ]`
  vacíos de separador, una tabla, una imagen, texto libre, profundidad 6—. **No
  copies mis notas al repo: es público.**
- **Un diferencial opt-in contra el vault real**, salteado si no está
  `OBSIDIAN_VAULT`, con un script `npm run test:corpus`. Ahí van el invariante 9
  sobre las siete notas de verdad y una comparación de los conteos del parser
  nuevo contra `scripts/medir-tareas.mjs`. Hasta ahora hay **dos gramáticas sin
  forma de saber si divergen**; esto lo resuelve.

## La CLI de Obsidian está disponible

Hay un MCP conectado al Obsidian que corre en esta máquina (servidor v2.2.2 en
`127.0.0.1:27200`). Usalo como **instrumento de medición**, con tres reglas:

- **La capa 1 no lo importa nunca.** El plugin tiene que funcionar con Obsidian
  cerrado. Es para tests opt-in y para medir, no una dependencia de `src/`.
- **Puede escribir en el vault** (`patch_vault_file`, `search_and_replace`,
  `delete_vault_file`). Vale la regla dura de CLAUDE.md: **no escribas en el
  vault**. Hasta ahora estaba garantizado porque no había cómo; ahora hay.
- **Es otro instrumento y puede mentir.** Lee del `metadataCache`, que necesita
  la aplicación abierta y puede ir atrasado respecto del disco. Nunca en la
  suite normal.

Para lo que sirve acá: `get_note_outline` y `get_outgoing_links` dan el parser
propio de Obsidian para headings y enlaces. Agregá esa comparación al
diferencial —nivel, texto y línea de cada heading—. Importa porque
`medir-tareas.mjs` es gramática mía y podría estar equivocada igual que el
parser nuevo; Obsidian es independiente. No expone ítems de lista, así que para
las tareas no hay diferencial por ese lado.

## Cómo quiero trabajar

- **Plan primero**, y esperá que lo apruebe.
- **Medí en vez de suponer.** Si una decisión depende de cómo son mis notas,
  contalas: el vault está en `$OBSIDIAN_VAULT` y `npm run medir` ya existe.
- **Preguntame cuando la spec no alcance.** Es larga pero no completa.
- Español en comentarios, documentación y mensajes de commit.

## Qué espero al final

Capa 1 en verde, `npm run test:corpus` pasando contra las siete notas reales, y
—si el diferencial encuentra que el parser nuevo y `medir-tareas.mjs` no
coinciden— **cuál de los dos está mal y por qué**, medido y no argumentado.

No hace falta lista de verificación manual: esta sesión no toca la interfaz.
