# Qué verificar — paso 4a: decoración pasiva sobre la nota

El comportamiento del editor —cursor, teclado, cómo se ve algo— no se puede
comprobar desde Claude Code. Esto es la lista de qué mirar, con **qué tiene que
quedar exactamente** en cada caso y **qué significa si falla**, no un «probalo a
ver».

Al final hay una **plantilla de respuesta** para copiar, completar y pegar en la
próxima sesión.

Hay dos consolas y conviene no confundirlas:

- **la terminal**, donde corren `npm ...`;
- **la consola de Obsidian**: *Ver → Alternar herramientas de desarrollo*.

Cada bloque dice cuál usa.

**Las teclas están escritas para este Mac.** No hay tecla `Fin` ni `Inicio` en
el teclado del portátil: van `Cmd+→` y `Cmd+←`, que en Obsidian corren el mismo
comando que `End` y `Home` —verificado adentro del asar 1.13.7, donde
`key:"End"` y `mac:"Cmd-ArrowRight"` apuntan a la misma función—. `Fn+→` y
`Fn+←` también sirven: producen el código de `End` y `Home`.

---

## 0. Antes de empezar

### 0.1 — Desplegar y recargar *(terminal)*

Ya está desplegado, pero si tocaste algo:

```bash
npm run deploy
```

En Obsidian: *Configuración → Complementos de la comunidad* → apagar y volver a
prender **Tareas (outline)**. Recargar el plugin hace falta porque las clases de
los indicadores se ponen en `body` al cargar.

### 0.2 — Los ajustes que vas a usar

En *Configuración → Tareas (outline)* hay tres controles nuevos:

| Ajuste | Cómo arranca | Para qué |
|---|---|---|
| **Decoraciones en la nota** | encendido | apagarlo es el A/B del bloque H |
| **Prioridad: filete con textura** | encendido | indicador de forma 1 |
| **Prioridad: signo al final del texto** | **apagado** | indicador de forma 2 |

Tu `data.json` es anterior a esta sesión, así que los tres van a tomar el valor
por omisión la primera vez. Es lo correcto: el glifo arranca apagado a propósito.

También conviene dejar **«Registrar eventos en la consola»** encendido — ya lo
está — porque el bloque I lo usa.

### 0.3 — Cargar la nota de prueba de tokens

Todo se prueba en **`0_inbox/tareas_PRUEBA.md`**. Hoy tiene 13 tokens en 436
líneas, y con eso el bloque H **no prueba nada**: trece líneas que se acortan
cuarenta caracteres es ruido para el mapa de alturas.

1. Abrí `0_inbox/tareas_PRUEBA.md`.
2. Poné el cursor sobre una tarea **raíz** (una que tenga hijos).
3. Paleta de comandos → **«Asignar la tarea del cursor al workbench favorito»**.
   Escribe el subárbol entero de una vez.
4. Repetilo sobre otras nueve o diez raíces, eligiendo las que tengan más hijos.
5. Objetivo: **más de 100 líneas con token**. Para contarlo, en la terminal:

```bash
grep -c '%%t:' "$HOME/Downloads/obsidian/mental palace/0_inbox/tareas_PRUEBA.md"
```

> Si preferís no cargarla, se puede hacer igual todo menos el bloque H. Pero
> entonces el bloque H queda **sin hacer**, no «en verde»: decilo así en la
> plantilla.

---

## A. El token invisible

Con Live Preview puesto (no modo fuente, no modo lectura).

| # | Qué hacer | Qué tiene que quedar | Si falla, qué significa |
|---|---|---|---|
| A1 | Mirar una tarea que ya tenga token | El `%%t:…%%` **no se ve**. La línea termina donde termina el texto | La decoración no se está aplicando: revisá el interruptor y que la nota esté en la lista |
| A2 | Mirar el **espacio** antes de donde estaba el token | No hay un espacio suelto colgando al final | El tramo se calculó desde el `%%` y no desde el fin del texto |
| A3 | Pasar a **modo fuente** (paleta de comandos → buscar «código fuente», o el menú ⋯ de la nota) | El token **se ve entero** | El gate de Live Preview no está funcionando; en modo fuente hay que poder arreglarlo a mano |
| A4 | Pasar a **modo lectura** | El token **no se ve** | Eso no lo hace el plugin: `%%…%%` es comentario nativo. Si se ve, hay algo raro en el token |
| A5 | Volver a Live Preview sin tocar el texto | El token vuelve a esconderse **solo**, sin tener que escribir nada | El `StateField` no está mirando el cambio de modo, solo el de texto |

---

## B. El cursor y el rango atómico

Esta es la parte que en Anotaciones costó tres bugs. Todo con una tarea **que
tenga token**.

| # | Qué hacer | Qué tiene que quedar | Si falla, qué significa |
|---|---|---|---|
| B1 | Cursor al final del texto visible. **Flecha derecha una vez** | El cursor salta al **principio de la línea de abajo** | Si hace falta apretarla dos veces, el rango atómico no incluye el salto de línea |
| B2 | Cursor al principio de la línea de abajo. **Flecha izquierda una vez** | Cae al **final del texto visible** de arriba, no en el medio de la nada | Ídem B1, del otro lado |
| B3 | Apretar **Cmd+→** sobre la tarea (es el «Fin» de este teclado) | El cursor queda al final del texto visible | El cursor se está metiendo adentro del tramo |
| B4 | **Cmd+Shift+→** desde el medio del texto | Selecciona hasta el final del **texto**, y no se ve una selección fantasma más allá | Ídem B3 |
| B5 | **Doble clic** sobre la última palabra de la tarea | Selecciona la palabra sola | — |
| B7 | **Cmd+←** (el «Inicio») desde el final visible | Va al principio de la línea, sin escalas raras | — |
| B6 | Cursor al final del texto visible, escribir una letra | La letra aparece **antes** del token, o sea al final del texto | Sin esto el token queda en el medio de la línea y deja de parsear |

---

## C. Backspace desde la línea de abajo

Las tres variantes son distintas y las tres importan. Después de cada una,
**pasá a modo fuente para ver dónde quedó el token** y volvé.

| # | Preparás | Qué hacer | Qué tiene que quedar |
|---|---|---|---|
| C1 | Una tarea con token y **debajo una línea vacía** | Cursor al principio de la vacía → **Backspace** | La vacía desaparece y **el token sigue entero al final de la tarea** |
| C2 | Una tarea con token y debajo **otra tarea sin token** | Cursor al principio de la de abajo → **Backspace** | Las dos se unen y el token de arriba queda **al final de la línea unida** |
| C3 | **Dos tareas con token**, una debajo de la otra | Cursor al principio de la de abajo → **Backspace** | Se unen, **sobrevive el token de arriba** y el de abajo desaparece |
| C4 | Igual que C3 | Después de unir, mirar en **modo fuente** | Hay **un solo** `%%t:` en la línea. Si hay dos, la línea queda congelada para siempre y es el peor bug del paso |
| C5 | Una tarea con token y otra debajo | Cursor al **final del texto visible** de la de arriba → **Suprimir/Delete** | Es la misma unión que C2, con el mismo resultado |

> **C4 es el que hay que mirar sí o sí.** Dos `%%t:` en una línea la vuelven
> ilegible, y una línea ilegible el plugin no la vuelve a escribir nunca: ni
> completar, ni asignar, ni prioridad.

---

## D. Enter, y la convivencia con el checkbox automático

| # | Qué hacer | Qué tiene que quedar | Si falla, qué significa |
|---|---|---|---|
| D1 | Cursor al final del texto visible de una tarea **con token** → **Enter** | Arriba queda la tarea **con su token**; abajo nace **`- [ ] `** | Si el token bajó, falló la regla de partir. Si no hay checkbox, se invirtió el orden de los dos filtros |
| D2 | Igual que D1, pero en una tarea **sin** token | Nace `- [ ] ` como siempre | Es la regresión del paso 1: el filtro nuevo no tiene que tocarlo |
| D3 | Cursor **en el medio del texto** de una tarea con token → **Enter** | Se parte en dos; el token queda **en la mitad de abajo**. Las dos líneas son válidas | Está previsto y documentado: cuál mitad «es» la tarea original es ambiguo, así que no se adivina. Anotalo si te resulta molesto |
| D4 | D1 con la tarea que tiene **hijos** | El árbol no se toca; solo aparece la línea nueva | — |
| D5 | Sobre la `- [ ] ` recién nacida de D1, apretar **Backspace** | Queda `- ` (bullet pelado, para escribir una nota de tarea) | Es la regla B del paso 1; el filtro nuevo no tiene que romperla |

---

## E. Lo que **no** se tiene que ocultar

El criterio es: se oculta solo lo que el plugin gestiona. Todo lo demás se ve, y
está bien que se vea.

| # | Qué escribir a mano, al final de una tarea | Qué tiene que quedar |
|---|---|---|
| E1 | `%%t:id=ABCD%%` (mayúsculas: el parser las rechaza) | **Se ve entero.** La línea no se pinta y no se decora |
| E2 | `%%t:id=a3f2` (sin cerrar) | **Se ve entero** |
| E3 | Un token válido al final de un bullet **sin checkbox** (`- una nota %%t:id=a3f2%%`) | **Se ve.** No es una tarea, así que no está en el índice: esconderlo sería metadatos invisibles de nadie |
| E4 | Sobre la línea de E1, correr **«Subir la prioridad de la tarea del cursor»** | Avisa **«No había nada que cambiar.»** y el archivo no se toca. Si dijera «Prioridad alta.», el invariante 7 se rompió |
| E5 | Borrar a mano lo que escribiste en E1–E3 | La nota vuelve a como estaba | — |

---

## F. La prioridad

Los comandos nuevos están en la paleta: **«Subir la prioridad de la tarea del
cursor»** y **«Bajar la prioridad de la tarea del cursor»**. Conviene atarlos a
dos teclas para esta prueba.

| # | Qué hacer | Qué tiene que quedar |
|---|---|---|
| F1 | Cursor sobre una tarea normal → **Subir** | Avisa **«Prioridad alta.»**; la línea se pinta de **amarillo** y aparece un filete a la izquierda |
| F2 | **Subir** otra vez | Avisa **«Prioridad muy alta.»**; pasa a **rojo**, y el filete cambia de grosor y de textura |
| F3 | **Subir** una tercera vez | **No cambia nada** y avisa **«La prioridad ya está en muy alta.»** |
| F4 | **Bajar** dos veces | Vuelve a normal: sin color y sin filete. El segundo avisa «Prioridad normal.» y el tercero, «La prioridad ya está en normal.» |
| F5 | Sobre una tarea **con hijos**, subir la prioridad | La **madre** lleva color de fondo; los **hijos** llevan solo el filete, más fino, **sin fondo** |
| F6 | Mirar el filete de un árbol que tenga **líneas en blanco adentro** | La vertical es **continua**, sin agujeros en los blancos |
| F7 | Sobre una tarea con prioridad, poner una **hija** con prioridad distinta | La hija se pinta con **su** color, y sus descendientes con el de ella |
| F8 | En modo fuente, mirar la línea de F1 | Dice `p=1` y **solo en la línea de la tarea**, no en las hijas |
| F9 | Bajar a normal la de F8 y mirar en modo fuente | El `p=` desapareció. Si era lo único que tenía, **desapareció el token entero** |

---

## G. Los indicadores de forma, y el contraste

Esta es la pregunta de la §14: **¿se distinguen los tres niveles sin mirar el
color?** Dejá una tarea en normal, otra en alta y otra en muy alta, las tres a
la vista.

| # | Estado de los dos interruptores | Qué mirar |
|---|---|---|
| G1 | filete **on**, glifo **off** | ¿Se distinguen alta de muy alta por el **filete** —grosor y muescas— sin mirar el color? |
| G2 | filete **off**, glifo **on** | ¿Se distinguen por el `!` y el `!!`? |
| G3 | los dos **on** | ¿Es redundante y cómodo, o es demasiado? |
| G4 | los dos **off** | Queda solo el color. Es la línea de base para comparar |
| G5 | Con el glifo **on**, angostar la ventana | ¿El `!!` empuja el corte de línea? Es el costo conocido de ese indicador |

Y lo mismo en los dos temas:

| # | Qué hacer | Qué mirar |
|---|---|---|
| G6 | Tema **claro** | El amarillo, que es el peor caso. ¿Se lee el texto sobre el fondo teñido? |
| G7 | Tema **oscuro** | Ídem |
| G8 | Los dos | ¿El filete queda **afuera** del texto, en el margen, y no tapa el bullet ni el triangulito de plegar? |
| G9 | Si usás un tema que no sea el por omisión | Decir cuál: los colores se definen sobre `.theme-light` / `.theme-dark` y un tema propio puede pisar el fondo |

> Los contrastes están calculados: 4,63:1 en el peor de los ocho casos, arriba
> del 4,5:1 que pide WCAG AA. Lo que no puedo calcular es si **se ve bien**.

---

## H. El ciclo de medición *(consola de Obsidian)*

Es la predicción falsable de la §5.5. **Necesita el paso 0.3 hecho.**

La línea de base, medida al cerrar el paso 3 y **sin ninguna decoración**:

```
Measure loop restarted more than 5 times     ×1
Viewport failed to stabilize                 ×4
```

…pero solo con **dos condiciones a la vez**: la ventana **angostada** y
scrolleando **hacia arriba**. A pantalla completa, o bajando, no aparece ninguno.

### Cómo medirlo, paso a paso

1. Abrí `0_inbox/tareas_PRUEBA.md`.
2. **Angostá la ventana** de Obsidian hasta que las líneas de tarea corten en
   dos renglones. Cerrá los paneles laterales para que la columna quede angosta.
3. Abrí la consola: *Ver → Alternar herramientas de desarrollo*.
4. **Apagá** «Decoraciones en la nota» en los ajustes.
5. Volvé a la nota, andá al **final** (**Cmd+↓**).
6. Limpiá la consola (el ⊘ arriba a la izquierda del panel, o escribí
   `console.clear()`).
7. **Scrolleá hacia arriba** con la rueda, de a poco, hasta el principio.
8. En el filtro de la consola escribí `Measure` y anotá la cuenta. Después
   `Viewport` y anotá la cuenta.
9. **Encendé** «Decoraciones en la nota».
10. Repetí los pasos 5 a 8 **con el mismo recorrido**.

### Cómo se lee el resultado

| Resultado | Qué significa |
|---|---|
| Encendido ≤ apagado, y los dos cerca de 1 y 4 | La predicción se sostiene. El `StateField` está haciendo su trabajo |
| **Sube con las decoraciones encendidas** | Es del plugin. La primera pregunta es si la hipótesis de la §5.5 dice la verdad, no si el código está mal |
| **Aparecen sin scrollear** | Es del plugin, seguro |
| `Measure loop restarted` sube | Discrimina: solo sale si una extensión llamó a `requestMeasure`, y el plugin no lo llama en ningún lado |

Repetilo una vez más con el **glifo encendido**: es el único indicador que suma
ancho al renglón, así que es el único que puede mover esta cuenta.

---

## I. El costo por tecla *(consola de Obsidian)*

Con «Registrar eventos en la consola» encendido, cada recálculo se imprime.

1. En el filtro de la consola escribí `decorar`.
2. Limpiá la consola.
3. Escribí unas veinte letras seguidas en `tareas_PRUEBA.md`.
4. Anotá el **rango** de milisegundos que ves.

Medido acá sobre las notas reales, el peor caso —`tareas_COLE` con un token en
cada tarea, 290 tokens en 380 líneas— da **0,65 ms** de mediana contra los 16 ms
de un cuadro a 60 fps. Si en tu máquina da un orden de magnitud más, hay que
mirarlo.

---

## J. Convivencia

| # | Qué hacer | Por qué |
|---|---|---|
| J1 | Repetir **D1** y **C2** con **Outliner desactivado** | La forma de la edición cambia. Las reglas no la miran, pero eso está probado offline, no en la app |
| J2 | Repetir **D1** con `stickCursor` de Outliner en «Never» | Cambia dónde puede pararse el cursor |
| J3 | Abrir una nota que **no** esté en la lista (`1_proyectos/…`) | **Nada cambia**: ni decoración, ni filtro |
| J4 | Abrir dos paneles con `tareas_PRUEBA.md` y editar en uno | El otro se redibuja igual |
| J5 | **Opción+clic** para poner **dos cursores** en dos tareas con token y apretar Backspace | No se pierde ninguna de las dos ediciones. Puede perderse un token: es el daño recuperable |

---

## K. Si algo no coincide: medirlo, no discutirlo

En la **consola de Obsidian**, con el cursor en la nota, pegá entero el contenido
de `scripts/espia.js`. Después:

1. apretá **una sola vez** la tecla del caso que falló,
2. copiá el bloque que imprime la consola,
3. `espiaTareas.off()` para apagarlo.

De esa salida importan tres cosas: el rango `[from, to]`, el texto insertado, y
si dice `← CRUZA A LA LÍNEA DE ABAJO`. Con eso se sabe qué forma tuvo el cambio
y el arreglo sale medido en vez de adivinado.

Para ver en qué quedó el token, **modo fuente**: es la forma más rápida de
distinguir «se escondió» de «se perdió».

---

## Plantilla de respuesta

Copiá esto, completalo y pegalo en la próxima sesión. **Solo hace falta
describir lo que falló**; lo que anda alcanza con marcarlo.

````text
# Verificación del paso 4a

## Entorno
- Obsidian:
- Tema (claro/oscuro, cuál):
- Outliner: activado / desactivado · stickCursor:
- Tokens en tareas_PRUEBA.md al empezar (grep -c '%%t:'):

## A — el token invisible
A1  ok / MAL:
A2  ok / MAL:
A3  ok / MAL:
A4  ok / MAL:
A5  ok / MAL:

## B — el cursor y el rango atómico
B1  ok / MAL:
B2  ok / MAL:
B3  ok / MAL:
B4  ok / MAL:
B5  ok / MAL:
B6  ok / MAL:
B7  ok / MAL:

## C — Backspace desde abajo
C1  ok / MAL:
C2  ok / MAL:
C3  ok / MAL:
C4  ok / MAL:          ← el crítico: ¿cuántos %%t: quedaron?
C5  ok / MAL:

## D — Enter y el checkbox automático
D1  ok / MAL:
D2  ok / MAL:
D3  ok / MAL:          ← ¿te resultó molesto que el token baje?  sí / no
D4  ok / MAL:
D5  ok / MAL:

## E — lo que no se oculta
E1  ok / MAL:
E2  ok / MAL:
E3  ok / MAL:
E4  ok / MAL:
E5  ok / MAL:

## F — la prioridad
F1  ok / MAL:
F2  ok / MAL:
F3  ok / MAL:
F4  ok / MAL:
F5  ok / MAL:
F6  ok / MAL:
F7  ok / MAL:
F8  ok / MAL:
F9  ok / MAL:

## G — forma y contraste
G1 (solo filete)   ¿se distinguen sin color?  sí / no —
G2 (solo glifo)    ¿se distinguen sin color?  sí / no —
G3 (los dos)       ¿redundante o cómodo?      —
G4 (ninguno)       —
G5 (glifo, ventana angosta) ¿empuja el corte de línea?  sí / no
G6 tema claro      ¿se lee el texto sobre el amarillo?  —
G7 tema oscuro     —
G8 ¿el filete tapa el bullet o el triangulito de plegar?  sí / no
G9 tema propio, si usás uno:

Cuál indicador dejarías encendido:  filete / glifo / los dos / ninguno

## H — el ciclo de medición
Ancho de ventana usado (aprox.):
Tokens en la nota al medir:

                              Measure loop    Viewport failed
  decoraciones APAGADAS            ___              ___
  decoraciones ENCENDIDAS          ___              ___
  encendidas + glifo               ___              ___

¿Aparecieron avisos SIN scrollear?  sí / no
¿Aparecieron scrolleando hacia ABAJO?  sí / no

## I — el costo por tecla
Rango de ms que imprimió `[tareas] decorar`:
Líneas de la nota:

## J — convivencia
J1  ok / MAL:
J2  ok / MAL:
J3  ok / MAL:
J4  ok / MAL:
J5  ok / MAL:

## Lo que no se pudo hacer
(bloques salteados y por qué)

## Otras cosas que noté
(cualquier cosa rara, aunque no esté en la lista)
````
