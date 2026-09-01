# Qué verificar — paso 4b, sexta vuelta

**Ya está desplegado.** Tres comprobaciones, todas del mismo arreglo.

## Qué pasaba

Error mío, y de los que no puedo ver. Al pasar la columna a un margen dejé en pie
esta regla:

```css
body.tareas-revelar-hover … .tareas-fila { opacity: 0; pointer-events: none; }
```

Sin decir **cuál** de las dos filas. Hay dos: el widget, que vive adentro de
`.cm-line`, y el marcador del margen, que vive afuera. La regla apagaba las dos,
y el `:hover` de la línea que las volvía a encender **no llega al margen** — así
que ahí los botones no aparecían nunca. En modo «Siempre» sí, porque esa otra
regla los sube a 0,5. Es exactamente lo que reportaste.

Explica los tres síntomas juntos: la manito aparecía porque los botones estaban
ahí, invisibles pero presentes.

Ahora las reglas genéricas dicen `.cm-line`, y el margen tiene la suya propia.

**Y agregué el guardia que faltaba.** `npm run deploy` ahora se niega a desplegar
un `styles.css` donde una regla toque `opacity` o `pointer-events` sobre
`.tareas-fila` sin nombrar `.cm-line` o `.cm-gutter`. Lo probé volviendo a meter
la regla vieja: el despliegue falla. Una cascada de CSS no se puede resolver sin
un navegador, así que cuando el ojo no llega, la regla se convierte en algo que
el pipeline pueda comprobar.

---

## Lo que hay que mirar

Estilo **«Columna en el margen izquierdo»**, modo **«Con el mouse sobre la
línea»**.

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| A1 | Una tarea que ya está en «foco», **sin** tocar nada | Se ve el ★ relleno y **nada más** |
| A2 | Pasar el mouse **por el texto** de esa tarea | Aparecen los cuatro y la pastilla, **y el ★ no se movió** |
| A3 | Mover el mouse rápido de arriba abajo por la nota | La pastilla sigue al mouse y no queda encendida en dos líneas a la vez |

Si A1 y A2 andan, el estilo está terminado y lo único que queda es tu decisión de
cuál usar.

---

## Plantilla

```
A1 ok · A2 ok · A3 ok
Me quedo con <estilo> + <modo>.
```
