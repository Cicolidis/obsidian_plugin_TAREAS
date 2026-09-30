# Qué verificar — paso 4a, cuarta vuelta

Corta: **doce comprobaciones** sobre lo que cambió. Plantilla al final.

## Qué cambió

| Reportaste | Qué se hizo |
|---|---|
| **A3** — bajar a normal decía «Prioridad normal» pero volvía al color de la madre | El guardia mira qué queda **después** de sacarle lo suyo, no de dónde venía |
| **B5, B8** — no se agregaba el espacio con texto suelto abajo, ni con Backspace sin Outliner | La línea de abajo ya no tiene que ser un ítem de lista |
| «que el checkbox se vuelva bullet también con la tarea con texto» | Hecho. El borrado que **cruza líneas** sigue uniendo, no convirtiendo |
| «combiná la barra con el checkbox» | Estilo **«Barra corta + checkbox coloreado»**, y es el nuevo por omisión |

## 0. Antes de empezar

Apagar y prender el plugin. El estilo de prioridad va a arrancar en el
combinado; si preferís otro, está en el desplegable.

---

## A. La prioridad heredada

| # | Qué hacer | Qué tiene que quedar |
|---|---|---|
| A1 | Madre en **muy alta**. Una hija en **alta** propia (subir y bajar desde ahí). Sobre la hija → **Bajar** | Aviso: «Esta tarea hereda la prioridad de su tarea madre…» y **no cambia nada**. Antes decía «Prioridad normal» y volvía al rojo |
| A2 | Bajar la **madre** a normal. Sobre la hija (alta) → **Bajar** | Ahora **sí**: «Prioridad normal.» y queda sin marca |

## B. Unir

| # | Preparás | Qué hacer | Qué tiene que quedar |
|---|---|---|---|
| B1 | Tarea, y debajo **texto suelto** sin bullet | Unir | `- [ ] tarea texto suelto` — **con** espacio |
| B2 | Dos tareas, **con Outliner**, borrando el checkbox de abajo primero | Unir con Backspace | Los textos con un espacio en el medio |
| B3 | Lo mismo **sin Outliner** | Unir con Backspace | Ídem |
| B4 | Lo mismo | Unir con **Suprimir** | Ídem |
| B5 | Apagar «Unir tareas deja una línea limpia» y repetir B1 | | Se une sin espacio, como antes |

## C. El checkbox que se vuelve bullet

| # | Qué hacer | Qué tiene que quedar |
|---|---|---|
| C1 | Cursor al **comienzo del texto** de una tarea con texto → **Backspace** | Queda **`- texto`**: el checkbox entero se fue de un teclazo |
| C2 | Sobre esa misma línea, **Backspace** de nuevo | Ahora sí se une con la de arriba, o borra el `- ` |
| C3 | Si la tarea **tenía token**, mirar C1 | El token **queda a la vista**. Es a propósito: la línea ya no es una tarea y esos metadatos quedaron huérfanos. Decime si preferís que se sigan escondiendo |

## D. El estilo combinado

| # | Qué mirar |
|---|---|
| D1 | La barra corta en el margen **y** el checkbox coloreado, juntos |
| D2 | ¿Se distinguen alta y muy alta **sin mirar el color**? (altura de la barra, anillo del checkbox) |
| D3 | Con tareas contiguas de distinta prioridad, y con un árbol de varios niveles |

---

## Plantilla de respuesta

````text
# Verificación del paso 4a — cuarta vuelta

A1  ok / MAL:
A2  ok / MAL:

B1  ok / MAL:
B2  ok / MAL:
B3  ok / MAL:
B4  ok / MAL:
B5  ok / MAL:

C1  ok / MAL:
C2  ok / MAL:
C3  ok / MAL:   ← ¿preferís que el token se siga escondiendo?  sí / no

D1  ok / MAL:
D2  ¿se distinguen sin color?  sí / no —
D3  —
Qué le cambiarías al estilo combinado:

## Otras cosas que noté
````
