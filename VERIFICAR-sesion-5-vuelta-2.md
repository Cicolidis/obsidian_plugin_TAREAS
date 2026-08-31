# Qué verificar — paso 4b, segunda vuelta

**Ya está desplegado.** Reiniciá Obsidian o apagá y prendé el plugin.

Corta: **una falla arreglada, dos que no pude reproducir, y el diseño para
mirar.** Lo primero son diez minutos; lo del diseño es la parte larga.

## Qué cambió

| Reportaste | Qué se hizo |
|---|---|
| **Falla errática** — al asignar, el cursor salta al comienzo de la línea y desarma el checkbox | **Arreglado**, con mecanismo leído. El `preventDefault` estaba en cada botón y no en la fila: un clic en el relleno o entre dos botones quedaba descubierto, el navegador ponía el caret al lado de la isla `contenteditable="false"` y `posFromDOM` lo resuelve en `line.from` |
| **C6** — Cmd+Z deshace la asignación | **No es una falla: la guía estaba mal.** Ver abajo |
| **G3** — el cursor después de unir | **No reproducido.** Mi hipótesis falló su propio test y la reverti. Va un instrumento |
| **G2** — las flechas llegan antes del checkbox | **No reproducido.** Mismo instrumento |
| El filete a medio camino en tareas de dos renglones | **Arreglado**, y hay una variante nueva para comparar |
| «No me convence el diseño de los botones» | **Cinco estilos** en un desplegable nuevo, incluido el tuyo |

## Sobre C6: me equivoqué yo, no el plugin

La guía decía que Cmd+Z **no** iba a deshacer la asignación. Lo deshace, y tenías
razón en anotarlo. La spec afirmaba lo mismo en cuatro lugares y estaba mal: la
escritura vuelve al editor como cambio externo, y **esa transacción entra al
historial de deshacer del editor**.

El límite importa y ya está escrito en la spec: **solo con la nota abierta.** Una
escritura sobre una nota cerrada —la vista de workbenches del paso 5, el
archivado al LOG del paso 6— no tiene ningún historial detrás. O sea que a veces
se deshace y a veces no, que es peor que nunca, y por eso la confirmación de la
§11 se justifica igual.

**Nada que verificar acá.** Va como aviso de que el comportamiento es ese.

---

## A. La falla errática del cursor

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| A1 | Poner el cursor **en la misma línea** de una tarea y clickear el **★** veinte veces, apuntando a propósito al **borde** del botón, al hueco entre dos, y al espacio vacío a la izquierda de la fila | El cursor **no se mueve** ninguna de las veinte, y el `- [ ] ` nunca se desarma |
| A2 | Lo mismo con el **◐**, el **→** y el **⋯** | Ídem |
| A3 | Repetirlo con el estilo **«en una pastilla»**, que tiene más superficie sin botón | Ídem |

Si vuelve a pasar, decime **dónde exactamente** clickeaste: el mecanismo está
identificado y el que quede sería una superficie que no cubrí.

## B. El filete de prioridad

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| B1 | Una tarea `p=2` cuyo texto ocupe **dos o tres renglones** | La barra queda **al lado del checkbox**, en el primer renglón. Antes flotaba en el medio |
| B2 | Una tarea `p=1` igual de larga | Ídem, y sigue siendo **más corta** que la de `p=2` |
| B3 | Sus hijas | La hairline sí cubre todos sus renglones: el bloque se lee como uno |
| B4 | En ajustes, «Prioridad: cómo se dibuja» → **«Barra que cubre toda la tarea»** | La barra cubre los renglones de la tarea; el nivel se lee por el **ancho** y por las muescas. Decime cuál de las dos preferís |

## C. Los cinco estilos de fila

Ajuste nuevo: **«Fila de botones: dónde va»**. Se cambian en caliente. Miralos
con la nota real, no con una tarea suelta: la pregunta es cómo se ve una pantalla
entera.

| Estilo | Qué mirar |
|---|---|
| **Sobre el final de la línea, con degradado** | El actual |
| **Sobre el final de la línea, sin fondo** | Botones más chicos, sin caja. ¿El texto que queda debajo molesta? |
| **En una pastilla** | Los cuatro se leen como **un** control. ¿Se siente más sólido o más pesado? |
| **En el margen derecho** | **No puede tapar una palabra.** Mirá si se recorta con la ventana angosta, y con «longitud de línea legible» apagada |
| **Antes del checkbox** | Columna fija a la izquierda: todas las filas alineadas, sin importar la indentación. El filete se corre solo a 6rem para no quedar debajo. Mirá si el margen alcanza |

Y los dos últimos **con los dos modos de revelación**, que es lo que pediste:

| # | Qué hacer | Qué mirar |
|---|---|---|
| C1 | «Antes del checkbox» + «Con el mouse sobre la línea» | Que aparezca sin mover nada |
| C2 | «Antes del checkbox» + **«Siempre»** | Una columna permanente de botones. ¿Es ruido o es un tablero? |
| C3 | «En el margen derecho» + **«Siempre»** | Ídem del otro lado |
| C4 | En los cinco, con la ventana angosta | **El corte de línea no se mueve** al cambiar de estilo |

## D. Lo que no pude reproducir: G2 y G3

Los tests con los tres filtros puestos dan siempre la costura, con las cinco
formas de unión, con token y sin token. Lo que falta es lo que no está en los
tests: **Outliner interceptando la tecla**, y lo que Obsidian despacha detrás.

Hay un instrumento nuevo. **Consola de Obsidian** (*Ver → Alternar herramientas
de desarrollo*), con el foco en el editor, pegar entero el contenido de
`scripts/espia-cursor.js`. Después:

| # | Qué hacer | Qué copiarme |
|---|---|---|
| D1 | Reproducir **G3**: unir dos tareas con Backspace hasta que el cursor quede mal | Las líneas que imprima el espía, tal cual. La que dice **«← selección explícita»** es la que manda |
| D2 | Reproducir **G2**: flecha izquierda desde el comienzo del texto hasta pasar el checkbox | Ídem |
| D3 | Repetir D1 y D2 **con Outliner desactivado** | Si con Outliner apagado el cursor queda bien, ya sabemos de quién es |

`espiaCursor.off()` para sacarlo.

---

## Plantilla

```
A1 ok · A2 ok · A3 ok
B1 ok · B4: prefiero <cuál>
C: me quedo con <estilo> + <modo>, porque <…>
D1: <pegar la salida del espía>
D2: <pegar la salida del espía>
D3: con Outliner apagado <pasa / no pasa>
```
