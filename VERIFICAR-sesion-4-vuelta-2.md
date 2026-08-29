# Qué verificar — paso 4a, segunda vuelta

Esta lista es **corta a propósito**: solo lo que cambió y lo que no se pudo
evaluar la primera vez. Lo que ya dio OK y no toqué no hace falta repetirlo.

La guía completa sigue siendo `VERIFICAR-sesion-4.md`; esto la complementa, no
la reemplaza.

Al final está la **plantilla de respuesta**.

Las teclas están escritas para este Mac: no hay `Fin` ni `Inicio`, van `Cmd+→` y
`Cmd+←`.

---

## Qué cambió, y por qué

Las tres fallas tenían **una sola causa**: mis reglas preguntaban de qué *forma*
venía el cambio, y la forma de una edición depende de qué plugins haya
instalados. El filtro se reescribió para reconocer **el defecto**, no el gesto:
calcula en qué quedaría el documento, pregunta si eso está mal, y solo entonces
corrige. Un cambio que deja todo bien pasa intacto.

| Falla de la primera vuelta | Qué pasaba | Bloque acá |
|---|---|---|
| **F** — «;p=1» como texto, el token sin tocar | Cuando el plugin escribe en el disco, Obsidian mete el cambio en el editor como un diff **adentro del token**. El filtro lo confundía con alguien tecleando y lo sacaba afuera | **P** |
| **C2/C3/C4** — el token en el medio, los dos visibles | Con Outliner, unir dos líneas **reemplaza las dos por una**, y ninguna regla reconocía ese gesto | **U** |
| **B6** — el espacio que no aparecía | El tramo se llevaba *todos* los espacios finales, así que el que escribías caía adentro y desaparecía | **T** |

Y dos cosas que **no eran del plugin**, medidas:

- Que Backspace borre los caracteres del checkbox de a uno es `stickCursor` de
  Outliner. Lo confirmaste vos en J1.
- Que al des-indentar un árbol los hijos queden `-[]` es de Outliner: probé esa
  forma de cambio y el filtro no toca ni un byte. Quedó como test permanente.

---

## 0. Antes de empezar

### 0.1 — Recargar el plugin

Ya está desplegado. En Obsidian: *Configuración → Complementos de la comunidad*
→ apagar y volver a prender **Tareas (outline)**.

### 0.2 — Limpiar lo que dejó el bug *(terminal)*

El bug de la prioridad dejó basura en `tareas_PRUEBA.md`. Es poca —**una línea**—
pero hay que sacarla o los resultados salen confusos. Para encontrarla:

```bash
grep -n '%%t:' "$HOME/Downloads/obsidian/mental palace/0_inbox/tareas_PRUEBA.md" | grep -vE '%%t:[^%]*%%[ \t]*$'
```

Hoy eso devuelve **la línea 414**, que tiene texto escrito *después* del token.
Abrila en **modo fuente** y dejala en una de estas dos formas:

- sin token: borrás el `%%t:…%%` entero, o
- con el token al final: movés el texto suelto para adelante del `%%t:`.

Y de paso, buscá los `;p=1` sueltos que el bug pudo haber dejado como texto:

```bash
grep -n ';p=1' "$HOME/Downloads/obsidian/mental palace/0_inbox/tareas_PRUEBA.md" | grep -v '%%'
```

Cuando los dos comandos no devuelvan nada, está limpio.

### 0.3 — Los ajustes

Los tres siguen donde estaban. Para esta vuelta: **decoraciones encendidas**,
**filete encendido**, **glifo apagado** (después lo vas a prender en el bloque G).

---

## P. La prioridad *(era F, lo más roto)*

Los dos comandos: **«Subir la prioridad de la tarea del cursor»** y **«Bajar…»**.

| # | Qué hacer | Qué tiene que quedar |
|---|---|---|
| P1 | Cursor sobre una tarea **sin token**, → **Subir** | Aviso «Prioridad alta.» · fondo **amarillo** · filete izquierdo. En modo fuente: `%%t:p=1%%` al final |
| P2 | **Subir** otra vez | Aviso «Prioridad muy alta.» · fondo **rojo** · el filete cambia de grosor y textura. En modo fuente: `%%t:p=2%%` |
| P3 | **Subir** una tercera vez | «La prioridad ya está en muy alta.» y **nada cambia** |
| P4 | **Bajar** | «Prioridad alta.» · vuelve al amarillo |
| P5 | **Bajar** otra vez | «Prioridad normal.» · sin color, sin filete. En modo fuente **el token desapareció entero** |
| P6 | **Bajar** una vez más | «La prioridad ya está en normal.» y nada cambia |
| P7 | Ahora sobre una tarea **que ya tiene token** (con `id` y `wb`), → **Subir** | En modo fuente el token queda `%%t:id=…;wb=…;p=1%%`: **un solo token**, con el `p=1` **adentro**, y el `id` y el `wb` intactos |
| P8 | Sobre esa misma, **Bajar** | El `p=1` desaparece del token y el resto queda igual |

> **P7 es el que fallaba.** Si aparece un `;p=1` suelto fuera del token, o el
> token queda igual, el arreglo no funcionó.

| # | Qué hacer | Qué tiene que quedar |
|---|---|---|
| P9 | Sobre una tarea **con hijos**, subir la prioridad | La madre lleva fondo + filete; los hijos, **solo filete** más fino y sin fondo |
| P10 | Mirar un árbol con **líneas en blanco adentro** | La vertical del filete es **continua**, sin agujeros |
| P11 | Una hija con prioridad **distinta** de la madre | La hija se pinta con **su** color, y lo que cuelga de ella también |
| P12 | Sobre una línea con el token roto a mano (`%%t:id=ABCD%%`), **Subir** | «No había nada que cambiar.» y el archivo no se toca |

---

## U. Unir líneas *(era C)*

Después de cada una, **mirá en modo fuente** dónde quedó el token.

| # | Preparás | Qué hacer | Qué tiene que quedar |
|---|---|---|---|
| U1 | Tarea con token, **debajo una línea vacía** | Cursor al principio de la vacía → **Backspace** | La vacía desaparece y el token **sigue entero al final** |
| U2 | Tarea con token, debajo **otra tarea sin token** | Cursor al principio de la de abajo → **Backspace** las veces que haga falta | Se unen y el token queda **al final de la línea unida** |
| U3 | **Dos tareas con token** | Ídem | Se unen, **sobrevive el de arriba**, el de abajo desaparece |
| U4 | Igual que U3 | Contar en **modo fuente** | Hay **un solo** `%%t:` en la línea |
| U5 | Tarea con token y otra debajo | Cursor al **final del texto visible** de arriba → **Suprimir** | La misma unión, con el mismo resultado |

> Que primero se borren los caracteres del checkbox **es de Outliner**, no del
> plugin. Lo que importa es qué queda **después** de que las líneas se unan.
>
> **U3 y U4 son los críticos.** Dos `%%t:` en una línea la vuelven ilegible, y
> una línea ilegible el plugin no la vuelve a escribir nunca.

---

## T. Escribir al final de una tarea *(era B6)*

| # | Qué hacer | Qué tiene que quedar |
|---|---|---|
| T1 | Cursor al final del texto visible de una tarea con token → **barra espaciadora** | **El espacio se ve.** El cursor se separa de la última palabra |
| T2 | Seguir escribiendo una palabra | Se escribe normal, y en modo fuente queda **antes** del token |
| T3 | **Backspace** para borrar esa palabra y el espacio | Vuelve a como estaba, con el token intacto |
| T4 | Cursor al final del texto visible → escribir una letra sin espacio | La letra queda pegada al texto, antes del token |

---

## S. Partir una tarea al medio *(cambio nuevo)*

Es la decisión que tomaste: **la mitad de arriba se queda con el token**, y con
él el workbench, el `due`, el `rec` y la prioridad. Antes bajaba con la segunda
mitad.

| # | Qué hacer | Qué tiene que quedar |
|---|---|---|
| S1 | Tarea con token, cursor **en el medio del texto** → **Enter** | Arriba: la primera mitad **con el token**. Abajo: la segunda mitad **sin token** |
| S2 | Confirmar S1 en **modo fuente** | Un solo `%%t:` y está en la línea de **arriba** |
| S3 | Tarea que esté en un workbench, partida al medio | La mitad de **arriba** sigue en el workbench. La de abajo sale — y eso es esperado: alguna de las dos sale sí o sí |
| S4 | Cursor **al comienzo del texto** (justo después del `- [ ] `) → **Enter** | Arriba queda una tarea vacía **sin token**, y el token **baja** con el texto. Es el límite de la regla: si no, una tarea vacía sería la dueña del workbench |
| S5 | Cursor **al final del texto visible** → **Enter** | Lo de siempre: el token se queda arriba y abajo nace `- [ ] ` |

---

## R. Que no haya roto lo que ya andaba *(regresión rápida)*

Son cinco, no la lista entera.

| # | Qué hacer | Qué tiene que quedar |
|---|---|---|
| R1 | **Enter** al final de una tarea **con token** | Arriba queda la tarea con su token; abajo nace **`- [ ] `** |
| R2 | **Enter** al final de una tarea **sin token** | Nace `- [ ] ` como siempre |
| R3 | **Cmd+→** y **flecha derecha** desde el final visible | El cursor cruza a la línea de abajo de **un solo teclazo** |
| R4 | Escribir a mano `%%t:id=ABCD%%` al final de una tarea | **Se ve entero** y la línea no se pinta |
| R5 | Modo lectura / modo fuente | En lectura el token no se ve; en fuente sí |

---

## G. Forma y contraste *(era G — no se pudo evaluar la primera vez)*

Dejá tres tareas a la vista: una normal, una alta y una muy alta.

| # | Estado de los interruptores | Qué mirar |
|---|---|---|
| G1 | filete **on**, glifo **off** | ¿Se distinguen alta de muy alta por el filete —grosor y muescas— **sin mirar el color**? |
| G2 | filete **off**, glifo **on** | ¿Se distinguen por el `!` y el `!!`? |
| G3 | los dos **on** | ¿Redundante y cómodo, o demasiado? |
| G4 | los dos **off** | Solo color. Es la base para comparar |
| G5 | glifo **on**, ventana angosta | ¿El `!!` empuja el corte de línea? |
| G6 | Tema **oscuro** (el tuyo) | ¿Se lee el texto sobre el fondo teñido? |
| G7 | Tema **claro** | El amarillo es el peor caso |
| G8 | Cualquiera | ¿El filete queda en el margen, sin tapar el bullet ni el triangulito de plegar? |

Al final: **cuál indicador dejarías encendido.**

---

## M. El ciclo de medición *(era H)*

La primera vez no salió **ningún** aviso, ni apagado ni encendido. Eso puede
querer decir dos cosas y conviene separarlas: que la ventana no estaba lo
bastante angosta, o que la línea de base de la §5.5 ya no se reproduce.

1. Abrí `tareas_PRUEBA.md` y **angostá la ventana hasta que las líneas de tarea
   corten en dos renglones**. Cerrá los dos paneles laterales. Si no cortan en
   dos, la condición de la §5.5 no se está dando y la medición no significa nada.
2. Consola de Obsidian, filtro vacío, `console.clear()`.
3. Ctrl/Cmd+↓ para ir al final, y **scrolleá hacia arriba con la rueda**, de a
   poco, hasta el principio.
4. Filtrá por `Measure` y por `Viewport` y anotá las cuentas.
5. Repetí con las decoraciones **apagadas**.

Si en las dos condiciones sigue sin salir nada, **anotalo así**: quiere decir que
la línea de base tampoco se reproduce hoy, y eso hay que revisarlo en la spec,
no en el código.

---

## C. Varios cursores *(era J5, ahora explicada)*

1. Cursor al final del texto de una tarea con token.
2. **Cmd+Opción+clic** al final del texto de **otra** tarea con token, unas
   líneas más abajo. Dos cursores parpadeando.
3. **Suprimir** una vez: cada cursor une su línea con la de abajo.
4. Mirar: que **las dos** uniones hayan ocurrido, y que ninguna línea quede con
   dos `%%t:` (en modo fuente).

Que se pierda alguno de los dos tokens **no es un error**: con varios cursores el
filtro prefiere no corregir antes que comerse la edición del otro cursor.

---

## Plantilla de respuesta

````text
# Verificación del paso 4a — segunda vuelta

## Entorno
- Obsidian:
- Tema:
- Outliner: activado / desactivado · stickCursor:
- ¿Quedó limpia tareas_PRUEBA.md (los dos grep del 0.2 sin resultados)?  sí / no

## P — la prioridad
P1   ok / MAL:
P2   ok / MAL:
P3   ok / MAL:
P4   ok / MAL:
P5   ok / MAL:
P6   ok / MAL:
P7   ok / MAL:          ← el que fallaba. En modo fuente el token quedó:
P8   ok / MAL:
P9   ok / MAL:
P10  ok / MAL:
P11  ok / MAL:
P12  ok / MAL:

## U — unir líneas
U1   ok / MAL:
U2   ok / MAL:
U3   ok / MAL:
U4   ok / MAL:          ← ¿cuántos %%t: quedaron en la línea?
U5   ok / MAL:

## T — escribir al final
T1   ok / MAL:
T2   ok / MAL:
T3   ok / MAL:
T4   ok / MAL:

## S — partir al medio
S1   ok / MAL:
S2   ok / MAL:
S3   ok / MAL:          ← ¿te resultó razonable en el uso?
S4   ok / MAL:
S5   ok / MAL:

## R — regresión
R1   ok / MAL:
R2   ok / MAL:
R3   ok / MAL:
R4   ok / MAL:
R5   ok / MAL:

## G — forma y contraste
G1 (solo filete)  ¿se distinguen sin color?  sí / no —
G2 (solo glifo)   ¿se distinguen sin color?  sí / no —
G3 (los dos)      —
G4 (ninguno)      —
G5 ¿el glifo empuja el corte de línea?  sí / no
G6 tema oscuro    —
G7 tema claro     —
G8 ¿el filete tapa el bullet o el plegado?  sí / no

Cuál indicador dejarías:  filete / glifo / los dos / ninguno

## M — el ciclo de medición
¿Las líneas de tarea cortaban en dos renglones?  sí / no

                            Measure loop    Viewport failed
  decoraciones APAGADAS          ___              ___
  decoraciones ENCENDIDAS        ___              ___

## C — varios cursores
¿Ocurrieron las dos uniones?  sí / no
¿Alguna línea quedó con dos %%t:?  sí / no

## Otras cosas que noté
````
