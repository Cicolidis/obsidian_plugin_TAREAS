# Qué verificar — paso 4b, cuarta vuelta

**Ya está desplegado.** Corta: **el cursor y la columna nueva.**

## Qué cambió

| Reportaste | Qué se hizo |
|---|---|
| **A1/A2** — el cursor salta a la columna 0 al asignar | **Arreglado**, y tu espía lo resolvió. No era el clic: era la escritura |
| **B1/B4/B5** — la columna se recorta y se superpone con los números | **Rehecha como margen de CodeMirror**, que es una columna de verdad |

### Lo que el espía mostró, que dos vueltas no habían podido ver

```
#103 376:0 → 376:41  ← selección explícita  · doc +0  · select.pointer
#104 376:41 → 376:0                          · doc +30 · set
```

El clic (#103) deja el cursor en la columna 41. **La transacción `set` que trae
de vuelta nuestra propia escritura (#104) lo manda a la 0**, y sin poner ninguna
selección explícita: lo mueve el mapeo.

Mi reproducción de la vuelta anterior no lo encontró porque usaba un diff
**mínimo**, carácter a carácter — ahí el cambio empieza adentro del token, o sea
después del cursor, y no lo toca. El de Obsidian arranca en el comienzo de la
línea, y una posición adentro de un rango reemplazado mapea al comienzo del
rango. Esa diferencia era todo.

Ahora hay un filtro que aplica la regla del invariante 10 al cursor: **la línea
se identifica por su texto visible, no por su número.** Si ese texto no aparece,
o aparece repetido y la línea se movió, no toca nada.

---

## A. El cursor

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| A1 | La tarea de siempre (la 376), cursor **en el medio de su texto**, y clickear ★ diez veces | El cursor **se queda donde estaba** y el `- [ ] ` no se desarma |
| A2 | Igual con ◐, y con una tarea **con hijas** | Ídem |
| A3 | Cursor en **otra** línea, y asignar desde la fila | Tampoco se mueve |
| A4 | Con el cursor **al final del texto** de la tarea (antes del token) | Se queda ahí |

Puede que el clic siga moviendo el cursor a la columna donde clickeaste: eso es
CodeMirror leyendo la selección del DOM de forma asíncrona, y **no** es lo que
desarmaba el checkbox. Si te molesta, decilo y lo miramos aparte.

## B. La columna, ahora como margen propio

Es un `gutter` de CodeMirror: una columna de verdad, no algo posicionado adentro
de la línea. De ahí salen las tres cosas que faltaban.

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| B1 | Estilo **«Columna en el margen izquierdo»**, con «longitud de línea legible» **apagada** | **No se recorta nada.** Era el caso que fallaba |
| B2 | Mirar el orden | `número de línea · [★][◐][→][⋯] · filete · plegado · [ ] texto` |
| B3 | Mirar los números de línea | **Nada se superpone**: son dos columnas distintas |
| B4 | Encender y apagar «Fila de botones» | La columna aparece y desaparece, y el texto se corre solo |
| B5 | Una tarea en «foco», sin pasar el mouse | Se ve el ★ relleno y nada más |
| B6 | Pasar el mouse por esa línea | Aparecen los cuatro y la pastilla, **y el ★ no se movió** |
| B7 | Una nota **sin** tareas, con este estilo | La columna no ocupa lugar |
| B8 | Cambiar entre los seis estilos con la ventana angosta | El corte de línea no se mueve |

---

## Plantilla

```
A1 ok · A2 ok · A3 ok · A4 ok
B1 ok · … · B8 ok
Me quedo con <estilo> + <modo>.
```
