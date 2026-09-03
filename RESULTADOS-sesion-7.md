# Resultados de la verificación — paso 6b (fecha, recurrencia, reinicio)

> **Cómo se usa. Nada de acá hay que borrarlo ni reescribirlo.**
>
> - Se llenan los `` `_` ``. **Un `` `_` `` que queda sin tocar significa «no lo
>   hice» o «nada que decir»**, y lo leo así: no hace falta llenar todo.
> - Las citas y las instrucciones en *cursiva* **se quedan donde están**. Las
>   ignoro al leer.
> - Para el resultado de cada comprobación uso este vocabulario, pero **escribí
>   lo que quieras**: `ok` · `parcial` · `falla` · `raro` · `—`.
>   («parcial» está porque lo inventaste vos en la sesión 6 y era la respuesta
>   correcta donde yo solo había previsto ok/falla.)
> - Los bloques de falla vacíos **se dejan vacíos**. No hay que copiarlos ni
>   borrarlos: hay cuatro, y uso los que tengan algo.
> - **Poné el dato donde te salga.** Si contestás algo en prosa abajo, no hace
>   falta repetirlo en el tablero — recorro el archivo entero, no solo la grilla.
>
> Cuando esté, se pega el archivo entero como prompt.

Estos son los resultados de la verificación en vivo del paso 6b. Leelos, decidí
qué es una falla del plugin y qué es un error mío en la guía, y proponé qué
hacer con cada cosa **antes** de tocar código.

---

## 0. Sobre qué binario corrió

*Esto va primero. Pegá tal cual la salida del comando de la §0 de la guía —
`commit …` y la línea del `stat`.*

```
_
```

| | |
|---|---|
| Versión de Obsidian | `_` |
| ¿Outliner encendido? | `_` |
| ¿Creaste `tareas_PRUEBA_2.md` y la agregaste a la lista? (0a) | `_` |
| Notas de tareas que quedaron en los ajustes | `_` |
| Estilo de fila | `_` |
| Modo de revelación | `_` |
| Estilo de prioridad | `_` |
| ¿Cuántas fechas, grupos y reinicios hiciste en total? | `_` |

**La forma de las notas de prueba** *(sin el texto real: reemplazá las palabras
por cualquier cosa. Lo que necesito es la forma —sangría, checkboxes, bullets
sin checkbox, blancos—. El repositorio es público.)*

```
_
```

---

## 1. El tablero

*Una celda por comprobación. Si algo no lo hiciste, dejalo en `` `_` ``.*

**A — El selector de fecha, en una tarea normal**

| # | Qué era | Resultado | Detalle, si querés |
|---|---|---|---|
| A1 | Abrir `⋯ → Fecha…` sobre una tarea sin fecha | `_` | `_` |
| A2 | Mirar las etiquetas | `_` | `_` |
| A3 | Elegir «Hoy» | `_` | `_` |
| A4 | Mirar la línea en la nota | `_` | `_` |
| A5 | Apagar «Decoraciones en la nota» en los ajustes y mirar la línea | `_` | `_` |
| A6 | Volver a abrir `⋯ → Fecha…` | `_` | `_` |
| A7 | Elegir «Otra fecha…» | `_` | `_` |
| A8 | Escribir una fecha en el modal | `_` | `_` |
| A9 | Aceptar con Enter, sin tocar el botón | `_` | `_` |
| A10 | `⋯ → Fecha… → Sin fecha` sobre esa tarea | `_` | `_` |
| A11 | Sobre una tarea que además está en un workbench (★), sacarle la fecha | `_` | `_` |

**B — La fecha en una cíclica, y la conversión**

| # | Qué era | Resultado | Detalle, si querés |
|---|---|---|---|
| B1 | Ponerle fecha a una tarea (A3) y después `⋯ → Recurrencia… → Grupo nuevo…`, con nombre `mensual` | `_` | `_` |
| B2 | Mirar el token con las decoraciones apagadas | `_` | `_` |
| B3 | `⋯ → Fecha…` sobre esa tarea cíclica | `_` | `_` |
| B4 | En «Otra fecha…» de una cíclica | `_` | `_` |
| B5 | Escribir `40` y aceptar | `_` | `_` |
| B6 | Elegir «Fin de mes» | `_` | `_` |
| B7 | `⋯ → Recurrencia… → No es cíclica` sobre esa | `_` | `_` |

**C — La recurrencia y los grupos**

| # | Qué era | Resultado | Detalle, si querés |
|---|---|---|---|
| C1 | `⋯ → Recurrencia…` sobre una tarea, con `mensual` ya creado | `_` | `_` |
| C2 | Crear un grupo desde la **otra** nota (`tareas_PRUEBA_2`), llamado `lunes` | `_` | `_` |
| C3 | Volver a `tareas_PRUEBA` y abrir `⋯ → Recurrencia…` | `_` | `_` |
| C4 | En «Grupo nuevo…» escribir `a;b` | `_` | `_` |
| C5 | Etiquetar con `lunes` una tarea **madre** que tiene una hija | `_` | `_` |

**D — El reinicio de un grupo**

| # | Qué era | Resultado | Detalle, si querés |
|---|---|---|---|
| D1 | Paleta → «Reiniciar un grupo cíclico…» | `_` | `_` |
| D2 | Elegir `lunes` | `_` | `_` |
| D3 | Leer el modal | `_` | `_` |
| D4 | Cancelar | `_` | `_` |
| D5 | Volver a hacerlo y aceptar | `_` | `_` |
| D6 | Mirar el token de una reiniciada, con las decoraciones apagadas | `_` | `_` |
| D7 | Mirar una tarea del grupo que estaba **pendiente** | `_` | `_` |
| D8 | Mirar una tarea **sin etiqueta** que esté al lado de una del grupo | `_` | `_` |
| D9 | Mirar la **hija** de la madre que etiquetaste en C5 | `_` | `_` |
| D10 | Reiniciar el mismo grupo otra vez | `_` | `_` |
| D11 | Sacarle el `rec` a todas y correr el comando | `_` | `_` |

**E — Con el índice congelado — «o todas o ninguna»**

| # | Qué era | Resultado | Detalle, si querés |
|---|---|---|---|
| E1 | Completar dos tareas de `mensual`, una en cada nota, y **teclear cinco líneas arriba** en `tareas_PRUEBA` solamente | `_` | `_` |
| E2 | Correr el reinicio de `mensual` y aceptar | `_` | `_` |
| E3 | Mirar `tareas_PRUEBA_2`, que sí se podía escribir | `_` | `_` |
| E4 | Con el índice congelado, `⋯ → Fecha…` sobre una tarea que se corrió | `_` | `_` |
| E5 | **Apagar el congelado** y volver a correr el reinicio | `_` | `_` |

**F — Que lo de antes siga andando**

| # | Qué era | Resultado | Detalle, si querés |
|---|---|---|---|
| F1 | Clic en el vacío a la derecha del texto de una tarea | `_` | `_` |
| F2 | Flecha derecha desde el final del texto | `_` | `_` |
| F3 | Backspace desde el comienzo de la línea de abajo | `_` | `_` |
| F4 | Enter al final de una tarea | `_` | `_` |
| F5 | **Tildar el checkbox** de una tarea con fecha | `_` | `_` |
| F6 | Destildarlo | `_` | `_` |
| F7 | Cmd+clic en el checkbox | `_` | `_` |
| F8 | Pasar el mouse por el margen izquierdo | `_` | `_` |
| F9 | Mirar la consola de **Obsidian** mientras scrolleás hacia arriba con la ventana angosta | `_` | `_` |

---

## 2. Los números que la guía pide contar

*Estos no son «ok / falla»: son datos. Si el número que viste no es el
predicho, eso ya es el reporte.*

| Qué | Predicho | Lo que vi |
|---|---|---|
| A1 · cuántos atajos tiene el menú de fecha | **7** | `_` |
| A1 · ¿había dos atajos con la misma fecha? | **no** | `_` |
| A6 · cuántos atajos quedaron tildados | **uno solo** | `_` |
| B1 · cuántos avisos salieron al poner `rec` sobre una tarea con fecha | **2** | `_` |
| B2 · qué dice el token después de la conversión | `due=N;rec=mensual` | `_` |
| B2 · ¿un solo Ctrl-Z la dejó como estaba? | **sí** | `_` |
| C3 · cuántos grupos ofrece el menú desde la otra nota | **2** | `_` |
| D3 · cuántas tareas dijo el modal | las que dejaste `[x]` | `_` |
| D3 · en cuántas notas dijo el modal | **2** | `_` |
| D5 · cuántas dijo el aviso que reinició | el mismo número | `_` |
| E2 · ¿en cuántas notas escribió? | **ninguna** | `_` |
| F9 · `Measure loop restarted` | base 1 | `_` |
| F9 · `Viewport failed to stabilize` | base 4 | `_` |

---

## 3. Lo que falló

*Hay cuatro bloques. Llená los que necesites y **dejá vacíos los demás**.*

### Falla 1

- **Qué comprobación** *(p. ej. «D5», o «no estaba en la lista»)*: `_`
- **Qué hice, tecla por tecla o clic por clic:**
  `_`
- **Qué esperaba:** `_`
- **Qué pasó de verdad** *(lo que viste, no lo que creés que lo causó — la
  hipótesis va abajo, aparte)*:
  `_`
- **¿Pasa siempre o a veces?** `_` *(si es a veces: cuántas de cuántas)*
- **¿Se puede repetir a propósito?** `_`
- **Estado que quedó** *(qué notas, y con qué forma)*:
  ```
  _
  ```
- **Consola de Obsidian** *(Ver → Alternar herramientas de desarrollo). El error
  entero con su pila, si hay:*
  ```
  _
  ```
- **Mi hipótesis, si tengo una:** `_`
  *(va aparte a propósito: en la sesión 5 una hipótesis razonable descartó la
  causa correcta durante dos vueltas)*

### Falla 2

- **Qué comprobación:** `_`
- **Qué hice:** `_`
- **Qué esperaba:** `_`
- **Qué pasó de verdad:** `_`
- **¿Siempre o a veces?** `_`
- **Estado que quedó:**
  ```
  _
  ```
- **Consola de Obsidian:**
  ```
  _
  ```
- **Mi hipótesis:** `_`

### Falla 3

- **Qué comprobación:** `_`
- **Qué hice:** `_`
- **Qué esperaba:** `_`
- **Qué pasó de verdad:** `_`
- **¿Siempre o a veces?** `_`
- **Estado que quedó:**
  ```
  _
  ```
- **Consola de Obsidian:**
  ```
  _
  ```
- **Mi hipótesis:** `_`

### Falla 4

- **Qué comprobación:** `_`
- **Qué hice:** `_`
- **Qué esperaba:** `_`
- **Qué pasó de verdad:** `_`
- **¿Siempre o a veces?** `_`
- **Estado que quedó:**
  ```
  _
  ```
- **Consola de Obsidian:**
  ```
  _
  ```
- **Mi hipótesis:** `_`

---

## 4. Lo que viste mirando, que no estaba en la lista

*La parte que más rindió en las sesiones 5 y 6: los hallazgos que ningún test
iba a agarrar salieron de mirar, no de la guía. Un cartel que dice algo raro, un
número que no cierra, algo que se ve feo, una demora, un ítem del menú que sobra
o que falta, una etiqueta mal redactada. Capturas: pegalas como `![[…]]`, las
puedo leer.*

- `_`
- `_`
- `_`

---

## 5. Las dos notas de prueba, después de todo

*Sin contenido real: alcanza con la forma.*

| | `tareas_PRUEBA` | `tareas_PRUEBA_2` |
|---|---|---|
| ¿Quedó alguna línea que no tocaste, cambiada? | `_` | `_` |
| ¿Quedó algún `%%t:` a la vista? | `_` | `_` |
| ¿Alguna tarea sin etiqueta quedó destildada? | `_` | `_` |
| ¿Se perdió alguna nota sin checkbox? | `_` | `_` |

**La estructura de lo que quedó** *(niveles y sangría, con las palabras
reemplazadas)*:

```
_
```

---

## 6. Las dos preguntas de diseño que dejé abiertas

*Estas no son comprobaciones: son decisiones tuyas, y las hice así a propósito
para que las juzgues usándolas.*

| | Qué decidí | Qué te pareció |
|---|---|---|
| **D9** | Una cíclica con hijos se reinicia con la madre destildada y **los hijos siguen en `[x]`**, porque `rec` va en una sola línea. Es lo correcto para el registro por mes; puede no serlo para una semanal con subtareas | `_` |
| **B1** | Ponerle `rec` a una tarea con fecha **convierte** el `due` en día del mes y avisa, en vez de preguntar o de dejarlo como estaba | `_` |
| — | El orden del ⋯: prioridad primero, después fecha y recurrencia. La §13.0 las lista en otro orden | `_` |

---

## 7. Qué querés que haga

*Tildá lo que corresponda. Lo que no tildes, lo leo como que no.*

- [ ] Arreglar lo de la §3, en este orden: `_`
- [ ] Escribir un **instrumento** para lo que no se puede reproducir offline
- [ ] Un **ajuste conmutable** para comparar dos comportamientos mirándolos
- [ ] Corregir la **guía** o la **spec**, porque el que estaba mal era yo
- [ ] Hacer testeable offline la secuencia de `escribirEnVarias` *(el alias de
      vitest con un `obsidian` falso que te ofrecí y no decidí solo)*
- [ ] Commitear el paso 6b
- [ ] Seguir con el **paso 6c**: «archivar y reiniciar» y el botón por grupo
- [ ] Otra cosa: `_`

---

## Recordatorios

- **Apagá «Congelar el índice en memoria»** si quedó encendido de la §E.
- **Decí de qué consola hablás.** La de Obsidian es *Ver → Alternar herramientas
  de desarrollo*; la terminal es la otra.
- **El repositorio es público.** Nada de esto entra tal cual a un commit, pero
  conviene igual no pegar acá texto real de las notas: la forma alcanza.
- Si esta nota queda guardada **dentro** de una de tus notas de tareas, el
  plugin va a tratar sus `- [ ]` como tareas de verdad. Guardala fuera de la
  lista.
