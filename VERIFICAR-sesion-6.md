# Qué verificar — paso 6a, terminar una tarea

**Ya está desplegada** (`npm run deploy`). Reiniciá Obsidian o apagá y prendé el
plugin.

Son **veinticuatro comprobaciones**. Las tres primeras (§0) hay que hacerlas
antes que nada: este es el primer paso en que el plugin **escribe en el
historial**, y conviene tener una copia.

## Qué hay ahora

El ⋯ pasa de dos ítems a cuatro:

```
Prioridad
  Normal · Alta · Muy alta          ← el vigente, marcado
──────────
Completar y descartar               (check)
Completar y archivar                (archive)     ← nuevo
──────────
Eliminar…                           (trash, rojo) ← nuevo
```

Y dos comandos de paleta más: **«Completar y archivar la tarea del cursor»** y
**«Eliminar la tarea del cursor»**.

- **Completar y archivar** marca `[x]`, escribe `done`, copia el bloque al
  historial y **no borra nada de la nota**.
- **Eliminar** borra la tarea y su subárbol de la nota, **no escribe en el
  historial**, y confirma siempre.

Fecha y recurrencia siguen **afuera**: son el paso 6b.

---

## 0. Antes de empezar — esto sí o sí

| # | Qué hacer |
|---|---|
| 0a | **Copiar `0_inbox/tareas_LOG.md`** a otro lado. Es la primera vez que el plugin escribe ahí |
| 0b | Trabajar sobre `0_inbox/tareas_PRUEBA.md`, que está en la lista de ajustes |
| 0c | Comprobar que **«Nota de historial»** en los ajustes apunta a `0_inbox/tareas_LOG.md` |

Armate en `tareas_PRUEBA.md` algo con esta forma —el texto inventalo vos—:

```
# PRUEBA

- [ ] una hoja suelta
- [ ] una madre
	- una nota sin checkbox, con   espacios   y **negrita**
	- [ ] una hija
	- [ ] otra hija
- [ ] otra hoja
```

> **Las dos consolas.** Abajo, «consola de Obsidian» es *Ver → Alternar
> herramientas de desarrollo*. La terminal no aparece en esta guía.

---

## A. La confirmación dice la verdad

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| A1 | ⋯ sobre **la hoja suelta** → «Completar y archivar» | **No pregunta nada.** Archiva de un clic. Es el 64,5% de las tareas: tildar tiene que costar menos que borrar |
| A2 | ⋯ sobre **«una madre»** → «Completar y archivar» | Aparece el modal. Dice **«4 líneas van al historial, bajo "tareas_PRUEBA"»** — contá las líneas del bloque y que el número dé |
| A3 | En ese mismo modal | Dice **«3 tareas quedan en "[x]" en tareas_PRUEBA. No se borra nada.»** — son las tres con checkbox, la nota no cuenta |
| A4 | Ídem, la primera vez | Dice **«Se crea la sección "tareas_PRUEBA", al final del archivo»** |
| A5 | La segunda vez, sobre otra tarea | Esa línea **ya no aparece**: la sección existe |
| A6 | Los dos modales | La última línea habla de Ctrl-Z: con la nota abierta se deshace, en el historial no |

## B. El bloque llega bien al historial

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| B1 | Archivar «una madre» y abrir `tareas_LOG.md` | El bloque está **al final del archivo**, bajo un `# tareas_PRUEBA` nuevo |
| B2 | Mirar el bloque | **Bullets sin checkbox**, ninguno con `- [ ]`. La fecha `[✓ AAAA-MM-DD]` solo en la primera línea |
| B3 | Mirar la nota sin checkbox | Llegó **verbatim**: los espacios de más, la negrita, todo igual |
| B4 | Mirar cualquier línea | **No hay ningún `%%t:`**. El token se limpia |
| B5 | Archivar una segunda tarea de la misma nota | Va **bajo el mismo heading**, y el heading **no se duplica** |
| B6 | Mirar lo que ya estaba en el LOG | **Ni una línea cambió.** El historial crece por abajo |

## C. Archivar no borra

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| C1 | Volver a `tareas_PRUEBA.md` después de archivar | La tarea **sigue estando**, en `[x]`, con toda su descendencia también en `[x]` |
| C2 | Mirar el token | Tiene `done=` con la fecha de hoy |
| C3 | La nota sin checkbox de la madre | **Intacta**, no la tocó nadie (invariante 3) |
| C4 | Archivar una tarea que **ya estaba** `[x]` | El modal dice «La tarea ya está completa: en tareas_PRUEBA no se cambia nada», y el historial la recibe igual |

## D. Eliminar sí borra

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| D1 | ⋯ sobre una tarea | «Eliminar…» se ve **en rojo**, después de un separador |
| D2 | Clickearlo | Modal con el botón **«Eliminar» destacado como destructivo**, y el foco en **«Cancelar»** — apretar Enter de reflejo no puede borrar nada |
| D3 | El texto | Dice cuántas líneas y de qué nota, y **«No se escribe nada en el historial»** |
| D4 | Aceptar sobre «una madre» | Se van la madre, la nota sin checkbox y las dos hijas. **«una hoja suelta» y «otra hoja» siguen** |
| D5 | Abrir `tareas_LOG.md` | **No se escribió nada ahí** |
| D6 | Eliminar una **hija** | Se va la hija y nada más; la madre y la hermana quedan |

## E. Cancelar no escribe nada

Esta es la que más importa y la más fácil de dar por sentada.

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| E1 | Abrir el modal de archivar y **cancelar** | Ni la nota ni el historial cambian. Ni el `mtime` |
| E2 | Ídem con el de eliminar, y con **Esc** | Lo mismo |
| E3 | Comprobarlo de verdad, desde la **terminal** | Ver el bloque de abajo |

```bash
ls -l --time-style=full-iso "$HOME/Downloads/obsidian/mental palace/0_inbox/tareas_LOG.md" 2>/dev/null || stat -f "%Sm %N" -t "%F %T" "$HOME/Downloads/obsidian/mental palace/0_inbox/tareas_LOG.md"
```

## F. El invariante 10, sobre los dos caminos nuevos

Con **«Congelar el índice en memoria»** encendido (ajustes → Verificación).
Acordate de apagarlo después.

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| F1 | Encender el congelado. Teclear **cinco líneas nuevas arriba** de la tarea | El índice queda a propósito atrasado |
| F2 | ⋯ → «Completar y archivar» sobre esa tarea | **Escribe donde va**, no cinco líneas más arriba. El aviso puede decir «se había corrido» |
| F3 | Ídem con «Eliminar» | Borra el subárbol correcto |
| F4 | Duplicar una tarea con subárbol para que el bloque quede **repetido verbatim**, y correr cualquiera de las dos | Se **niega** con «No se escribió nada: alguna línea ya no está donde estaba, o aparece repetida». Y el historial **tampoco** recibió nada: el paso en seco corre antes |
| F5 | Apagar el congelado | (acordate) |

**F4 es la que prueba el paso en seco.** Si el historial recibiera la entrada y
la nota no, sería el estado a medias — y ahí tendría que salir un aviso largo
que empieza con «Se escribieron N líneas en el historial, pero la tarea NO quedó
completada en su nota».

## G. Los cuatro gestos que ya costaron caro

Ningún filtro se tocó en esta sesión, así que esto es una regresión, no una
prueba nueva. Sobre una tarea **con token** (mandala a un workbench primero):

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| G1 | Clic al final de la línea, en el vacío de la derecha | El cursor queda **en esa línea**, no en la de abajo |
| G2 | Flecha derecha desde el final del texto | Cruza a la línea de abajo **de un teclazo** |
| G3 | Backspace desde el comienzo de la línea de abajo | Une las dos y queda **una sola línea legible**, con un solo token |
| G4 | Enter en el medio de una tarea | La de arriba se queda con el token; la de abajo nace `- [ ] ` |

## H. La consola de Obsidian

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| H1 | Con «Registrar eventos» encendido, archivar una tarea | Se ve **un** reparseo de la nota. **El historial no aparece nunca**: no está en el índice, a propósito (§12) |
| H2 | Angostar la ventana, cargar la nota de tokens y scrollear **hacia arriba** | Contar `Measure loop restarted` y `Viewport failed to stabilize`. **Sigue sin reproducirse** desde la sesión 4: si no aparece nada, **no lo anotes como verde** — no hay con qué comparar. Si aparece algo, hay que volver a medir la línea de base antes de concluir |

---

## Lo que no se pudo comprobar desde Claude Code

- Cómo se ve el modal, dónde cae el foco, y si el rojo del «Eliminar» se lee.
- Que el ⋯ abra con los cuatro ítems en el orden correcto.
- Todo lo de la §E: que cancelar no toque el disco.
- La §H2, que necesita la ventana y el scroll.

Lo que **sí** está comprobado acá: 662 tests en `npm test` y 151 en
`npm run test:corpus`, incluido el ida y vuelta del historial real (invariantes
6 y 9), que borrar se lleva el subárbol y nada más en las siete notas, y que un
lote mixto da el mismo resultado en cualquier orden.
