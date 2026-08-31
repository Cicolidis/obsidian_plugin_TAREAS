# Qué verificar — paso 4b, tercera vuelta

**Ya está desplegado.** Corta: **la columna nueva, y si la línea 383 sigue.**

El estilo por omisión pasó a **«en una pastilla»**, que fue el que elegiste de
los que ya existían. La propuesta nueva está en el mismo desplegable como
**«Columna en el margen izquierdo, en pastilla»**.

## Lo que contestaron tus mediciones

| | |
|---|---|
| **G3** — el cursor al unir | **Es de Outliner.** Con Outliner apagado no falla nunca, y los tres filtros dejan el cursor en la costura con las cinco formas de unión. No lo corrijo desde acá: sería pelearle una selección a un plugin que la puso a propósito |
| **G2** — la flecha entra al `- [ ] ` | **Es de Obsidian.** El espía muestra `168:7 → 168:6 → … → 168:0`, una transacción por tecla, todas con selección explícita. Son posiciones reales del documento y siempre estuvieron. Lo que sí es del plugin es el salto de `168:0` a `167:35`: el token entero de un teclazo |
| **El espía imprimía `%t:id=…%`** | Bug **mío**, y bueno de encontrar: la consola de Chrome trata el primer argumento de `console.log` como cadena de formato, y `%%` es su escape para un `%`. El instrumento mentía sobre lo único que este plugin escribe. Arreglado |

Si G2 llega a molestar de verdad, la salida es hacer atómico el `- [ ] ` para que
la flecha lo cruce de un teclazo. **No lo hice**: cambiaría también qué borra un
Backspace ahí, que es el gesto que dejamos andando en la primera vuelta (borrar
el checkbox convierte la tarea en bullet). Decime si lo querés.

---

## A. La tarea de la línea 383

No la pude reproducir. Monté offline el camino entero —el plan, el diff recortado
como el que despacha Obsidian, la transacción con `userEvent: "set"`— con el
subárbol y con una sola línea, y con el cursor en las cuatro posiciones de la
línea: **no se mueve en ningún caso.** O sea que no es el mapeo de la escritura.

Así que en vez de seguir buscando, la fila ahora **guarda la selección en el
`mousedown` y la devuelve en el `click` si algo la movió.** Entre esos dos
eventos no hay ninguna razón legítima para que el cursor se mueva.

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| A1 | Volver a esa tarea (línea 383, `wb=mensual;p=2;done=…`), cursor **en esa misma línea**, y clickear ★ y ◐ diez veces | El cursor **no se mueve** y el `- [ ] ` no se desarma |
| A2 | Si vuelve a pasar: pegar `scripts/espia-cursor.js` y repetirlo | Copiame las líneas `#N`. Con eso se ve qué transacción lo mueve y con qué `userEvent` |
| A3 | Y decime **qué tiene de distinto esa tarea**: ¿tiene hijas? ¿es la última de su bloque? ¿la fila le queda encima del texto? | Es el dato que me falta |

## B. La columna del margen izquierdo

El orden que pediste, de izquierda a derecha:

```
número de línea · [★][◐][→][⋯] · filete · plegado · [ ] texto de la tarea
```

**Los botones no se mueven nunca.** En reposo se ven solo los de los workbenches
donde la tarea ya está; al pasar el mouse aparecen los cuatro y sale la pastilla.
Los cuatro están siempre en el DOM y lo único que cambia es la opacidad — con
`display: none` la fila está anclada por la derecha y cada botón que aparece
empujaría a los de al lado, o sea que el ★ se correría justo cuando el mouse va
hacia él.

| # | Qué hacer | Qué mirar |
|---|---|---|
| B1 | Estilo **«Columna en el margen izquierdo»**, modo **«Con el mouse sobre la línea»** | Una tarea sin workbench no muestra nada en reposo; una en «foco» muestra el ★ relleno y nada más |
| B2 | Pasar el mouse por esa línea | Aparecen los cuatro y la pastilla, **y el ★ no se movió** |
| B3 | Recorrer una pantalla entera pasando el mouse rápido | Que no queden pastillas de otra línea |
| B4 | El orden contra el filete y el plegado | Que **no se superpongan** y que el orden sea el que pediste |
| B5 | Con la ventana angosta, y con «longitud de línea legible» **apagada** | Si la columna se recorta. Es el riesgo de este estilo y no lo puedo ver desde acá |
| B6 | Modo **«Siempre»** con este estilo | Los cuatro visibles en todas las tareas. ¿Tablero o ruido? |
| B7 | Con la ventana angosta, cambiar entre los seis estilos | **El corte de línea no se mueve** en ninguno |

---

## Plantilla

```
A1 ok  (o: sigue pasando, y la tarea tiene <qué>)
A2: <pegar la salida del espía>
B1 ok · B2 ok · … · B5: <se recorta / no se recorta>
Me quedo con <estilo> + <modo>.
```
