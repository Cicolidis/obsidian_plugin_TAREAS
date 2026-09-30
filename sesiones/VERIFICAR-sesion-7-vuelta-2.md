# Qué verificar — 2.ª vuelta del paso 6b

**Ya está desplegada** (`npm run deploy`). Reiniciá Obsidian o apagá y prendé el
plugin.

Son **28 comprobaciones**. Es corta a propósito: la primera vuelta dejó
44 en verde y esto mira **solo lo que cambió**, más la §C, que es la que la
primera vuelta no pudo mirar.

> **Las dos consolas.** «Consola de Obsidian» es *Ver → Alternar herramientas de
> desarrollo*. «Terminal» es la de macOS.

---

## 0. Sobre qué binario estás probando

**Terminal:**

```bash
cd ~/Downloads/claude/obsidian_plugin_TAREAS && echo "commit $(git rev-parse --short HEAD)" && stat -f '%Sm  %z bytes  %N' "$HOME/Downloads/obsidian/mental palace/.obsidian/plugins/tareas-outline/main.js"
```

**Las dos líneas**, esta vez: la del commit también. En la primera vuelta pegaste
solo la del `stat` y lo pude resolver porque no había commiteado nada; con el
6b commiteado eso ya no alcanza.

## Qué cambió desde la primera vuelta

| | |
|---|---|
| **`resincronizar()` relee lo que se perdió** | Apagar «Congelar el índice» dejaba el índice atrasado **para siempre**. Es lo que hizo fallar E2 y E5 |
| **El margen ya no cobra ancho fuera de las notas de tareas** | El `gutter` existe en todos los editores; ahora solo tiene `padding` donde se usa |
| **El cursor se queda en su lugar al tildar** | Y no solo en una hija: pasaba en toda tarea, la columna 0 lo disimulaba |
| **«1 se había corrido»** | Decía «se habían» siempre |

---

## A. El margen no corre las notas que no son de tareas

*Es el reporte de tu §4. Conviene mirarlo **antes** de tocar nada más.*

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| A1 | Abrir una nota cualquiera que **no** esté en la lista de ajustes, con los números de línea encendidos | El texto arranca **pegado** a los números, sin el hueco de ~22px que reportaste |
| A2 | Abrir `tareas_PRUEBA` | El margen de botones está, y los botones se ven igual que antes |
| A3 | Ponerlas **lado a lado**, en dos paneles | La de tareas tiene el hueco y la otra no, **al mismo tiempo**. Es lo que una clase en `body` no podía hacer |
| A4 | En ajustes, cambiar «Fila de botones: dónde va» a cualquiera que no sea «Columna» | El hueco desaparece **también** en la nota de tareas, sin recargar. Volvelo a «Columna» |
| A5 | Apagar «Fila de botones sobre la tarea» del todo | Ídem: ninguna nota queda con hueco |

## B. El cursor al tildar

*Poné el cursor **en el medio del texto** antes de tildar, no al final: es donde
se ve si se movió.*

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| B1 | Clic en el checkbox de una **hija indentada**, con el cursor en el medio de su texto | El cursor se queda **en esa línea y en esa columna**. Antes saltaba al margen izquierdo, a la altura de la madre |
| B2 | Destildarla | Ídem |
| B3 | Tildar una **madre con hijas** | El cursor se queda donde estaba, aunque el plugin haya reescrito varias líneas |
| B4 | Tildar una tarea con el cursor **al final del texto**, sobre una que ya tiene token | El cursor queda al final del texto visible, **no adentro del token** ni en la línea de abajo |
| B5 | Seleccionar dos palabras del texto de una tarea y tildarla con el teclado | La selección sobrevive, no se convierte en un cursor en la columna 0 |
| B6 | Tildar con Live Preview y mirar la línea | El `- [x] ` **no se desarma**. Ese era el síntoma visible del cursor en la columna 0 |

## C. El reinicio: «o todas o ninguna», ahora sí

*Esta es la sección que la primera vuelta no pudo mirar, y el motivo era mío:
con el índice congelado el plan sale **vacío**, así que nunca llegaba al paso en
seco que quería probar. Para que se niegue no alcanza con que la línea se haya
corrido —si el texto aparece una sola vez, `ubicar.ts` la encuentra y escribe, y
eso está bien—: hace falta que el texto **ya no aparezca**.*

**Preparación, con el índice VIVO (congelado apagado):**

| # | Qué hacer |
|---|---|
| 0a | Etiquetar con `rec=mensual` al menos una tarea en `tareas_PRUEBA` y una en `tareas_PRUEBA_2` |
| 0b | **Completarlas**, con el checkbox |
| 0c | Esperar dos segundos, para que el índice las vea |

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| C1 | Correr «Reiniciar un grupo cíclico…» y **leer el modal sin aceptar**. Cancelar | Dice **2 tareas en 2 notas**, y las nombra. Si dice «no hay nada que reiniciar», el índice todavía no las vio: esperá y probá de nuevo |
| C2 | Encender **«Congelar el índice en memoria»** | — |
| C3 | En `tareas_PRUEBA`, **cambiarle el texto** a la tarea completada del grupo (agregarle una palabra). En `tareas_PRUEBA_2` no tocar nada | El índice sigue creyendo el texto viejo |
| C4 | Correr el reinicio y **aceptar** | Se niega: el aviso dice que **no se escribió nada, en ninguna nota**, y nombra `tareas_PRUEBA` |
| C5 | Mirar `tareas_PRUEBA_2` | **Intacta.** Su tarea sigue en `[x]` con su `done`. Esto es lo único que la §E vino a probar |
| C6 | Mirar `tareas_PRUEBA` | Intacta también |
| C7 | Apagar **«Congelar el índice»**, y **no tocar ningún archivo** | — |
| C8 | Correr el reinicio otra vez | **Ahora sí escribe en las dos.** Antes de este arreglo seguía diciendo «no hay nada que reiniciar» para siempre |
| C9 | Mirar las dos notas | Las dos tareas quedaron `[ ]` y sin `done`, con `rec` y `due` intactos |

## D. Que lo de antes siga andando

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| D1 | Con el índice congelado, teclear cinco líneas arriba de una tarea y ponerle fecha con el ⋯ | **Escribe** —la línea se corrió y es única, así que se encuentra— y el aviso dice «(1 se **había** corrido)», en singular |
| D2 | Clic en el vacío a la derecha del texto de una tarea | El cursor cae en **esa** línea |
| D3 | Flecha derecha desde el final del texto | Cruza el token de un teclazo |
| D4 | Backspace desde el comienzo de la línea de abajo | Une las dos y queda una línea limpia |
| D5 | Enter al final de una tarea | Nace `- [ ] ` y el token se queda arriba |
| D6 | Cmd+clic en el checkbox | Archiva al historial |
| D7 | `⋯ → Fecha…` y `⋯ → Recurrencia…` | Los dos submenús siguen abriendo y escribiendo igual |
| D8 | Mirar la consola de **Obsidian** scrolleando hacia arriba con la ventana angosta | Contá `Measure loop restarted` y `Viewport failed to stabilize`. La base es **1 y 4**. **Van cinco vueltas sin reproducirse**: si no aparece ninguno, decilo igual — no se anota como verde |
