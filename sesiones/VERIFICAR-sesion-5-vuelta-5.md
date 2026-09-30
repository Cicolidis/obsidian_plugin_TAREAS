# Qué verificar — paso 4b, quinta vuelta

**Ya está desplegado.** Muy corta: **seis comprobaciones**, todas sobre la
columna del margen.

## Qué cambió

| Reportaste | Qué se hizo |
|---|---|
| **A1-A4** | En verde. El cursor queda cerrado |
| **B1/B4/B5/B6** — los botones no aparecen al pasar el mouse por la tarea | **Arreglado.** El `:hover` del CSS no podía: un margen es **hermano** de la línea, no su hijo, y `:hover` no cruza de costado |
| **B3** — el ⋯ se superpone con el filete | **Arreglado**, con un hueco. El valor hay que mirarlo |
| **B8** — «no sé a qué te referís» | Culpa mía. Abajo, dicho en castellano |

### Por qué el hover no funcionaba

Con la fila adentro de la línea alcanzaba `.cm-line:hover .tareas-fila`, porque
la fila era descendiente de la línea. Un margen de CodeMirror no lo es: es
hermano del contenido. Por eso solo aparecía la manito apuntando a la columna
angosta — estabas encontrando el único lugar donde el `:hover` sí llegaba.

Ahora hay un oyente que publica **qué línea tiene el mouse encima** y el margen
lo lee. Es **uno** para todo el editor, no uno por fila, y el modo de revelación
sigue siendo el ajuste: en móvil no hay `mousemove` y esto nunca se enciende.

### Y el filete se metía en el margen

El filete se dibuja a `-1.9rem` del borde de la línea, o sea **fuera** de la caja
del contenido, así que se metía en la zona del margen. No es problema de uno ni
del otro: es que uno se dibuja en coordenadas del otro. Ahora el margen deja un
hueco a la derecha (`1.4rem`). Si quedó mucho o poco, decímelo con un número.

---

## Lo único que hay que mirar

Estilo **«Columna en el margen izquierdo»**, modo **«Con el mouse sobre la
línea»**.

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| A1 | Pasar el mouse **por el texto** de una tarea | Aparecen los cuatro botones y la pastilla, sin tener que apuntarle a la columna |
| A2 | Una tarea que ya está en «foco», **sin** pasar el mouse | Se ve el ★ relleno y nada más |
| A3 | Pasar el mouse por esa misma | Aparecen los cuatro, **y el ★ no se movió** |
| A4 | Mirar el ⋯ contra el filete de una tarea con prioridad | **No se tocan.** Si el hueco quedó grande o chico, decime cuánto |
| A5 | Recorrer una pantalla entera moviendo el mouse rápido de arriba abajo | La pastilla sigue al mouse y no queda encendida en dos líneas |
| A6 | Escribir sobre una tarea con el mouse quieto encima | La pastilla **no parpadea** |

### Y lo de «corte de línea», que expliqué mal

Es dónde una tarea larga **pasa al renglón de abajo**. Angostá la ventana hasta
que una tarea ocupe dos renglones, y mirá en qué palabra corta. Después cambiá
entre los seis estilos de fila: **tiene que cortar en la misma palabra siempre**.
Si un estilo la hace cortar antes, es que la fila está sumando ancho al renglón,
y eso es lo que el diseño entero viene evitando.

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| A7 | Lo de arriba, con los seis estilos | Corta en la misma palabra en todos |

---

## Plantilla

```
A1 ok · A2 ok · A3 ok · A4 ok (o: el hueco quedó <grande/chico>) · A5 ok · A6 ok · A7 ok
Me quedo con <estilo> + <modo>.
```
