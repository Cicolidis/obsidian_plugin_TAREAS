# Prompt para la sesión 10 en Claude Code

> Abrir Claude Code en `~/Downloads/claude/obsidian_plugin_TAREAS`, entrar en
> **plan mode** y pegar lo de abajo.

---

Seguimos con el plugin de tareas de Obsidian. La especificación está en
`plugin-tareas-spec.md`, en la raíz. **Leela entera antes de proponer nada**, y
con más cuidado la §6, la §7, la §9, la §10, la §13.1, la §15 y la §20. El
método de trabajo está en `CLAUDE.md` y no lo repito acá; la sección «Verificar
en vivo» es nueva desde la última sesión de Claude Code y cambia cómo se cierra
cada paso.

## Dónde estamos

Las capas 1 y 2 están cerradas, y del orden de la §20 están hechos el 4a, el 4b,
el 6a, el 6b, el 6c y el paso **V**. Son **818 tests** en `npm test` y **162** en
`npm run test:corpus`, contados el 01/10/2026. La versión **0.1.0** está
publicada como release para BRAT.

La sesión 9 no fue de Claude Code: la hizo Claude desde la app, con acceso a
esta máquina, e hizo tres cosas que tenés que conocer. `git log 94c2ff6..` las cuenta:

- **La verificación en vivo la corre Claude Code**, con la CLI de Obsidian sobre
  un vault de prueba adentro del repo (`tareas-vault-prueba/`, fuera de git).
  Todo pasa por `scripts/obs.mjs`, que se niega a hablar con otro vault, y los
  ayudantes están en `scripts/verificar/lib.mjs`: teclas y clics reales por el
  protocolo de Chrome, restaurar el vault, el informe. Hay dos ejemplos enteros,
  `scripts/verificar/paso-6c.mjs` y `sesion-9.mjs`. **Leé las trampas de
  `CLAUDE.md` antes de escribir el tuyo**: cada una costó una corrida colgada.
- **Las alternativas de diseño se eligieron y las perdedoras se borraron**: la
  fila en su margen, revelada al pasar el mouse; la prioridad como barra +
  checkbox; los atajos de fecha discontinuos; «Otra fecha…» con la grilla. Los
  instrumentos de prueba quedaron en una sección «Desarrollo» de los ajustes.
- **La lista de notas por omisión está vacía y fuera de git**
  (`notas-de-tareas.json`, con la forma en `notas-de-tareas.ejemplo.json`).

Lo que quedó decidido y no hace falta volver a discutir:

- **Asignar a un workbench escribe `wb=` en el subárbol entero**, y le pone `id`
  a cada tarea que entra sin uno (`planDeWorkbench`). O sea: **toda tarea que
  entró a un workbench con el ★ tiene `id`**. Eso importa para esta vista; ver
  más abajo.
- **Un workbench no tiene almacenamiento propio** (§10, invariante 1). La vista
  es un filtro sobre el store y nada más.
- **Ninguna escritura de mantenimiento automática.** Abrir la vista no escribe
  nada: ni ids, ni asignaciones, ni nada que «arregle» algo que encuentre.
- **El store ya tiene lo que una vista necesita leer**: `tareas()`,
  `tareasDe()`, `documento()`, `workbenchesEnUso()`, `gruposPorUso()` y
  `alActualizar()` para enterarse de los cambios. Las vistas no abren archivos
  (§7, punto 3).
- **El colapso ya está decidido y tiene capa 1**: se expande si el subárbol
  tiene ≤ 5 líneas, se colapsa si tiene más (§9). `resumenDelSubarbol` y
  `naceColapsado` en `tareas.ts`.

**El corpus, contado el 01/10/2026:** 453 tareas en siete notas, 32 tokens, y
solo **4 tareas en un único workbench**. La pestaña va a nacer casi vacía con mis
notas: los workbenches «de verdad» hoy son secciones `## WORKBENCH` escritas a
mano, y convertirlas es la migración del paso 8 (§19). **Para medir esta vista
hay que construir el caso** en el vault de prueba, y decir que es construido.

**El repositorio es público** y la regla está en `CLAUDE.md`: no entra contenido
real de mis notas, ni siquiera en un mensaje de commit.

## Antes del paso 5: una tarea suelta

Está en la §20, «Tareas sueltas para Claude Code»: **unir debajo de una tarea con
el token ilegible** deja el token en el medio de la línea y el texto absorbido
pegado detrás, sin espacio. Ya está decidido cómo tiene que quedar: el texto
absorbido va **antes** del token, separado por un espacio, y los bytes del token
no se tocan. La causa no está diagnosticada: **medila primero**, con un test que
falle antes del arreglo, y comprobala en vivo con una unión real sobre
`tarea con el token roto`, que ya está en `tareas_PRUEBA` del vault de prueba.

Es chica y va primero para calentar con la infraestructura de verificación antes
de lo grande. Si resulta no ser chica, pará y avisame.

## Alcance de esta sesión: el paso 5, primera mitad

El paso 5 tiene dos trabajos de naturaleza distinta, y propongo **partirlo**:

| | Qué | Por qué junto o aparte |
|---|---|---|
| **5a (esta sesión)** | La pestaña que **lee y actúa**: el componente de lista virtualizable, la vista de un workbench, el colapso, las recurrentes aparte, y las acciones de fila de la §13.1 que **ya tienen camino de escritura** —completar y descartar, completar y archivar, sacar del workbench, «ir a la tarea»—, más el botón de **reinicio por grupo** que el 6c dejó para esta vista | Todo es capa 3 sobre capas 1 y 2 que existen. Lo nuevo es el componente, que no tiene precedente: Anotaciones no tiene ninguna vista de lista (medido: cero `ItemView` en su `src/`) |
| **5b (la que sigue)** | Las **escrituras nuevas** que la §10 y la §13.4 le piden a la pestaña: crear una tarea desde el workbench con su destino, editar el título en línea, «vaciar workbench», «archivar las completadas de este workbench», y pedir el proyecto al mandar una tarea sin clasificar | Cada una es un camino de escritura que hoy no existe —insertar una línea al final de una sección, reescribir el texto y no el token, escribir en N notas desde la vista—, con sus propias propiedades que probar |

Si al leer la spec y el código pensás que el corte va en otro lado, decímelo en
el plan con el porqué. Cada mitad tiene que cerrar con su propia verificación en
vivo.

### Qué queda explícitamente afuera

- Todo lo de 5b.
- Las pestañas Buscar y Agenda (paso 7). Pero **el componente de lista tiene que
  servirles**: Buscar va a mostrar las 453 tareas, no las 4 de un workbench.
- El swipe y todo lo de móvil más allá de no romperlo (§15). La vista tiene que
  abrir en el teléfono; no tiene que ser cómoda todavía.
- Reordenar (§9: no se implementa).

---

## Lo primero, porque decide la arquitectura

### 1. Una fila de la vista elige su tarea igual que el cursor, o actúa sobre la de al lado

El invariante 10 vale **en los dos extremos de una acción**, y la vista es un
extremo nuevo. Hoy la fila de botones de la nota y la paleta entran por
`elegirEnLinea(store, notas, archivo, linea, texto)`, que traduce una coordenada
fresca contra el índice con `ubicarLinea` y se niega cuando no puede saber. El
bug que eso arregló está contado en `elegirTarea`: con cinco líneas tecleadas
arriba, el comando elegía otra tarea y la escribía impecablemente.

En la vista la situación es la inversa y igual de peligrosa: **la fila se dibujó
con una foto del store**, y cuando el usuario hace clic el store puede haber
cambiado —editó la nota en el panel de al lado, llegó algo por Sync—. Lo que yo
haría: que la fila guarde el `archivo`, la `linea` y el **texto crudo de la línea
con su token** del momento en que se dibujó, y que el clic pase eso por
`elegirEnLinea` como si fuera el cursor. Pero **no está decidido**: proponelo o
proponé otra cosa, con un test que reproduzca el caso de las cinco líneas
tecleadas arriba y que falle con la versión ingenua —la que actúa sobre la
clave guardada en la fila—.

### 2. La clave de una fila no puede ser `archivo:línea`

`Clave` es `archivo:linea` y es **volátil** por diseño (§6): teclear una línea
arriba cambia la clave de todas las tareas de abajo. Una lista que identifique
sus filas por eso las rehace enteras en cada tecla, y en una lista virtualizada
pierde además el scroll y el estado de colapso. Como se dijo arriba, **toda
tarea que entró con el ★ tiene `id`**, así que hay una clave estable para las
filas que importan. Lo que no la tiene: una hija que se agregó **después** de
asignar la madre. Eso empuja a la pregunta 1 de abajo.

### 3. La virtualización va desde el principio, con alturas variables

Es la decisión más cara de postergar (§15.3), y no hay de dónde portarla. Las
filas no tienen alto fijo: el texto envuelve, una tarea con hijos se colapsa y se
expande, y el colapso cambia el alto de golpe. **Sin dependencias nuevas**, como
el calendario del 6c.

Antes de elegir el diseño, medí (ver «Antes de escribir código, medir»).

### 4. Lo que la spec no dice y hay que preguntarme

La §13.1 son cuatro líneas. Estas preguntas son mías y no hay que inventar la
respuesta. Hacémelas **en el plan**, cada una con la opción que recomendás y por
qué:

1. **¿Qué se ve de un árbol asignado?** El ★ escribe `wb=` en todo el subárbol,
   pero una hija que agrego después no lo tiene. ¿La vista muestra el subárbol
   **como está hoy en la nota**, o solo las tareas que llevan el `wb`?
2. **Las completadas**, ¿se ven en el workbench? La spec se contradice: la §12
   dice que completar, con cualquiera de los dos verbos, «la saca de las
   vistas», y la §10 ofrece «archivar las completadas de este workbench», que
   solo tiene sentido si están a la vista o al menos contadas.
3. **El orden de las tareas** adentro de un workbench: ¿el de las notas, por
   prioridad, por fecha? La §9 descarta reordenar a mano, no ordenar.
4. **¿Se agrupan por proyecto?** La §13.1 solo dice «recurrentes agrupadas
   aparte».
5. **«Uno o varios en columnas»**: ¿columnas adentro de una misma pestaña, o una
   pestaña por workbench que Obsidian acomoda en sus paneles (D11)?
6. **Dónde abre** la primera vez: barra lateral, o panel central.

Si te surge otra pregunta de este tipo, se suma a la lista. **Si la spec no cubre
algo, se pregunta.**

---

## Cómo quiero que quede

| Archivo | Capa | Qué |
|---|---|---|
| `src/filtros.ts` *(nuevo)* | 1 | Qué tareas entran a un workbench, sus raíces, el orden y los grupos que se decidan en las preguntas. Puro, sobre `Task[]` |
| `src/lista.ts` *(nuevo, o el nombre que propongas)* | 1 | Lo calculable de la virtualización: qué filas caen en una ventana dada una tabla de alturas, y cómo cambia esa tabla al colapsar |
| `src/vista/listaVirtual.ts` *(nuevo)* | 3 | El componente de lista, **sin saber de workbenches**: Buscar y Agenda lo van a reusar |
| `src/vista/workbenches.ts` *(nuevo)* | 3 | El `ItemView`: selector arriba, la lista, las acciones de fila |
| `src/comandos.ts` *(modificado)* | 2-3 | Las acciones de la vista entran por los mismos caminos que la paleta y la fila de la nota. **No hay camino de escritura especial** |
| `src/main.ts` *(modificado)* | 3 | Registrar la vista y el comando para abrirla |
| `src/strings.ts` | — | Los textos, juntos como siempre |
| `styles.css` | — | Scopeado a la vista, sin tocar nada fuera de ella |

Decisiones por archivo:

1. **Las acciones de fila son las de la nota**, con los mismos caminos:
   `alternarWorkbench`, `completarTarea`, `archivarTarea`. Si alguna necesita
   una firma distinta para no depender de un editor, la firma cambia en un solo
   lugar y los dos frentes la usan. Dos copias de la traducción de coordenadas
   divergirían justo donde más caro sale.
2. **La vista se redibuja por `alActualizar`, no a mano** después de una acción
   (§7: un solo camino de lectura). Si una acción desde la vista no se ve
   reflejada, el bug está en el store o en la suscripción, no en la acción.
3. **Un control sin capa 1 y 2 detrás no aparece**, ni gris (§13.0). Lo de 5b no
   se dibuja deshabilitado esperando.
4. **`Platform.isMobile` solo en la capa 3**, y ojalá en ningún lado todavía.
5. **Ajustes nuevos, los mínimos.** El paso 10 de la §20 es una revisión de todos
   los ajustes, pedida porque ya son muchos. Cada ajuste que agregues lo
   justificás en el plan, y va en la categoría de la vista, no suelto.

## Las trampas que ya costaron caro

- **Una coordenada fresca contra una foto vieja** (§8, invariante 10, y el
  comentario de `elegirTarea`). Es *la* trampa de esta sesión.
- **Toda escritura lleva el texto que esperaba encontrar**, se escribe por rango
  con `vault.process()` y lo que devuelve entra al store por `absorber`.
- **`process` con un contenido idéntico no dispara `modify` ni `changed`.**
- **Antes de escribir se fuerza `save()`** sobre toda vista abierta. Con la
  pestaña abierta al lado de la nota, el caso es el de todos los días.
- **Un oyente del store que tira no puede romper a los demás** (`avisar` ya lo
  ataja). Tu vista tampoco puede tirar al redibujar.
- **Una lista de valores hardcodeada en varios archivos va a divergir.** Los
  textos en `strings.ts`; las clases CSS de la vista, en un solo lugar.
- **`humo.mjs` busca sus marcas en el bundle sin comentarios.** Si agregás
  marcas, comprobá que fallan con el código revertido.
- **Después de `plugin:reload`, lo ya dibujado conserva el código viejo.** Vale
  también para un `ItemView` abierto: cerrarlo y abrirlo.

## Antes de escribir código, medir

1. **Cuánto cuesta dibujar sin virtualizar**, en el vault de prueba y con la CLI:
   N filas de tareas con el aspecto que van a tener (checkbox, texto que
   envuelve, botones), para N = 50, 450 y 2000. Tiempo de construcción y de un
   redibujo completo. **Predicción falsable**: con 450 —lo que va a mostrar
   Buscar con mis notas— dibujar todo ya se nota en escritorio. Si no se nota,
   la virtualización sigue siendo obligatoria por la §15, pero decí el número:
   cambia cuánto esfuerzo merece el primer diseño.
2. **Cuánto tarda en llegar un cambio a la vista**: escribir con la paleta en la
   nota y medir hasta que la fila de la vista cambia. Es lo que dice si
   `alActualizar` alcanza o hace falta algo más.
3. **`dev:mobile`** para ver que la vista abre y no se rompe en el ancho de un
   teléfono. Emula la pantalla, no el teclado; lo demás del teléfono es mío.

Construí los casos en `test/vault-semilla/` —inventados, porque el repo es
público— o generalos como `tareas_LARGA` en `scripts/vault-prueba.mjs`. Hoy hay
**dos** líneas con `wb=foco` en la semilla: no alcanza.

## Los tests

- **`filtros.ts` y la parte calculable de la lista, offline**, con el mismo
  patrón de `tareas.test.ts` y fixtures inventadas.
- **El invariante 1 como propiedad**: toda tarea que muestra la vista tiene
  exactamente una línea en una nota de tareas. Está en la §18 desde el principio
  y hasta hoy no había vista que lo pusiera a prueba.
- **El caso de las cinco líneas tecleadas arriba, desde la vista**: el test del
  punto 1, que falla con la versión ingenua.
- **`test/domFalso.ts`** si hace falta mirar lo que construye la vista sin
  Obsidian.
- **La virtualización**: que la ventana de filas sea la correcta después de
  colapsar, expandir y redimensionar. Es aritmética, se prueba offline.

## Dónde puede escribir

En el **vault de prueba**, por `scripts/obs.mjs` y nada más, y en la semilla
`test/vault-semilla/`. Vale la regla dura de `CLAUDE.md`: **no escribas en mi
vault real**, ni con las herramientas del MCP de Obsidian, que puede.

## Cómo quiero trabajar

- **Plan primero**, con las preguntas de arriba, y esperá que lo apruebe.
- **Aclarame siempre de qué consola hablás**: la terminal, o la de Obsidian. Con
  la CLI casi no debería hacer falta la segunda.
- **Medí en vez de suponer**, y acordate de que **la spec también es una medición
  con fecha**.
- **Los instrumentos mienten antes que el código.** Antes de creerle a un cero,
  comprobá que el instrumento mide lo que dice; una comprobación que no puede
  fallar no es un guardia.
- **Cuando una propiedad falle, fijate primero si la propiedad dice la verdad.**
- **Una hipótesis que no falla su test se revierte.**
- **Mirá la salida, no solo los tests.** Para una vista, eso es una captura. El
  patrón está en `scripts/verificar/colores.mjs`, que saca la captura y guarda
  el rectángulo de lo que importa para recortarla y mirarla.
- **Cuando yo elija entre alternativas, la que pierde se borra.**
- Español en comentarios, documentación y mensajes de commit.

## Qué espero al final

La tarea suelta arreglada y verificada; la pestaña Workbenches leyendo y
actuando, con la lista virtualizable; `npm test`, `npm run test:corpus` y
`npm run typecheck` en verde; la §20 y la §13.1 de la spec al día con lo que se
decidió; y la verificación en vivo en sus dos partes.

**Lo que corrés vos**, en `scripts/verificar/sesion-10.mjs`, con los mismos ids
que `sesiones/VERIFICAR-sesion-10.md` y su informe en
`sesiones/RESULTADOS-sesion-10-cli.md`. Como mínimo:

- que la vista muestre exactamente las tareas del workbench, y que una tarea que
  sale del workbench desde la nota **desaparezca de la vista** sin que nadie la
  toque;
- que una acción desde la vista actúe sobre **la tarea correcta** con líneas
  agregadas arriba en la nota después de dibujar la fila, y se **niegue** si la
  tarea ya no se puede ubicar;
- que completar y archivar desde la vista escriban exactamente lo mismo que
  desde la nota, y que completar baje por el subárbol (§9);
- que «ir a la tarea» deje el cursor en esa línea;
- que el colapso respete el umbral de cinco líneas y cambie el alto sin romper
  el scroll;
- que con 2000 filas generadas se dibuje solo la ventana visible, con el número;
- que el reinicio por grupo desde la vista confirme y escriba lo mismo que el
  comando de paleta;
- que abrir la vista **no escriba nada** en ninguna nota;
- y la tarea suelta: la unión real, con los bytes del token comparados antes y
  después.

**Lo que queda para mí**, en la misma guía y separado:

- si la vista se entiende y se ve bien, en tema claro y oscuro;
- las alternativas que haya que elegir mirando, si salen de las preguntas;
- abrirla en el teléfono;
- y usarla unos días con un workbench real, que es de donde salieron los
  pedidos de las sesiones 6 a 8.
