# Prompt para la sesión 4 en Claude Code

> Abrir Claude Code en `~/Downloads/claude/obsidian_plugin_TAREAS`, entrar en
> **plan mode** y pegar lo de abajo.

---

Seguimos con el plugin de tareas de Obsidian. La especificación está en
`plugin-tareas-spec.md`, en la raíz. **Leela entera antes de proponer nada** —
la §5.5, la §7 y la §8 se reescribieron en la sesión 3 con mediciones, y las
tres dicen qué reemplazan. El método de trabajo está en `CLAUDE.md` y no lo
repito acá.

## Dónde estamos

Las capas 1 y 2 están cerradas. Están el parser, el token, los árboles, los
planes, el índice en memoria y el único camino de escritura. Son 362 tests en
`npm test` y 83 en `npm run test:corpus`.

Lo que la sesión 3 dejó decidido y no hace falta volver a discutir. `git log` es
corto y vale leerlo:

- **Una línea se identifica por su texto, no por su número** (invariante 10).
  Vale en los dos extremos de una acción: al elegir sobre qué tarea actúa el
  usuario (`elegirTarea`) y al escribir (`ubicar.ts`). Si el texto esperado no
  está donde se esperaba, se busca; si aparece cero o varias veces, **no se
  escribe y se avisa**.
- **El lote es todo o nada.** `vault.process()` no pasa por el editor, así que
  Ctrl-Z no lo deshace.
- **No hay debounce**, y eso está medido: `changed` llega cada ~2100 ms, que es
  el guardado del editor. La §7 quedó reescrita.
- **Antes de escribir se fuerza `save()` sobre las vistas abiertas del archivo**,
  porque el disco puede estar hasta 2 s atrasado respecto del editor.
- El store recibe **un puerto y no `App`**, y no parsea `tareas_LOG.md` (§12).
- Hay dos ajustes de verificación —congelar el índice y registrar eventos—, los
  dos apagados por omisión. Son el patrón `designFlags.ts`.

Hay un informe nuevo, `INFORME-eventos.md`, con las cinco sondas del espía y una
hipótesis mía que la medición **refutó**.

**El repositorio es público** y la regla está en `CLAUDE.md`: no entra contenido
real de mis notas, ni siquiera en un mensaje de commit.

## Alcance de esta sesión: el paso 4a

El paso 4 de la §20 son tres cosas y se parte en dos sesiones. **Esta es la
primera: decoración pasiva sobre la nota. Ni botones ni menús.**

Se parten solas: 4a es un port re-arquitecturado con las trampas ya documentadas,
y 4b —la fila de botones de la §13.0— es código sin precedente, porque
Anotaciones no tiene botones sobre la línea: tiene una barra global y gutters.

### Lo primero, porque decide la arquitectura

La §5.5 tiene una restricción **leída del código de CodeMirror** y verificada
además dentro del bundle de Obsidian 1.13.7:

```js
this.stateDeco = state.facet(decorations).filter(d => typeof d != "function");
this.heightMap = this.heightMap.applyChanges(this.stateDeco, …);
```

El mapa de alturas **descarta las decoraciones que llegan como función**, que es
como las aporta un `ViewPlugin`. Con `StateField` entran, y `addLineDeco` hace
`line.collapsed += length`, así que la estimación de altura descuenta el token.

> **Las decoraciones van en un `StateField` sobre el documento entero, nunca en
> un `ViewPlugin` sobre el viewport visible.**

Y ojo: `src/editor/annotationDecorations.ts` de Anotaciones —el módulo que la
§17 manda portar— usa `ViewPlugin.fromClass`. **El port no es una copia: es la
misma lógica re-arquitecturada.** Sirve para la estructura de decoraciones, el
caché y el nivel como variable CSS; no para cómo se registra.

### Cómo quiero que quede

| Archivo | Capa | Qué es |
|---|---|---|
| `src/hiddenTail.ts` | 1 | Dónde empieza el tramo oculto de una línea |
| `src/color.ts` | 1 | `colorClass(prioridad)` |
| `src/editor/decoraciones.ts` | 3 | El `StateField` con `Decoration.replace` y `Decoration.line` |
| `src/editor/protegerTramo.ts` | 3 | El `transactionFilter` que defiende el rango atómico |
| `styles.css` | — | Las clases, con variables de tema |

1. **`hiddenTail.ts` no se porta tal cual.** El de Anotaciones maneja tres piezas
   distintas al final de línea; acá hay **una sola** (`%%t:…%%`) y su gramática
   ya vive en `src/token.ts`. Reusala desde ahí: una gramática repetida en dos
   archivos diverge.
2. **Se oculta solo lo que parsea.** Un token ilegible queda a la vista, y está
   bien: es la única forma de que yo lo arregle, y encaja con el invariante 7.
3. **`color.ts` tampoco se porta.** En Anotaciones el color *es* el dato, porque
   viene de Zotero; acá es presentación de un ordinal (§14, D12).
4. Las decoraciones solo en Live Preview (`editorLivePreviewField`) y solo en las
   notas de la lista. La traducción «editor de CodeMirror → archivo del vault» ya
   existe en `main.ts`, en `filtroActivo`.
5. **Un tercer comando de paleta**: subir y bajar la prioridad de la tarea del
   cursor. Sin él los colores no se pueden mirar: hoy no hay una sola tarea con
   `p=1` ni `p=2`. Reusa entero el camino del paso 3 —`elegirTarea` → plan puro →
   `escribir` → `absorber`— y `setTaskToken` ya sabe escribir `p=`.

### Las trampas que ya costaron caro

Están en `CLAUDE.md` y en la §5.5, todas con su bug detrás:

- `display: none` no saca nada del documento: `Decoration.replace` + `atomicRanges`.
- **Un rango atómico al final de línea tiene que incluir el salto de línea**, o
  hay que apretar la flecha dos veces.
- **Un rango atómico no se borra de a un carácter: se borra entero.** Ante
  cualquiera, preguntarse qué pasa cuando alguien **borra hacia atrás desde el
  otro lado**. Tres bugs de la fase 2 de Anotaciones salieron de ahí.
- **Dos `Decoration.replace` no se pueden anidar** y se cae el conjunto entero de
  la nota. Acá hay un token solo, así que no aplica — pero es la razón de que
  todos los metadatos vayan en un token (D4).
- El `transactionFilter` nuevo **convive** con el de `autoCheckbox.ts`, que ya
  está y tiene 74 tests. Un filtro no puede encadenar specs: se resuelven contra
  el documento original, así que hay que corregir la entrada, no el resultado.
- Outliner está instalado y la forma de una edición depende de qué plugins haya:
  **escribir reglas que no miren la forma**.

### Antes de escribir código, la predicción falsable

La §5.5 dejó una línea de base **medida**: con la ventana angostada y
scrolleando **hacia arriba**, la consola de Obsidian tira `Measure loop
restarted` ×1 y `Viewport failed to stabilize` ×4, **sin ninguna decoración del
plugin**.

> Con las decoraciones puestas, la cuenta no tiene que pasar de ahí. Si sube, o
> si aparecen avisos **sin scrollear**, es del plugin.

`Measure loop restarted` discrimina, además: solo sale si alguien llamó a
`requestMeasure`, o sea una extensión. Hoy el plugin no lo llama en ningún lado.

Si la predicción falla, **la primera pregunta es si la hipótesis de la §5.5 dice
la verdad**, no si el código está mal.

### Los tests

Todo lo que se pueda probar sin DOM, se prueba sin DOM. El patrón ya existe:
`autoCheckbox.ts` tiene 74 tests offline sobre `EditorState`, sin Obsidian.

- `hiddenTail` con propiedades, incluida la del borrado hacia atrás.
- **La lógica de qué decorar se extrae pura** y el `StateField` solo la envuelve.
- El filtro de protección, con el mismo andamiaje que `autoCheckbox`.

## Dónde puede escribir

Sobre `0_inbox/tareas_PRUEBA.md`, que ya está habilitada en ajustes y ya tiene
tokens escritos por el paso 3. Las siete notas reales siguen sin un solo token y
así se quedan hasta que yo lo pida.

Vale la regla dura de `CLAUDE.md`: **no escribas vos en el vault**, ni con las
herramientas del MCP de Obsidian, que puede.

## Cómo quiero trabajar

- **Plan primero**, y esperá que lo apruebe.
- **Aclarame siempre de qué consola hablás.** Hay dos y me las confundo: la
  terminal, y la de Obsidian (*Ver → Alternar herramientas de desarrollo*).
  Etiquetá los bloques y no las mezcles en uno solo.
- **Medí en vez de suponer**, y acordate de que **la spec también es una medición
  con fecha**. En la sesión 3 escribí una afirmación en la §8 que quedó refutada
  dos horas después por una sonda.
- **Preguntame cuando la spec no alcance.**
- **Cuando una propiedad falle, fijate primero si la propiedad dice la verdad.**
  En la sesión 3 fallaron cinco veces y cuatro fueron del generador de los tests.
- **Mirá la salida, no solo los tests.**
- Español en comentarios, documentación y mensajes de commit.

## Qué espero al final

El token invisible en Live Preview y visible en modo lectura, los tres niveles de
prioridad distinguibles **también sin color** (§14), `npm test` y
`npm run test:corpus` en verde, la cuenta de avisos comparada contra la línea de
base, y una **lista concreta de qué observar** en el editor: que la flecha cruce
el final de línea de una sola vez, que un Backspace desde la línea de abajo no
parta el token, que un token roto sí se vea, y el contraste en tema claro y
oscuro.
