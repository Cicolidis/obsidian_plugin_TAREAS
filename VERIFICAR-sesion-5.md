# Qué verificar — paso 4b, la fila de botones

**Ya está desplegada** (`npm run deploy`). Reiniciá Obsidian o apagá y prendé el
plugin.

Son **veintitrés comprobaciones**. Las últimas cinco son las que más importan:
son los cuatro gestos que ya costaron caro en la sesión 4, y el widget se mete
justo ahí.

## Qué hay ahora

```
[✓]  texto de la tarea …                    [★] [◐] [→] [⋯]
```

- **★** manda al workbench favorito, **◐** al segundo. Un clic, toggle. Quedan
  **rellenos** si la tarea ya está ahí.
- **→** los muestra todos, numerados 1-9, más «Workbench nuevo…».
- **⋯** abre prioridad (tres niveles) y «Completar y descartar».

Fecha, recurrencia, «completar y archivar» y «eliminar» **no están**: no tienen
capa 1 y 2 detrás y ponerlas grises es lo mismo que no ponerlas. Son el paso 6.

## 0. Antes de empezar

Ajustes nuevos, en orden de aparición:

| Ajuste | Cómo arranca |
|---|---|
| **Segundo workbench favorito (◐)** | **Vacío** → el ◐ no se dibuja. Ponele un nombre para verlo |
| **Fila de botones sobre la tarea** | Encendida |
| **Fila de botones: cuándo se ve** | *Con el mouse sobre la línea* |

Y encendé **«Registrar eventos en la consola»** para las mediciones de la §F.
Trabajá sobre `0_inbox/tareas_PRUEBA.md`.

> **Las dos consolas.** Abajo, «consola de Obsidian» es *Ver → Alternar
> herramientas de desarrollo*. La terminal no aparece en esta guía.

---

## A. Que aparezcan donde corresponde

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| A1 | Pasar el mouse sobre una tarea | Aparecen ★ ◐ → ⋯ a la derecha, alineados con el checkbox |
| A2 | Pasar el mouse sobre un **bullet sin checkbox**, sobre un heading, sobre texto suelto y sobre un `- [ ]` **vacío** | **No aparece nada** en ninguno de los cuatro |
| A3 | Vaciar el «Segundo workbench favorito» | Quedan tres botones: ★ → ⋯ |
| A4 | Poner el modo en **Siempre** | Se ven todos, tenues; el de abajo del mouse se resalta |
| A5 | Apagar «Fila de botones sobre la tarea» | No aparece ninguna, y el color de prioridad **sigue** |
| A6 | Pasar a **modo fuente** (`Ctrl/Cmd + E`) | No hay fila, y el token se ve entero |
| A7 | Abrir una nota que **no** esté en la lista | No hay fila |

## B. Lo que no tiene que cambiar: el renglón

Es la comprobación que más importa después de las últimas cinco. La §5.5 se
apoya en que el mapa de alturas de CodeMirror estime bien.

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| B1 | Angostar la ventana hasta que una tarea larga corte en dos renglones. Mirar dónde corta **con** y **sin** la fila (apagando el ajuste) | **Corta en el mismo lugar.** La fila no suma ancho |
| B2 | Con la fila encendida, mirar el alto de las líneas de tarea contra las de texto | **El mismo.** Ninguna línea de tarea es más alta |
| B3 | Una tarea que ocupa **dos renglones** | Los botones quedan arriba, al lado del checkbox — no flotando en el medio |

## C. El clic

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| C1 | Clic en el **★** de una tarea | El ★ queda **relleno**, sin recargar nada y sin cartel |
| C2 | Mirar el cursor después de C1 | **No se movió**, y no empezó ninguna selección |
| C3 | Clic en el ★ de nuevo | Se vacía. La tarea sale del workbench |
| C4 | Mirar la línea en **modo fuente** después de C1 | Tiene `%%t:id=…;wb=foco%%`, con un id que antes no estaba |
| C5 | ★ sobre una tarea **con hijas** | El token con `wb=` baja por **todo el subárbol** (§9), y las hijas también quedan rellenas |
| C6 | Ctrl-Z después de C1 | **No lo deshace.** Es esperado: `vault.process` no pasa por el editor (§8). Si molesta, decilo y se piensa |

## D. El → y el ⋯

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| D1 | Clic en **→** | Se abre un menú con los workbenches numerados `1 · foco`, `2 · …`, y al final **«Workbench nuevo…»** |
| D2 | Con el menú abierto, apretar **`1`** | Manda la tarea al primero y cierra. Es el «un clic más una tecla» de la §13.0 |
| D3 | **«Workbench nuevo…»**, escribir un nombre y **Enter** | La tarea va ahí, y ese nombre aparece en el → de **cualquier otra tarea** desde ese momento |
| D4 | Lo mismo, escribiendo `a;b` | Aviso explicando que `;`, `,` y `%` romperían el token. **No escribe nada** |
| D5 | Clic en **⋯** | «Prioridad» como rótulo, tres niveles con el vigente **tildado**, separador, «Completar y descartar» |
| D6 | Elegir **Muy alta** | La línea se colorea en el acto |
| D7 | ⋯ sobre una **hija** de esa tarea | El nivel tildado es el que **se ve** (el heredado), no «Normal» |
| D8 | Sobre esa hija, elegir **Normal** | Aviso: «Esta tarea hereda la prioridad de su tarea madre…». Es el límite del modelo, dicho |
| D9 | **Completar y descartar** sobre una tarea con hijas | Todas quedan `[x]` con `done=`, y avisa cuántas |

## E. El token roto

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| E1 | Romper un token a mano (`%%t:id=A3F2%%`, en mayúsculas) y pasar el mouse | La fila **aparece igual**, apagada, y el tooltip de los cuatro botones dice que el token es ilegible |
| E2 | Clic en cualquiera de los cuatro | Aviso explicando por qué no se toca. **No escribe nada** |

## F. Las dos mediciones

**Consola de Obsidian**, con «Registrar eventos» encendido.

| # | Qué hacer | Qué anotar |
|---|---|---|
| F1 | Tipear un rato sobre `tareas_PRUEBA.md` y mirar las líneas `[tareas] fila · N líneas visibles · X ms` | El número. Medido offline sobre la nota más grande **saturada de tokens**: mediana **0,036 ms**, p90 0,097 ms, contra los **0,65 ms** que cuesta decorar el documento entero |
| F2 | **La línea de base de la §5.5.** Angostar la ventana, cargar la nota de tokens, y scrollear **hacia arriba** un buen rato. Repetir con «Fila de botones» apagada y con «Decoraciones en la nota» apagada | Contar `Measure loop restarted` y `Viewport failed to stabilize` en las tres condiciones. **Si no aparece ninguno en ninguna, eso no es verde**: en la sesión 4 tampoco aparecían sin el plugin, así que no hay con qué comparar. Anotalo como «no se pudo evaluar» |

## G. Los cuatro gestos que ya costaron caro

El widget se mete justo donde la sesión 4 dejó tres bugs. Todos sobre una tarea
**con token**.

| # | Qué hacer | Qué tiene que seguir pasando |
|---|---|---|
| G1 | Clic en el **vacío a la derecha** del texto de una tarea | El cursor queda al **final del texto**, no en la línea de abajo |
| G2 | Flecha **derecha** desde el final del texto | Cruza a la línea de abajo **de un teclazo** |
| G3 | **Backspace** desde el comienzo de la línea de abajo | Une las dos líneas, con un espacio, y queda **un solo** token — nunca dos `%%t:` |
| G4 | **Enter** al medio del texto de una tarea | La línea nueva nace `- [ ] `, y el token se queda **arriba** |
| G5 | **Enter** al **comienzo** de una tarea | Se abre una línea vacía arriba y el token **baja** con el texto |

---

## Plantilla de respuesta

Copiá y completá solo lo que falle:

```
A1 ok · A2 ok · …
B1 FALLA: <qué pasó>
F1: <el número que imprimió la consola>
F2: fila+deco <n> · solo deco <n> · nada <n>   (o «no aparece ninguno»)
```

Y si algo se ve mal —el tamaño de los botones, los íconos elegidos (★ es `star`,
◐ es `circle`), dónde quedan, cuánto se ven en modo *Siempre*— decilo aunque no
sea una falla: eso es lo único que no se puede decidir desde acá.
