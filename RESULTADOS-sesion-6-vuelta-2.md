# Resultados de la verificación — paso 6a, segunda vuelta

> **Cómo se usa.** Llenar los `_` con `VERIFICAR-sesion-6-vuelta-2.md` al lado,
> borrar esta cita y las instrucciones en *cursiva*, y pegar el archivo entero
> como prompt en Claude Code.
>
> **No hace falta llenarlo todo.** Lo que salió bien puede quedar en una letra.
> Lo que salió mal es lo que necesita detalle.

Estos son los resultados de la segunda vuelta del paso 6a. Leelos, decidí qué es
una falla del plugin y qué es un error de la guía, y proponé qué hacer con cada
cosa **antes** de tocar código.

---

## 0. Sobre qué binario corrió

*Esto va primero y no es burocracia: la primera vuelta se verificó sobre un
build y para cuando llegaron los resultados ya había tres commits encima. Un
«OK» sin saber sobre qué corrió no dice nada.*

**Desde la terminal**, antes de empezar:

```bash
cd ~/Downloads/claude/obsidian_plugin_TAREAS && git log --oneline -1 && stat -f "desplegado: %Sm  (%z bytes)" -t "%F %T" "$HOME/Downloads/obsidian/mental palace/.obsidian/plugins/tareas-outline/main.js"
```

| | |
|---|---|
| Lo que imprimió | `_` |
| ¿Reinicié Obsidian o apagué y prendí el plugin? | `_` |
| Versión de Obsidian | `_` |
| ¿Outliner encendido? | `_` |

**Los cinco ajustes nuevos, tal como los dejé:**

| Ajuste | Cómo lo puse |
|---|---|
| Tildar el checkbox completa la tarea | `_` |
| Cmd+clic en el checkbox: completar y archivar | `_` |
| Fila de botones: incluir 🗑 Eliminar | `_` |
| Preguntar antes de archivar | `_` |
| Preguntar antes de eliminar | `_` |

Y lo demás del estado, si cambió respecto de la primera vuelta:

| | |
|---|---|
| Estilo de fila | `_` |
| Modo de revelación | `_` |
| «Nota de historial» apunta a | `_` |
| Nota de prueba usada | `_` |

---

## 1. El tablero

*Una celda por comprobación. Vale **ok**, **falla**, **parcial** —lo usaste la
vez pasada y sirvió— o **—** si no la hiciste.*

|                                        | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|----------------------------------------|---|---|---|---|---|---|---|
| **A** lo que ya no pregunta            |`_`|`_`|`_`|`_`|`_`|`_`|   |
| **B** el checkbox como gesto           |`_`|`_`|`_`|`_`|`_`|`_`|   |
| **C** los gestos del editor            |`_`|`_`|`_`|`_`|`_`|`_`|`_`|
| **D** el cursor                        |`_`|`_`|`_`|`_`|   |   |   |
| **E** el hover y el costo              |`_`|`_`|`_`|`_`|   |   |   |
| **F** la consola                       |`_`|`_`|   |   |   |   |   |

*La **C** es la que más importa: hay un `transactionFilter` nuevo corriendo
último y el orden entre filtros ya rompió el checkbox automático una vez. La
**D** es lo que estaba roto por abajo.*

---

## 2. Los números

*Estos no son «ok / falla»: son datos. Poné el número que viste, aunque sea el
esperado — y sobre todo si no lo es.*

| Qué | Lo que vi |
|---|---|
| **E4** · `posAtCoords`: llamadas en 10 s | `_` |
| **E4** · `posAtCoords`: ms en total | `_` |
| **E4** · `posAtCoords`: ms por llamada | `_` |
| **E1** · ¿en qué `x` se apagan los botones, si se apagan? | `_` |
| **F2** · `Measure loop restarted` | `_` |
| **F2** · `Viewport failed to stabilize` | `_` |
| **B2** · tareas que quedaron `[x]` al tildar la madre | `_` |

*Si corrés otra vez la sonda de hover, pegá el tramo desde el texto hasta la
fila de botones. Es lo que resolvió el problema la vez pasada.*

---

## 3. Lo que falló

*Una sección por falla. Si no falló nada, borrá todo esto y escribí «nada».*

### Falla 1 — `_` *(qué comprobación, p. ej. «C3», o «no estaba en la lista»)*

- **Qué hice, tecla por tecla o clic por clic:**
  `_`
- **Qué esperaba:**
  `_`
- **Qué pasó de verdad** *(lo que viste, no lo que creés que lo causó — si tenés
  una hipótesis va abajo, aparte)*:
  `_`
- **¿Pasa siempre o a veces?** `_` *(si es a veces: cuántas de cuántas)*
- **Estado que quedó** *(la nota, el historial, o las dos; la forma, no el
  contenido)*:
  ```
  _
  ```
- **Consola de Obsidian** *(Ver → Alternar herramientas de desarrollo). El error
  entero con su pila, si hay:*
  ```
  _
  ```
- **Captura**, si ayuda: pegá el `![[…]]` — las puedo leer.
- **Mi hipótesis, si tengo una:** `_`

### Falla 2 — `_`

*(copiar el bloque de arriba)*

---

## 4. Lo que vi mirando, que no estaba en la lista

*La sección que más rindió la vez pasada: de acá salieron el checkbox como
gesto, el 🗑 en la fila, las confirmaciones apagadas y la zona muerta del hover.
Los cuatro cambiaron el diseño, y ninguno estaba en ninguna guía.*

- `_`

---

## 5. Qué querés que haga

- [ ] Arreglar lo de la §3, en el orden que digas: `_`
- [ ] Escribir un **instrumento** para lo que no se puede reproducir offline
- [ ] Un **ajuste conmutable** para comparar dos comportamientos mirándolos
- [ ] Corregir la **guía** o la **spec**, porque el que estaba mal era yo
- [ ] **Cerrar el paso 6a** y armar el handoff del 6b (fecha, recurrencia,
      reinicio por grupo)
- [ ] Otra cosa: `_`

---

## Recordatorios

- **Apagá «Congelar el índice»** si lo encendiste.
- **El repositorio es público.** Describir la forma alcanza y siempre alcanzó.
- **Decí de qué consola hablás.** La de Obsidian es *Ver → Alternar herramientas
  de desarrollo*; la terminal es la otra.
