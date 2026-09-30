# El frente principal: la bitácora de la §13.0

Salió de la §13.0 de `plugin-tareas-spec.md` el 29/09/2026, **verbatim**, cuando
la spec se separó en lo normativo —qué es el plugin y qué quedó decidido— y la
bitácora —cómo se llegó, con qué mediciones y qué vueltas de verificación—. Lo
vigente está resumido en la spec, en «Lo que quedó decidido»; el porqué y los
números están acá.

Los comentarios del código que dicen «§13.0 punto N» remiten a los puntos
numerados de este archivo.

### Lo que el paso 4b construyó, y lo que dejó afuera

**30/08/2026.** La fila existe. `src/botones.ts` decide **qué** botones van y en
qué estado —capa 1, sin DOM, calculado del texto de la línea y no del store, que
puede estar atrasado— y `src/editor/filaDeBotones.ts` la dibuja.

**Los cuatro botones terminan en las tres funciones que ya usaban los comandos de
paleta.** Ningún camino de escritura nuevo: `posAtDOM` → `elegirEnLinea` → plan
puro → `escribir` → `absorber`.

**El ⋯ lleva solo lo que tiene capa 1 y 2 detrás.** De las seis cosas que esta
sección lista, entran dos —prioridad y «completar y descartar»— y las otras
cuatro **no aparecen**, ni grises:

| Del menú | Por qué no |
|---|---|
| Fecha | `setTaskToken` sabe escribir `due`, pero no hay con qué elegir una |
| Recurrencia | Ídem con `rec`, y el botón por grupo es de la §11 |
| Completar y archivar | `archivado.ts` tiene la lógica pura y **ninguna** escritura: toca dos archivos a la vez. Paso 6 |
| Eliminar | Es el descarte físico de la §12, con confirmación. Paso 6 |

Un ítem gris ocupa el mismo lugar que uno que anda y no hace nada. La misma
regla decidió el ◐: **el segundo workbench favorito arranca vacío, y vacío
significa que el botón no se dibuja.** Inventarle un nombre por omisión sería
peor — se escribiría en el token de la primera tarea que el usuario toque sin
haberlo elegido.

**El elegido, después de seis vueltas mirándolo: la columna en su margen
propio, con revelación por hover.** Los otros cinco quedan encendibles, que es
para lo que sirve el patrón.

**Seis lugares donde puede vivir la fila**, y conviven (patrón `designFlags.ts`):
sobre el final de la línea con degradado, sin fondo, en pastilla; en el margen
derecho; antes del checkbox; y una **columna en el margen izquierdo** con el
orden que pidió el usuario en la segunda vuelta — número de línea · botones ·
filete · plegado · checkbox.

Esa última contesta una pregunta que la §13.0 no tenía resuelta: **cómo mostrar
siempre los workbenches donde la tarea ya está y hacer aparecer el resto al pasar
el mouse, sin que los primeros se corran.** La respuesta es no sacar nada del
flujo: los cuatro botones están siempre, y lo único que cambia es la opacidad y
el fondo de la pastilla. Con `display: none` o con un ancho variable, la fila
está anclada por la derecha y cada botón que aparece empujaría a los de al lado
— el ★ se movería justo cuando el mouse va hacia él.

**De los tres modos de revelación se ofrecen dos.** `hover` y `siempre` son CSS
puro, con la clase en `body` como el estilo de prioridad; `swipe` está declarado
en el tipo —la §15 punto 1 pide que el modo sea un parámetro— y no está en el
desplegable, por lo mismo que los cuatro ítems de arriba.

**Los éxitos de ★ ◐ → son silenciosos.** El botón que se rellena *es* el aviso, y
llega solo: la escritura vuelve al editor como cambio externo y el widget se
reconstruye. Un cartel por clic sería ruido sobre la acción más frecuente del
plugin. Los fracasos avisan siempre.

**Y sobre una línea con el token ilegible la fila se dibuja igual, apagada.**
Esconderla dejaría una tarea sin botones y sin explicación. Los cuatro tooltips
dicen que el token es ilegible y no lo que harían: los cuatro son inertes, y un
control que promete lo que no puede hacer es peor que uno apagado. **Eso salió
de mirar la salida** —los tests pasaban y el tooltip decía «Mandar a foco»—, no
de un test.

### Lo que la verificación del paso 6a cambió en el frente principal

**01/09/2026.** Cuatro decisiones del usuario y dos mecanismos leídos del
sistema. Todas salieron de **usar** el plugin, no de mirarlo.

**1. Tildar el checkbox es completar la tarea, y destildarlo es descompletarla.**
Era el agujero más grande de la §12: el gesto más natural y más frecuente era el
único que **no** pasaba por el plugin, así que la fecha de completado —que es lo
que el historial y la vista de archivadas leen— solo existía si uno se acordaba
de usar el ⋯. Ahora tildar escribe `done=` y baja por el subárbol (§9), y
destildar le borra el `done` y **no** baja: eso último ya estaba decidido en
`idsADestildar`, porque destildar en cascada borraría trabajo terminado de un
clic.

Se hace **reconociendo el hecho, no el gesto** (§5.5 punto 5): un
`transactionFilter` que pregunta si alguna línea quedó igual salvo por el tilde.
De ahí sale gratis que ande con el mouse, con el teclado —el comando propio de
Obsidian, `editor:toggle-checklist-status`—, con Outliner y desde el teléfono.
Corre último —`Prec.high`— para ver la línea con el token ya en su lugar.

Con un límite que la verificación encontró y que **no es del filtro**: escribir
la `x` a mano adentro de `[ ]` no completa nada, porque insertar sin borrar el
espacio deja `[x ]`, y `[x ]` no es un checkbox —la §4.2 y el parser exigen
exactamente un carácter entre corchetes—. La línea deja de ser una tarea en el
camino, y negarse es lo correcto. No es de Live Preview ni de Outliner, que fue
lo que primero pareció.

**2. Cmd+clic en el checkbox archiva, y es el único mecanismo del plugin que
intercepta un clic.** Vale escribir por qué, porque parece contradecir lo
anterior y no lo hace: **un modificador no deja rastro en la transacción** —
`Cmd+clic` y `clic` producen el mismo cambio de documento— así que mirar el
resultado no alcanza; y archivar toca dos archivos, que un `transactionFilter`
no puede. Es estructuralmente más frágil: depende de correr en fase de captura
antes que el handler de Obsidian, y **en móvil no existe**. Tiene interruptor
propio, y el ⋯ sigue siendo el camino que anda siempre.

**3. Las confirmaciones se apagan, y la repetida no.** Yo había propuesto
preguntar al archivar con dos líneas o más (138 de 389 tareas, 35,5%) y al usarlo
resultó fricción, que es exactamente lo que esta sección existe para eliminar.
Gana el uso: por omisión no pregunta ni al archivar ni al eliminar, con ajuste
para volver. La excepción es **archivar algo que ya figura en el historial**, que
pregunta siempre: ahí el cartel evita una entrada repetida en vez de agregar un
paso.

Y el 🗑 entra a la fila como quinto botón, **último**, lo más lejos posible del
★. La objeción quedó dicha una vez y la decisión es del usuario: es la única
acción que pierde texto, el subárbol más grande del corpus son 77 líneas, y con
la nota cerrada no hay Ctrl-Z. Lo que lo separa de un clic errado es el color al
pasarle el mouse.

**4. El hover del margen se resolvió midiendo, no razonando.** Los botones se
apagaban yendo del texto hacia la izquierda, antes de llegar a ellos. La causa
está escrita en `@codemirror/view`: los `domEventHandlers` «are registered on the
**content element**», así que salir de `.cm-content` dispara su `mouseleave`, y
entre el borde del contenido y el margen hay unos 40 px donde ya no hay
`mousemove` y todavía no hay `:hover`.

Lo que decidió el arreglo fue la sonda en la consola: **`posAtCoords(…, false)`
devuelve la línea correcta en todo el recorrido**, también sobre
`.cm-contentContainer` y sobre el propio `.cm-gutter`, y nunca `null`. O sea que
no había nada que inventar — alcanzaba con escuchar donde el mouse está de
verdad, que es `scrollDOM`. Va en un `ViewPlugin`, que es la única forma de
enganchar ahí; **no contradice la regla del `StateField`** porque no es una
decoración: la clase la sigue poniendo un `gutterLineClass.compute`.

**Y lo que costó, medido.** Mover el oyente al `scrollDOM` significa que
`posAtCoords` corre también sobre los márgenes, y eso había que medirlo antes de
darlo por bueno. Con la sonda en la consola, moviendo el mouse por una nota de
402 líneas:

```
posAtCoords: 4590 llamadas · 620,5 ms en total · 0,1352 ms cada una
posAtCoords: 1003 llamadas · 127,8 ms en total · 0,1274 ms cada una
```

**Dos muestras independientes, de tamaños muy distintos, y el costo por llamada
coincide**: 0,135 y 0,127 ms. Eso es lo que hace creíble el número — una sola
corrida no habría distinguido el costo real de una casualidad del JIT, que es
justo el error que ya se cometió una vez con el test de costo de la fila.

El navegador junta los `mousemove` en uno por cuadro, así que 4590 llamadas son
del orden de **76 segundos de movimiento continuo**, y **0,13 ms es el 0,8% de
un cuadro de 16,7 ms**. Está en la misma liga que lo que ya se acepta por
transacción —decorar la nota entera cuesta 0,65 ms y construir la fila entre 0,1
y 0,2— así que no hay nada que optimizar.

Se consideró y se descartó cachear por `clientY` —la línea del documento depende
solo de la altura, así que el movimiento horizontal, que es el que motivó el
arreglo, podría costar cero—. **No se hace**: una caché que hay que invalidar al
scrollear es una superficie de bug nueva a cambio del 0,8% de un cuadro. Si
alguna vez el número sube, está el camino escrito.

**Y una corrección a cómo se prueba esto.** La primera sonda dio **cero
llamadas, tres veces**, y el cero era del instrumento: medía diez segundos desde
que se pegaba —si uno tardaba en volver a Obsidian la ventana ya se había
cerrado— y parcheaba una instancia en lugar del prototipo. Es la tercera vez en
esta sesión que un instrumento miente antes que el código, después del `%%` en
`console.log` y del Enter sin continuación de lista. **Un instrumento con reloj
propio miente sin avisar**: los que se consultan a mano no.

**Y dos cosas que la §5.5 gana de esta vuelta.** Una: `MenuItem.setWarning(true)`
pone la clase `is-warning` —verificado adentro del asar 1.13.7— pero **Obsidian
no la colorea**; la documentación de la API dice «will become red» y en realidad
depende del tema. Dos: `reubicarCursor` identificaba la línea por su texto
**visible**, y completar cambia justamente eso, así que el cursor caía en la
columna 0 y Live Preview desarmaba el `- [ ] `. No se había visto porque la
verificación de la sesión 5 probó el ★, que solo toca el token.

### Lo que el paso 6b agregó al frente principal

**02/09/2026.** El ⋯ queda con **los seis ítems** que esta sección lista: fecha,
prioridad, recurrencia, completar y descartar, completar y archivar, eliminar.
Los dos que faltaban entraron con la capa 1 y 2 detrás, que es la regla con la
que el paso 4b los dejó afuera.

**1. Los dos abren un `Menu` propio, no un submenú.** Es la misma decisión que
puso los tres niveles de prioridad planos: `setSubmenu` no está en las
tipificaciones públicas de Obsidian, y apoyarse en API que no está prometida es
gratis hasta el día que no lo es. Se posicionan con el mismo `MouseEvent`, como
el → con su popover.

**2. La fecha resuelta va en la etiqueta del atajo:** «Lunes · 7 sep», no
«Lunes». Contesta dos preguntas que el menú no podía contestar de otra manera:
«el lunes» sobre un lunes es ambiguo —la regla es que hoy cuenta como hoy, igual
que `resolverDue` con el día del mes, y eso no se adivina—, y **cuál de las dos
formas de `due` va a escribir**, que en la nota no se ve porque el token está
oculto. El modal hace lo mismo con una línea de «va a escribir».

**3. Y dos ítems del menú se iban a pisar, lo que salió de mirar la salida.** La
primera versión ofrecía hoy, mañana y los siete días: un miércoles eso mostraba
«Hoy · 2 sep» y «Miércoles · 2 sep», que escriben exactamente lo mismo. Además
de ser ruido, rompía el tilde del menú — `setChecked(valor === actual)` marcaba
los dos a la vez, así que la pantalla decía que la tarea tenía dos
vencimientos. Ningún test lo miraba: apareció imprimiendo las etiquetas y
leyéndolas. Ahora los dos días que «hoy» y «mañana» ya cubren no se repiten, y
la lista tiene siete ítems todos los días.

**4. El reinicio por grupo es un comando de paleta, no un ítem del ⋯.** El botón
por grupo vive en la vista (§11) y la pestaña es del paso 5. Un comando anda sin
vista **y sin cursor sobre una tarea**, que es lo que importa: un grupo entero
puede estar completado y colapsado en cinco notas cerradas. Ponerlo también en
el ⋯ dejaría un menú de siete ítems que solo a veces tiene siete, y un menú cuyo
largo cambia según la tarea es el que esta sección dice que no se puede
aprender.

**5. El modal de «Workbench nuevo…» y el de «Grupo nuevo…» son el mismo.** No
por ahorrar líneas: los dos nombres viven en el mismo token con la misma
gramática —`NOMBRE_RE` es literalmente la misma para `wb` y para `rec`— y dos
clases con el mismo saneo divergirían justo en si aceptan un `;`, que deja la
línea ilegible para siempre (§5.3).

**6. Y una debilidad del pipeline que este paso encontró.** `humo.mjs` exige que
ciertas marcas estén en el bundle, y el build de producción **no minifica**, así
que los comentarios de `src/` viajan enteros: cualquier marca que además
aparezca en un comentario era un guardia falso. Se encontró poniendo
`resolverDue` en la lista —una función que **todavía no llama nadie**— y viendo
que pasaba, por una línea de documentación que la nombra. Ahora las marcas se
buscan contra el bundle **sin comentarios**, y el barrido es conservador a
propósito: una alarma falsa que se repite es una alarma que se ignora.

### Lo que la verificación del paso 6b encontró, usando el plugin

**02/09/2026, primera vuelta: 44 de 48 en verde.** Las tres fallas estaban todas
en la sección del índice congelado y **dos de las tres eran errores de la guía**,
no del plugin. Vale escribirlas porque las dos son reglas, no anécdotas.

**1. Un `gutter()` de CodeMirror existe en todos los editores, y cobra ancho
aunque esté vacío.** Reportado mirando, no por un test: «al activar el plugin se
corre el margen de las notas que no son de tareas». La columna de botones se
registra con `registerEditorExtension`, así que vive en **cada** editor
markdown; `lineMarker` devuelve `null` fuera de las notas de la lista —y con eso
no dibuja ningún marcador— pero el `padding` del margen corría el texto de todas
las notas del vault unos 22px.

Y el comentario de `styles.css` afirmaba exactamente lo contrario: «con
`renderEmptyElements: false` una nota sin tareas no ocupa nada». Es una
afirmación escrita sin medirla, en el archivo que menos se puede comprobar
leyéndolo.

El arreglo es una clase que pone `EditorView.editorAttributes` sobre el
`.cm-editor` —tiene que ser **por editor** y no en `body`, porque una nota de
tareas y otra que no lo es pueden estar abiertas al lado—, y una regla nueva en
`humo.mjs` que se niega a desplegar un `styles.css` donde algo le dé ancho al
margen sin nombrarla. Se descartó `:has(.cm-gutterElement)`, que sería una
línea: el margen solo tiene elementos para las líneas **visibles**, así que
scrollear hasta una zona sin tareas lo vaciaría y el texto saltaría — cambiar un
corrimiento fijo por uno que se mueve al scrollear es peor.

**2. El cursor a la columna 0, por segunda puerta.** «Tildar el checkbox de una
tarea hija lleva el cursor al margen izquierdo, a la altura de la madre.» Es el
mecanismo que la §5.5 ya tenía escrito —`ChangeSet.mapPos` de una posición
adentro de un rango reemplazado devuelve el comienzo del rango— pero por un
camino que `cursor.ts` no cubre: allá lo trae `vault.process()` como cambio
externo y acá lo produce el propio `transactionFilter`, que reescribía la línea
entera y devolvía sus cambios **sin selección**.

Y el test lo mostró más general que el reporte: **pasaba en toda tarea**, no
solo en una hija. En una de primer nivel la columna 0 cae donde empieza el
`- [ ] ` y casi no se nota; la sangría de una hija lo vuelve visible. El arreglo
es una selección explícita, en las coordenadas posteriores a los cambios —
verificado en `mergeTransaction` de `@codemirror/state` 6.5.0, donde con
`sequential` el mapeo de la selección del segundo spec es la identidad.

**3. Y dos errores de la guía, que son la misma regla.** «Con el índice
congelado el reinicio se niega» pedía algo que no puede pasar: congelado, el
plan sale **vacío** —el store no vio las tareas completarse— y un plan vacío
nunca llega al paso en seco que la comprobación quería probar. Y «con el índice
congelado, ponerle fecha a una tarea que se corrió se niega» era directamente
falso: si el texto aparece **una sola vez**, `ubicar.ts` la encuentra y escribe,
avisando. Negarse necesita cero o dos apariciones, no un número de línea viejo.

> **Una guía de verificación es un instrumento, y un instrumento que pide un
> estado imposible no prueba nada.** Las dos comprobaciones pasaron por
> «falla» sin que hubiera nada roto, y la garantía que iban a verificar —«o
> todas o ninguna» sobre N notas— quedó sin mirar una vuelta entera.

### La segunda vuelta del 6b: 27 de 28

**02/09/2026.** Los cinco arreglos quedaron verificados en vivo: el margen ya no
cobra ancho fuera de las notas de tareas —comprobado también con las dos abiertas
lado a lado, que es lo que una clase en `body` no podía hacer—, el cursor se
queda en su lugar al tildar, y la §C confirmó lo que la primera vuelta no había
podido mirar: **con una nota que no se puede ubicar, el reinicio no escribe en
ninguna de las dos**, y al descongelar el índice se pone al día sin tocar los
archivos.

La única sin verde es la de la consola, y es la de la §5.5: no es una falla del
plugin, es una comprobación que hay que reemplazar por un instrumento.

### Lo que el paso 6c agregó al frente principal

**03/09/2026.** Los cuatro pedidos que salieron de **usar** el 6b, los cuatro
encendibles y conviviendo con lo que había (patrón `designFlags.ts`). Los tres
que tienen alternativa arrancan en **lo que ya estaba**, así que actualizar el
plugin no cambia nada hasta que se elija otra cosa.

**1. Dos indicadores en la fila: «tiene fecha» y «es cíclica».** Lo que valen es
que son el **único lugar donde esos dos datos se ven**: el token está oculto
(§5.1) y hasta acá había que abrir el ⋯ para saber si una tarea tenía
vencimiento. Tres decisiones, y las tres salen de algo ya decidido:

- **Son un atajo, no un toggle.** Un clic abre el submenú de fecha o el de
  recurrencia y **nunca escribe por su cuenta**. El ★ es toggle porque asignar un
  workbench es un clic y su inversa es el mismo clic; «tiene fecha» no tiene
  inversa —¿qué fecha escribiría?— y un apagado que borra el vencimiento es una
  pérdida de datos por un clic errado.
- **La etiqueta dice el valor resuelto**, y en una cíclica dice **las dos
  cosas**: «Vence el día 10 de cada mes: este mes, el 10 sep». Son datos
  distintos —uno está en el token y el otro sale de `resolverDue`, que hasta acá
  no tenía ningún llamador— y mostrar uno solo deja la mitad de la pregunta sin
  contestar. Es la misma decisión que puso la fecha resuelta en los atajos.
- **Ocupan su lugar aunque estén apagados**, escondidos con `opacity` y nunca con
  `display`. Dos razones medidas: la §13.0 ya lo decidió para los cuatro botones
  —lo que sale del flujo mueve al ★ justo cuando el mouse va hacia él— y **un
  `gutter()` se dimensiona por su elemento renderizado más ancho**, así que una
  fila que creciera solo en las tareas con fecha ensancharía el margen al
  scrollear hasta la primera y el texto saltaría. Es exactamente por lo que en el
  6b se descartó `:has(.cm-gutterElement)`.

Van **últimos** en el orden canónico y por lo tanto **primeros en el margen**,
que `ordenDelMargen` invierte: así el ★ no se corre ni un lugar de donde está, y
lo que queda pegado al texto sigue siendo el botón que más se aprieta.

**Y cuestan 0,015 ms.** Medido con `npm run test:corpus` sobre `tareas_COLE`
saturada y ventanas de 103 líneas —el viewport real—: mediana **0,110 · 0,112 ·
0,116 ms** en tres corridas independientes, contra los 0,097 ms de la fila de
cinco botones. Tres muestras que coinciden es lo que hace creíble el número; una
sola corrida de las primeras dio 0,217 y era ruido. Es el 0,7% de un cuadro de
16,7 ms, y la sexta parte de lo que cuesta decorar la nota entera.

**2. Tres órdenes de atajos de fecha, y el que había es el que no convencía.**
El pedido fue textual: «no me convence la selección de fechas ni el orden en que
figuran. Si queremos ofrecer los siete próximos días, hay que colocarlos en
orden. Pero quizás es mejor ofrecer opciones discontinuas». Impreso, se ve por
qué —un jueves, el orden fijo de lunes a domingo deja el sábado y el domingo,
que son los más cercanos, **últimos**:

```
semana        Hoy 3 · Mañana 4 · Lunes 7 · Martes 8 · Miércoles 9 · Sábado 5 · Domingo 6
cronologico   Hoy 3 · Mañana 4 · Sábado 5 · Domingo 6 · Lunes 7 · Martes 8 · Miércoles 9
discontinuo   Hoy 3 · Mañana 4 · Pasado 5 · En una semana 10 · En dos 17 · En 30 días 3 oct
```

Los tres cumplen las dos reglas que la sesión 7 pagó caro, y ahora son
propiedades sobre 400 días consecutivos: **ningún atajo repite el valor de otro**
—el bug de «Hoy · 2 sep» y «Miércoles · 2 sep», que además marcaba el tilde en
los dos— y **la cantidad no cambia según el día**, porque un menú cuyo largo se
mueve no se puede aprender.

Por eso `discontinuo` **no tiene «fin de mes»**, que era el candidato obvio: un
día 17 de un mes de 31 coincide con «en dos semanas», y ahí vuelven las dos cosas
más una tercera —el largo cambiaría—. Los seis son desplazamientos fijos, así que
no pueden chocar ningún día del año. Para el fin de mes está el selector.

**3. «Otra fecha…» con calendario, y lo que lo paga es el caso cíclico.** Se
ofrecen las dos formas. El costo, medido antes de decidir: el nativo son **seis
líneas** (`inputEl.showPicker()` con su guardia, porque `minAppVersion` es 1.6.0)
y la grilla son **~30 líneas puras** en `fechas.ts` más el DOM del modal. Lo que
inclina la balanza no es cuál se ve mejor —eso se decide mirando— sino que en una
tarea cíclica el campo es un `<input type="number">` del 1 al 31 y el navegador
**no ofrece ningún selector**: ahí la grilla de 31 días es lo único que hay.

Un clic en la grilla **elige, no acepta**: la línea «va a escribir» existe para
que se vea cuál de las dos formas de `due` queda antes de confirmar, y aceptar de
un clic la saltearía justo en el caso que la necesita.

**4. La recurrencia ordena por uso, y eso NO necesita estado nuevo.** El pedido
era «que recuerde y ofrezca las más usadas». Se miró de frente antes de
escribirlo, porque un contador en `data.json` sería el primer estado propio del
plugin —hasta hoy todo se deriva de las notas (§10)—. Dos cosas lo decidieron:

| | |
|---|---|
| Grupos distintos en las siete notas reales | **0** |
| Grupos distintos en las de prueba | **2** (`lunes` ×3, `mensual` ×5) |

Hoy **ordenar por uso ordena dos ítems**, así que no hay ninguna urgencia que
justifique estado nuevo; y la cuenta se **deriva** de las notas —cuántas tareas
llevan cada `rec`— con un recorrido que el store ya hace. Derivado no se
desincroniza, no viaja mal por Sync y no vive por dispositivo. Lo único que la
derivación no puede dar es el orden por **recencia**, que no se pidió.

Lo que sí es un ajuste es la **semilla**: con 0 grupos escritos, el submenú de
una nota real no ofrece nada para clickear, así que la lista lleva detrás unos
nombres sugeridos (`semanal, mensual` por omisión). Van **después** de los que
están en uso, no antes: la tecla `1` tiene que escribir un grupo que el vault ya
usa, no uno que el plugin propone.

Y el **atajo numérico se ve en pantalla**, como pide la §13.0 para el →. El
mecanismo se extrajo a un solo lugar: dos listeners de teclado con la misma regla
divergirían en cuál se saca al cerrar, que es cómo se llega a un `keydown` que
sobrevive a su menú y le come los dígitos al editor.

**5. Y la clave de una fila estaba incompleta, aunque hasta hoy no se notara.**
Decide si dos tareas comparten el mismo DOM, y llevaba `accion:workbench:activo`.
Eso era suficiente **solo porque ninguna etiqueta variaba por tarea**; con los
indicadores, la etiqueta lleva la fecha, y dos tareas con fechas distintas
habrían compartido marcador y una habría mostrado la fecha de la otra. Ahora
lleva la etiqueta, que es literalmente lo que la clave dice ser —«todo lo que
este widget dibuja»— y vive en **un** lugar en vez de los tres que la repetían.

**6. Y dos cosas que salieron de mirar la salida, no de un test.** Una: el
indicador mostraba `2026-09-07` crudo mientras el menú, a dos centímetros, decía
«7 sep» — dos formatos del mismo dato en la misma pantalla. Ahora dice «7 sep
2026», con el año porque un `due` escrito puede estar a un año y los atajos no.
Otra: el aviso de media operación decía «Ya está en el historial 9 líneas».

**7. Y una marca de `humo.mjs` que era falsa, encontrada por el propio
pipeline.** Se puso `tareas-boton-fecha` en la lista de marcas del bundle y el
despliegue falló: esa clase se arma como `` `tareas-boton-${accion}` `` y el
literal no existe en el código. Las marcas que quedaron —`indicadorDeFecha`,
`venceElDiaResuelto`— sí desaparecen si el mecanismo se cae. Es la lección del 6b
por el otro lado: allá una marca pasaba por un comentario, acá una marca no
existía y el guardia lo dijo.
