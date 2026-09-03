# Qué verificar — paso 6b: fecha, recurrencia y reinicio

**Ya está desplegada** (`npm run deploy`). Reiniciá Obsidian o apagá y prendé el
plugin.

Son **48 comprobaciones**, más los preparativos de la §0.

Para anotar lo que salga, el molde de siempre: se llena y se pega entero como
prompt.

> **Las dos consolas.** Abajo, «consola de Obsidian» es *Ver → Alternar
> herramientas de desarrollo*. «Terminal» es la terminal de macOS. Cada bloque
> dice cuál.

---

## 0. Sobre qué binario estás probando

Esto va **primero y siempre**, y no es burocracia: en la sesión 6 se
commitearon tres cambios encima mientras la verificación estaba en curso, y dar
por verificado lo que se probó sobre otro `main.js` es el mismo error que el
invariante 10 evita un escalón más abajo.

**Terminal:**

```bash
cd ~/Downloads/claude/obsidian_plugin_TAREAS && echo "commit $(git rev-parse --short HEAD)" && stat -f '%Sm  %z bytes  %N' "$HOME/Downloads/obsidian/mental palace/.obsidian/plugins/tareas-outline/main.js"
```

Pegá esas dos líneas al principio del informe. Si mientras verificás yo
commiteo algo, te voy a decir **qué comprobaciones caducaron y por qué**.

### Y los preparativos

| # | Qué hacer |
|---|---|
| 0a | **Hace falta una segunda nota de prueba.** El reinicio toca varias notas y sin dos no se puede ver lo que importa. Creá `0_inbox/tareas_PRUEBA_2.md` y agregala a «Notas de tareas» en los ajustes |
| 0b | Comprobá que `0_inbox/tareas_PRUEBA.md` sigue en la lista |
| 0c | Dejá **«Congelar el índice»** apagado hasta la §E |

Armate en las **dos** notas algo con esta forma —el texto inventalo vos—:

```
# PRUEBA

- [ ] una hoja suelta
- [ ] una con fecha
- [ ] una madre
	- una nota sin checkbox
	- [ ] una hija
```

## Qué hay ahora

El ⋯ pasa de cuatro ítems a **seis**:

```
Prioridad
  Normal · Alta · Muy alta          ← el vigente, marcado
──────────
Fecha…                (calendar)    ← nuevo
Recurrencia…          (repeat)      ← nuevo
──────────
Completar y descartar (check)
Completar y archivar  (archive)
──────────
Eliminar…             (trash, rojo)
```

Y un comando de paleta más: **«Reiniciar un grupo cíclico…»**.

---

## A. El selector de fecha, en una tarea normal

`⋯ → Fecha…` abre un segundo menú. **La fecha resuelta va en la etiqueta**, y
eso es medio punto de esta sección: sin ella «el lunes» es ambiguo.

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| A1 | Abrir `⋯ → Fecha…` sobre una tarea sin fecha | **Siete** atajos: Hoy, Mañana y cinco días. **Ningún par escribe la misma fecha** — si ves «Hoy · 2 sep» y «Miércoles · 2 sep» juntos, eso es el bug que esta sesión arregló |
| A2 | Mirar las etiquetas | Cada una dice la fecha a la que resuelve: «Lunes · 7 sep». Comprobá que el día de la semana **coincide** con la fecha |
| A3 | Elegir «Hoy» | El aviso dice `Vencimiento: AAAA-MM-DD` con la fecha de hoy |
| A4 | Mirar la línea en la nota | **No se ve nada**: el token está oculto. Poné el cursor al final y movete con la flecha para comprobar que el token está ahí |
| A5 | Apagar «Decoraciones en la nota» en los ajustes y mirar la línea | Ahora se ve `%%t:due=AAAA-MM-DD%%`. Volvé a encenderlo |
| A6 | Volver a abrir `⋯ → Fecha…` | El atajo «Hoy» está **tildado**, y **solo ese** |
| A7 | Elegir «Otra fecha…» | Se abre un modal con `titulo` «Fecha de vencimiento» y un campo de fecha del sistema |
| A8 | Escribir una fecha en el modal | Debajo del campo aparece «Va a escribir: AAAA-MM-DD» **mientras escribís** |
| A9 | Aceptar con Enter, sin tocar el botón | Se cierra y escribe |
| A10 | `⋯ → Fecha… → Sin fecha` sobre esa tarea | Aviso «Sin fecha de vencimiento». Si el `due` era lo único que tenía, **el token entero desaparece** — comprobalo apagando las decoraciones |
| A11 | Sobre una tarea que además está en un workbench (★), sacarle la fecha | El token queda con el `wb` y el `id`, y **la ★ sigue rellena** |

## B. La fecha en una cíclica, y la conversión

Esta es la parte que la §11 hace ambigua y que el paso 6b tuvo que decidir.

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| B1 | Ponerle fecha a una tarea (A3) y después `⋯ → Recurrencia… → Grupo nuevo…`, con nombre `mensual` | **Dos avisos**: uno dice que el vencimiento pasó a ser «día N de cada mes», el otro «Ahora es cíclica, en el grupo «mensual»» |
| B2 | Mirar el token con las decoraciones apagadas | Dice `due=N;rec=mensual`, con **N el día del mes** — no la fecha entera. Y es **una sola** línea de historial: un Ctrl-Z la deja como estaba |
| B3 | `⋯ → Fecha…` sobre esa tarea cíclica | Ahora los atajos son **dos y son días del mes**: «Como hoy · día N» y «Fin de mes · día 31». El título del modal de «Otra fecha…» cambia a «Vencimiento adentro del período» |
| B4 | En «Otra fecha…» de una cíclica | El campo es un **número**, no un calendario, y la descripción explica que 31 en febrero es el 28 |
| B5 | Escribir `40` y aceptar | Se niega con «El día del mes va de 1 a 31» y **no escribe nada** |
| B6 | Elegir «Fin de mes» | Escribe `due=31` |
| B7 | `⋯ → Recurrencia… → No es cíclica` sobre esa | Dos avisos: «Ya no es cíclica» y uno que dice que le quedó «día 31» y cómo cambiarlo. El `due=31` **sigue ahí** |

## C. La recurrencia y los grupos

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| C1 | `⋯ → Recurrencia…` sobre una tarea, con `mensual` ya creado | El menú ofrece **`mensual`**, «Grupo nuevo…» y «No es cíclica». El vigente está tildado |
| C2 | Crear un grupo desde la **otra** nota (`tareas_PRUEBA_2`), llamado `lunes` | Se escribe ahí |
| C3 | Volver a `tareas_PRUEBA` y abrir `⋯ → Recurrencia…` | Ofrece **los dos**, `lunes` y `mensual`: los grupos son globales, no de una nota |
| C4 | En «Grupo nuevo…» escribir `a;b` | Se niega con el aviso de los tres caracteres, y **no escribe nada** |
| C5 | Etiquetar con `lunes` una tarea **madre** que tiene una hija | Se escribe **solo en la línea de la madre**. La hija queda sin `rec` — es la condición de seguridad del reinicio |

## D. El reinicio de un grupo

Antes: dejá **al menos una tarea de `lunes` completada en cada nota**, con el
checkbox o con el ⋯.

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| D1 | Paleta → «Reiniciar un grupo cíclico…» | Se abre un selector con los grupos que existen, filtrable escribiendo |
| D2 | Elegir `lunes` | **Siempre pregunta**, aunque sea una sola tarea: es el único modal que no se puede apagar en los ajustes |
| D3 | Leer el modal | Dice **cuántas tareas y en cuántas notas**, y **cuáles** por nombre. Comprobá que el número coincide con lo que dejaste completado |
| D4 | Cancelar | **No se escribe nada.** Mirá las dos notas |
| D5 | Volver a hacerlo y aceptar | Aviso «N tareas reiniciadas en M notas». Las tareas quedan `[ ]` y **sin fecha de completado** |
| D6 | Mirar el token de una reiniciada, con las decoraciones apagadas | Conserva `wb`, `due` y `rec`. Solo se fue el `done` |
| D7 | Mirar una tarea del grupo que estaba **pendiente** | No la tocó |
| D8 | Mirar una tarea **sin etiqueta** que esté al lado de una del grupo | No la tocó, ni siquiera si estaba `[x]` |
| D9 | Mirar la **hija** de la madre que etiquetaste en C5 | Si la habías completado, **sigue en `[x]`**: el reinicio solo toca lo etiquetado. Decime si eso te molesta en el uso |
| D10 | Reiniciar el mismo grupo otra vez | Dice «No hay nada que reiniciar en «lunes»» y no escribe |
| D11 | Sacarle el `rec` a todas y correr el comando | Dice que no hay ningún grupo todavía, y explica dónde se crean |

## E. Con el índice congelado — la garantía «o todas o ninguna»

Encendé **«Congelar el índice en memoria»** en los ajustes.

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| E1 | Completar dos tareas de `mensual`, una en cada nota, y **teclear cinco líneas arriba** en `tareas_PRUEBA` solamente | El índice queda desfasado en **una** de las dos |
| E2 | Correr el reinicio de `mensual` y aceptar | Se **niega entera**: el aviso dice que **no se escribió nada, en ninguna nota**, y nombra la que falló |
| E3 | Mirar `tareas_PRUEBA_2`, que sí se podía escribir | **No se tocó.** Esto es lo que el paso en seco sobre las N compra, y lo que el archivado no puede dar |
| E4 | Con el índice congelado, `⋯ → Fecha…` sobre una tarea que se corrió | Se niega con el aviso de la línea, y no escribe |
| E5 | **Apagar el congelado** y volver a correr el reinicio | Ahora sí escribe en las dos |

## F. Que lo de antes siga andando

Son los gestos que ya costaron caro. Sobre una tarea **con** token.

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| F1 | Clic en el vacío a la derecha del texto de una tarea | El cursor cae en **esa** línea, no en la de abajo |
| F2 | Flecha derecha desde el final del texto | Cruza el token de **un** teclazo y cae en la línea de abajo |
| F3 | Backspace desde el comienzo de la línea de abajo | Une las dos y queda **una** línea limpia, con un espacio |
| F4 | Enter al final de una tarea | Nace `- [ ] ` y el token se queda **arriba** |
| F5 | **Tildar el checkbox** de una tarea con fecha | Se completa y escribe `done`, **sin tocar el `due`** |
| F6 | Destildarlo | Borra el `done` y deja el `due` |
| F7 | Cmd+clic en el checkbox | Archiva al historial, como antes |
| F8 | Pasar el mouse por el margen izquierdo | Los cinco botones aparecen y no se apagan al ir hacia ellos |
| F9 | Mirar la consola de **Obsidian** mientras scrolleás hacia arriba con la ventana angosta | Contá `Measure loop restarted` y `Viewport failed to stabilize`. La base es **1 y 4**. Si sube, es del plugin — y si no aparece ninguno, decilo igual: **esa línea de base no se reproduce desde hace cuatro sesiones** y no se anota como verde |
