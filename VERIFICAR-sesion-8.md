# Qué verificar — paso 6c: «archivar y reiniciar», y los cuatro pedidos

**Ya está desplegada** (`npm run deploy`). Reiniciá Obsidian o apagá y prendé el
plugin.

Son **68 comprobaciones**, más los preparativos de la §0.

Para anotar lo que salga, el molde de siempre: se llena y se pega entero como
prompt. **El molde se llena, nunca se edita**: lo que sobra se deja vacío.

> **Las dos consolas.** Abajo, «consola de Obsidian» es *Ver → Alternar
> herramientas de desarrollo*. «Terminal» es la terminal de macOS. Cada bloque
> dice cuál.

---

## 0. Sobre qué binario estás probando

Esto va **primero y siempre**: dar por verificado lo que se probó sobre otro
`main.js` es el mismo error que el invariante 10 evita un escalón más abajo.

**Terminal:**

```bash
cd ~/Downloads/claude/obsidian_plugin_TAREAS && echo "commit $(git rev-parse --short HEAD)" && stat -f '%Sm  %z bytes  %N' "$HOME/Downloads/obsidian/mental palace/.obsidian/plugins/tareas-outline/main.js"
```

Pegá esas dos líneas al principio del informe. Si mientras verificás yo
commiteo algo, te voy a decir **qué comprobaciones caducaron y por qué**.

### Y los preparativos

**Esta sesión escribe en el historial**, así que lo primero es una copia.

**Terminal:**

```bash
cd "$HOME/Downloads/obsidian/mental palace/0_inbox" && cp tareas_LOG_PRUEBA.md "tareas_LOG_PRUEBA.copia-$(date +%H%M).md" && ls -la tareas_LOG_PRUEBA*
```

| # | Qué hacer |
|---|---|
| 0a | Comprobá que **«Nota de historial»** en los ajustes apunta a `0_inbox/tareas_LOG_PRUEBA.md`. Si apunta al real, cambialo antes de seguir |
| 0b | Que `tareas_PRUEBA.md` y `tareas_PRUEBA_2.md` sigan en «Notas de tareas» |
| 0c | «Congelar el índice» **apagado** hasta la §F |
| 0d | En ajustes hay cuatro cosas nuevas: **«Indicadores de fecha y de recurrencia»** (dos interruptores), **«Fecha: en qué orden se ofrecen los atajos»**, **«"Otra fecha…": cómo se elige»** y **«Grupos de reinicio sugeridos»** |

## Qué hay ahora

La fila pasa de cinco botones a **siete**:

```
en la nota:    [★] [◐] [→] [⋯] [🗑] [📅] [🔁]
en el margen:  [🔁] [📅] [🗑] [⋯] [→] [◐] [★]  texto de la tarea
                                              └─ el ★ sigue pegado al texto
```

Y la confirmación del reinicio pasa a tener **dos caminos**:

```
[Cancelar]  [Archivar y reiniciar]  [Reiniciar]
    ↑
    el foco arranca acá: ninguno de los dos puede recibir un Enter reflejo
```

---

## A. Los dos indicadores de la fila

Son el **único** lugar donde se ve que una tarea tiene fecha o grupo: el token
está oculto. Un clic **abre el submenú, nunca escribe solo**.

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| A1 | Mirar una tarea **sin** fecha ni grupo | Los dos indicadores están, apagados. Con «Revelar: al pasar el mouse» aparecen recién con el mouse encima |
| A2 | Ponerle fecha desde el ⋯ | El 📅 **queda encendido**, y se ve **sin** pasar el mouse |
| A3 | Pasarle el mouse al 📅 | El tooltip dice «Vence el 7 sep 2026», **con el año** |
| A4 | Ponerle un grupo de reinicio | El 🔁 queda encendido y su tooltip dice «Cíclica, en el grupo «…»» |
| A5 | En una tarea **cíclica con fecha**, mirar el tooltip del 📅 | Dice **las dos cosas**: «Vence el día 10 de cada mes; el próximo, el 10 sep». Probá con un día **ya pasado** —si hoy es 20, poné `due=5`— y fijate que la fecha que muestra es la del mes que viene |
| A6 | Clic en el 📅 | Se abre el submenú de fecha, el mismo del ⋯. **No escribe nada por sí solo** |
| A7 | Clic en el 🔁 | Se abre el submenú de recurrencia |
| A8 | Sacarle la fecha («Sin fecha»), con otra tarea **con** fecha justo arriba | El 📅 se apaga **y su lugar queda**: el ★ está a la misma distancia del texto en las dos |
| A9 | Sobre una tarea con el **token roto** (`%%t:zz=1%%`) | Los siete botones apagados, y los siete dicen que el token es ilegible |
| A10 | **Angostá la ventana** hasta la mitad y mirá el margen izquierdo | Contame si el margen se comió demasiado texto. Es lo único de esta sección que no puedo ver |
| A11 | Apagar los dos indicadores en ajustes | La fila vuelve a cinco botones **sin recargar nada**, y el margen se angosta |

### Y el ancho del margen, medido

`scripts/espia-margen.js` se ejecuta al pegarlo y no deja nada: para medir dos
veces hay que pegarlo dos veces. Con el margen a la vista, en la **consola de
Obsidian**, pegalo **con los indicadores encendidos**, anotá la fila
`tareas-margen` de la tabla, apagá los dos en ajustes y pegalo de nuevo.

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| A12 | Comparar los dos anchos de `tareas-margen` | La diferencia es lo que cuestan los dos indicadores. Decime el número, no si «se ve bien» |

## B. Los tres órdenes de atajos de fecha

Se cambian en ajustes y tienen efecto **sin recargar**: abrí `⋯ → Fecha…`
después de cada cambio. El de por omisión es el que ya tenías.

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| B1 | Con **«Hoy, mañana y la semana de lunes a domingo»** | Es el de siempre: los días van de lunes a domingo pase lo que pase. **De miércoles a domingo eso deja los más cercanos al final** —un jueves, el sábado y el domingo quedan después del miércoles—, que es lo que decías que no te convencía. De lunes a martes no se nota: fijate qué día es hoy antes de anotar |
| B2 | Cambiar a **«en orden de fecha»** | La lista arranca en hoy y sigue día por día. Siete ítems |
| B3 | Cambiar a **«hoy, mañana, pasado, en una semana…»** | Seis ítems, y el último es «En 30 días» |
| B4 | En los tres, mirar si dos ítems dicen la misma fecha | **Ninguno la repite**, ningún día del año. Si ves dos iguales, es un bug |
| B5 | En los tres, mirar el tilde sobre una tarea que ya tiene fecha | Marca **uno solo** |
| B6 | Decime cuál te convence | Es lo único de esta sección que no se decide desde acá |

## C. «Otra fecha…»: las dos formas de elegir

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| C1 | Con **«El selector del navegador»**, `⋯ → Fecha… → Otra fecha…` | Se abre el modal y el calendario del navegador aparece solo. Si no aparece, el campo sigue funcionando y su ícono lo abre |
| C2 | Cambiar a **«Una grilla dibujada por el plugin»** y volver a abrir | Aparece un mes con `‹ septiembre 2026 ›`, lunes primero, y **hoy con un borde** |
| C3 | Clic en un día | **Elige, no acepta**: el campo se pone al día y abajo dice «Va a escribir: …» |
| C4 | Aceptar | Escribe **lo mismo** que dice la línea «va a escribir» |
| C5 | Navegar dos meses adelante y dos atrás | El mes cambia, la grilla **no cambia de alto** y el modal no salta |
| C6 | Escribir una fecha a mano en el campo, de otro mes | La grilla **se va a ese mes** y marca el día |
| C7 | En una tarea **cíclica**, abrir «Otra fecha…» con la grilla | Son los **31 días del mes**, sin semanas: ahí el selector del navegador no ofrece nada |
| C8 | Elegir el 31 y aceptar | Escribe `due=31`, y el aviso dice que guarda el día del mes y no la fecha |

## D. La recurrencia: las más usadas, la semilla y la tecla

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| D1 | En una tarea **sin ningún grupo en el vault**, abrir `⋯ → Recurrencia…` | Ofrece **«1 · semanal»** y **«2 · mensual»**: la semilla. Antes no ofrecía nada |
| D2 | Apretar la tecla `2` con el menú abierto | Etiqueta la tarea con `mensual` y cierra el menú |
| D3 | Etiquetar tres tareas con `mensual` y una con `lunes` | — |
| D4 | Volver a abrir el submenú | **`mensual` primero**, ordenado por uso, y los sugeridos que ya existen no se repiten |
| D5 | Cambiar «Grupos de reinicio sugeridos» a `quincenal, anual` | El submenú los ofrece detrás de los que están en uso, sin recargar |
| D6 | Dejar el campo **vacío** | No sugiere nada; los que existen se siguen ofreciendo |
| D7 | Escribir `con;punto` en el campo de sugeridos | Se descarta ese nombre: rompería el token |
| D8 | Abrir el submenú, **cerrarlo con Escape**, y escribir un `2` en la nota | Escribe el dígito. El atajo numérico **no sobrevive** al menú que lo puso |

## E. «Archivar y reiniciar»

La sección de esta sesión. **Escribe en `tareas_LOG_PRUEBA.md`**, del que ya
tenés copia.

**Preparación, con el índice VIVO:**

| # | Qué hacer |
|---|---|
| 0e | Etiquetar con `rec=mensual` **al menos dos** tareas en `tareas_PRUEBA` y **una** en `tareas_PRUEBA_2`. Que una de las de `tareas_PRUEBA` tenga hijos y una nota sin checkbox |
| 0f | **Completarlas** con el checkbox, y esperar dos segundos |

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| E1 | Correr «Reiniciar un grupo cíclico…» y elegir `mensual` | El modal tiene **tres botones** y el foco está en **«Cancelar»** |
| E2 | Leer el modal | Dice cuántas tareas y en cuántas notas, **y** cuántas líneas van al historial y cuántas secciones se crean |
| E3 | Apretar Enter sin tocar nada | **No pasa nada**: el foco está en Cancelar |
| E4 | Cancelar y mirar las tres notas y el historial | **Nada escrito, en ningún lado** |
| E5 | Volver a correrlo y apretar **«Archivar y reiniciar»** | Aviso: «N tareas reiniciadas en M notas, y K líneas al historial» |
| E6 | Abrir `tareas_LOG_PRUEBA.md` | Hay una sección por **nota de origen**, con los bloques adentro |
| E7 | Contar los headings de nivel 1 del historial | **Uno por nota**, aunque `tareas_PRUEBA` haya aportado dos tareas. Es el invariante 6 |
| E8 | Mirar el bloque de la tarea con hijos | Está **el subárbol entero**, notas sin checkbox incluidas, **sin checkboxes y sin token** |
| E9 | Mirar la marca de fecha | La raíz lleva `[✓ AAAA-MM-DD]`. **Si la completaste hoy las dos fechas coinciden y esto no discrimina**: para verlo, apagá las decoraciones y cambiale el `done` a mano a una fecha vieja antes de archivar. Es el dato que el reinicio estaba por borrar |
| E10 | Mirar las notas | Las etiquetadas quedaron `[ ]` y sin `done`; el `due`, el `rec` y los workbenches **siguen** |
| E11 | Mirar una tarea **sin** etiqueta que esté al lado | **No se tocó**, ni siquiera si estaba `[x]` |
| E12 | Volver a completar las mismas y **archivar y reiniciar otra vez** | El historial recibe los bloques de nuevo, **debajo de las mismas secciones**: no se crea ningún heading más |
| E13 | Ahora elegir **«Reiniciar»** a secas | Destilda igual y **no escribe nada en el historial** |
| E14 | Con todas las del grupo ya pendientes, correr el reinicio | «No hay nada que reiniciar en «mensual»», y no escribe |
| E15 | Cambiar «Nota de historial» a una ruta que no existe y correr el reinicio | El botón «Archivar y reiniciar» **no aparece** y el modal dice por qué. Es el único caso en que no se ofrece: se archiva exactamente lo que el reinicio toca. **Volvé a poner la ruta buena** |

## F. Con el índice congelado: no se escribe en el historial tampoco

*Es la garantía que esta sesión tiene que dar y la que ningún test offline puede
probar. Para que se niegue no alcanza con que la línea se haya corrido —si el
texto aparece una sola vez, `ubicar.ts` la encuentra y escribe—: hace falta que
el texto **ya no aparezca**.*

**Preparación, con el índice VIVO:** volvé a etiquetar y completar una tarea de
`mensual` en cada una de las dos notas, y esperá dos segundos.

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| F1 | Correr el reinicio y **leer el modal sin aceptar**. Cancelar | Dice 2 tareas en 2 notas. Si dice que no hay nada, el índice todavía no las vio: esperá |
| F2 | Encender **«Congelar el índice en memoria»** | — |
| F3 | En `tareas_PRUEBA`, **cambiarle el texto** a la tarea completada del grupo. En `tareas_PRUEBA_2` no tocar nada | El índice sigue creyendo el texto viejo |
| F4 | Anotar el tamaño del historial | **Terminal:** `wc -l "$HOME/Downloads/obsidian/mental palace/0_inbox/tareas_LOG_PRUEBA.md"` |
| F5 | Correr el reinicio y apretar **«Archivar y reiniciar»** | Se niega: el aviso dice que **no se escribió nada, en ninguna nota NI en el historial** |
| F6 | Volver a contar las líneas del historial | **El mismo número que en F4.** Esto es lo único que esta sección vino a probar |
| F7 | Mirar `tareas_PRUEBA_2` | Intacta: su tarea sigue en `[x]` con su `done` |
| F8 | Apagar «Congelar el índice» y **no tocar ningún archivo** | — |
| F9 | Correr «Archivar y reiniciar» otra vez | Ahora sí: escribe en las dos **y** en el historial |

## G. Que lo de antes siga andando

Los gestos que ya costaron caro. Sobre una tarea **con** token.

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| G1 | Clic en el vacío a la derecha del texto de una tarea | El cursor cae en **esa** línea, no en la de abajo |
| G2 | Flecha derecha desde el final del texto | Cruza el token de **un** teclazo |
| G3 | Backspace desde el comienzo de la línea de abajo | Une las dos y queda una línea limpia |
| G4 | Enter al final de una tarea | Nace `- [ ] ` y el token se queda arriba |
| G5 | **Tildar el checkbox** de una tarea con fecha | Se completa, escribe `done`, **no toca el `due`**, y **el cursor se queda donde estaba** |
| G6 | Cmd+clic en el checkbox | Archiva al historial |
| G7 | Abrir una nota que **no** es de tareas, al lado de una que sí | El margen **no le cobra ancho** a la que no lo usa |
| G8 | Pasar el mouse por el margen de una nota de tareas | Los siete botones aparecen y no se apagan al ir hacia ellos |

## H. El ciclo de medición, con instrumento

Esto **reemplaza** la comprobación que se pidió a ojo seis veces y nunca dio un
número. Si esta vez tampoco lo da, esa comprobación **sale del método** y la
§5.5 se corrige.

**Consola de Obsidian**, con una nota larga de tareas abierta y **la ventana
angostada**: pegá entero el contenido de `scripts/espia-medicion.js` y después:

```
await medicion.subir()
```

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| H1 | Leer la línea `parche comprobado` | Si dice **NO**, el resto no vale nada y hay que decirlo |
| H2 | Anotar los dos contadores y el ancho del editor | La base de la §5.5 es **1 y 4**. Cualquier número sirve; **cero también es un resultado** y hay que escribirlo |
