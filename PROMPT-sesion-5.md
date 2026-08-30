# Prompt para la sesión 5 en Claude Code

> Abrir Claude Code en `~/Downloads/claude/obsidian_plugin_TAREAS`, entrar en
> **plan mode** y pegar lo de abajo.

---

Seguimos con el plugin de tareas de Obsidian. La especificación está en
`plugin-tareas-spec.md`, en la raíz. **Leela entera antes de proponer nada** —
la §5.5 creció mucho en la sesión 4 y sus once apartados son casi todos
mediciones nuevas. El método de trabajo está en `CLAUDE.md` y no lo repito acá.

## Dónde estamos

Las capas 1 y 2 están cerradas y el **paso 4a** también: la decoración pasiva
sobre la nota. Son **531 tests** en `npm test` y **117** en `npm run test:corpus`.

Hay token invisible en Live Preview, color de prioridad con cuatro estilos
intercambiables, un filtro que defiende el token de los gestos del editor, unión
limpia de tareas, y cuatro comandos de paleta. Cuatro vueltas de verificación en
vivo, y de cada una salieron bugs que ningún test había visto.

Lo que quedó decidido y no hace falta volver a discutir. `git log` es largo y
vale leer los mensajes:

- **Las reglas que preguntan de qué forma vino un cambio fallan.** La forma de
  una edición depende de qué plugins haya instalados. Los filtros reconocen **el
  defecto**: calculan en qué quedaría el documento y deciden sobre eso. Tres
  bugs de la sesión 4 salieron de haberlo hecho al revés.
- **Un cambio externo llega como un diff con `userEvent: "set"`**, incluido lo
  que el propio plugin acaba de escribir. Los filtros lo descartan de entrada.
- **Las decoraciones van en un `StateField`**, nunca en un `ViewPlugin` (§5.5).
  Ver abajo, porque para el paso 4b esa regla tiene un límite exacto.
- Tres filtros con precedencias fijadas por tests: `unirLimpio` decide el
  **texto** de una línea unida, `protegerTramo` el **token**, `autoCheckbox` el
  **checkbox**. Corren de menor a mayor precedencia.
- **La línea que hereda la posición hereda el token**, tanto al unir como al
  partir. Con un límite: si la mitad de arriba queda sin texto, baja.
- La prioridad se escribe **solo en la línea de la tarea**; el filete de los
  hijos es dibujo. Los comandos parten del nivel **efectivo**, no del propio.
- **El estilo de prioridad por omisión es «barra corta + checkbox coloreado»**,
  elegido mirándolo. Los otros tres siguen en el desplegable.

Hay tres informes de verificación en vivo —`VERIFICAR-sesion-4.md` y sus vueltas
2, 3 y 4— con lo que se probó y lo que salió mal.

**Una cosa que quedó abierta y no es verde:** la línea de base del ciclo de
medición de la §5.5 **no se reproduce**. Con 122 tokens, la ventana angostada y
scrolleando en las dos direcciones no aparece ningún aviso, ni con decoraciones
ni sin ellas. La predicción falsable de ese apartado no se puede evaluar. Si el
bucle reaparece, hay que medir la base de nuevo antes de concluir nada.

**El repositorio es público** y la regla está en `CLAUDE.md`: no entra contenido
real de mis notas, ni siquiera en un mensaje de commit.

## Alcance de esta sesión: el paso 4b

La **fila de botones de la §13.0**, sobre cada línea de tarea:

```
[✓]  texto de la tarea …                    [★] [◐] [→] [⋯]
```

Es la mitad del paso 4 que **no** tiene precedente. Anotaciones no tiene una fila
de botones sobre la línea: tiene una barra global (`ui/ActionBar.ts`) y un margen
(`editor/annotationGutter.ts`). Lo único portable es la mecánica de **un** widget
sobre la línea, el `CheckboxWidget` de `editor/annotationDecorations.ts`.

### Qué queda explícitamente afuera

El ⋯ de la §13.0 lista seis cosas y **solo tres tienen capa 1 y 2 detrás hoy**:
prioridad, completar y descartar, y los workbenches. Las otras no:

| Del menú | Por qué no entra |
|---|---|
| Fecha | `setTaskToken` sabe escribir `due`, pero no hay con qué elegir una fecha. Un selector es un trabajo aparte |
| Recurrencia | Ídem con `rec`, y el botón de reinicio por grupo es de la §11 |
| Completar y archivar | `archivado.ts` tiene la lógica pura y **ninguna** escritura: toca dos archivos a la vez. Es el paso 6 |
| Eliminar | Es el descarte físico de la §12, con confirmación. Paso 6 |

Que aparezcan grises no sirve: **si no se pueden usar, no van**. Ponerlas es el
paso 6, y ahí el menú se completa.

---

## Lo primero, porque decide la arquitectura

La §5.5 manda las decoraciones a un `StateField` sobre el documento entero. Para
una fila de botones eso significaría construir **un widget por tarea**: en
`tareas_COLE` son 290, de las cuales se ven cuarenta. Antes de aceptar ese costo,
leelo bien, porque **la regla tiene un límite exacto** y está en el código.

En `@codemirror/view` 6.38.6, el constructor del mapa de alturas:

```js
point(from, to, deco) {
  if (from < to || deco.heightRelevant) {
    …
    else if (len || breaks || height >= relevantWidgetHeight)
      this.addLineDeco(height, breaks, len);
  }
  …
}
```

y

```js
get heightRelevant() {
  return this.block || !!this.widget &&
         (this.widget.estimatedHeight >= 5 || this.widget.lineBreaks > 0);
}
```

O sea: **un widget inline de ancho cero, sin `estimatedHeight` y sin
`lineBreaks`, no entra nunca al mapa de alturas.** `from === to` y
`heightRelevant` es `false`, así que `point` no hace nada con él.

De ahí sale la división:

| Qué | Dónde va | Por qué |
|---|---|---|
| El `Decoration.replace` del token | **`StateField`**, como está | Tiene `from < to` y alimenta `line.collapsed`: si el mapa no lo ve, cada tarea de fuera de pantalla se estima un renglón más alta |
| Los botones, como widget inline de ancho cero | **`ViewPlugin`** sobre `visibleRanges` | El mapa no lo ve de todos modos, así que no hay nada que ganar recorriendo el documento entero, y sí mucho DOM que ahorrar |

> **Y la trampa que eso deja armada:** el día que alguien le ponga
> `estimatedHeight` al widget o lo haga `block`, vuelve a ser relevante para el
> mapa, y desde un `ViewPlugin` el mapa lo descarta — que es exactamente el bug
> de la §5.5, entrando por la puerta de al lado. **Escribir un test que falle si
> el widget declara altura.**

Esto hay que **verificarlo dentro del bundle instalado** antes de apoyarse en
ello, como se hizo con el filtro de `stateDeco`:
`~/Library/Application Support/obsidian/obsidian-*.asar`.

---

## Cómo quiero que quede

| Archivo | Capa | Qué es |
|---|---|---|
| `src/acciones.ts` *(modificado)* | 1 | Los planes que falten, si falta alguno |
| `src/botones.ts` *(nuevo)* | 1 | **Qué botones tiene una tarea y en qué estado**: puro, sin DOM |
| `src/editor/filaDeBotones.ts` *(nuevo)* | 3 | El `ViewPlugin`, el widget y el `WidgetType` |
| `src/editor/menuDeTarea.ts` *(nuevo)* | 3 | El ⋯ y el popover del → |
| `src/settingsData.ts` *(modificado)* | 1 | Los dos workbenches favoritos y el modo de revelación |
| `styles.css` *(modificado)* | — | La fila, con los tres modos de revelación |

Decisiones por archivo:

1. **`botones.ts` es capa 1 y no tiene DOM.** Dada una tarea, devuelve qué
   botones van y con qué estado: `★` relleno si está en el workbench favorito,
   etc. Eso se prueba offline; el widget solo lo dibuja. Es la misma separación
   que `decorar.ts` con `decoraciones.ts`, que funcionó.
2. **El modo de revelación es un parámetro, no un `mouseenter`.** La §15 punto 1
   es explícita: si nace con `mouseenter` adentro, después se reescribe entero.
   Y ya hay un patrón para esto en el repo: el estilo de prioridad viaja como
   **clase en `body`** (`clasesDelEstilo` en `color.ts`) y la hoja de estilos
   decide. Los tres modos —`hover`, `siempre`, `swipe`— son eso mismo, y el
   `hover` es CSS puro.
3. **Los botones no suman ancho al renglón.** Ancla de ancho cero en
   `line.from`, y la fila posicionada con `position: absolute; right: 0` sobre
   la línea, que ya es `position: relative`. Es lo que hace el `CheckboxWidget`
   de Anotaciones y evita de raíz empujar el corte de línea — medido en la
   sesión 4: el glifo de prioridad lo empuja unas tres letras.
4. **Anclar en `line.from` y no al final** tiene una segunda razón: el final de
   la línea está adentro del `Decoration.replace` del token, y meter un widget
   ahí es pedirle problemas al rango que ya costó tres bugs.
5. **El clic no puede confiar en el número de línea con que se construyó el
   widget** (invariante 10). Dos caminos posibles y hay que elegir midiendo:
   pedirle a CodeMirror la posición fresca del DOM del widget, o llevar el texto
   esperado y volver a ubicarlo con `ubicarLinea`. El camino de escritura ya
   existe entero y **se reusa**: `elegirTarea` → plan puro → `escribir` →
   `absorber`.
6. **Dos workbenches favoritos en ajustes**, para ★ y ◐. Hoy hay uno solo
   (`workbenchFavorito`); saneado con `sanearWorkbench`, que ya está.
7. Para el ⋯ y el popover, Anotaciones tiene `ui/ConfirmModal.ts` y
   `ui/DestinationModal.ts` como referencia de forma. Obsidian tiene `Menu`
   nativo, que probablemente alcance para el ⋯.

---

## Las trampas que ya costaron caro

- **Un widget tiene que implementar `eq()`.** Si no, cada redibujado tira el DOM
  y lo rehace: se pierde el hover en el medio del gesto y se paga en cada tecla.
- **`ignoreEvent()` y `preventDefault` en `mousedown`.** Sin eso, un clic en un
  botón mueve el cursor y empieza una selección. Está resuelto en el
  `CheckboxWidget` de Anotaciones.
- **CodeMirror recrea los elementos de línea en cada redibujado.** Una clase
  puesta a mano en el DOM desaparece; todo estado visual persistente se reaplica
  desde la decoración.
- **Dos `Decoration.replace` no se pueden anidar** y la excepción se lleva puesto
  el conjunto entero de la nota. El widget de los botones no es un `replace`,
  pero convive con el del token: cuidado con dónde se ancla.
- **`atomicRanges` decide dónde cae un clic**, con `bias 0`. Ya mordió una vez y
  está resuelto en `editor/clicAlFinal.ts`; un botón nuevo en la línea vuelve a
  meterse en esa zona.
- **La escritura no pasa por el editor: Ctrl-Z no la deshace.** Un botón que
  completa o archiva es un clic sin red. La §12 pide confirmación para lo grande.
- **El lote es todo o nada**, y toda escritura lleva el texto que esperaba
  encontrar (invariante 10).

---

## Antes de escribir código, medir

1. **Verificar el límite del mapa de alturas dentro del asar instalado**, no solo
   en `node_modules`. Es lo que decide `ViewPlugin` contra `StateField` para los
   botones, y es la única decisión de arquitectura de esta sesión.
2. **La línea de base del ciclo de medición sigue sin reproducirse.** Antes de
   usarla como referencia hay que volver a tomarla, o decir que no se pudo. No
   anotar «sin avisos» como verde: hoy tampoco hay avisos sin el plugin.
3. **Cuánto cuesta construir la fila**, con el mismo instrumento que ya existe:
   el `alMedir` de `decoraciones.ts` imprime por transacción con el ajuste
   «Registrar eventos en la consola». El costo de decorar hoy es 0,65 ms en el
   peor caso realista, medido; los botones se comparan contra eso.

## Los tests

Todo lo que se pueda probar sin DOM, se prueba sin DOM. Los patrones ya existen:

- `botones.ts` como `decorar.ts`: casos y propiedades sobre fixtures inventadas.
- El `ViewPlugin` sobre un `EditorState` pelado, como `decoraciones.test.ts`, que
  además tiene el test que fija la restricción de la §5.5. **Escribir el
  equivalente para el widget:** que no declare altura, o el mapa vuelve a
  importar.
- Los planes nuevos, en `acciones.test.ts`, con `aplicarPlan`.
- Y volver a correr la cacería de las dos propiedades de los filtros con 20.000
  corridas si se toca alguno: encontró dos bugs que los casos no.

## Dónde puede escribir

Sobre `0_inbox/tareas_PRUEBA.md`, que está habilitada en ajustes y tiene 122
tokens. Las siete notas reales siguen sin un solo token.

Vale la regla dura de `CLAUDE.md`: **no escribas vos en el vault**, ni con las
herramientas del MCP de Obsidian, que puede.

## Cómo quiero trabajar

- **Plan primero**, y esperá que lo apruebe.
- **Aclarame siempre de qué consola hablás.** Hay dos: la terminal, y la de
  Obsidian (*Ver → Alternar herramientas de desarrollo*). Etiquetá los bloques.
- **Medí en vez de suponer**, y acordate de que **la spec también es una medición
  con fecha**. En la sesión 4 una línea de base de dos días antes ya no se
  reproducía.
- **Preguntame cuando la spec no alcance**, y decime cuando una decisión mía
  choca con otra que ya tomé.
- **Cuando una propiedad falle, fijate primero si la propiedad dice la verdad.**
  En la sesión 4 fallaron cuatro veces y dos fueron de la propiedad, que
  afirmaba algo más fuerte que la verdad.
- **Mirá la salida, no solo los tests.**
- Español en comentarios, documentación y mensajes de commit.

## Qué espero al final

La fila apareciendo sobre la línea, el ★ marcando de verdad si la tarea está en
el workbench, el ⋯ con lo que se puede usar hoy, `npm test` y
`npm run test:corpus` en verde, el costo de construir la fila medido contra los
0,65 ms de las decoraciones, y una **lista concreta de qué observar** en el
editor, que es lo único que no se puede comprobar desde Claude Code:

- que los botones aparezcan y desaparezcan donde corresponde, en los tres modos;
- que **no empujen el corte de línea** ni cambien la altura de la línea;
- que un clic en un botón no mueva el cursor ni empiece una selección;
- que el ★ quede relleno sin tener que recargar nada;
- que con la nota scrolleada rápido no queden botones de otra línea;
- y que el clic al final de la línea, la flecha, el Backspace desde abajo y el
  Enter sigan haciendo lo mismo que ahora: son cuatro gestos que ya costaron
  caro y el widget se mete justo ahí.
