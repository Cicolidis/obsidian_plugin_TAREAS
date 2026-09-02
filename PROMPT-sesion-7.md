# Prompt para la sesión 7 en Claude Code

> Abrir Claude Code en `~/Downloads/claude/obsidian_plugin_TAREAS`, entrar en
> **plan mode** y pegar lo de abajo.

---

Seguimos con el plugin de tareas de Obsidian. La especificación está en
`plugin-tareas-spec.md`, en la raíz. **Leela entera antes de proponer nada** — la
§5.5 y la §13.0 crecieron otra vez, y casi todo lo que se agregó son mediciones.
El método de trabajo está en `CLAUDE.md` y no lo repito acá.

## Dónde estamos

Las capas 1 y 2 están cerradas, el paso 4 entero, y ahora **el paso 6a**:
completar y archivar al LOG, y el descarte físico. Son **711 tests** en
`npm test` y **150** en `npm run test:corpus`.

El ⋯ tiene cuatro ítems, la fila cinco botones, el historial recibe bloques bien
formados, tildar el checkbox completa y destildarlo descompleta. **Tres vueltas
de verificación en vivo**, en `VERIFICAR-sesion-6.md` y sus vueltas 2 y 3, y de
las tres salieron cosas que ningún test había visto.

Lo que quedó decidido y no hace falta volver a discutir. `git log` es largo y
vale leer los mensajes:

- **`ubicar.ts` se rehizo alrededor de un solo cambio ubicado nuevo**, `bloque`,
  que reemplaza un tramo de N líneas por M. Cubre borrar (`despues` vacío),
  verificar sin tocar (`despues` igual a `antes`) y reescribir un tramo como
  unidad. El aplicador es de **una pasada** y por eso es orden-independiente;
  hay una propiedad con permutaciones que lo fija.
- **`antes` vacío está prohibido**, y por eso **la inserción no existe todavía**:
  un cambio sin ancla no se puede verificar. La va a necesitar el paso 5 —«crear
  tarea desde el workbench»— y también un «deshacer» para el 🗑.
- **La inserción en el LOG no se ubica: se recalcula** adentro de
  `vault.process()` sobre los bytes frescos. Su posición es una función del
  contenido del LOG, y recalcular es lo único que evita duplicar un heading que
  otra máquina acaba de crear por Sync (invariante 6).
- **Archivar toca dos archivos y la atomicidad no se puede cumplir entre ellos.**
  Se eligió en qué orden se rompe —primero el LOG: una entrada de una tarea
  pendiente **se ve**, una tarea completada sin registro no— y se achicó la
  ventana con un **paso en seco**: un `process` que devuelve `data` intacto, que
  está medido que no dispara `modify` ni `changed`.
- **Tildar el checkbox es completar, y destildarlo es descompletar.** Se hace
  **reconociendo el hecho, no el gesto**: un `transactionFilter` que pregunta si
  alguna línea quedó igual salvo por el tilde. Corre último (`Prec.high`).
- **Cmd+clic en el checkbox archiva, y es el único mecanismo que intercepta un
  clic**, porque un modificador no deja rastro en la transacción. Es
  estructuralmente más frágil y tiene interruptor propio.
- **Las confirmaciones de archivar y eliminar están apagadas por omisión**,
  contra una medición mía y por decisión del usuario. La excepción es archivar
  algo que **ya figura** en el historial, que pregunta siempre.
- **La fila del margen se dibuja al revés** (`🗑 ⋯ → ◐ ★`): el mouse llega desde
  el texto, y el orden canónico dejaba el botón que borra como el primero que
  uno se cruza.

**Tres cosas que siguen abiertas y no son de este paso:**

- **La línea de base del ciclo de medición de la §5.5 no se reproduce**, por
  cuarta vez. **No anotarlo como verde.**
- **Tras tildar, el índice queda atrasado ~2 s**: el filtro escribe por el
  editor, no por `vault.process()`, así que el store se entera por el evento de
  Obsidian. El ⋯ sobre esa misma tarea se niega durante esa ventana, con su
  aviso. Está aceptado; si molesta, el arreglo tiene una trampa escrita.
- **La inserción en `ubicar.ts`**, de arriba.

**El repositorio es público** y la regla está en `CLAUDE.md`: no entra contenido
real de mis notas, ni siquiera en un mensaje de commit.

## Alcance de esta sesión: el paso 6b, y propongo partirlo

La §20 llama al paso 6b «fecha y recurrencia en el ⋯, más el botón de reinicio
por grupo». **Propongo partirlo, y no por tamaño:**

| | Qué | Por qué va junto |
|---|---|---|
| **6b — esta sesión** | **Fecha** y **recurrencia** en el ⋯, y **reiniciar un grupo** (destildar y borrar el `done`) | Los tres cierran la §5.2: son los dos campos del token que faltan, más lo único que le da sentido a uno de ellos |
| 6c — la que sigue | **«Archivar y reiniciar»** (§11) y el botón por grupo en la vista | Es el archivado de 6a multiplicado por N sobre varias notas, y su lugar natural es la pestaña que todavía no existe (paso 5) |

**El reinicio simple no se puede dejar afuera.** `rec` es un nombre de grupo y
nada más; si se puede escribir la etiqueta y nunca reiniciarla, la etiqueta es
decoración — que es exactamente la regla con la que el ⋯ dejó afuera lo que no
tenía capa 1 y 2 detrás. `planDeReinicio` ya existe y está probado: lo que falta
es la puerta.

### Qué queda explícitamente afuera

- **«Archivar y reiniciar»**, por lo de arriba.
- **La detección automática de fechas en prosa.** La §5.2 dice que `due` se
  escribe «desde el menú, **o al confirmar una fecha detectada**». Lo segundo es
  un parser de lenguaje natural sobre 24 líneas medidas, y merece su propia
  medición antes de escribirse.
- Las pestañas Workbenches, Buscar y Agenda (pasos 5 y 7).

---

## Lo primero, porque decide la arquitectura

### 1. `due` guarda dos cosas distintas, y cuál depende de `rec`

No son dos ítems independientes del menú. La §11:

> Para esas, **`due` guarda el día del mes, no la fecha**: `due=10` es «el 10 del
> mes en curso», y se resuelve contra el reloj con `resolverDue`.

O sea que **el selector de fecha tiene que saber si la tarea es cíclica** para
saber qué escribir: `2026-09-10` en una tarea normal y `10` en una con `rec`. Y
al revés: ponerle `rec` a una tarea que ya tiene un `due` absoluto deja un dato
que significa otra cosa que antes.

`resolverDue` ya existe en `src/token.ts` y está probado, incluido el caso de
que el día ya pasó (rueda al mes siguiente). Lo que no está decidido es **qué
pasa con un `due` que ya estaba escrito cuando la tarea se vuelve cíclica**, y
eso hay que resolverlo antes de dibujar nada.

### 2. Reiniciar un grupo toca **N notas**, no una

`planDeReinicio(doc, tareas, grupo)` recibe **un** documento: o sea, una nota.
Pero un grupo de reinicio es global —la §11 pide «un botón por grupo» sobre el
store entero— así que reiniciar es **N lotes, uno por nota**.

Vuelve a aparecer el problema de 6a, con otra forma. `escribirArchivado` maneja
exactamente **dos** archivos con un orden fijo; esto son N y sin orden
privilegiado. El criterio ya está decidido —paso en seco primero, y media
operación no puede terminar en silencio— pero la **forma** hay que generalizarla,
y conviene decidir si el paso en seco corre sobre las N antes de escribir
ninguna. Yo creo que sí, y que ahí sí se puede volver a la regla completa: **o
todas o ninguna**, porque nada se escribe hasta que las N verifiquen.

### 3. Hoy no hay ni un `rec` ni un `due` escrito

Medido el 02/09/2026 sobre las notas reales: **390 tareas, 0 con token, 0 con
`due`, 0 con `rec`, 0 grupos de reinicio**. Dos consecuencias:

- **No hay migración.** Nada que convertir.
- **No se puede verificar el reinicio hasta que algo escriba el primer `rec`.**
  El orden de la sesión importa: la recurrencia tiene que estar antes que el
  reinicio, o el reinicio se entrega sin poder mirarse.

Y ojo con un número de la spec: la §11 dice «23 líneas de un tirón en
`tareas_MES`, medido». **Eso se midió antes de que `rec` existiera como
etiqueta**, contando lo que *se esperaba* etiquetar. Hoy `planDeReinicio` tocaría
0 líneas. `tareas_MES` tiene 31 tareas, así que 23 sigue siendo un techo
plausible, pero no es una medición de lo que hay.

---

## Cómo quiero que quede

| Archivo | Capa | Qué es |
|---|---|---|
| `src/acciones.ts` *(modificado)* | 1 | `planDeFecha` y `planDeRecurrencia`: una línea cada uno, como `planDePrioridad` |
| `src/fechas.ts` *(nuevo)* | 1 | Lo que un selector necesita: los atajos («hoy», «mañana», «el lunes»), y el ida y vuelta con `resolverDue` |
| `src/vault/escribir.ts` *(modificado)* | 2 | `escribirEnVarias`: N notas, con el paso en seco sobre todas antes de escribir ninguna |
| `src/comandos.ts` *(modificado)* | 3 | `fijarFecha`, `fijarRecurrencia`, `reiniciarGrupo` |
| `src/editor/menuDeTarea.ts` *(modificado)* | 3 | Los dos ítems nuevos del ⋯, cada uno con su submenú de atajos |
| `src/ui/elegirFecha.ts` *(nuevo)* | 3 | El selector, forma de `WorkbenchNuevoModal` más un `<input type="date">` |
| `src/strings.ts` | — | Los textos, juntos como siempre |

Decisiones por archivo:

1. **La fecha se elige con atajos, no con un calendario.** Las 24 fechas que el
   corpus tiene escritas en prosa son casi todas relativas —un día de la semana,
   o un día del mes— y un `<input type="date">` suelto obliga a traducirlas a
   mano. El modal lleva los atajos primero y el campo de fecha como salida.
2. **La recurrencia es igual que un workbench nuevo**: un nombre libre, con los
   que ya existen ofrecidos. `gruposDeReinicio` ya los da, y
   `sanearWorkbenchOpcional` ya rechaza `;`, `,` y `%` — que son los tres
   caracteres que rompen el token y dejan la línea ilegible para siempre.
   **Reusar el saneo, no escribir otro.**
3. **El reinicio confirma siempre**, y eso **no** es lo mismo que archivar o
   eliminar, que quedaron sin confirmación. La §11 lo pide y la razón está
   escrita ahí: es la escritura más grande del plugin, toca varias notas a la
   vez, y con la nota cerrada no hay historial de deshacer.
4. **El reinicio no toca el `due`.** El `due` de una cíclica es un día del mes y
   se resuelve con el reloj, así que sobrevive al reinicio — igual que los
   workbenches. Sin eso hay que rearmar el workbench cada lunes, que es la
   fricción a eliminar.

## Las trampas que ya costaron caro

- **Nada reescribe el archivo entero.** Por rango, con `vault.process()`.
- **Toda escritura lleva el texto que esperaba encontrar** (invariante 10), y el
  lote es todo o nada — dentro de un archivo.
- **El reinicio solo toca las tareas etiquetadas.** En `tareas_MES` el registro
  por mes son hijos **sin** etiqueta, con el monto de cada mes; un reinicio que
  barriera la nota entera los convertiría en tareas pendientes y perdería el
  dato. `planDeReinicio` ya lo cumple: cualquier cosa que se le agregue tiene que
  seguir cumpliéndolo.
- **`setTaskToken` con `prioridad: 0` borra el campo, y si era lo único, borra el
  token entero.** Lo mismo tiene que valer para `due: null` y `rec: null` — «sin
  fecha» y «no es cíclica» no escriben campo.
- **Un token que no parsea deja la línea intacta** (invariante 7). La negativa
  vive en `marcar()` de `acciones.ts`, antes de tocar nada, no en
  `setTaskToken`.
- **`process` con un contenido idéntico no dispara `modify` ni `changed`** y deja
  el `mtime` igual. Es lo que hace legítimo el paso en seco.
- **Antes de escribir se fuerza `save()`** sobre toda vista abierta del archivo.
- **Los `transactionFilter` corren de menor a mayor precedencia**, y hay cuatro
  registrados. Si esta sesión agrega uno, el orden es una decisión de diseño:
  fijala con un test.

## Antes de escribir código, medir

1. **Cuántas de las 24 fechas en prosa son parseables sin ambigüedad.** Es lo que
   decide si la detección de la §5.2 entra alguna vez o se descarta. Contarlo con
   un script en el scratchpad y **decir el número**, aunque la detección quede
   afuera de esta sesión.
2. **Cuántas tareas tocaría un reinicio de verdad.** Hoy son 0. Etiquetar un
   grupo de prueba en `tareas_PRUEBA.md` y medir sobre eso, no sobre el 23 de la
   §11, que es de antes de que la etiqueta existiera.
3. **Cuánto cuesta `resolverDue` por tarea.** Si una vista lo llama por tarea en
   cada dibujo, 400 llamadas por cuadro no son gratis. Medirlo antes de que se
   note, con el patrón de `test/corpus/costo-fila.test.ts` —calentamiento
   descartado y muestras suficientes para que la mediana signifique algo—.
4. **La línea de base de la §5.5 sigue sin reproducirse.** Si aparece un aviso,
   medirla de nuevo antes de concluir nada.

## Los tests

- **`resolverDue` ya tiene tests** en `test/token.test.ts`, incluido el caso de
  que el día ya pasó. Falta el borde que la §11 nombra: **`due=31` en febrero se
  recorta al 28** (y al 29 en bisiesto).
- **El invariante 5 ya es propiedad** en `test/propiedades.test.ts`: reiniciar
  dos veces seguidas da el mismo archivo, y no toca una sola línea sin la
  etiqueta. Tiene que seguir valiendo con el reinicio sobre N notas.
- **Los planes nuevos, en `acciones.test.ts`**, con `aplicarPlan`.
- **La escritura sobre N notas** se prueba offline con `aplicarLote` sobre cada
  texto, como hace `test/corpus/ubicar.test.ts`. Lo que necesita Obsidian es solo
  la secuencia, y esa se verifica en vivo.
- **El DOM falso está en `test/domFalso.ts`** si hace falta mirar lo que
  construye un `toDOM`: reproduce burbujeo y `stopPropagation`, que es lo que
  importó una vez.
- Y si se toca algún filtro, volver a correr con `{ numRuns: 20000 }` las dos
  propiedades de `protegerTramo`: encontraron dos bugs que los casos no.

## Dónde puede escribir

Sobre `0_inbox/tareas_PRUEBA.md` y sobre `0_inbox/tareas_LOG_PRUEBA.md`, las dos
habilitadas en ajustes. **El reinicio toca varias notas**, así que conviene una
segunda nota de prueba antes de la primera corrida en vivo.

Vale la regla dura de `CLAUDE.md`: **no escribas vos en el vault**, ni con las
herramientas del MCP de Obsidian, que puede.

## Cómo quiero trabajar

- **Plan primero**, y esperá que lo apruebe.
- **Aclarame siempre de qué consola hablás.** Hay dos: la terminal, y la de
  Obsidian (*Ver → Alternar herramientas de desarrollo*). Etiquetá los bloques.
- **Medí en vez de suponer**, y acordate de que **la spec también es una medición
  con fecha**: la §2 decía 25 fechas en prosa y hoy son 24.
- **Una reproducción tiene que copiar la forma del sistema.** En la sesión 6 un
  test mío insertaba un Enter que Obsidian no produce y fallaba **también sin el
  cambio que decía medir**.
- **Los instrumentos mienten antes que el código.** En la sesión 6 pasó tres
  veces: una sonda con reloj propio que se cerraba antes de empezar, un `%%` que
  la consola de Chrome se come, y un Enter sin continuación de lista. Antes de
  creerle a un cero, comprobá que el instrumento mide lo que dice.
- **Cuando una propiedad falle, fijate primero si la propiedad dice la verdad.**
- **Una hipótesis que no falla su test se revierte.**
- **Mirá la salida, no solo los tests** — y cuando el ojo no llegue, convertí la
  regla en algo que el pipeline pueda comprobar. `humo.mjs` ya tiene dos guardias
  así.
- Español en comentarios, documentación y mensajes de commit.

## Qué espero al final

El ⋯ con seis ítems, el token con sus seis campos escribiéndose todos, un grupo
de reinicio que se puede crear y reiniciar, `npm test` y `npm run test:corpus` en
verde, y una **lista concreta de qué observar** en Obsidian, que es lo único que
no se puede comprobar desde Claude Code:

- que el selector de fecha escriba `AAAA-MM-DD` en una tarea normal y **el día
  del mes** en una cíclica, y que se vea cuál escribió;
- que sacarle la fecha a una tarea **borre el campo**, y que si era lo único que
  tenía, borre el token entero;
- que crear un grupo de reinicio ofrezca los que ya existen;
- que reiniciar un grupo **confirme siempre**, diga cuántas tareas y en cuántas
  notas, y que cancelar no escriba nada;
- que el reinicio **no toque** una tarea sin la etiqueta, ni el `due`, ni los
  workbenches;
- que con el índice congelado el reinicio se **niegue** en vez de escribir en la
  línea de al lado;
- y que los gestos del editor que ya costaron caro sigan igual: clic al final de
  la línea, flecha, Backspace desde abajo, Enter, y **tildar el checkbox**.
