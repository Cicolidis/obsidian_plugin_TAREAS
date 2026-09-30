# Qué verificar — paso 6a, segunda vuelta

**Ya está desplegado.** Reiniciá Obsidian o apagá y prendé el plugin.

Esta guía **no repite las 36** de la primera. Existe porque tu pasada corrió
sobre `a327dab` y desde entonces entraron tres commits, dos de ellos sobre
mecanismos que tocan todo:

| Commit | Qué tocó | Qué invalida de tu pasada |
|---|---|---|
| `6ff1ac6` | `cursor.ts` | **Toda escritura.** El cursor se reubica distinto al completar, archivar y reiniciar |
| `734c568` | filtro nuevo `completarAlTildar` | **Lo que hace el teclado.** Es un `transactionFilter` más, y el orden entre filtros ya rompió cosas antes |
| `734c568` | confirmaciones apagadas | **La sección A entera**: el modal que verificaste ya no aparece por omisión |
| `ec762b0` | `lineaHover` al `scrollDOM` | El hover, y el costo de mover el mouse |

Lo que **sigue valiendo** de la primera vuelta: B (el bloque en el historial), C1–C3
(archivar no borra), E (cancelar no escribe) y F (el índice congelado). Nada de
eso cambió.

Son **29 comprobaciones** (A 6 · B 6 · C 7 · D 4 · E 4 · F 2). Las de la §C son
las que más importan: son los gestos del editor, y ahí es donde un filtro nuevo
hace daño sin avisar.

Para anotar lo que salga está `RESULTADOS-sesion-6-vuelta-2.md`, que se llena y
se pega entero como prompt.

---

## 0. Los ajustes nuevos

Cinco, todos en la pantalla de siempre. Miralos antes de empezar:

| Ajuste | Cómo arranca |
|---|---|
| **Tildar el checkbox completa la tarea** | Encendido |
| **Cmd+clic en el checkbox: completar y archivar** | Encendido |
| **Fila de botones: incluir 🗑 Eliminar** | Encendido |
| **Preguntar antes de archivar** | **Apagado** |
| **Preguntar antes de eliminar** | **Apagado** |

> **Las dos consolas.** Abajo, «consola de Obsidian» es *Ver → Alternar
> herramientas de desarrollo*. La terminal no aparece en esta guía.

---

## A. Lo que ya no pregunta

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| A1 | ⋯ → «Completar y archivar» sobre una tarea **con subárbol** | **No aparece ningún modal.** Archiva y avisa |
| A2 | Archivar **la misma tarea otra vez** | **Sí aparece**, y la primera línea dice que ya figura en el historial |
| A3 | Cancelar ese modal | No se escribe nada, ni en la nota ni en el historial |
| A4 | Encender «Preguntar antes de archivar» y repetir A1 | Vuelve el modal de la primera vuelta, con las líneas y el camino |
| A5 | El 🗑 de la fila sobre una tarea con subárbol | Borra **sin preguntar** |
| A6 | Encender «Preguntar antes de eliminar» y repetir | Vuelve el modal, con el botón rojo y el foco en «Cancelar» |

## B. El checkbox como gesto

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| B1 | Tildar una tarea **sin subárbol** | Queda `[x]` con `done=` de hoy |
| B2 | Tildar una **madre con hijas y una nota sin checkbox** | Las hijas quedan `[x]` con fecha; **la nota sin checkbox no se toca** |
| B3 | Destildar esa madre | Pierde el `done` y conserva el resto del token; **las hijas quedan como estaban** |
| B4 | Tildar con **Cmd** (Ctrl fuera de macOS) | Completa **y** archiva. El checkbox queda `[x]` |
| B5 | Cmd+clic sobre una tarea **ya archivada**, y **cancelar** el modal | El checkbox **no** queda tildado: no se escribió nada |
| B6 | Apagar «Tildar el checkbox completa la tarea» y tildar | Tilda y nada más, como antes |

## C. Los gestos del editor, otra vez

**Esta es la sección que importa.** Hay un `transactionFilter` nuevo corriendo
último, y el orden entre filtros ya rompió el checkbox automático una vez.
Trabajá sobre una tarea **con token** (mandala a un workbench primero).

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| C1 | **Enter** al final de una tarea | La línea nueva nace `- [ ] ` y la de arriba conserva el token |
| C2 | **Enter** en el medio del texto | El token se queda **arriba**; la de abajo nace sin él |
| C3 | **Backspace** desde el comienzo de la línea de abajo | Une las dos y queda **una sola línea legible**, con un solo token |
| C4 | **Flecha derecha** desde el final del texto | Cruza a la línea de abajo de un teclazo |
| C5 | **Clic al final de la línea**, en el vacío de la derecha | El cursor queda en **esa** línea |
| C6 | **En modo código fuente** (Ajustes → Editor → Modo de edición por omisión), escribir una `x` a mano adentro de un `[ ]` | Completa igual que un clic: es el mismo hecho. **En Live Preview esto no se puede hacer y no es de Outliner:** Obsidian reemplaza el `- [ ] ` por un widget, así que no hay dónde poner el cursor. La guía estaba mal |
| C7 | **Escribir una letra en el texto** de una tarea que ya está `[x]` **y no tiene fecha** — en el texto, no en el checkbox | **No** le aparece un `done` de hoy. Son 29 tareas del corpus las que están `[x]` sin fecha, y ninguna se completó hoy |

## D. El cursor, que es lo que cambió por abajo

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| D1 | Poner el cursor **en el medio del texto** de una tarea y apretar el ★ | El cursor **no se mueve** y el `- [ ] ` no se desarma |
| D2 | Ídem, y completar con el ⋯ | Lo mismo. **Esto es lo que estaba roto** |
| D3 | Ídem, y archivar | Lo mismo |
| D4 | Ídem, y **tildar el checkbox** con el cursor en el medio del texto | Lo mismo |

## E. El hover y el costo

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| E1 | Pasar el mouse de derecha a izquierda sobre una tarea **anidada varios niveles** | Los botones **no se apagan en ningún punto** del camino hasta llegar a ellos |
| E2 | Lo mismo sobre una tarea pegada al margen | Ídem |
| E3 | Lo mismo de izquierda a derecha | Ídem |
| E4 | Mover el mouse rápido por toda la nota unos segundos | El editor no se pone pesado. Ver la sonda de abajo |

El oyente del hover pasó de `.cm-content` a `.cm-scroller`, así que ahora corre
también sobre los márgenes. Debería ser marginal, pero **no lo pude medir desde
Claude Code**. La sonda, en la **consola de Obsidian**:

```js
(() => { const P = Object.getPrototypeOf(app.workspace.activeEditor.editor.cm); const o = P.posAtCoords; let n = 0, t = 0; P.posAtCoords = function (...a) { const t0 = performance.now(); const r = o.apply(this, a); t += performance.now() - t0; n++; return r; }; window.__medir = () => { console.log("%s", `posAtCoords: ${n} llamadas · ${t.toFixed(1)} ms en total · ${(t / Math.max(1, n)).toFixed(4)} ms cada una`); }; window.__parar = () => { P.posAtCoords = o; console.log("%s", "sonda sacada"); }; console.log("%s", "sonda puesta. Mové el mouse por la nota y después corré __medir()"); })()
```

**Corregida respecto de la vuelta anterior**, donde dio cero tres veces. Aquella
medía diez segundos **desde que se pegaba**, así que si uno tardaba en volver a
Obsidian la ventana ya se había cerrado; y parcheaba una instancia en vez del
prototipo, así que no veía otras vistas abiertas. Esta no tiene reloj: se mide
cuando uno quiere con `__medir()` y se saca con `__parar()`.

## F. La consola

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| F1 | Con «Registrar eventos» encendido, tildar una tarea con subárbol | **Un** reparseo. El historial no aparece nunca |
| F2 | Angostar la ventana y scrollear hacia arriba | Contar `Measure loop restarted` y `Viewport failed to stabilize`. **Sigue sin reproducirse**: si no aparece nada, **no lo anotes como verde** |

---

## Lo que sigo sin poder comprobar desde acá

- Todo lo visual: el rojo del 🗑, dónde cae el foco en los modales, si el
  hover se siente parejo.
- Que el Cmd+clic llegue **antes** que el handler de Obsidian. Se prueba
  usándolo: si el checkbox se tilda y además archiva, llegó tarde.
- El costo de la §E4, que es la única regresión de rendimiento que este cambio
  podía introducir.

Para anotar sigue sirviendo `RESULTADOS-sesion-6.md`: cambiá el tablero por las
secciones de acá y el resto queda igual.
