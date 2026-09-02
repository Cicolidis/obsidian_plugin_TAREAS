# Qué verificar — paso 6a, tercera vuelta

**Ya está desplegado** (`b0e26af`, `main.js` de las 01:06). Reiniciá Obsidian o
apagá y prendé el plugin.

Es corta: **7 comprobaciones**. Tres son las que quedaron pendientes de la
segunda vuelta, tres son del cambio que entró después, y la última es para que
no te sorprenda algo que ya sabemos que pasa.

## Lo que la segunda vuelta cerró

Todo A, todo B, todo D y E1–E3. Y **F1 y F2 también**, aunque los dejaste en
blanco en el tablero: los resultados que pasaste alcanzan.

| | Qué diste | Por qué cierra |
|---|---|---|
| **F1** | `0_inbox/tareas_PRUEBA.md · 276 tareas · 0.50 ms · evento`, dos veces, con dos `decorar` cada una | Un reparseo por tilde, y **el historial no aparece nunca**, que era lo que había que ver. Los dos pares son dos tildes |
| **F2** | «sigue sin generar eventos» | Es el resultado esperado, y **no cuenta como verde**: la línea de base de la §5.5 no se reproduce desde la sesión 4 y no hay con qué comparar |

Quedaron sin probar **C6**, **C7** y **E4**, y las tres están abajo con la
corrección que hacía falta.

> **Las dos consolas.** Abajo, «consola de Obsidian» es *Ver → Alternar
> herramientas de desarrollo*. La terminal no aparece en esta guía.

---

## A. Lo que quedó pendiente

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| A1 | **En modo código fuente** (Ajustes → Editor → «Modo de edición por omisión» → *Código fuente*), poner el cursor adentro de un `[ ]` y escribir una `x` | Completa igual que un clic: queda `[x]` con `done=` y baja por el subárbol. **En Live Preview esto no se puede hacer, y no es Outliner:** Obsidian reemplaza el `- [ ] ` por un widget y no hay dónde poner el cursor. La guía anterior estaba mal |
| A2 | Buscar una tarea que ya esté `[x]` **y sin fecha** —hay 29 en el corpus— y escribirle una letra **en el texto**, no en el checkbox | **No** le aparece un `done` de hoy. Es el guardia contra el falso positivo: esas tareas se completaron otro día |
| A3 | La sonda de abajo, en la **consola de Obsidian** | Ver los números que pide |

```js
(() => { const P = Object.getPrototypeOf(app.workspace.activeEditor.editor.cm); const o = P.posAtCoords; let n = 0, t = 0; P.posAtCoords = function (...a) { const t0 = performance.now(); const r = o.apply(this, a); t += performance.now() - t0; n++; return r; }; window.__medir = () => { console.log("%s", `posAtCoords: ${n} llamadas · ${t.toFixed(1)} ms en total · ${(t / Math.max(1, n)).toFixed(4)} ms cada una`); }; window.__parar = () => { P.posAtCoords = o; console.log("%s", "sonda sacada"); }; console.log("%s", "sonda puesta. Mové el mouse por la nota y después corré __medir()"); })()
```

**Sin reloj, a diferencia de la anterior.** Pegás la sonda, movés el mouse por la
nota unos segundos, y después escribís `__medir()` en la consola. `__parar()` la
saca. La de la vuelta pasada daba cero porque medía diez segundos **desde que se
pegaba** y parcheaba una instancia en vez del prototipo: el cero era del
instrumento, no del código.

Lo que necesito: **las tres cifras** que imprime. Si «ms cada una» está por
debajo de 0,05 no hay nada que hacer; si está cerca de 1 ms, sí.

## B. El orden nuevo de la fila

La fila del margen ahora se dibuja **al revés**: `🗑 ⋯ → ◐ ★`, con el ★ pegado al
texto y el 🗑 lo más lejos. Sale de tu propia medición: `eliminar` estaba en
x=235 y `wb-primario` en x=153, con el texto empezando cerca de x=280, o sea que
el botón que borra sin preguntar era el primero que tocaba el mouse.

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| B1 | Mirar la fila en el margen | De izquierda a derecha: **🗑 ⋯ → ◐ ★**. El ★ es el más cercano al texto |
| B2 | Apretar **cada uno de los cinco** | Cada uno hace **lo suyo**, no lo del de al lado. Invertir el dibujo sin invertir la marca dejaría el clic andando sobre el botón equivocado, que es peor que no andar |
| B3 | Mirar la fila con un estilo de los otros (Ajustes → «Fila de botones: dónde va» → *Sobre el final de la línea*) | Ahí **no** se invierte: sigue `★ ◐ → ⋯ 🗑`, porque el mouse llega desde el otro lado |

## C. Algo que ya sabemos, para que no te sorprenda

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| C1 | Tildar una tarea y **enseguida** abrir el ⋯ sobre esa misma tarea | Puede negarse con «Esa tarea todavía no está en el índice» durante ~2 segundos. **Es correcto**: tildar escribe por el editor, no por `vault.process()`, así que el índice se entera por el evento de Obsidian, que llega cada ~2100 ms (medido). Esperás un segundo y anda |

Si eso molesta en el uso, decímelo y lo arreglo — se puede hacer que el índice
absorba el texto del editor después de un completado. No lo hice ahora porque
tiene una trampa: el filtro corre **antes** de aplicar sus propios cambios, así
que absorber desde adentro guardaría un documento incompleto.

---

## Para anotar

No hace falta el molde grande. Con esto alcanza:

```
A1 _   A2 _   A3 _
B1 _   B2 _   B3 _
C1 _

A3 · posAtCoords: _ llamadas · _ ms en total · _ ms cada una

Lo que vi mirando y no estaba acá:
- _
```
