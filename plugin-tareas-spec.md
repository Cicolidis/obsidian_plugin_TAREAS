# Plugin de tareas — especificación

Estado: 22 de agosto de 2026, revisada el 29 de septiembre. Documento de entrada para la implementación en Claude Code.

Dice **qué** es el plugin y **por qué** cada decisión es la que es. El orden de trabajo va al final.

**Esta spec es la parte normativa.** Desde el 29/09/2026 las bitácoras de las
secciones que más crecieron —la §5.5 y la §13.0, con sus vueltas de verificación
y sus mediciones— están en `informes/`, verbatim, y acá queda un resumen de lo
que quedó decidido con el punto del informe donde está el porqué. Una decisión
nueva entra acá; la historia de cómo se llegó, al informe de su sección.

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

**Recontado el 02/09/2026, al empezar el paso 6b.** Esta tabla es una foto con
fecha y dos de sus números ya no valen:

| | 22/08 | 02/09 |
|---|---|---|
| Tareas totales | 386 | **390** |
| Completadas | 29 (7,5%) | **16 (4,1%)** |
| Fechas escritas en prosa | 25 | **24 líneas, y solo 9 sobre una tarea** |

Lo de las fechas no es una corrección de cantidad sino de **qué se contaba**: el
contador mira líneas, y de las 24 que tienen una fecha, 15 son notas de tarea,
headings o texto libre. Ver la §5.2. Y **ningún test hardcodea estos números**:
el corpus se sigue escribiendo.

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

### La detección de fechas en prosa se descarta, y este es el número

**Medido el 02/09/2026, al abrir el paso 6b.** La fila de `due` dice «desde el
menú, **o al confirmar una fecha detectada**». Lo segundo se midió antes de
escribirlo y no entra:

| | |
|---|---|
| Líneas del corpus con una fecha en prosa | 24 |
| …de ellas, sobre una **línea de tarea** | **9** |
| …de esas 9, con forma de **rango** («del N al M») | 4 |
| …de esas 9, **sin el año escrito** | 8 |
| Tareas con una fecha única y sin ambigüedad | **5 de 390** |

Un parser de lenguaje natural serviría para **cinco tareas**, y en casi todas
tendría que inventar el año. El resto de las señales temporales del corpus son
**relativas** —4 tareas nombran un día de la semana, 2 dicen «antes del día N»,
0 dicen «hoy» o «mañana»— y esas no las resuelve un parser de fechas: las
resuelve un menú de atajos, que es lo que el paso 6b construyó.

Lo que sí queda de la medición es **la forma del selector**: los atajos primero
—hoy, mañana y los días de la semana— y el campo de fecha como salida, no al
revés. Un `<input type="date">` suelto obligaría a traducir «el lunes» a mano
cada vez.

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

### Lo que quedó decidido

La historia completa —la línea de base del ciclo de medición, las seis vueltas de
verificación del paso 4b, los treinta puntos numerados con sus mediciones— está
en [`informes/spec-5.5-rangos-atomicos-y-medicion.md`](informes/spec-5.5-rangos-atomicos-y-medicion.md).
Lo que vale hoy, con el punto de ese informe donde está el porqué:

**El tramo oculto y el mapa de alturas**

- Las decoraciones del token van en un **`StateField` sobre el documento
  entero**, nunca en un `ViewPlugin`: el mapa de alturas descarta las que llegan
  como función.
- Con un límite exacto: un widget inline de ancho cero, sin `estimatedHeight` ni
  `lineBreaks`, no entra al mapa venga de donde venga. Por eso **la fila de
  botones va en un `ViewPlugin`** sobre `visibleRanges`, y hay un test que falla
  el día que el widget declare altura (punto 12).
- El rango atómico **incluye el salto de línea** (punto 1) y el tramo oculto se
  lleva **un solo espacio** final (punto 7).
- La posición de un widget **se le pide a CodeMirror** (`posAtDOM`) y `eq()` no
  lleva el número de línea (punto 14).

**Los filtros de transacción**

- Se encadenan de menor a mayor precedencia, y el orden está fijado por tests:
  **`unirLimpio` decide el texto, `protegerTramo` el token, `autoCheckbox` el
  checkbox** (puntos 2 y 9); `completarAlTildar` corre último (§13.0).
- **Se reconoce el defecto, no el gesto**: se calcula en qué quedaría el
  documento y se corrige solo si algo queda mal. Así pasan intactas las
  escrituras del propio plugin (punto 5).

**El comportamiento del editor**

- Al **partir** una tarea el token se queda arriba, salvo que la mitad de arriba
  quede sin texto (punto 6).
- Al **unir** dos tareas queda una línea limpia —un espacio, sin el marcador de
  la absorbida—; la de arriba tiene que ser un ítem de lista y la de abajo no
  (puntos 9 y 10).
- **Borrar el checkbox** convierte la tarea en bullet aunque tenga texto, y el
  token se va con el checkbox. El borrado que cruza líneas no convierte: ahí unir
  es unir (punto 10).
- Los comandos de prioridad parten de la **prioridad que se ve**, la heredada
  incluida. Queda un agujero dicho: una hija que hereda no se puede bajar sola sin
  un `p=0` explícito, que cambiaría el formato (puntos 9 y 10).
- Un **clic al final** de una tarea no salta a la línea de abajo: se corrige el
  clic, no el rango (punto 9).
- **Ctrl-Z deshace una escritura del plugin solo si la nota está abierta.** Por
  eso lo que toca varias notas confirma: el rescate depende de qué notas estaban
  abiertas (punto 15).
- Un clic en la fila fuera de un botón no mueve el cursor: la fila guarda la
  selección en el `mousedown` y la devuelve en el `click` (puntos 16 y 22).
- **Un cambio externo no mueve el cursor**: `cursorExterno` ubica la línea por su
  texto visible y, si no es único, deja el mapeo de CodeMirror (punto 23).

**La fila en el margen**

- Es un **`gutter`** registrado con `Prec.lowest`, no un widget posicionado
  (punto 24). El hover le llega por un oyente que publica la línea del mouse
  (punto 26; el oyente vive en `scrollDOM`, ver §13.0).
- Toda regla de CSS que la apague o la encienda **nombra `.cm-line` o
  `.cm-gutter`**, y `humo.mjs` lo exige (punto 28).
- Las unidades relativas se resuelven **fijando el contexto** —la letra de la
  línea en la celda del margen—, no con un número (punto 30).

**Lo que no se corrige desde acá, medido:** el cursor que Outliner deja al unir
(punto 19), la flecha que entra en el `- [ ] ` (punto 20) y el margen de badges
de Anotaciones entre los números de línea y la fila (punto 29).

**La línea de base del ciclo de medición** («1 y 4» avisos, tomada el 24/08) no
se reproduce desde el 25/08 y **no se pide más a ojo en las guías** (puntos 8, 11
y 18). **El 30/09/2026 el instrumento dio su primer número: 0 y 0**, con el
parche comprobado, el editor en 341 px con `lineWrapping`, la nota larga del vault
de prueba (360 tareas, 120 tokens) y 40 pasos hacia arriba, con el plugin
encendido (`scripts/verificar/paso-6c.mjs`, sección H). La predicción —«la cuenta
no pasa de la base»— se cumple; lo que ya no se puede decir es que la base de
agosto fuera reproducible. Falta la mitad A/B, con el interruptor «decoraciones
en la nota» apagado.

---

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

1. **Arranque:** se parsean las notas de D2 y se arma el mapa. **Menos el LOG**, que solo recibe y crece sin techo (§12).
2. **Suscripción:** `metadataCache.on("changed")`. Cambia un archivo → se reparsea **solo ese archivo**. **Sin debounce**, ver abajo.
3. **Lectura:** las vistas no abren archivos nunca. Leen el store, filtran, renderizan.
4. **Escritura:** el plugin edita el markdown → **`vault.process()` devuelve lo que quedó escrito y eso entra al store en el acto** → las vistas se redibujan solas. El evento llega después con lo mismo y no reparsea nada.

**Un solo camino de escritura, un solo camino de lectura.** Ninguna vista se actualiza a mano después de una acción; eso es lo que evita que el workbench y la nota digan cosas distintas.

### No hay debounce, y eso está medido

**Revisado el 24/08/2026.** La versión anterior decía: «el debounce importa más
que la estructura: reparsear las 398 líneas de `tareas_COLE` en cada tecla es
invisible en escritorio y perceptible en móvil». **Las dos mitades de esa frase
son falsas**, y ninguna estaba verificada cuando se escribió.

Medido con `scripts/espia-eventos.js` en la consola de Obsidian, tecleando sin
parar 15 segundos sobre una nota de 388 líneas:

| | |
|---|---|
| eventos en 15 s de tecleo continuo | `modify`×8 · `changed`×8 |
| hueco entre `changed` consecutivos | mín **2023 ms** · mediana **2100** · máx 7288 |
| demora `modify` → `changed` | mín 16 ms · mediana **21** · máx 28 |
| costo de parsear **las siete notas enteras** | **0,31 ms** |

- **`changed` no llega por tecla.** Llega una vez por guardado del editor, que es
  el `requestSave` de 2 segundos de `TextFileView`. No existe el caso «en cada
  tecla» que la versión anterior quería evitar.
- **Un debounce no junta nada**, porque nada llega más junto que 2023 ms. Lo
  único que agregaría es su propia espera entre la acción y el redibujo.
- **El costo tampoco lo justifica**: 0,31 ms por las siete notas, no por una.

Conclusión: el store se suscribe directo. La constante `DEBOUNCE_MS = 150` que
existió unas horas quedó sin trabajo que hacer y se borró. Si alguna vez aparece
una fuente de eventos más rápida —Sync escribiendo el mismo archivo en ráfaga—
se vuelve a medir antes de agregar nada.

Con 406 tareas el mapa son unos pocos MB.

### Descongelar tiene que releer, y no lo hacía

**02/09/2026, encontrado al verificar el paso 6b.** `resincronizar()` —lo que
corre cuando cambian los ajustes— saltea toda nota que **ya** está en el mapa:

```ts
if (this.notas.has(path)) return;
```

Como optimización es correcta y como cura no sirve: apagar «Congelar el índice»
llamaba a `resincronizar()` y **no pasaba nada**. El índice quedaba atrasado
para siempre, hasta que alguien tocara el archivo y llegara un `changed`.

Costó tres comprobaciones de la guía. Con tres tareas completadas en disco, el
reinicio informaba «no hay nada que reiniciar: ninguna tarea del grupo está
completada» — un cartel que **afirma un hecho sobre el mundo** leyéndolo de un
índice viejo. El plan puro, corrido sobre los mismos bytes, daba 3 tareas en 2
notas.

Dos cosas que quedan de eso:

1. **El arreglo vive en el store, no en quien apaga el ajuste.** El store anota
   qué notas descartó mientras estaba congelado y la próxima `resincronizar()`
   —venga de donde venga— las relee. El bug **era** un camino de llamada que no
   releía; una lista de llamadores que hay que acordarse de actualizar es la
   misma trampa otra vez.
2. **Un andamio de verificación que miente es peor que no tenerlo.** Es el §«un
   instrumento miente antes que el código» aplicado al propio plugin: el ajuste
   se llama «congelar» y su descripción dice «acordate de apagarlo», o sea que
   promete que apagarlo alcanza.

---

## 8. Escritura sobre el vault

Dos reglas, las dos por conflictos de Sync. `tareas_COLE` tiene 304 tareas en un archivo: un conflicto no afecta una tarea, afecta decenas.

1. **Nunca reescribir el archivo entero.** Solo el rango de las líneas que cambian, con `vault.process()` (lectura-modificación-escritura atómica), no `modify()` con el contenido completo. Es el §6 de Anotaciones convertido en requisito.
2. **Ninguna escritura de mantenimiento automática.** El plugin no toca un archivo si el usuario no pidió una acción sobre una tarea de ese archivo. Ver §5.4.

### El riesgo que las dos reglas no cubren

**Agregado el 24/08/2026, al construir el paso 3.** Las dos reglas de arriba
hablan de *cuánto* se escribe y *cuándo*. Falta *dónde*, y ahí estaba el agujero:

> El plan dice que la tarea está en la línea 42; para cuando se escribe, ya no lo
> está, porque alguien tecleó arriba. Escribir en la 42 igual no falla ni avisa:
> **pisa otra tarea.**

Por eso **toda escritura lleva el texto que esperaba encontrar** y se verifica
contra el archivo en el momento de escribir, adentro de `vault.process()`, que
es el único lugar sin carrera entre verificar y escribir. Si la línea sugerida no
coincide, se busca ese texto exacto: **una sola aparición** se escribe, **cero o
varias no**, y se avisa. Nunca adivinar cuál de dos líneas iguales era. Es el
invariante 10, y vive en `src/ubicar.ts`.

Dos cosas medidas que dimensionan el riesgo:

- **40 de las 398 líneas de tarea del corpus (10,1%) están repetidas**: 20 textos
  distintos, cada uno exactamente dos veces, de 30 caracteres de mediana. Todas
  en `tareas_COLE`. Son las que, con el índice atrasado, hacen que la acción se
  niegue en vez de escribir. Se corrige sola donde importa: **una tarea que entra
  a un workbench recibe un `id`, y eso vuelve su línea única** (§5.4).
- **El disco puede estar hasta 2 segundos atrasado respecto del editor.**
  `TextFileView.requestSave` es «debounced save in 2 seconds from now», y
  `vault.process()` lee del disco. Medido: con la nota abierta y recién
  tecleada, disco 13354 bytes contra editor 13403, y `process` escribió
  **13393 = 13354 + 39**. Es decir, **calculó sobre el disco viejo e ignoró lo
  que el usuario acababa de escribir.** El invariante 10 no puede atajarlo:
  adentro de `process` esa foto se ve perfectamente consistente.

  **Lo que la medición refutó** (24/08/2026, el mismo día en que se escribió
  esta sección): la primera versión decía que el volcado posterior del editor
  «pisa la escritura». No pasa. A los 2004 ms el editor guardó 13442 = 13403 +
  39, o sea que Obsidian **fusiona** el cambio externo en el buffer sucio en vez
  de descartarlo. No se perdió ni lo tecleado ni lo escrito.

  Aun así, antes de escribir se fuerza `save()` sobre toda vista abierta del
  archivo, y no por la pérdida que no ocurre: sin él, la verificación del
  invariante 10 corre contra una foto que no incluye lo recién tecleado —el
  desfasaje exacto del que este mecanismo defiende— y la corrección pasa a
  depender de que la fusión de Obsidian mapee bien los números de línea, que no
  está medido. Con `save()` no hay fusión: la secuencia es lineal y cuesta 8 ms.

**O se aplican todos los cambios de una acción o ninguno.** Media operación deja
el árbol en un estado que el usuario no pidió, y con la nota **cerrada** no hay
nada que lo deshaga. (Con la nota abierta sí: la escritura vuelve al editor y
entra a su historial. Ver §5.5 punto 15 — a veces sí y a veces no, que es peor
que nunca.)

### Y entre dos archivos no se puede cumplir

**Agregado el 01/09/2026, al construir el paso 6a.** Archivar escribe en la nota
—marcar `[x]`, escribir `done`— **y** en el LOG. `vault.process()` es de a un
archivo, así que no hay forma de hacer las dos atómicamente. Lo que sí se puede
es elegir en qué orden se rompe y achicar la ventana:

1. **Primero el LOG, después la nota.** Si falla la segunda queda una entrada de
   historial de una tarea que sigue pendiente: **se ve, y se arregla**. Al revés
   queda una tarea completada sin registro, que es una pérdida que **no se
   nota**. Es el mismo criterio con el que el rango atómico del token eligió el
   daño reversible (§5.5 punto 1).
2. **Un paso en seco antes de tocar el LOG.** Se corre `process` sobre la nota
   devolviendo `data` **intacto**, solo para preguntar si el lote se podría
   ubicar. No es una escritura, y eso está medido: un `process` que devuelve lo
   mismo que recibió no dispara `modify` ni `changed` y deja el `mtime` igual.
   Ataja la falla realista —`no-ubicada`— antes de tocar el LOG, y deja la
   ventana en los microsegundos que hay entre las dos llamadas.
3. **Media operación no puede terminar en silencio.** Es su propio estado, con
   su propio aviso, que dice qué quedó hecho y qué hay que mirar.

Y una excepción que vale la pena mirar de frente: **la inserción en el LOG no se
ubica, se recalcula.** Su posición es una *función del contenido del LOG* —la
calcula `planDeArchivado` leyéndolo—, y `process` entrega los bytes frescos, así
que recalcular sobre ellos es estrictamente más correcto que verificar un ancla
vieja. No es solo más simple: **es lo único que sostiene el invariante 6 con más
de un dispositivo**. Con una inserción ubicada, un heading que otra máquina
acaba de crear por Sync no lo ve nadie y el archivado lo duplica en silencio.
Cuesta 0,011 ms sobre el LOG de hoy y 0,17 ms sobre uno veinte veces más grande.

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

134 tareas (35%) no cuelgan de un heading semántico: viven bajo `## WORKBENCH`, `## semana N - M` o `# INBOX`. **No son fleeting: son tareas cuyo proyecto está implícito.** Se distinguen tres estados:

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

**La confirmación es obligatoria**, y **la razón no es el tamaño.**

La versión anterior de esta frase decía «la escritura más grande del plugin —23
líneas de un tirón en `tareas_MES`, medido—». Ese número contaba lo que *se
esperaba* etiquetar, no lo que un reinicio tocaría. **Contado el 02/09/2026**,
con `planDeReinicio` —que salta las tareas ya pendientes y sin `done`—:

| | tareas | completadas = techo del reinicio |
|---|---|---|
| `tareas_COLE` | 292 | 3 |
| `tareas_VIDA` | 37 | 1 |
| `tareas_MES` | 31 | **9** |
| `tareas_ACADEMIA` | 25 | 3 |
| `tareas_CLAUDE` | 5 | 0 |
| **todo el vault** | 390 | **16** |

O sea que hoy el reinicio más grande posible son 16 líneas repartidas en cuatro
notas, no 23 en una. La confirmación se queda igual, por lo que sí es verdad:
**toca varias notas a la vez**, y el historial de deshacer solo existe en las
que están abiertas —con la nota cerrada `vault.process()` no pasa por el editor
y no hay nada que lo deshaga—. Un rescate que depende de qué notas estaban
abiertas no es un rescate. Tiene que decir cuántas tareas y en cuántas notas.

### Lo que el paso 6b decidió y midió

**02/09/2026.**

**1. `due` guarda dos cosas y cuál depende de `rec`, así que hay una conversión
que la spec no cubría.** Ponerle `rec` a una tarea que ya tiene `due=2026-09-10`
deja un dato que significa otra cosa que antes. Decisión del usuario, tomada
antes de escribir nada: **se convierte, y el aviso lo dice**. `due=2026-09-10` +
`rec=mensual` pasa a `due=10` en el **mismo** cambio de línea, y se pierden el
año y el mes — que es exactamente lo que esta sección dice que no hay que
guardar en una cíclica. Al revés no se convierte nada: sacarle el `rec` a una
con `due=10` deja el `10`, que sigue resolviéndose contra el reloj, y también se
avisa. La conversión inversa tendría que inventar un mes.

Quién decide es una sola función pura, `conversionDeDue`, y la usan **el plan y
el cartel**: si el aviso lo decidiera por su cuenta, mentiría el día que una de
las dos reglas cambie.

**2. `rec` se escribe en una sola línea, y eso es la condición de seguridad del
reinicio.** No es una analogía con la prioridad. Si `rec` bajara por el
subárbol, en `tareas_MES` los hijos sin etiqueta que llevan el monto de cada mes
quedarían etiquetados, y el primer reinicio los convertiría en tareas
pendientes: el desastre que esta sección nombra, habilitado desde el otro lado.

La consecuencia queda dicha en vez de tapada: una cíclica **con hijos** se
reinicia con la madre destildada y los hijos todavía en `[x]`, porque tildar sí
baja por el subárbol (§9). Es lo correcto para `tareas_MES` y puede no serlo
para una semanal con subtareas. Se decide con uso.

**3. Reiniciar toca N notas, y ahí vuelve a valer «o todas o ninguna».** Un
grupo es global, así que el reinicio son N lotes, uno por nota.
`escribirEnVarias` corre el **paso en seco sobre todas antes de escribir en
ninguna** —un `process` que devuelve `data` intacto, que está medido que no
dispara `modify` ni `changed`—, así que la regla completa de la §8 se recupera:
la falla realista se ataja entera antes de tocar el disco. Es la diferencia con
`escribirArchivado`, que maneja dos archivos con un orden elegido y su paso en
seco corre sobre uno solo.

Lo que queda de ventana —entre el seco de la última nota y la escritura de la
primera— no puede corromper nada: `aplicarLote` vuelve a verificar adentro de
`process`, así que una nota que se movió se niega. El modo de falla es
`media-operacion`, nunca «escribió en la línea de al lado». El orden de
escritura es **alfabético por ruta**, para que una media operación sea
reproducible y el aviso diga siempre las mismas notas.

**4. `resolverDue` es gratis, medido antes de que se note.** Las pestañas Agenda
y Buscar lo van a llamar por tarea en cada dibujo, y no se puede cachear por
contenido —es una función del reloj, ese es el punto de guardar el día del mes—.
Medido con calentamiento descartado y 50 muestras, en el peor caso («todas
cíclicas», porque hoy hay 0 `due` escritos): **0,065 ms para las 292 tareas de
`tareas_COLE`**. Es el 10% de lo que cuesta decorar la nota entera (0,65 ms) y
el 0,4% de un cuadro. No hay nada que optimizar ni que cachear.

Y una advertencia sobre cómo se lee esa salida: **con pocas tareas la columna de
µs por tarea está dominada por el reloj**, no por la función. `tareas_CLAUDE` (5
tareas) informa 0,57 µs por tarea y `tareas_COLE` (292) informa 0,22; no es que
la nota chica sea más cara, es que a esa escala lo que se mide son las dos
llamadas a `performance.now()`. El único número que significa algo es el de la
nota grande.

La razón **cambió** con lo que midió la primera verificación del paso 4b (§5.5
punto 15). La versión anterior decía «`vault.process()` no pasa por el editor,
así que Ctrl-Z no la deshace», y eso es falso cuando la nota está abierta: la
escritura vuelve al editor como cambio externo y esa transacción entra al
historial de deshacer. Con la nota **cerrada** —que es el caso del reinicio de un
grupo que toca varias notas— no hay historial ninguno. O sea: **a veces se
deshace y a veces no**, y un rescate que depende de si la nota estaba abierta no
es un rescate. Eso justifica la confirmación mejor que la afirmación anterior.

### Lo que el paso 6c construyó: «archivar y reiniciar»

**03/09/2026.** El segundo camino de la confirmación existe. Cinco decisiones,
todas con su razón medida o leída.

**1. Son 1 + N archivos, y ninguno de los dos caminos que había alcanzaba.**

| | Cuántos | Cómo rompe la atomicidad |
|---|---|---|
| `escribirArchivado` | 2, con orden elegido | Seco sobre la nota; la nota puede quedar a medias |
| `escribirEnVarias` | N, sin orden privilegiado | Seco sobre **todas**: o todas o ninguna |
| `escribirArchivadoEnVarias` | **1 + N** | Seco sobre las N → el LOG → las N |

El orden es **seco sobre las N notas, después el LOG, después las N**. La §8 ya
elegía el LOG primero porque una entrada de historial de una tarea pendiente se
ve y se arregla; acá hay una razón más dura y es la que manda: **el reinicio
borra los `done` y los `[x]`**. Escribiendo las notas primero, si el LOG fallara,
la fecha de completado de ese ciclo ya no existiría en ningún lado. No es elegir
entre dos daños reversibles: un orden destruye datos y el otro no.

Y el seco corre sobre las N **antes de tocar el LOG**, que es lo que hace
verdadera la promesa que este camino tiene que dar: **si una nota no se puede
ubicar, no se escribe en el historial tampoco.** La inserción en el LOG no puede
entrar al seco —su posición es una función del contenido del LOG y se recalcula
adentro de `process` (§8)— pero puede ir **después**, y con eso alcanza.

Los tres comparten la secuencia en un solo lugar, y eso no es prolijidad: **la
garantía vive en la secuencia**, no en cada paso, y dos copias son dos garantías
que se pueden desincronizar en silencio.

**2. Se archiva exactamente lo que el reinicio va a borrar.** No «las
completadas»: el mismo conjunto que `planDeReinicio` toca, o sea `hecha || done
!== null`. Una regla y no dos, y la razón es el sentido entero de este camino —
nada de lo que el reinicio destruye se pierde. Queda dicho el borde en vez de
tapado: una tarea `[ ]` con un `done` viejo —solo alcanzable editando el token a
mano— también se archiva, porque su fecha también se borra.

**3. La nota recibe bloques, no las líneas del reinicio.** Es la §12 punto 4
valiendo acá: **lo que se copia al LOG tiene que ser lo que estaba en la nota**.
El bloque incluye las notas sin checkbox del subárbol (§4.3), que ningún cambio
de línea toca y que por lo tanto nadie verificaría; viajando adentro del `antes`
del bloque, si alguna cambió, el lote entero se niega en vez de archivar texto
viejo.

Y de ahí sale una condición que no era obvia: **una tarea del grupo que cuelga
de otra del mismo grupo no lleva entrada propia**. Ya viaja adentro del bloque de
la madre, y una entrada aparte la duplicaría en el historial **y** haría
solapar dos cambios en el mismo lote — `ubicarLote` devolvería `colisión` y la
operación entera se negaría sin que nada lo explique. Es raro —`rec` no baja por
el subárbol, hay que etiquetar las dos a mano— y hay una propiedad que lo fija.

**4. La confirmación tiene dos botones y el foco en «Cancelar».** Decisión del
usuario: ninguno de los dos puede ser el que un Enter reflejo elige, porque los
dos son irreversibles de maneras distintas —uno borra fechas de completado, el
otro escribe en un archivo que solo crece—. Eso obligó a separar `peligrosa` de
`focoEnCancelar` en el modal, que hasta acá eran lo mismo **por accidente**:
había una sola acción peligrosa, así que «pintar de rojo» y «no recibir el Enter»
iban siempre juntas.

Si no hay nada que archivar, el segundo botón **no se dibuja**. Es la misma regla
que dejó los cuatro ítems afuera del ⋯ en el paso 4b: un control que promete lo
que no puede hacer es peor que uno que no está.

**5. Cuánto escribe: el número es construido, y hay que decirlo.** Contado el
03/09/2026: **0 tareas con `rec` en las siete notas reales**, así que no hay
ningún grupo cíclico que archivar y cualquier número sobre esto hay que
fabricarlo. Lo que sí es real es el archivo contra el que se inserta:

| | |
|---|---|
| El LOG hoy | 51 líneas · 7 headings · 1297 bytes |
| Caso **construido** (las 15 completadas del corpus como un grupo) | 15 bloques · **50 líneas al LOG** · **3 headings nuevos** |
| El LOG después | 101 líneas |

O sea que un reinicio con archivado del tamaño de todo lo completado que hay hoy
**duplica el historial**. No es un problema —el LOG es el único conjunto que solo
recibe, y para eso está— pero es el orden de magnitud que la confirmación tiene
que decir, y por eso el cartel cuenta líneas y secciones.

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

El default se deriva del tamaño del bloque, y siempre se puede forzar el otro con un modificador. **Medido el 01/09/2026 sobre *todas* las tareas** —que es lo que ve el botón, no solo las raíces que midió la §2—: el subárbol tiene p50 **1** línea, y **251 de 389 tareas (64,5%) son hojas de una sola línea**. La conclusión no cambia; el número sí, y la versión anterior de esta frase decía «p50 = 2» apoyándose en una medición que contaba otra cosa. **Ninguno de los dos borra la línea de la nota**: la tarea queda `[x]` en su lugar y las vistas la ocultan. El descarte físico es una acción aparte, explícita, con confirmación.

### Formato del LOG

**Revisado el 24/08/2026.** La versión anterior decía «bajo el mismo camino de
headings que la tarea tenía en su nota» y a la vez «organizado por proyecto».
Las dos cosas se contradicen: el camino literal arrastra al historial los
andamios de la nota de trabajo —`WORKBENCH`, `INBOX`, `semana N - M`—, que son
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

### Lo que el paso 6a decidió y midió

**01/09/2026.** Cuatro cosas, todas apoyadas en contar antes de decidir.

**1. El LOG de hoy, contado.** 51 líneas, 37 bullets, **0 checkboxes**, **0
marcas `[✓ AAAA-MM-DD]`**, 7 headings de niveles 1 y 2, y no termina en `\n`.
O sea que la marca de fecha **sigue siendo formato nuevo**, como esta sección
afirmaba. Confirmado, no supuesto — y hay un test del corpus que lo vuelve a
contar y avisa el día que deje de ser cierto.

**2. Ninguno de los caminos de archivado engancha todavía.** El corpus produce
**5 caminos distintos**, todos de un solo nivel —ninguna tarea cuelga de un
heading de proyecto, porque solo el wikilink lo define (§4.1) y todavía no hay
ninguno— y **ninguno coincide** con los 7 headings que el LOG ya tiene. O sea
que el primer archivado de cada nota crea su sección, al final del archivo, y
después no se crea ninguna más: son 5 headings en toda la vida del LOG hasta la
migración del paso 8.

**3. Cuándo se pregunta.** Archivar **no confirma** un bloque de una sola línea,
y sí confirma con dos o más. El umbral sale de la medición: el 64,5% de las
tareas son hojas de una línea, y el hallazgo que ordena esta sección es que
tildar tiene que costar menos que borrar. Con dos líneas o más el modal gana lo
que le falta al caso de una: el usuario está moviendo contenido que puede no
estar mirando —el subárbol colapsado, las notas ocultas— y **el destino en el
LOG es información que no puede ver de otro modo**, porque el LOG está siempre
cerrado. Eliminar confirma **siempre**: es la única acción del plugin que pierde
texto.

**4. Archivar verifica el bloque entero, no línea por línea.** Es lo que hace
que «se preserva verbatim» (§4.3) valga también en el momento de escribir:
ningún cambio de línea toca un bullet sin checkbox, así que sin esto nadie
verificaría lo que se copia al historial y una nota editada en el medio se
archivaría con el texto viejo. El bloque viaja adentro del `antes` de un solo
cambio, y si alguna línea cambió, **el archivado se niega entero**. Medido: de
los 389 subárboles del corpus, 38 (9,8%) aparecen repetidos verbatim en su nota
y son los que se van a negar con el índice atrasado — de los de más de una
línea, 14 de 138. Un tramo largo es **menos** ambiguo que una línea suelta.

### Lo que el paso 6c le pidió al archivado

**03/09/2026.** `archivarEnElLog` pasó de **un** camino y **un** bloque a N de
cada uno, en una sola llamada, y el cambio es de forma pero la razón es del
invariante 6.

Un grupo cíclico repartido en M notas produce **M caminos distintos** —el camino
es la nota de origen más el proyecto, `caminoDeArchivado`— y los M tienen que
entrar en **un solo** `vault.process()`. Con dos llamadas, la segunda
recalcularía su posición sobre bytes que la primera ya cambió, que es
exactamente lo que la §8 dice que hay que evitar cuando la posición es una
función del contenido.

Se resuelve plegando: cada entrada calcula su plan sobre el documento **ya
actualizado** por la anterior. Así el invariante 6 sale del recorrido y no de una
comprobación aparte —cuando la segunda entrada trae el mismo camino, el heading
ya está y lo engancha— y dos bloques del mismo camino quedan contiguos, porque
`finDeSeccion` los manda al mismo lugar.

Es **una** función y no dos: archivar un bloque es `archivarEnElLog(texto,
[entrada])`. Dos versiones de esta decisión divergirían justo en si crean el
heading, que es el invariante que la función existe para sostener. Y hay una
propiedad que fija que una llamada con N entradas escribe **exactamente lo
mismo** que N llamadas encadenadas, que es lo que hace legítimo el cambio de
firma sobre algo ya verificado.

**Y la propiedad del invariante 6 estaba mal escrita dos veces antes de estar
bien.** La primera versión generaba caminos mezclando nombres de nota y de
proyecto en una sola lista, y falló: con `["tareas_A", "p_Dos"]` archivado,
`["p_Dos"]` a secas engancha bajo el `## p_Dos` que creó el primero — que es lo
que «el prefijo más largo del camino que ya existe» quiere decir. Con
`caminoDeArchivado` eso no puede pasar, porque los dos alfabetos son disjuntos.
La segunda versión contaba los headings por `(nivel, texto)` y también falló:
`## p_Dos` bajo `# tareas_A` y bajo `# tareas_B` son **dos secciones legítimas**.
Un heading se identifica por su camino entero. Las dos veces la propiedad
afirmaba algo más fuerte que la verdad, que es la regla de la sesión 2: cuando
una propiedad falla, la primera pregunta es si la propiedad dice la verdad.

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

### Lo que quedó decidido

La bitácora —lo que construyó cada paso, lo que encontró cada verificación, con
sus mediciones— está en [`informes/spec-13.0-frente-principal.md`](informes/spec-13.0-frente-principal.md).
Lo que vale hoy:

**La fila**

- `src/botones.ts` (capa 1) decide **qué** botones van y en qué estado, a partir
  del texto de la línea y no del store, que puede estar atrasado.
  `src/editor/filaDeBotones.ts` la dibuja. Todo botón termina en los caminos de
  los comandos: `posAtDOM` → `elegirEnLinea` → plan puro → `escribir` → `absorber`.
- **Un control sin capa 1 y 2 detrás no aparece**, ni gris. Por lo mismo, el ◐
  arranca vacío y vacío significa que no se dibuja.
- Hoy son siete: ★ ◐ → ⋯ 🗑 📅 🔁. El 🗑 va lejos del ★ y se distingue por su color
  al pasarle el mouse. En el margen el orden se invierte, así que el ★ queda
  pegado al texto.
- **Nada sale del flujo**: lo que se apaga cambia de opacidad, nunca de `display`,
  para que el ★ no se corra y el margen no cambie de ancho al scrollear.
- Por omisión: **columna en el margen propio, revelada al pasar el mouse**. Las
  otras cinco posiciones y el modo «siempre» quedan encendibles; `swipe` está
  declarado en el tipo (§15) y no se ofrece.
- Los éxitos de ★ ◐ → son silenciosos —el botón que se rellena es el aviso— y los
  fracasos avisan siempre. Sobre un token ilegible la fila se dibuja apagada, y
  los tooltips dicen por qué.
- El margen **solo cobra ancho en las notas de tareas**: una clase por editor
  (`EditorView.editorAttributes`), no en `body` ni con `:has`. El hover del margen
  escucha en `scrollDOM` con `posAtCoords` (0,13 ms por llamada, sin caché).
- La clave de una fila lleva la etiqueta: dos tareas con fechas distintas no
  comparten DOM.

**Completar, archivar, eliminar**

- **Tildar es completar** —escribe `done=` y baja por el subárbol— y destildar es
  descompletar, sin bajar. Lo decide un `transactionFilter` que reconoce el hecho
  y no el gesto, con `Prec.high`, y deja el cursor en su lugar. Escribir la `x` a
  mano deja `[x ]`, que no es un checkbox, y no completa nada.
- **Cmd+clic en el checkbox archiva.** Es el único mecanismo que intercepta un
  clic, no existe en móvil y tiene interruptor propio.
- **Archivar y eliminar no confirman por omisión**, con ajuste para volver.
  Archivar algo que ya está en el historial pregunta siempre.

**El ⋯, la fecha y la recurrencia**

- El ⋯ tiene los seis ítems de arriba. Fecha y recurrencia abren un `Menu`
  propio, no un submenú (`setSubmenu` no está en la API pública).
- El **reinicio de un grupo es un comando de paleta**, no un ítem del ⋯: un grupo
  puede estar entero en notas cerradas.
- Los atajos de fecha llevan la fecha resuelta en la etiqueta («Lunes · 7 sep»).
  Hay tres órdenes —`semana` por omisión, `cronológico` y `discontinuo`— y los
  tres cumplen dos propiedades: **ningún atajo repite el valor de otro, y la
  cantidad no cambia según el día**.
- «Otra fecha…» se elige con el selector nativo (por omisión) o con una grilla,
  que es lo único que hay en una cíclica. Un clic en la grilla **elige, no
  acepta**.
- Los indicadores 📅 y 🔁 son **atajos, no toggles**: abren el submenú y nunca
  escriben solos. La etiqueta dice el valor resuelto, y en una cíclica las dos
  cosas («día 10 de cada mes: este mes, el 10 sep»).
- La recurrencia se ofrece **ordenada por uso**, derivado de las notas —sin estado
  nuevo en `data.json`—, con los grupos sugeridos detrás de los que ya se usan y
  el atajo numérico a la vista.
- El modal de «Workbench nuevo…» y el de «Grupo nuevo…» son el mismo: los dos
  nombres comparten gramática en el token.
- `MenuItem.setWarning` no colorea en todos los temas: el rojo depende del tema.

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
- **Verificar contraste en tema claro y oscuro.** Amarillo sobre fondo claro es el peor caso.
- Los tres niveles deben distinguirse **también sin color** (un indicador de forma), por accesibilidad y por pantallas al sol.

### Lo que el paso 4a decidió y midió

**25/08/2026.**

**La prioridad se escribe en la línea de la tarea y en ninguna más.** Es la
diferencia con completar y con asignar a un workbench, que bajan por el subárbol
entero (§9). Sale de la regla de arriba —el color pinta la línea, los hijos
llevan filete— y de una consecuencia que la regla no dice: si el `p=` se
escribiera en cada hija, **bajarle la prioridad a la madre no podría distinguir
una hija que la heredó de una que el usuario subió a mano**. El filete es
dibujo, no dato, y lo calcula la decoración mirando la herencia.

**El amarillo de Anotaciones no sirve, y ahora está medido.** «Amarillo sobre
fondo claro es el peor caso» era una anticipación correcta sin número. El
número: `#c99a00` sobre blanco da **2,59:1**, por debajo del 3:1 que la WCAG
1.4.11 pide para un componente y muy por debajo del 4,5:1 de texto. La paleta
que quedó —`#8c6500` y `#c62828` en claro, `#e3c052` y `#e07070` en oscuro—
tiene **4,63:1 en el peor de los ocho casos**.

**Son dos indicadores de forma, no uno, y se encienden por separado.** Decisión
del usuario: uno, el otro o los dos.

| Indicador | Qué dibuja | Por omisión |
|---|---|---|
| Filete con textura | alta = filete sólido de 3px; muy alta = 5px con muescas | encendido |
| Signo al final | `!` y `!!` después del texto | apagado |

Que estén separados no es solo gusto: **el glifo suma ancho al renglón y el
filete no**, y el ancho es lo que decide si una línea entra en un renglón o en
dos. Con la ventana angosta eso alimenta el mismo bucle de medición de la §5.5,
así que tenerlos en dos interruptores deja ver cuál de los dos, si alguno, mueve
la cuenta de avisos. Es el patrón `designFlags.ts` haciendo de instrumento.

Las clases viven en `body` y no en la decoración: el `StateField` pone siempre
la misma clase de nivel y la hoja de estilos decide qué dibuja. Así alternar un
ajuste no obliga a reconstruir las decoraciones de cada editor abierto.

**`scripts/revisar-especificidad.mjs` no se portó.** Su heurística es la de
Anotaciones —selectores de etiqueta pelada, `button:not(.clickable-icon)`— y no
mira el riesgo de acá, que es clase contra clase sobre `.cm-line`. La pregunta
se contestó leyendo el `app.css` del asar instalado: de las diez reglas de
Obsidian que tocan `.cm-line` o `.cm-content` en propiedades que este plugin
usa, la única con `!important` es `.cm-content > * { margin: 0 !important }` —la
que costó cara en Anotaciones— y `styles.css` no toca `margin`. Ninguna pinta
`background-color` sobre `.cm-line` ni usa su `::before`.

Sí se portó **`scripts/extraer-css-de-obsidian.mjs`**, que es lo que permitió
contestarla, con un arreglo: el de Anotaciones lee el `.asar` del instalador en
`/Applications`, y Obsidian se actualiza solo y corre el de
`~/Library/Application Support/obsidian/obsidian-N.asar`. Medir la versión
equivocada es peor que no medir.

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

1. **Lógica pura** — parser, token, outline, recurrencia, archivado, filtros,
   **fechas**. Sin Obsidian, sin DOM. Testeable offline. Es el §5 de las notas
   de método. `fechas.ts` es capa 1 y **toda su aritmética va en UTC**, por lo
   mismo que `enMes`: sumarle un día a una fecha local da 23 o 25 horas en los
   dos domingos del año en que cambia la hora, y ahí «mañana» cae en hoy o en
   pasado mañana. Está probado con `process.env.TZ` puesto a tres zonas.
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
5. **Reiniciar un grupo cíclico dos veces seguidas da el mismo archivo**, y no
   toca una sola línea que no lleve la etiqueta de ese grupo. Desde el paso 6b
   vale sobre **N notas**: un grupo es global, así que la propiedad se comprueba
   con el grupo repartido entre varias. Y una tercera que sale de ahí: **la
   cuenta que dice la confirmación es la que se escribe** — una nota sin nada
   que cambiar no se cuenta ni se abre.
6. **Archivar y volver a leer recupera lo archivado**: texto, fecha, nota y
   proyecto. Y archivar N bloques en el mismo camino crea el camino una sola
   vez. Desde el paso 6c vale también con **N caminos distintos en un solo
   `process`**, que es lo que «archivar y reiniciar» necesita: un grupo cíclico
   repartido en M notas produce M caminos, y en dos llamadas la segunda
   recalcularía su posición sobre bytes que la primera ya cambió. La propiedad
   compara **caminos enteros**, no textos de heading: `## p_Dos` bajo
   `# tareas_A` y bajo `# tareas_B` son dos secciones legítimas, y una versión
   anterior de la propiedad las contaba como una y fallaba.
7. **Un token que no parsea deja la línea intacta.**
8. **Un `- [ ]` vacío nunca aparece como tarea.**
9. **Parsear las siete notas y volver a escribirlas sin cambios no altera ningún byte.** Es la prueba diferencial más barata y la que más bugs de reescritura atrapa.
10. **Ninguna línea se identifica por su número: se identifica por su texto.**
    Y desde el paso 6a, **ningún tramo tampoco**: lo que se borra o se archiva
    lleva sus N líneas verbatim y se verifica entero.
    Vale en los dos extremos de una acción —al **elegir** sobre qué tarea actúa
    el usuario, y al **escribir**— porque en los dos hay una coordenada fresca
    contra una foto vieja. Y una acción se aplica entera o no se aplica.

    Es el que impide el error más caro y menos visible del plugin: actuar sobre
    la tarea de al lado porque el índice estaba atrasado. **Verificado que hace
    falta en los dos lados:** la primera versión de los comandos lo cumplía al
    escribir y no al elegir, y con cinco líneas tecleadas arriba elegía otra
    tarea y la escribía impecablemente. Ver §8.

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
| 1 | ~~**Prototipo del `transactionFilter`** del checkbox automático, conviviendo con Outliner, probado en escritorio **y en el teléfono**~~ | Hecho y verificado en los dos. Era lo único que podía salir mal de un modo que cambiara el diseño |
| 2 | ~~**Capa 1 completa con tests**: parser de las cuatro clases de línea, token, árboles, reinicio de cíclicas, archivado~~ | Hecho. Da los invariantes 2, 3, 5, 6, 7, 8, 9 sin tocar Obsidian |
| 3 | ~~**Store + capa de escritura**, con el invariante 9 como prueba diferencial contra las siete notas reales~~ | Hecho. Antes de dibujar nada, garantizar que leer y escribir no corrompe |
| 4a | ~~**Decoración pasiva sobre la nota**: ocultar el token, defender el rango atómico, colores de prioridad~~ | Hecho. El frente principal (§13.0) |
| 4b | ~~**La fila de botones** de la §13.0: ★ ◐ → ⋯~~ | Hecho. Código sin precedente: Anotaciones no tiene botones sobre la línea, tiene una barra global y gutters |
| V | ~~**Verificación con la CLI de Obsidian**: vault de prueba en el repo, `deploy:prueba` y comprobaciones que corre Claude Code (ver `CLAUDE.md`)~~ | Hecho el 30/09/2026. Las guías a mano eran el cuello de botella: 216 comprobaciones pedidas entre las sesiones 6 y 8 |
| 5 | **Pestaña Workbenches**, con el componente de lista virtualizable desde el principio | **Lo que sigue.** La vista que más se usa, y la que le da sentido al ★ y al ◐ |
| 6a | ~~**Completar y archivar** al LOG (§12) y **eliminar** con confirmación~~ | Hecho. Resuelve el hallazgo del 7,5% |
| 6b | ~~**Fecha** y **recurrencia** en el ⋯, más **reiniciar un grupo**~~ | Hecho. Cierra la §5.2: los seis campos del token se escriben |
| 6c | ~~**«Archivar y reiniciar»** (§11) y los cuatro pedidos de la verificación~~ | Construido el 03/09/2026 y **verificado por la CLI el 30/09**: 61 de 61 comprobaciones automáticas en verde, después de corregir la altura de la grilla del calendario (C5). Quedan tres a mano —A10, B6, C1— y elegir entre las alternativas. El botón por grupo **en la vista** sigue pendiente: su lugar es la pestaña del paso 5 |
| 7 | Pestañas Buscar y Agenda, con «archivadas» como origen en Buscar (§12) | |
| 8 | Migración (§19) | Al final: reescribe notas reales, y conviene que el parser esté probado |
| 9 | Layout de paneles | Alcance chico, entra en cualquier hueco |

**El orden real se desvió, y hay que decirlo.** Después del 4b se hicieron 6a,
6b y 6c, y el 5 quedó sin empezar: al 29/09/2026 el plugin escribe asignaciones
a workbenches que **ninguna vista muestra**. Cada paso del 6 tenía su razón —el
6a resolvía el hallazgo del 7,5%, el 6b cerraba los campos del token—, pero la
consecuencia es la que la fila de este cuadro anticipaba: la vista que más se usa
es la que falta. **Con el 6c verificado, no entra nada antes del 5.**

### Antes de compartirlo como community plugin

Solo si sale del vault propio. Está listado acá para que no sea un olvido: idioma (los textos van juntos desde el principio, como en Anotaciones), accesibilidad de botones y teclado, `isDesktopOnly` y el trabajo de §15, convivencia con instalaciones sin Outliner, y la primera migración de `FORMAT_VERSION`.
