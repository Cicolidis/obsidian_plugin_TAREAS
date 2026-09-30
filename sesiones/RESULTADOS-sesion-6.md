# Resultados de la verificación — paso 6a

> **Cómo se usa.** Llenar los `_` mientras se verifica con
> `VERIFICAR-sesion-6.md` al lado, borrar esta cita y las instrucciones en
> *cursiva*, y pegar el archivo entero como prompt en Claude Code.
>
> **No hace falta llenarlo todo.** Lo que salió bien puede quedar en una línea.
> Lo que salió mal es lo que necesita detalle.

Estos son los resultados de la verificación en vivo del paso 6a. Leelos,
decidí qué es una falla del plugin y qué es un error de la guía, y proponé qué
hacer con cada cosa **antes** de tocar código.

---

## 0. En qué estado corrió

*Sin esto, la mitad de lo de abajo no se puede interpretar. La sesión 5 perdió
dos vueltas por no saber con qué estilo estaba mirando.*

| | |
|---|---|
| Versión de Obsidian | `_` |
| ¿Outliner encendido? | `_` |
| Copia del LOG hecha (0a) | `_` |
| «Nota de historial» apunta a | `_` |
| Estilo de fila | `_` |
| Modo de revelación | `_` |
| Estilo de prioridad | `_` |
| ¿Nota de prueba usada? | `_` |
| ¿Cuántas tareas archivé y cuántas eliminé en total? | `_` |

**La forma de la nota de prueba** *(sin el texto real: reemplazá las palabras
por lo que sea. Lo que necesito es la forma —sangría, checkboxes, bullets sin
checkbox, blancos—, no el contenido. El repositorio es público)*:

```
_
```

---

## 1. El tablero

*Una letra por comprobación: **ok**, **falla**, o **—** si no la hiciste.
Rellenar la fila entera de un vistazo y después detallar solo las que fallaron.*

| | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| **A** la confirmación dice la verdad | `_` | `_` | `_` | `_` | `_` | `_` |
| **B** el bloque llega bien al historial | `_` | `_` | `_` | `_` | `_` | `_` |
| **C** archivar no borra | `_` | `_` | `_` | `_` | | |
| **D** eliminar sí borra | `_` | `_` | `_` | `_` | `_` | `_` |
| **E** cancelar no escribe nada | `_` | `_` | `_` | | | |
| **F** el invariante 10 | `_` | `_` | `_` | `_` | `_` | |
| **G** los cuatro gestos | `_` | `_` | `_` | `_` | | |
| **H** la consola | `_` | `_` | | | | |

---

## 2. Los números que la guía pide contar

*Estos no son «ok / falla»: son datos. Si el número que vi no es el que la guía
predice, eso ya es el reporte.*

| Qué | Predicho | Lo que vi |
|---|---|---|
| A2 · líneas que el modal dijo que van al historial | las del bloque | `_` |
| A2 · líneas que el bloque tiene de verdad | — | `_` |
| A3 · tareas que el modal dijo que quedan en `[x]` | las que tienen checkbox | `_` |
| B5 · headings `# ...` en el LOG después de archivar dos veces | **uno solo** | `_` |
| D4 · líneas que desaparecieron al eliminar | las del subárbol | `_` |
| H2 · `Measure loop restarted` | sin línea de base | `_` |
| H2 · `Viewport failed to stabilize` | sin línea de base | `_` |

---

## 3. Lo que falló

*Una sección por falla. Si no falló nada, borrá todo esto y escribí «nada».*

### Falla 1 — `_` *(qué comprobación, p. ej. «D4», o «no estaba en la lista»)*

- **Qué hice, tecla por tecla o clic por clic:**
  `_`
- **Qué esperaba:**
  `_`
- **Qué pasó de verdad** *(lo que vi, no lo que creo que lo causó — si tenés una
  hipótesis va abajo, aparte)*:
  `_`
- **¿Pasa siempre o a veces?** `_` *(si es a veces: cuántas de cuántas)*
- **¿Se puede repetir a propósito?** `_`
- **Estado que quedó** *(la nota, el historial, o las dos; describí la forma, no
  el contenido)*:
  ```
  _
  ```
- **Consola de Obsidian** *(Ver → Alternar herramientas de desarrollo). Pegá el
  error entero con su pila, si hay:*
  ```
  _
  ```
- **Mi hipótesis, si tengo una:** `_`
  *(va aparte a propósito: en la sesión 5 una hipótesis razonable descartó la
  causa correcta durante dos vueltas)*

### Falla 2 — `_`

*(copiar el bloque de arriba)*

---

## 4. Lo que vi mirando, que no estaba en la lista

*La parte que más rindió en la sesión 5: los dos hallazgos que ningún test iba a
agarrar salieron de mirar, no de la guía. Un cartel que dice algo raro, un
número que no cierra, algo que se ve feo, una demora, un ítem del menú que
sobra o que falta.*

- `_`

---

## 5. El historial, después de todo

*Lo único que puedo revisar yo si me lo pegás, y el archivo que más importa que
haya quedado bien. **Sin contenido real**: alcanza con la forma.*

- **¿Creció solo por abajo?** `_`
- **¿Alguna línea de las que ya estaban cambió?** `_`
- **¿Hay headings duplicados?** `_`
- **¿Quedó algún `- [ ]` o algún `%%t:`?** `_`
- **La estructura de lo que se agregó** *(niveles de heading y cuántos bullets
  cuelgan de cada uno, con los títulos reemplazados)*:
  ```
  _
  ```

Si algo quedó mal, **decime antes de tocarlo**: tenés la copia de 0a y conviene
comparar contra ella antes de arreglar nada a mano.

---

## 6. Qué querés que haga

*Marcá lo que corresponda y agregá lo que falte.*

- [ ] Arreglar lo de la §3, en el orden que digas: `_`
- [ ] Escribir un **instrumento** para lo que no se puede reproducir offline
      *(el camino de la sesión 5 cuando la hipótesis no falla su test)*
- [ ] Un **ajuste conmutable** para comparar dos comportamientos mirándolos
- [ ] Corregir la **guía** o la **spec**, porque el que estaba mal era yo
- [ ] Nada de esto: seguir con el **paso 6b** (fecha, recurrencia, reinicio por
      grupo)
- [ ] Otra cosa: `_`

---

## Recordatorios

- **Apagá «Congelar el índice en memoria»** si lo encendiste para la §F.
- **El repositorio es público.** Nada de esto entra tal cual a un commit, pero
  igual conviene no pegar acá texto real de las notas: describir la forma
  alcanza y siempre alcanzó.
- **Decí de qué consola hablás.** La de Obsidian es *Ver → Alternar herramientas
  de desarrollo*; la terminal es la otra.
