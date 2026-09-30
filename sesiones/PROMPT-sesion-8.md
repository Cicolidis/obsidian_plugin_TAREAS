# Prompt para la sesión 8 en Claude Code

> Abrir Claude Code en `~/Downloads/claude/obsidian_plugin_TAREAS`, entrar en
> **plan mode** y pegar lo de abajo.

---

Seguimos con el plugin de tareas de Obsidian. La especificación está en
`plugin-tareas-spec.md`, en la raíz. **Leela entera antes de proponer nada** — la
§5.5, la §7, la §11 y la §13.0 crecieron en la sesión 7, y casi todo lo que se
agregó son mediciones o correcciones de números que estaban mal. El método de
trabajo está en `CLAUDE.md` y no lo repito acá.

## Dónde estamos

Las capas 1 y 2 están cerradas, el paso 4 entero, el 6a y ahora **el 6b**: fecha
y recurrencia en el ⋯, y el reinicio de un grupo cíclico sobre N notas. Son
**770 tests** en `npm test` y **159** en `npm run test:corpus`.

**El token escribe sus seis campos.** El ⋯ tiene los seis ítems que la §13.0
lista. Hubo **dos vueltas de verificación en vivo** —44 de 48 y 27 de 28— y de
las dos salieron cosas que ningún test había visto.

Lo que quedó decidido y no hace falta volver a discutir. `git log` es largo y
vale leer los mensajes:

- **`due` guarda dos cosas y cuál depende de `rec`.** Poner `rec` sobre una
  tarea con fecha absoluta **convierte** el `due` en día del mes, en el mismo
  cambio de línea, y lo avisa. Quién decide es `conversionDeDue`, y la usan el
  plan **y** el cartel: si el aviso decidiera por su cuenta, mentiría el día que
  una de las dos reglas cambie.
- **`rec` se escribe en una sola línea**, y eso no es una analogía con la
  prioridad: si bajara por el subárbol, el primer reinicio convertiría en
  pendientes los hijos sin etiqueta que llevan el registro por mes.
- **`escribirEnVarias` corre el paso en seco sobre las N antes de escribir en
  ninguna**, así que ahí sí vuelve a valer «o todas o ninguna». Es la diferencia
  con `escribirArchivado`, que son dos archivos con un orden elegido y su seco
  corre sobre uno solo.
- **El reinicio confirma siempre, y no se puede apagar.** La razón **no es el
  tamaño** —medido: el reinicio más grande posible hoy son 16 líneas en todo el
  vault, no las 23 de una nota que decía la §11— sino que toca varias notas y el
  historial de deshacer solo existe en las que están abiertas.
- **La detección de fechas en prosa de la §5.2 está descartada, con el número**:
  serviría para 5 de 390 tareas.
- **El reinicio se dispara desde un comando de paleta**, no desde el ⋯: un grupo
  puede estar entero en notas cerradas.

**Tres cosas abiertas que no son de este paso:**

- **`escribirEnVarias` no tiene test offline de su *secuencia*.** El paquete
  `obsidian` es solo tipos, así que la capa 2 no se puede importar en la suite.
  Lo que sí está probado es el lote por nota. La opción que quedó sin decidir es
  un alias de vitest con un `obsidian` falso; tiene el costo de abrirle la puerta
  a la capa 3 en la suite offline.
- **El nombre del colegio quedó en la historia de git.** Se sacó del árbol y
  **no** se reescribió la historia: decisión del usuario. Hay un guardia nuevo,
  `test/corpus/privacidad.test.ts`, que solo ve los headings de **hoy**.
- **La línea de base del ciclo de medición de la §5.5** lleva **seis** vueltas
  sin reproducirse. Ahora tiene instrumento; ver más abajo.

**El repositorio es público** y la regla está en `CLAUDE.md`: no entra contenido
real de mis notas, ni siquiera en un mensaje de commit. En la sesión 7 se coló el
nombre del colegio y hubo que sacarlo.

## Alcance de esta sesión: el paso 6c

| | Qué |
|---|---|
| **Los cuatro pedidos de la verificación** | Salieron de **usar** el plugin, no de mirarlo, y van **encendibles** para elegir mirando (patrón `designFlags.ts`) |
| **«Archivar y reiniciar»** (§11) | El segundo camino de la confirmación de reinicio: escribe los bloques en el LOG **antes** de destildar |

### Los cuatro pedidos, textuales

1. **Un botón en la fila que quede encendido cuando la tarea tiene `due`, y otro
   para `rec`.** «Es la misma lógica que la de los botones de los workbenches
   principal y secundario.»
2. **Los atajos de fecha, en otro orden.** «No me convence la selección de fechas
   ni el orden en que figuran. Si queremos ofrecer los siete próximos días de la
   semana, hay que colocarlos en orden. Pero quizás es mejor ofrecer opciones
   discontinuas: hoy, mañana, en una semana…»
3. **«Otra fecha…» con un calendario chico** para elegir la fecha.
4. **Recurrencia con opciones preconfiguradas**, que recuerde y ofrezca las más
   usadas, «elegibles con un clic o con una tecla que se muestre en pantalla».

### Qué queda explícitamente afuera

- Las pestañas Workbenches, Buscar y Agenda (pasos 5 y 7).
- El botón de reinicio **por grupo en la vista**: vive en la pestaña del paso 5.
  Hasta entonces la puerta es el comando de paleta, que ya existe.
- Reescribir la historia de git.

---

## Lo primero, porque decide la arquitectura

### 1. «Archivar y reiniciar» son **1 + N** archivos, y ninguno de los dos caminos que existen alcanza

Hoy hay dos escrituras multi-archivo y las dos resuelven un problema distinto:

| | Cuántos | Cómo rompe la atomicidad |
|---|---|---|
| `escribirArchivado` | **2**, con orden elegido (LOG primero) | Seco sobre la nota; si falla la nota queda `media-operacion` |
| `escribirEnVarias` | **N**, sin orden privilegiado | Seco sobre **todas**: o todas o ninguna |

«Archivar y reiniciar» es **el LOG más N notas**, o sea las dos formas a la vez.
Y hay una asimetría que decide el diseño: **la inserción en el LOG no se ubica,
se recalcula** adentro de `vault.process()` sobre los bytes frescos (§8), así que
no puede entrar al paso en seco como entra un lote ubicado.

Yo propondría: seco sobre las N notas → escribir el LOG → escribir las N. Pero
**está sin decidir** y hay que resolverlo antes de escribir nada.

### 2. `archivarEnElLog` sabe **un** camino y **un** bloque

```ts
archivarEnElLog(data, camino, bloque)
```

Un grupo cíclico repartido en M notas produce **M caminos distintos** —el camino
es la nota de origen más el proyecto (§12, `caminoDeArchivado`)— y todos tienen
que entrar en **un solo** `process` sobre el LOG, o se recalcula sobre bytes que
ya cambiaron. Hay que generalizarlo a N bloques con sus caminos, y el
**invariante 6** es exactamente lo que hay que sostener: «archivar N bloques en
el mismo camino crea el camino una sola vez».

### 3. El corpus todavía no tiene con qué medir esto

Medido el 02/09/2026: **0 `due`, 0 `rec`, 0 grupos** en las siete notas reales.
Las de prueba sí tienen (`tareas_PRUEBA` y `tareas_PRUEBA_2`, con `lunes` y
`mensual`), pero eso es andamiaje, no corpus. O sea que **cualquier número sobre
«cuánto escribiría archivar y reiniciar» hay que construirlo**, no medirlo, y
decir cuál es cuál.

---

## Cómo quiero que quede

| Archivo | Capa | Qué |
|---|---|---|
| `src/archivado.ts` *(modificado)* | 1 | `archivarEnElLog` con N bloques y N caminos, sosteniendo el invariante 6 |
| `src/acciones.ts` *(modificado)* | 1 | El plan de «archivar y reiniciar»: los bloques del LOG más el lote por nota |
| `src/fechas.ts` *(modificado)* | 1 | Los atajos alternativos: la lista discontinua del pedido 2 |
| `src/vault/escribir.ts` *(modificado)* | 2 | La escritura 1 + N, con la decisión de arriba |
| `src/botones.ts` *(modificado)* | 1 | Los dos indicadores nuevos de la fila: `due` y `rec` |
| `src/settingsData.ts` *(modificado)* | — | Los interruptores de las alternativas |
| `src/ui/elegirFecha.ts` *(modificado)* | 3 | El calendario del pedido 3 |
| `src/editor/menuDeTarea.ts` *(modificado)* | 3 | La recurrencia con las más usadas y su tecla |
| `src/strings.ts` | — | Los textos, juntos como siempre |

Decisiones por archivo:

1. **Los cuatro pedidos van encendibles y conviven**, no reemplazan lo que hay.
   Es el patrón con el que se eligieron los cinco estilos de fila y los tres de
   prioridad, y es lo que el usuario pidió explícitamente: **cómo se ve algo solo
   se juzga mirándolo en Obsidian.** Cada alternativa es un valor más en su lista
   de `settingsData.ts`, no un `if` adentro del código.
2. **Los dos indicadores nuevos de la fila son *indicadores*, no botones.** El ★
   es un toggle porque asignar un workbench es un clic; «tiene fecha» no se
   alterna, se ve. Si además abren el submenú, es un atajo, no un toggle —
   decidilo y decilo.
3. **«Las más usadas» necesita dónde guardarse.** Un contador por grupo en
   `data.json` es estado nuevo del plugin, que hasta hoy no tiene ninguno: todo
   se deriva de las notas (§10, «un workbench no tiene almacenamiento propio»).
   Eso hay que mirarlo de frente antes de escribirlo.
4. **El calendario del pedido 3 no se importa de ningún lado.** Sin dependencias
   nuevas: o `<input type="date">` con su selector nativo, o una grilla propia.
   Medir cuánto cuesta la grilla antes de decidir.

## Las trampas que ya costaron caro

- **Nada reescribe el archivo entero.** Por rango, con `vault.process()`.
- **Toda escritura lleva el texto que esperaba encontrar** (invariante 10), y el
  lote es todo o nada dentro de un archivo.
- **`process` con un contenido idéntico no dispara `modify` ni `changed`.** Es lo
  que hace legítimo el paso en seco.
- **Antes de escribir se fuerza `save()`** sobre toda vista abierta.
- **Un `gutter()` de CodeMirror vive en TODOS los editores.** Su ancho corría el
  texto de cada nota del vault; hoy lo acota la clase `tareas-con-margen` y hay
  una regla en `humo.mjs`. **Si la fila crece con dos indicadores más, el ancho
  del margen cambia: mirarlo con la ventana angosta.**
- **Un `transactionFilter` que reescribe una línea entera manda el cursor a la
  columna 0** si no devuelve selección explícita. Pasó dos veces, por dos
  puertas distintas.
- **Los `transactionFilter` corren de menor a mayor precedencia**, y hay cuatro
  registrados. Si esta sesión agrega uno, el orden es una decisión de diseño:
  fijala con un test.
- **`humo.mjs` busca sus marcas en el bundle sin comentarios.** El build no
  minifica, así que antes un comentario alcanzaba para satisfacer una marca.

## Antes de escribir código, medir

1. **La línea de base de la §5.5, con instrumento.** Está
   `scripts/espia-medicion.js`, escrito al cerrar la sesión 7. Se pega en la
   consola de **Obsidian**, se angosta la ventana y se corre
   `await medicion.subir()`. **Es lo primero de la sesión**, porque decide si esa
   comprobación vuelve a las guías o se retira del método. Se pidió a ojo seis
   veces y nunca dio un número.
2. **Cuánto escribiría «archivar y reiniciar».** Hoy no hay grupos en el corpus,
   así que hay que **construir** el caso en las notas de prueba y decir que es
   construido. El dato que importa: cuántas líneas al LOG y cuántos headings
   nuevos, porque el LOG es el archivo que solo crece.
3. **Si «las más usadas» necesita estado**, medir cuántos grupos hay de verdad
   antes de construir un ranking: con dos grupos, ordenar por uso no ordena nada.
4. **El ancho del margen con dos indicadores más**, con `scripts/espia-margen.js`.

## Los tests

- **Los planes nuevos, en `acciones.test.ts`**, con `aplicarPlan`.
- **El invariante 6 ya es propiedad** en `test/propiedades.test.ts`: archivar N
  bloques en el mismo camino crea el camino una sola vez. **Tiene que seguir
  valiendo con N caminos distintos en un solo `process`.**
- **El invariante 5 ya vale sobre N notas**, y «archivar y reiniciar» no lo puede
  aflojar: sigue sin tocar una línea que no lleve la etiqueta.
- **La escritura 1 + N se prueba offline con `aplicarLote`** sobre cada texto,
  como hace `test/corpus/ubicar.test.ts`. Lo que necesita Obsidian es la
  secuencia, y esa se verifica en vivo.
- **`test/domFalso.ts`** si hace falta mirar lo que construye un `toDOM`.
- **`test/corpus/privacidad.test.ts`** corre solo con el vault, y su primer test
  comprueba que el detector puede encontrar algo antes de informar cero.
- Si se toca algún filtro, volver a correr con `{ numRuns: 20000 }` las
  propiedades de `protegerTramo`.

## Dónde puede escribir

Sobre `0_inbox/tareas_PRUEBA.md` y `0_inbox/tareas_PRUEBA_2.md`, y el historial
de prueba `0_inbox/tareas_LOG_PRUEBA.md`, las tres habilitadas en ajustes.
**«Archivar y reiniciar» escribe en el historial**, así que conviene una copia
antes de la primera corrida en vivo.

Vale la regla dura de `CLAUDE.md`: **no escribas vos en el vault**, ni con las
herramientas del MCP de Obsidian, que puede.

## Cómo quiero trabajar

- **Plan primero**, y esperá que lo apruebe.
- **Aclarame siempre de qué consola hablás.** Hay dos: la terminal, y la de
  Obsidian (*Ver → Alternar herramientas de desarrollo*). Etiquetá los bloques.
- **Medí en vez de suponer**, y acordate de que **la spec también es una medición
  con fecha**. En la sesión 7 tres de sus números estaban mal.
- **Los instrumentos mienten antes que el código.** En la sesión 7 pasó dos
  veces: una marca de `humo.mjs` que un comentario satisfacía, y un comentario de
  CSS que afirmaba lo contrario de lo que hacía. **Antes de creerle a un cero,
  comprobá que el instrumento mide lo que dice** — y si no puede fallar nunca, no
  es un guardia.
- **Cuando una propiedad falle, fijate primero si la propiedad dice la verdad.**
- **Una hipótesis que no falla su test se revierte.**
- **Mirá la salida, no solo los tests.** En la sesión 7 eso encontró dos ítems del
  menú de fecha que escribían la misma fecha y marcaban el tilde en los dos.
- **Una guía de verificación es un instrumento.** Dos de las tres «fallas» de la
  primera vuelta eran comprobaciones que pedían un estado imposible. Antes de
  entregarla, preguntate si el estado que pide se puede alcanzar.
- **El molde de resultados se llena, nunca se edita**: nada que borrar,
  reescribir ni copiar. Los bloques que sobran se dejan vacíos.
- Español en comentarios, documentación y mensajes de commit.

## Qué espero al final

Los cuatro pedidos encendibles y conviviendo con lo que hay, «archivar y
reiniciar» andando sobre 1 + N archivos, `npm test` y `npm run test:corpus` en
verde, y una **lista concreta de qué observar** en Obsidian, que es lo único que
no se puede comprobar desde Claude Code:

- que los dos indicadores nuevos de la fila se enciendan con `due` y con `rec`, y
  que **el margen no se ensanche** de más con la ventana angosta;
- que las alternativas de atajos de fecha se puedan **comparar mirándolas**, sin
  recargar el plugin;
- que el calendario escriba lo mismo que el campo, y que se vea **cuál de las dos
  formas** de `due` va a escribir;
- que la recurrencia ofrezca las más usadas y que su tecla **se vea en pantalla**;
- que «archivar y reiniciar» escriba **una sola vez** cada heading del historial,
  aunque el grupo toque varias notas;
- que si una nota no se puede ubicar, **no se escriba en el historial tampoco**;
- que el reinicio siga sin tocar una tarea sin la etiqueta, ni el `due`, ni los
  workbenches;
- y que los gestos que ya costaron caro sigan igual: clic al final de la línea,
  flecha, Backspace desde abajo, Enter, **tildar el checkbox** —y que el cursor
  se quede donde estaba— y Cmd+clic.

**Y lo primero de todo:** correr `scripts/espia-medicion.js` y traer el número.
