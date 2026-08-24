# Plugin de tareas — especificación

Estado: 22 de agosto de 2026. Documento de entrada para la implementación en Claude Code.

Dice **qué** es el plugin y **por qué** cada decisión es la que es. El orden de trabajo va al final.

Referencia constante: el plugin **Anotaciones (Zotero + papel)** (`anotaciones-outline`) resolvió varios de estos problemas y su código es reutilizable. Cada vez que aparece «(Anot. §X)» hay algo concreto que portar o una trampa ya documentada en su `NOTAS-DE-METODO.md`.

---

## 1. Qué es, en una frase

Un **outliner de tareas con vistas superpuestas**: las tareas se escriben en notas markdown como se escriben hoy, y el plugin agrega interfaz encima de esas notas más tres vistas que filtran sin duplicar nada.

### Lo que no es

- No es un gestor con una nota por tarea. Eso atomiza el outline y es lo que expulsó al usuario de BeautyTasks y TaskNotes.
- No es una base de datos. El markdown es la fuente de verdad; si el plugin desaparece, las notas siguen siendo legibles y editables.
- No es un calendario ni un sistema de recordatorios. Los turnos, clases y compromisos van a un plugin aparte (ver §16).

### El principio que ordena todo

> La clasificación de una tarea surge de **dónde está escrita**, no de lo que el usuario cliqueó. Todo metadato que no se deduce de la ubicación se escribe con un botón, nunca a mano, y no se ve.

---

## 2. El corpus real, medido

Medido el 22/08/2026 con `scripts/medir-tareas.mjs` sobre las siete notas. Los números no son decorativos: cada decisión de más abajo apunta a uno.

| | |
|---|---|
| Tareas totales | **386** |
| Distribución | `tareas_COLE` tiene 304 (79%) |
| Completadas | **29 (7,5%)** — y solo 3 en COLE |
| Bullets sin checkbox | 194 (32,8% de los bullets); **34** cuelgan de una tarea |
| Checkboxes vacíos (separadores) | 11 |
| Texto libre | 39 líneas · tablas 8 · imágenes 2 |
| Estados de checkbox usados | solo `[ ]` (368) y `[x]` (29) |
| Profundidad de tarea | p50 **2** · p90 **4** · máx **6** |
| Subárbol de tarea raíz | p50 **2** · p90 **12** · máx **76** líneas |
| Headings por nivel | H1 12 · H2 21 · H3 7 · H4 12 |
| Headings por tipo | proyecto 14 · área **1** · otro enlace 3 · sección 34 |
| Referencias a proyecto | 3 con wikilink, **15 en texto plano** |
| Tareas sin heading semántico | **134 (35%)** |
| Indentación | **tabs en las siete notas**, ninguna mezcla |
| Fechas escritas en prosa | 25 |

**Notas que casi no tienen tareas:** `tareas_LOG` (0 tareas / 37 bullets), `tareas_CÍCLICAS` (0 / 16), `tareas_CLAUDE` (5 / 54).

---

## 3. Decisiones cerradas

| # | Decisión | Por qué |
|---|---|---|
| D1 | Markdown fuente de verdad + índice en memoria | Sobrevive al plugin, a Sync y a Git; permite editar la tarea donde nació |
| D2 | El plugin lee una **lista explícita de notas**, no el vault | 2.394 notas serían inaceptables, sobre todo en móvil |
| D3 | La unidad es el **bloque**, no la línea | 32,8% de los bullets no son tareas |
| D4 | Un **único token oculto** al final de la línea | Dos `Decoration.replace` no se pueden anidar (Anot. §8) |
| D5 | Se abandona la sintaxis de emojis de Tasks | Es visible por diseño; el usuario quiere invisibilidad en Live Preview |
| D6 | El tipo de heading lo da el **prefijo del enlace** (`p_`/`a_`), no el nivel | H1 y H4 aparecen como proyecto y como sección: el nivel no distingue nada |
| D7 | Solo `[ ]` y `[x]` | No hay un solo `[/]` ni `[-]` en el corpus |
| D8 | **Áreas fuera de la v1** | Un solo heading de área en 386 tareas |
| D9 | Workbenches con semántica «lo que yo puse ahí», sin rollover | Pedido explícito |
| D10 | No borrar líneas al completar | Destructivo e irreversible desde la UI |
| D11 | No construir mosaico de paneles propio | Obsidian ya lo tiene; `openPopoutLeaf` para el layout |
| D12 | Prioridad como número, dibujada como color | Ordenar necesita ordinal; la paleta debe poder cambiar |
| D13 | Móvil = capturar + mirar workbench | Ver §15 |

---

## 4. Gramática del markdown

Dentro de una nota de tareas hay **exactamente cuatro** clases de línea.

### 4.1 Heading

```
## sección libre                        → agrupador, sin efecto semántico
### [[p_6_Sheets]]                      → proyecto
## [[a_Reuniones semanales]]            → área (reconocida, sin vista en v1)
```

- El **tipo** sale del prefijo del destino del enlace: `p_` proyecto, `a_` área, cualquier otra cosa o sin enlace → sección.
- El **nivel** solo determina anidamiento y herencia: un heading de proyecto bajo uno de área hereda el área.
- **Se usa wikilink, no texto plano.** Si el proyecto se renombra, Obsidian actualiza el enlace y el plugin lo sigue; con texto plano la desconexión es silenciosa.
- **Un enlace no resuelto es válido.** Un proyecto cuyos archivos están en Finder y todavía no tiene nota se escribe igual; el enlace en otro color significa «existe, su nota no».

### 4.2 Tarea

```
- [ ] texto de la tarea %%t:…%%
```

Estados: `[ ]` pendiente, `[x]` completada. Nada más.

### 4.3 Nota de tarea

Un bullet **sin** checkbox que cuelga de una tarea. Se muestra colapsado con la tarea y **se preserva verbatim en toda reescritura**. Es donde viven los instructivos, los datos de pago y las listas de referencia de `tareas_MES`.

### 4.4 Todo lo demás

Texto libre, tablas, imágenes embebidas, y los 11 checkboxes vacíos usados como separador. **El plugin no los toca ni los cuenta.** Un `- [ ]` sin texto se ignora en silencio.

---

## 5. El token

### 5.1 Forma

```
- [ ] llamar a Flow %%t:id=a3f2;wb=foco,mudanza;due=2026-08-29;p=2%%
```

- `%%…%%` es comentario nativo de Obsidian: en modo lectura se oculta solo. En Live Preview lo oculta la decoración del plugin. (Anot. `color.ts`.)
- Va **siempre al final de la línea**, siempre uno solo, siempre con los campos en orden fijo.
- El usuario **nunca lo escribe**. Lo escriben los botones.

### 5.2 Campos

| Campo | Valor | Cuándo se escribe |
|---|---|---|
| `id` | 4-8 chars `[a-z0-9]` | **Solo al asignar la tarea a un workbench.** Ver §5.4 |
| `wb` | lista separada por comas | Al tocar un botón de workbench |
| `due` | `AAAA-MM-DD`, o `D`/`DD` (día del mes) si la tarea es cíclica | Desde el menú, o al confirmar una fecha detectada |
| `rec` | nombre libre del **grupo de reinicio** (`lunes`, `mensual`, …) | Desde el menú |
| `p` | `1` (alta) \| `2` (muy alta) | Desde la barra de prioridad. Normal no escribe nada |
| `done` | `AAAA-MM-DD` | Al completar |

Prioridad normal **no escribe campo**: es el caso del 95% y no debe dejar rastro.

### 5.3 Reescritura

Una sola función pura:

```ts
setTaskToken(line: string, patch: Partial<TaskMeta>): string
```

Dos propiedades testeadas:

- **Idempotencia:** aplicarla dos veces da el mismo resultado que una.
- **Estabilidad:** aplicarla con un patch vacío no modifica el archivo.

Y una regla de seguridad: **si el token no parsea, la línea no se reescribe.** Se trata como tarea sin metadatos. Nunca reparar a ciegas.

`FORMAT_VERSION` desde el día 1, con el patrón de Anotaciones.

### 5.4 El id se pone tarde, a propósito

Poner id a las 386 tareas al arrancar tocaría los cinco archivos en cada dispositivo cada vez que se abre Obsidian: receta para conflictos de Sync con archivos de 300 tareas. **El id se escribe solo cuando la tarea entra a un workbench**, que es el único momento en que hace falta identidad estable.

Si una tarea aparece sin id porque un Backspace se llevó el token (Anot. §8: un rango atómico se borra entero), el plugin le pone uno nuevo en silencio. Se pierde la asignación al workbench, no la tarea. El peor caso es «hay que volver a ponerle la estrella».

### 5.5 Riesgo real: los rangos atómicos

Reescribir el token es una función pura y fácil. El riesgo está en la capa de CodeMirror, donde Anotaciones acumuló tres bugs de Backspace. Se porta `hiddenTail.ts` completo: la definición del tramo oculto vive en un solo lugar y todo mecanismo que parta o borre líneas la respeta.

Regla heredada: **ante cualquier rango atómico, preguntarse qué pasa cuando alguien borra hacia atrás desde el otro lado.**

---

## 6. Modelo de datos

```ts
interface Task {
  id: string | null;           // null hasta que entra a un workbench
  texto: string;               // sin el token
  hecha: boolean;
  archivo: string;
  linea: number;               // volátil: se recalcula en cada parseo
  nivel: number;               // profundidad dentro del árbol
  padre: string | null;        // id interno de sesión, no el `id` del token
  hijos: string[];
  notas: string[];             // bullets sin checkbox, verbatim
  proyecto: string | null;     // del heading más cercano hacia arriba
  area: string | null;
  seccion: string | null;      // heading no semántico, p. ej. "WORKBENCH"
  workbenches: string[];
  due: string | null;
  rec: "w" | "m" | null;
  prioridad: 0 | 1 | 2;
  done: string | null;
}
```

`linea` es volátil por diseño: la identidad es `id`, nunca la posición.

---

## 7. Store reactivo

No es una nota ni un archivo. Es un `Map<string, Task>` en memoria dentro del proceso del plugin.

1. **Arranque:** se parsean las notas de D2 y se arma el mapa.
2. **Suscripción:** `metadataCache.on("changed")`. Cambia un archivo → se reparsea **solo ese archivo**, con debounce.
3. **Lectura:** las vistas no abren archivos nunca. Leen el store, filtran, renderizan.
4. **Escritura:** el plugin edita el markdown → Obsidian dispara el evento → el store se actualiza → las vistas se redibujan solas.

**Un solo camino de escritura, un solo camino de lectura.** Ninguna vista se actualiza a mano después de una acción; eso es lo que evita que el workbench y la nota digan cosas distintas.

Con 386 tareas esto son unos pocos MB. El debounce importa más que la estructura: reparsear las 398 líneas de `tareas_COLE` en cada tecla es invisible en escritorio y perceptible en móvil.

---

## 8. Escritura sobre el vault

Dos reglas, las dos por conflictos de Sync. `tareas_COLE` tiene 304 tareas en un archivo: un conflicto no afecta una tarea, afecta decenas.

1. **Nunca reescribir el archivo entero.** Solo el rango de las líneas que cambian, con `vault.process()` (lectura-modificación-escritura atómica), no `modify()` con el contenido completo. Es el §6 de Anotaciones convertido en requisito.
2. **Ninguna escritura de mantenimiento automática.** El plugin no toca un archivo si el usuario no pidió una acción sobre una tarea de ese archivo. Ver §5.4.

---

## 9. Árboles

| Situación | Comportamiento |
|---|---|
| Marcar el padre | Completa todos los hijos |
| Completar todos los hijos | **No** completa al padre |
| Enviar a un workbench | Va el **árbol completo**, no una hoja suelta |
| Misma tarea en varias vistas | Permitido y esperado |
| Bullets sin checkbox dentro del árbol | Son notas; se preservan verbatim; nunca se cuentan como tareas |

### Colapso en las vistas

p50 del subárbol = 2 líneas, p90 = 12, máx = 76. Colapsar todo por defecto sería molesto para el caso típico y no colapsar nada haría inusable el workbench.

> **Se expande si el subárbol tiene ≤ 5 líneas; se colapsa si tiene más, con contador `(3/60)`.** Cada tarea lleva un botón visible de desplegar/colapsar todo.

### Reordenar

**No implementar.** Outliner ya está instalado y sus comandos de mover e indentar bloque funcionan sobre checkboxes sin adaptación: un `- [ ] x` es un bullet. Verificar primero; si algo falla, portar `outline.ts` de Anotaciones (`parseOutline`, `subtreeOf`, detección de la unidad de indentación), que ya tiene tests.

---

## 10. Workbenches

Un workbench es **un filtro sobre el store**. No tiene almacenamiento propio. Por construcción no puede existir una tarea que viva solo ahí.

- Se crean escribiendo un nombre. No hay panel de administración.
- **No se llaman por unidad de tiempo.** «foco», «mudanza», «semana en el cole» — no «hoy». Un workbench llamado «hoy» obliga psicológicamente a mantenerlo al día; uno llamado «foco» no caduca. Es el arreglo más barato del plugin y va como texto por defecto, no como sugerencia.
- Acciones: **vaciar workbench** (quita asignaciones, no toca ninguna tarea) y **archivar las completadas de este workbench**. Un clic cada una.
- «Sacar del workbench», «completar» y «descartar» funcionan desde la vista de workbench igual que desde la nota.

### Crear una tarea desde el workbench

El diálogo tiene **texto** y **destino**.

- El destino se autocompleta con el último destino usado en ese workbench.
- Si no hay ninguno, va a fleeting (`tareas_INBOX`).
- Un atajo cambia el destino sin salir del campo de texto.
- El plugin **inserta la línea en la nota destino**, al final de la sección del heading correspondiente, con el `wb` ya puesto. No hay camino de escritura especial.

### Tareas sin proyecto

134 tareas (35%) no cuelgan de un heading semántico: viven bajo `## WORKBENCH`, `## semana 10 - 17` o `# INBOX`. **No son fleeting: son tareas cuyo proyecto está implícito.** Se distinguen tres estados:

| Estado | Qué es |
|---|---|
| Con proyecto | Cuelga de un heading `p_` |
| **Sin clasificar** | Está en una nota de tareas, bajo una sección no semántica |
| Fleeting | Está en `tareas_INBOX` |

La vista Buscar tiene un filtro «sin proyecto» con acción de asignar. Y **al mandar una tarea sin clasificar a un workbench, el plugin pide el proyecto**: es el momento en que el usuario ya está pensando en esa tarea, así que la fricción es mínima.

---

## 11. Tareas cíclicas

**Revisado el 23/08/2026.** La versión anterior era regenerativa: al completar,
la tarea quedaba `[x]` y el plugin insertaba una instancia nueva, oculta hasta
su fecha de activación, y le corría la fecha a la que no se hubiera completado.
Se reemplazó por lo de abajo porque chocaba consigo misma en tres lugares. El
detalle está en los comentarios de `src/tareas.ts`.

### El modelo: una etiqueta y un botón

`rec` es el nombre de un **grupo de reinicio**, no un motor: `rec=lunes`,
`rec=mensual`, `rec=mudanza`. Se crean escribiéndolos, como los workbenches.

Un botón por grupo **destilda todas las tareas de ese grupo y les borra el
`done`**. Nada más: no se crea ninguna instancia, no se clona ningún hijo y no
se corre ninguna fecha.

- **El disparador es el usuario, nunca el calendario.** Es lo que resuelve el
  choque con la §8: un reinicio por calendario haría que todos los dispositivos
  con Obsidian abierto reescribieran las mismas líneas en el mismo momento,
  sobre archivos en Sync. Peor que el caso que la §8 vino a prevenir.
- **Solo toca las tareas etiquetadas.** En `tareas_MES` el registro por mes son
  hijos sin etiqueta, con el monto de cada mes; un reinicio que barriera la nota
  entera los convertiría en tareas pendientes y perdería el dato.
- **Los workbenches y el `due` sobreviven al reinicio.** Sin eso hay que rearmar
  el workbench cada lunes, que es la fricción a eliminar.
- **No se mide el atraso.** Decisión explícita: una cíclica que no se reinició
  no está vencida, está igual que ayer.
- **Las cíclicas van agrupadas aparte** de las de una sola vez, en las vistas.

### El vencimiento adentro del período

Una cíclica puede tener plazo propio: 3 tareas del corpus dicen «antes del día
10» o «antes del segundo vencimiento». Para esas, **`due` guarda el día del mes,
no la fecha**: `due=10` es «el 10 del mes en curso», y se resuelve contra el
reloj con `resolverDue`. Guardar `2026-09-10` obligaría a que algo le corriera
el mes en octubre, que es la escritura automática otra vez por la puerta de
atrás. Un día que no existe en ese mes se recorta al último: `due=31` en febrero
es el 28.

### Al reiniciar, el usuario elige qué pasa con lo completado

La confirmación ofrece **reiniciar** o **archivar y reiniciar**; la segunda
escribe el bloque en `tareas_LOG.md` con la fecha (§12) antes de destildar. Así
la semanal trivial no llena el LOG y la mensual del alquiler deja rastro, sin
decidirlo de antemano.

**La confirmación es obligatoria.** Es la escritura más grande del plugin —23
líneas de un tirón en `tareas_MES`, medido— sobre un archivo en Sync, y
`vault.process()` no pasa por el editor, así que Ctrl-Z no la deshace. Tiene que
decir cuántas tareas va a reiniciar y en qué nota.

### tareas_CÍCLICAS: sigue fuera de la v1, pero ya no es caro

Hoy son bullets sin checkbox agrupados por día de la semana: 0 tareas
completables en 43 líneas. No se completan, se consultan. En v1 la pestaña
Agenda **muestra la sección del día en modo lectura, sin checkboxes**.

Lo que cambia respecto de la versión anterior de esta sección: convertirlas ya
no agrega ninguna obligación diaria. Con el botón, si un día no se reinicia no
pasa nada y nada queda marcado como atrasado. El mecanismo es `rec=lunes`,
`rec=martes`, … y un botón por día.

## 12. Terminar una tarea: dos verbos, no uno

**El hallazgo que ordena esta sección:** solo el 7,5% de las tareas están completadas, y en `tareas_COLE` son 3 de 304. El usuario **borra** la mayoría de las tareas breves, y las que quiere guardar «trata» de pasarlas al LOG a mano, sin sostener el hábito.

Conclusión de diseño: **tildar tiene que costar menos que borrar**, y hay dos intenciones distintas.

| Verbo | Qué hace | Cuándo es el default |
|---|---|---|
| **Completar y descartar** | Marca `[x] done=`, la saca de las vistas, **no** escribe en el LOG | Tarea hoja, sin hijos ni notas |
| **Completar y archivar** | Marca `[x] done=`, escribe el bloque en `tareas_LOG.md`, la saca de las vistas | Tarea con subárbol o con notas |

El default se deriva del tamaño del bloque (p50 = 2 líneas: la mayoría son hojas), y siempre se puede forzar el otro con un modificador. **Ninguno de los dos borra la línea de la nota**: la tarea queda `[x]` en su lugar y las vistas la ocultan. El descarte físico es una acción aparte, explícita, con confirmación.

### Formato del LOG

**Revisado el 24/08/2026.** La versión anterior decía «bajo el mismo camino de
headings que la tarea tenía en su nota» y a la vez «organizado por proyecto».
Las dos cosas se contradicen: el camino literal arrastra al historial los
andamios de la nota de trabajo —`WORKBENCH`, `INBOX`, `semana 24 - 28`—, que son
secciones para organizarse hoy y no categorías de lo hecho; y «por proyecto» no
es aplicable mientras solo el wikilink defina proyecto (§4.1), porque hoy no hay
ninguno.

- El destino es **la nota de origen, y el proyecto debajo si lo hay**:
  `# tareas_COLE` / `## p_6_Sheets`. No se elige: sale de dónde vivía la tarea.
  No depende de la migración del paso 8 y da un historial navegable desde el
  primer día.
- **Una sección nueva se agrega al final del archivo.** Un log crece por abajo.
- Se escribe **bullet sin checkbox**: es lo que el LOG ya usa (37 bullets, 0
  checkboxes). **La fecha al final, `[✓ 2026-08-22]`, es formato nuevo** —
  medido: ninguno de los 37 bullets de hoy tiene fecha.
- **Se limpia el token.** El id ya no apunta a nada vivo.
- Va el subárbol completo, incluidas las notas sin checkbox. En el LOG actual
  esas líneas son el contenido valioso. La fecha va en la raíz del bloque; un
  descendiente solo la lleva si tiene un `done` escrito y **distinto**.

### El LOG se lee por una vista, y el archivo sigue siendo legible solo

Decisión del usuario: el historial no se consulta abriendo la nota, sino desde
la interfaz, con orden y filtros. Va como **un origen más en la pestaña Buscar**
(§13.2) —«archivadas», junto a los filtros que ya tiene— y no como una pestaña
nueva: misma lista, misma virtualización, y es donde uno busca «¿dónde está eso
que hice?». Una vista dedicada se decide más adelante, con el LOG lleno; hoy
lleva 54 días sin tocarse y no hay evidencia de qué haría falta.

Dos restricciones que salen de esa decisión:

1. **El archivo se escribe como si la vista no existiera.** Es la D1: si el
   plugin desaparece, las notas siguen siendo legibles. El historial es lo que
   más probablemente sobreviva al plugin y lo menos re-derivable de todo el
   vault.
2. **La lectura endurece el formato, no lo relaja.** Para ordenar por fecha y
   filtrar por proyecto hay que **recuperar** esos campos del archivo, así que
   `[✓ AAAA-MM-DD]` deja de ser decoración y pasa a ser sintaxis, y el camino de
   headings pasa a ser el índice. El ida y vuelta está probado como propiedad
   (`parseLog`).

El archivo crece sin techo —es el único conjunto que solo recibe— así que **se
lee cuando se abre la vista, nunca al arrancar el plugin**: el store de la §7 se
arma con las notas de trabajo, que se mantienen de tamaño porque las cosas salen
de ellas.

---

## 13. Vistas

### 13.0 El frente principal: la nota

El grueso del plugin son **extensiones de CodeMirror sobre las notas de tareas**, no un panel lateral. La nota es donde se escribe, se edita y se asigna. Las tres pestañas son consumidores secundarios del mismo store.

Sobre cada línea de tarea, al pasar el mouse:

```
[✓]  texto de la tarea …                    [★] [◐] [→] [⋯]
```

- **★ ◐** — dos botones fijos, asignables en settings a los dos workbenches favoritos. Un clic, toggle. Es el 90% del uso.
- **→** — popover con todos los workbenches, numerados 1-9. Un clic más una tecla. Escala a cualquier cantidad.
- **⋯** — menú: fecha, prioridad, recurrencia, completar y descartar, completar y archivar, eliminar.

Indicador persistente: el ★ queda relleno si la tarea está en ese workbench. Sin esto se hace doble clic sin darse cuenta, porque la tarea no se va de la nota al asignarla.

**El componente de fila recibe el modo de revelación como parámetro** (`hover` | `siempre` | `swipe`). Nunca `mouseenter` cableado adentro. Ver §15.

### 13.1 Pestaña Workbenches

La principal. Selector de workbench arriba; uno o varios en columnas. Colapso según §9. Recurrentes agrupadas aparte. Editar, completar, descartar y sacar del workbench, todo desde acá.

### 13.2 Pestaña Buscar

Todas las tareas de las notas de D2, con filtros: proyecto, nota, vencimiento, prioridad, con/sin workbench, **sin proyecto**, completadas. No es donde se trabaja: es donde se **encuentra y asigna**. Caso de uso: filtrar por `p_HOGAR`, hacer clic en la estrella de seis tareas, cerrar.

### 13.3 Pestaña Agenda

Lo único temporal: tareas con `due`, ordenadas por fecha, vencidas arriba. Más la sección del día de `tareas_CÍCLICAS` en modo lectura (§11).

### 13.4 Editar

En las pestañas se edita **solo el título** inline, más un botón «ir a la tarea» que abre la nota con el cursor en esa línea. **No se embeben editores markdown en las listas**: el subárbol llega a 76 líneas.

### 13.5 Layout de paneles

Un comando abre N notas en una ventana nueva (`workspace.openPopoutLeaf`), con la lista de notas con tareas tomada del store. El core plugin **Espacios de trabajo** cubre las disposiciones fijas. Solo escritorio (§15).

---

## 14. Prioridad

Tres niveles: normal (sin color), alta (amarillo), muy alta (rojo).

- **Se guarda un número (`p=1`/`p=2`), se dibuja un color.** Ordenar necesita un ordinal, y guardar el nombre del color ata la paleta para siempre. En Anotaciones el color *es* el dato porque viene de Zotero; acá es presentación.
- **El color pinta la línea de la tarea, no el subárbol.** Los hijos llevan un filete de 2px del mismo color en el borde izquierdo. Con árboles de 76 líneas, teñir todo deja media nota roja.
- Se porta el mecanismo de Anotaciones: decoración de línea + `colorClass()` + la barra de colores rápidos configurable de `settingsData.ts`.
- **Verificar contraste en tema claro y oscuro.** Amarillo sobre fondo claro es el peor caso. Existe `scripts/revisar-especificidad.mjs`.
- Los tres niveles deben distinguirse **también sin color** (un indicador de forma), por accesibilidad y por pantallas al sol.

---

## 15. Móvil

**Caso de uso: capturar y mirar el workbench.** Nadie edita un árbol de 60 nodos en un teléfono. Consecuencia: el frente principal de escritorio (CodeMirror sobre las notas) es lo que menos importa en móvil, y las pestañas —secundarias en escritorio— son la aplicación móvil entera.

**Alcance actual:** el plugin se construye como si fuera solo para escritorio, pero respetando la separación en capas de §17. Eso deja la puerta abierta a publicarlo como community plugin —donde móvil deja de ser opcional, porque el manifiesto lo declara con `isDesktopOnly`— sin pagar el precio por adelantado.

### No existen en móvil

| Propuesta | Qué pasa |
|---|---|
| Botones en hover | No hay hover. Alternativa: swipe (derecha = workbench favorito, izquierda = completar) |
| Paneles en ventana nueva | `openPopoutLeaf` es solo escritorio |
| Atajos de teclado | No hay teclado físico |
| Drag & drop | Eventos de mouse; con el dedo compite con el scroll |
| Chips de metadatos a la derecha | En 390 px compiten con el texto |
| Filtros simultáneos visibles | No entran |

### Lo que hay que prever ahora

1. **El modo de revelación de los botones es un parámetro del componente.** Si nace con `mouseenter` adentro, después se reescribe entero.
2. **El `transactionFilter` del checkbox automático es el mayor riesgo de divergencia.** El teclado de software escribe por composición (IME) con autocorrección, y las transacciones no tienen la misma forma. **Hipótesis fundada, no verificada** — hay que probarlo en el teléfono, según el §1 de las notas de método. Salida de emergencia: en móvil no se intercepta nada y se escribe `- [ ]` a mano.
3. **La lista tiene que ser virtualizable.** Obsidian móvil es una WebView con menos memoria. Meter virtualización después obliga a rehacer la vista, porque cambia el cálculo de alturas, scroll y colapso. Es la decisión más cara de postergar.
4. **Token oculto sin widget en móvil.** Cuanto menos superficie tenga, menos chances de que el handle de selección táctil caiga adentro.
5. **Objetivos táctiles de 44 px.** Cuatro botones ocupan 176 px de 390. Otro argumento para el swipe.
6. **Áreas seguras y teclado.** El diálogo de captura al pie se lo come el teclado; usar las variables de área segura y las clases `is-mobile`.

---

## 16. Fuera de alcance

- **Recordatorios** (turnos, clases, compromisos). No son tareas: no se completan, ocurren; tienen hora y duración; su valor está en el aviso previo. Además, **un plugin de Obsidian solo puede notificar con Obsidian abierto** — no hay notificaciones de sistema en segundo plano ni en móvil. El aviso real vive en Google Calendar. Va a un plugin aparte, más simple.
- **Áreas** como concepto con vista propia (D8).
- **Convertir `tareas_CÍCLICAS` en tareas completables** (§11).
- **`workbench.md`**: es un pizarrón para pegar texto, no una nota de tareas. No entra en D2.
- **Reordenar por drag & drop** (§9).

---

## 17. Arquitectura

Tres capas y una prohibición.

1. **Lógica pura** — parser, token, outline, recurrencia, archivado, filtros. Sin Obsidian, sin DOM. Testeable offline. Es el §5 de las notas de método.
2. **Escritura sobre el vault** — sin DOM. Sujeta a §8.
3. **Vistas** — extensiones de CodeMirror y las tres pestañas, con un punto de entrada por plataforma.

> `Platform.isMobile` solo puede aparecer en la capa 3. Nunca en 1 ni en 2.

Si se respeta, la versión móvil es un frente nuevo. Si no, es una reescritura.

### Reutilizable de Anotaciones

| Módulo | Para qué |
|---|---|
| `hiddenTail.ts` | Casi tal cual: el tramo oculto al final de la línea es el mismo problema |
| `outline.ts` | Mover subárboles, detectar la unidad de indentación. Solo si Outliner falla |
| `color.ts` + `settingsData.ts` | Token de color, `colorClass`, barra de colores rápidos |
| `editor/annotationDecorations.ts` | Estructura de decoraciones de línea, caché, nivel como variable CSS |
| `blockId.ts` | El patrón, no el código: parseo tolerante que devuelve null en vez de tirar |
| `designFlags.ts` | Encender un diseño nuevo sin reemplazar el anterior (§17 de las notas) |
| `NOTAS-DE-METODO.md` §8 | Las trampas de CodeMirror. Leer antes de tocar decoraciones |
| Pipeline `npm run deploy` / `humo.mjs` / `revisar-especificidad.mjs` | Tal cual |

---

## 18. Invariantes testeables

Estas son las propiedades que sostienen el modelo. Si alguna se rompe, el plugin miente.

1. **Toda tarea visible en cualquier vista tiene exactamente una línea en una nota de tareas.** Los workbenches no almacenan.
2. **`setTaskToken` es idempotente**, y con patch vacío no modifica el archivo.
3. **Reescribir una tarea nunca modifica sus bullets sin checkbox.**
4. **Ninguna operación reescribe un archivo entero.**
5. **Reiniciar un grupo cíclico dos veces seguidas da el mismo archivo**, y no toca una sola línea que no lleve la etiqueta de ese grupo.
6. **Archivar y volver a leer recupera lo archivado**: texto, fecha, nota y proyecto. Y archivar N bloques en el mismo camino crea el camino una sola vez.
7. **Un token que no parsea deja la línea intacta.**
8. **Un `- [ ]` vacío nunca aparece como tarea.**
9. **Parsear las siete notas y volver a escribirlas sin cambios no altera ningún byte.** Es la prueba diferencial más barata y la que más bugs de reescritura atrapa.

---

## 19. Migración

Chica, medida:

1. **15 referencias en texto plano** (`⮕ p_6_Sheets`) a wikilink (`⮕ [[p_6_Sheets]]`). Un script, cinco notas.
2. **Las secciones `## WORKBENCH` a mano ya son workbenches.** El plugin las lee en la migración y las convierte en asignaciones reales, en vez de arrancar de cero. El usuario empieza con sus workbenches armados.
3. **Reformatear `tareas_LOG.md` por proyecto** (§12).
4. `tareas_CLAUDE` entra en D2: es una nota de tareas e ideas que recién arranca, sin deadline. Hoy tiene 5 tareas y 54 bullets; se espera que la proporción cambie con el uso.

Ninguna migración toca nombres de archivo ni estructura de carpetas.

---

## 20. Orden de trabajo

Criterio heredado del `PLAN.md` de Anotaciones: **primero lo que produce evidencia sobre la premisa que sigue sin confirmar.**

| # | Paso | Por qué acá |
|---|---|---|
| 0 | ~~Medir el corpus~~ | Hecho. Los números están en §2 |
| 1 | **Prototipo del `transactionFilter`** del checkbox automático, conviviendo con Outliner, probado en escritorio **y en el teléfono** | Es lo único que puede salir mal de un modo que cambie el diseño. Si falla, §15 punto 2 |
| 2 | **Capa 1 completa con tests**: parser de las cuatro clases de línea, token, árboles, reinicio de cíclicas, archivado | Lógica pura primero, interfaz después. Y da los invariantes 2, 3, 5, 6, 7, 8, 9 sin tocar Obsidian |
| 3 | **Store + capa de escritura**, con el invariante 9 como prueba diferencial contra las siete notas reales | Antes de dibujar nada, garantizar que leer y escribir no corrompe |
| 4 | **Decoraciones sobre la nota**: ocultar el token, botones en hover, colores de prioridad | El frente principal (§13.0) |
| 5 | **Pestaña Workbenches**, con el componente de lista virtualizable desde el principio | La vista que más se usa |
| 6 | **Completar / descartar / archivar al LOG** | Resuelve el hallazgo del 7,5% |
| 7 | Pestañas Buscar y Agenda, con «archivadas» como origen en Buscar (§12) | |
| 8 | Migración (§19) | Al final: reescribe notas reales, y conviene que el parser esté probado |
| 9 | Layout de paneles | Alcance chico, entra en cualquier hueco |

### Antes de compartirlo como community plugin

Solo si sale del vault propio. Está listado acá para que no sea un olvido: idioma (los textos van juntos desde el principio, como en Anotaciones), accesibilidad de botones y teclado, `isDesktopOnly` y el trabajo de §15, convivencia con instalaciones sin Outliner, y la primera migración de `FORMAT_VERSION`.
