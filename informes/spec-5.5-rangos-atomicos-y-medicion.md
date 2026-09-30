# Rangos atómicos, ciclo de medición y cursor: la bitácora de la §5.5

Salió de la §5.5 de `plugin-tareas-spec.md` el 29/09/2026, **verbatim**, cuando
la spec se separó en lo normativo —qué es el plugin y qué quedó decidido— y la
bitácora —cómo se llegó, con qué mediciones y qué vueltas de verificación—. Lo
vigente está resumido en la spec, en «Lo que quedó decidido»; el porqué y los
números están acá.

Los comentarios del código que dicen «§5.5 punto N» remiten a los puntos
numerados de este archivo.

### La línea de base del ciclo de medición, tomada antes de tocarlo

**Medido el 24/08/2026, al cerrar el paso 3**, sobre una nota de tareas de 425
líneas y **sin ninguna decoración del plugin**, que todavía no existen. La
consola de Obsidian tira:

```
Measure loop restarted more than 5 times     ×1
Viewport failed to stabilize                 ×4
```

Pero solo bajo **dos condiciones a la vez**, y eso es lo que vale:

1. **Con la ventana angostada.** A pantalla completa no aparece ninguno.
2. **Scrolleando hacia arriba.** De arriba hacia abajo no aparece ninguno.

Son de CodeMirror, que Obsidian empaqueta dentro de `app.js`, y las pilas son
puramente de scroll. Son avisos, no errores, y el editor se recupera.

**Qué lo explica.** Leído en `@codemirror/view` 6.38.6 (`node_modules`) **y
verificado dentro del bundle de Obsidian 1.13.7**, no deducido —el §1 de las
notas de método: verificar contra el sistema, no razonar sobre documentación—.
Los dos avisos salen del mismo bucle, en `EditorView.measure`:

```js
let newAnchorHeight = ... this.viewState.lineBlockAt(scrollAnchorPos).top;
let diff = newAnchorHeight - scrollAnchorHeight;
if (diff > 1 || diff < -1) {
    scrollTop = scrollTop + diff;
    sDOM.scrollTop = scrollTop / this.scaleY;
    scrollAnchorHeight = -1;
    continue;                    // ← otra vuelta; a la séptima, el aviso
}
```

CodeMirror ancla el scroll a un bloque y recuerda su `top`. Después de medir lo
recalcula: si se movió más de 1 px, es que **la altura de todo lo que está por
encima del ancla cambió**, compensa el `scrollTop` y vuelve a empezar. A la
séptima vuelta avisa y corta.

Eso explica las dos condiciones exactamente:

- **Hacia arriba y no hacia abajo.** Bajando, las líneas que se miden por primera
  vez están *debajo* del ancla y su `top` no se mueve: `diff` es 0 y el bucle
  corta en la primera vuelta. Subiendo, lo que se mide está *encima*.
- **Angosta y no a pantalla completa.** No es que la envoltura se encienda —en
  Obsidian está siempre—, es qué tan mal estima. En `HeightOracle`:

  ```js
  heightForLine(length) {
      if (!this.lineWrapping) return this.lineHeight;   // exacto
      let lines = 1 + Math.max(0, Math.ceil((length - this.lineLength) /
                                            Math.max(1, this.lineLength - 5)));
      return lines * this.lineHeight;
  }
  ```

  Si la línea entra en un renglón (`length <= lineLength`) la estimación es
  **exacta**. Angostando, `lineLength` —el promedio de caracteres por renglón—
  baja, muchas líneas lo superan, y entra a jugar una cuenta de caracteres que
  **ignora dónde cortan las palabras**. De ahí el error.

**Y los dos mensajes no son lo mismo:** `this.measureRequests.length ? "Measure
loop restarted more than 5 times" : "Viewport failed to stabilize"`. El primero
solo aparece si alguien pidió una medición con `requestMeasure`, o sea **una
extensión**. El segundo es puro vaivén del viewport. Hoy el plugin no llama a
`requestMeasure` en ningún lado.

### La restricción que esto le pone al paso 4

**`Decoration.replace` sobre el token cambia la altura de la línea**, no solo su
ancho: el token lleva unos 40 caracteres (`%%t:id=k3f9;wb=foco;due=2026-08-29;p=2%%`)
y con la ventana angosta eso es del orden de un renglón por tarea.

Y hay una trampa que decide el diseño, leída en la misma versión:

```js
this.stateDeco = state.facet(decorations).filter(d => typeof d != "function");
this.heightMap = this.heightMap.applyChanges(this.stateDeco, ...);
```

**El mapa de alturas se arma solo con las decoraciones que son un `DecorationSet`,
y descarta las que llegan como función.** Un `StateField` aporta el set; un
`ViewPlugin` aporta la función. O sea:

| De dónde salen | ¿Las ve el mapa de alturas? |
|---|---|
| `StateField` | **Sí.** `addLineDeco` hace `line.collapsed += length` y la estimación descuenta el token |
| `ViewPlugin` | **No.** Cada línea de fuera de pantalla se estima **con** los 40 caracteres puestos |

> Las decoraciones del paso 4 van en un **`StateField` sobre el documento entero**,
> nunca en un `ViewPlugin` sobre el viewport visible.

Y esto no es solo lo que dice el paquete de `node_modules`: es lo que hace el
Obsidian instalado. En el bundle de 1.13.7, minificado:

```js
function No(e){
  var t = e.facet(Ii).filter(function(e){ return "function" != typeof e });
  var n = e.facet(Oi).filter(function(e){ return "function" != typeof e });
  return n.length && t.push(ct.join(n)), t
}
…  this.stateDeco = No(t),
   this.heightMap = go.empty().applyChanges(this.stateDeco, …)
```

Se reproduce **desde la terminal**, sin abrir Obsidian:

```bash
grep -a -o '.\{60\}stateDeco=.\{0,110\}' ~/Library/Application\ Support/obsidian/obsidian-*.asar
```

Ahí mismo se ve que `lineWrapping` sale de si existe la clase `cm-lineWrapping`
y no del ancho de la ventana, que es la corrección del punto anterior.

Con `ViewPlugin`, cada tarea fuera de pantalla se estimaría un renglón más alta de
lo que es; al entrar en pantalla se mide, se encoge, el ancla se mueve, y es el
bucle de arriba —amplificado, y esta vez causado por nosotros—. Y no hay ninguna
razón para ser astutos: parsear las siete notas **enteras** cuesta 0,31 ms.

**Predicción falsable, para el paso 4:** con la ventana angosta y scrolleando
hacia arriba, la cuenta no tiene que pasar de la base de arriba (1 y 4). Si sube,
o si aparecen avisos **sin scrollear**, es del plugin. Sin esta base tomada, el
primer reflejo sería descartarlos como ruido de siempre — que es cómo se pierde
una regresión.

### Y la predicción lleva seis vueltas sin poder correrse

**02/09/2026, al cerrar la segunda vuelta del paso 6b.** La comprobación de la
consola se pidió en **seis** verificaciones —sesiones 4, 5 y 6, y las dos vueltas
de la 7— y **no reprodujo la base ni una vez**. La última fue explícita: «no
muestra nada la consola», o sea **cero**, no 1 y 4.

Hay que decir lo que eso significa, porque es más incómodo que anotarlo como
verde: **una comprobación que en seis vueltas no produjo un solo número no está
protegiendo nada.** La predicción de arriba solo puede dispararse si la base es
reproducible; con cero, un aumento causado por el plugin aparecería como «unos
avisos» y no habría contra qué compararlo. Es la contracara de la regla de las
alarmas falsas: una alarma que **nunca** suena tampoco se puede leer.

De las dos explicaciones posibles —que las condiciones no se estén
reproduciendo, o que la base haya sido un accidente de aquella tarde que no
generaliza— **ninguna se puede elegir mirando la consola a ojo**, que es
exactamente lo que se viene haciendo. Y hay una tercera que las cubre a las dos y
que el método ya nombró: **antes de creerle a un cero, hay que comprobar que el
instrumento mide lo que dice.** Seis ceros sin esa comprobación es el mismo error
que la sonda de la sesión 6, repetido más despacio.

Lo que corresponde: **un instrumento en vez de una indicación**, y ya está
escrito — `scripts/espia-medicion.js`. Cuenta los avisos, **scrollea solo** —
«angostá la ventana y scrolleá hacia arriba» a mano se cumple distinto cada vez,
y esa es la explicación más probable de los seis ceros— y, antes de medir,
**demuestra que parcheó lo que dice parchear** haciendo pasar un aviso sintético
por ahí. Se consulta a mano, sin reloj propio.

Hasta que ese instrumento dé un número, la comprobación **sale de las guías de
verificación**: pedirla otra vez a ojo es pedir seis veces lo mismo y anotarlo
seis veces como no concluyente.

### Lo que el paso 4a agregó a esta sección

**25/08/2026, al construir las decoraciones.** Tres cosas leídas del sistema, y
una corrección a cómo hay que leer la predicción de arriba.

**1. Por qué el rango atómico tiene que incluir el salto de línea: la segunda
razón.** La primera es de siempre —sin él bajar de línea cuesta dos flechas—. La
segunda sale de leer `deleteBy` y `skipAtomic` adentro del asar 1.13.7
instalado, minificados como `aH` y `sH`:

```js
function sH(e,t,n){ … r[i].between(t,t,function(e,i){ e<t && i>t && (t = n?i:e) }) … }
…  a<r ? (n="delete.backward", a = sH(e,a,!1)) : …
```

Un Backspace desde la línea de abajo apunta al salto de línea. Si el salto está
**adentro** del rango atómico, el objetivo se corre hasta el comienzo del rango y
se borra el token entero: feo pero recuperable, que es exactamente el caso que
la §5.4 acepta. Si el salto quedara **afuera**, el borrado se llevaría solo el
`\n` y dejaría dos `%%t:` en la línea unida: **ilegible, y una línea ilegible no
se vuelve a escribir nunca** (§5.3). De los dos daños, el rango elige el
reversible. `src/editor/protegerTramo.ts` evita los dos.

**2. Los `transactionFilter` sí se encadenan, y el orden es inverso.** Leído en
`@codemirror/state` 6.5.0, `filterTransaction`:

```js
let filters = state.facet(transactionFilter);
for (let i = filters.length - 1; i >= 0; i--) { … tr = resolveTransaction(state, …) }
```

Cada filtro recibe la `Transaction` que produjo el anterior, resuelta contra el
mismo `startState`, y se recorren **de menor a mayor precedencia**. O sea que
`Prec.low` corre **primero**. No es un detalle: si `autoCheckbox` corriera antes
que `protegerTramo`, vería un Enter cuya primera línea perdió el token, su
comparación `resultado[0].trimEnd() === linea.text.trimEnd()` fallaría, y **el
checkbox automático dejaría de funcionar en toda tarea que tenga token**. Un
mecanismo roto por el orden de registro de otro.

**3. CodeMirror no tira excepción con rangos superpuestos: los fusiona.** Medido,
porque lo primero que supuse era lo contrario. Con `[0,5)→X` y `[3,7)→Y` sobre
`abcdefghij` devuelve `XYhij`. Un filtro que agranda el rango que reescribe
—como hacen dos de las cuatro reglas de `protegerTramo`— podría comerse en
silencio la edición de otro cursor. Es peor que una excepción, porque no avisa.

**4. Recorrer el documento entero por tecla cuesta 0,65 ms en el peor caso.**
La §7 mide 0,31 ms para las siete notas, pero eso es por **evento** del vault,
que llega cada ~2100 ms; el `StateField` recalcula por **transacción**, o sea
por tecla. Son dos preguntas distintas y merecían dos mediciones. Medido el
25/08/2026 con `npm run test:corpus`, sobre las notas reales y sobre una copia
de cada una con un token en cada línea de tarea:

| Nota | Líneas | Tokens | Mediana | p90 |
|---|---|---|---|---|
| `tareas_COLE`, como está | 380 | 0 | 0,18 ms | 0,58 ms |
| `tareas_COLE`, saturada | 380 | 290 | **0,65 ms** | 0,98 ms |

Un cuadro a 60 fps son 16 ms. No hay ninguna razón para ser astutos, y ahora
hay un test que avisa si eso deja de ser cierto.

**5. Dos formas de cambio que ninguna regla había previsto**, encontradas
usando el plugin (verificación de la sesión 4, 25/08/2026). Las dos rompían
datos y las dos salían del mismo error: **reglas que preguntan de qué forma vino
el cambio**, que es lo que la §8 de las notas de método prohíbe y yo escribí
igual.

| Forma | Qué pasaba |
|---|---|
| Con Outliner, unir dos líneas **reemplaza las dos por una** | El token quedaba en el medio de la línea unida, visible; con token en las dos, quedaban los dos y la línea, ilegible |
| Una escritura del propio plugin vuelve al editor como **un diff adentro del token** (`…;wb=foco%%` → `…;wb=foco;p=1%%`) | El filtro lo confundía con alguien tecleando adentro del tramo y sacaba el `;p=1` afuera: **la prioridad no se escribía nunca** |

El filtro se reescribió alrededor de **reconocer el defecto y no el gesto**: se
calcula en qué quedaría el documento, se pregunta si eso está mal —alguna línea
ilegible, el token movido, el token perdido en una unión— y solo entonces se
corrige. Un cambio que deja todo bien pasa intacto, venga de donde venga, y eso
es lo que deja pasar las escrituras del plugin.

**6. Al partir una tarea al medio, el token se queda arriba.** Decisión del
usuario, 25/08/2026. Es la misma regla que en la unión —la línea que hereda la
posición hereda el token— y la razón es que el token **no se ve**: con el
comportamiento anterior, partir una tarea la sacaba del workbench sin que se
notara, porque la mitad que quedaba adentro era el texto nuevo y no la tarea que
uno reconoce. El workbench pasaba a mostrar «y pan».

Alguna de las dos mitades queda afuera del workbench sí o sí; ninguna regla
evita eso sin que el plugin **invente** un `id` y una asignación a partir de un
Enter, que se descartó por ahora. Lo que la regla elige es **cuál**: que sea la
mitad nueva, que es la que se nota en el acto y cuesta una tecla arreglar. Por el
token viajan también el `due`, el `rec` y la prioridad.

Con un límite: si la mitad de arriba queda **sin texto** —apretar Enter al
comienzo, para abrir una línea arriba— el token baja. Si no, quedaría en una
tarea vacía que sería la dueña del workbench.

**7. El tramo oculto se lleva un solo espacio.** Llevarse todos los finales
hacía que escribir un espacio al final de una tarea lo metiera adentro del tramo
y **desapareciera**: se apretaba la barra y no pasaba nada. Solo se ve usándolo.

**8. La línea de base ya no se reproduce, y eso invalida la predicción.**
Medido el 25/08/2026 con 122 tokens en la nota, la ventana angostada y
scrolleando en las dos direcciones: **no aparece ningún aviso**, ni con las
decoraciones encendidas ni con ellas apagadas. Ni `Measure loop restarted` ni
`Viewport failed to stabilize`.

O sea que la base de «1 y 4» tomada al cerrar el paso 3 **no se reproduce hoy**,
y la predicción falsable que se apoyaba en ella no se puede evaluar: no hay con
qué comparar. Lo único que se puede afirmar, y es poco, es que las decoraciones
**no agregaron** avisos donde antes no los había.

No hay que anotarlo como «verde». Hay tres explicaciones posibles y ninguna está
descartada: que la ventana no llegara al ancho donde el fenómeno aparece, que
alguna versión de Obsidian del medio lo haya cambiado, o que la base original
dependiera de algo del momento que no quedó registrado. **La §5.5 dice que una
medición tiene fecha; esta acaba de mostrar cuánto dura.** Si el bucle vuelve a
aparecer, hay que medir la base de nuevo antes de sacar conclusiones.

**9. Tres cosas más que salieron de usarlo**, 25/08/2026.

**Los comandos de prioridad parten del nivel que se ve, no del propio.** Una hija
sin `p=` se dibuja con la prioridad de su madre (§14), así que actuar sobre su
cero hacía que subirle la prioridad a una hija que heredaba «muy alta» la dejara
en «alta»: parecía que bajaba. `prioridadEfectiva` usa la misma regla que dibuja
`decorar.ts` —gana la propia, y arriba la ancestra más cercana— porque si no, el
comando y el color dirían cosas distintas sobre la misma línea.

Queda un agujero del modelo, y va dicho en vez de tapado: como «normal» no
escribe campo, sin campo la hija vuelve a heredar, así que **no se puede bajar
sola**. Cerrarlo pide un `p=0` explícito, que cambia el formato del token.

**Unir dos tareas deja una línea limpia**: con un espacio y sin el marcador de la
absorbida. Vive en un módulo aparte de la defensa del token, y la razón es de
diseño y no de prolijidad: aquella solo interviene cuando hay un token que
defender, así que la limpieza aparecería únicamente en las tareas con metadatos
—que son invisibles—. Un comportamiento del editor que cambia según algo que no
se ve no se puede aprender. La división queda: **`unirLimpio` decide el texto,
`protegerTramo` el token, `autoCheckbox` el checkbox.**

**Un clic al final de una tarea ya no salta abajo.** `skipAtomsForSelection`
resuelve con `bias 0`, y con el rango atómico llegando hasta el salto, el final
de la línea queda a un carácter del borde de abajo. Es el precio de que la flecha
cruce de un teclazo, y se paga corrigiendo el clic, no achicando el rango.

**10. Tres correcciones de la tercera vuelta**, 25/08/2026, y las tres del mismo
tipo: reglas que preguntaban lo que estaba a mano en vez de lo que importa.

- **Para saber si bajar la prioridad sirve de algo hay que mirar qué queda
  después, no de dónde viene lo de ahora.** Una hija con `p=1` propio adentro de
  un bloque `p=2` tiene prioridad propia, y bajarla igual la deja heredando rojo.
- **La unión limpia no puede pedir que la línea de abajo sea un ítem de lista.**
  Hay dos casos reales donde no lo es —texto suelto, y una tarea a la que ya le
  borraron el checkbox antes de unir, que es lo que pasa con `stickCursor`— y en
  los dos falta el espacio igual. La de **arriba** sí tiene que serlo: es la que
  sobrevive.
- **Borrar el checkbox convierte la tarea en bullet aunque tenga texto.** Que
  solo funcionara en la tarea vacía era arbitrario. El borrado que cruza líneas
  sigue sin convertir: ahí unir es unir.

Y una que se decidió probándola: **al convertir una tarea en bullet, el token se
borra con el checkbox.** La primera versión lo dejaba a la vista —el plugin
oculta solo lo que gestiona, así que un bullet sin checkbox muestra sus
metadatos— con el argumento de que verlos es lo que permite borrarlos. Usándolo
resultó que la señal no sirve para nada: con un token huérfano lo único que se
puede hacer es borrarlo a mano. Es la misma política que al unir dos tareas con
token, y se pierde menos de lo que parece: esto pasa **en el editor**, así que
Ctrl-Z lo devuelve entero, que es justo lo que no pasa con `vault.process`.

**11. La predicción de arriba solo discrimina con bastantes tokens.** Medido el
25/08/2026: las siete notas reales tienen **0 tokens**, y `tareas_PRUEBA.md`
tiene **13 en 435 líneas**. Trece líneas que se acortan unos 40 caracteres es un
efecto del orden del ruido sobre el mapa de alturas; comparar contra la base con
eso no prueba nada en ninguna de las dos direcciones. **Antes de medir hay que
cargar la nota de prueba de tokens.** Y la comparación se hace A/B con el
interruptor «decoraciones en la nota», sobre la misma nota y el mismo recorrido
de scroll: sin poder apagarlas, la línea de base no se compara contra nada.

### Lo que el paso 4b agregó a esta sección

**30/08/2026, al construir la fila de botones.**

**12. La regla del `StateField` tiene un límite exacto, y está en el código.**
La §5.5 manda las decoraciones a un `StateField` porque el mapa de alturas
descarta las que llegan como función. Para la fila de botones eso habría
significado un widget por tarea —290 en `tareas_COLE`, de las que se ven
cuarenta—. Antes de pagarlo, se leyó el constructor del mapa **dentro del
`obsidian-1.13.7.asar` instalado**, no en `node_modules`:

```js
e.prototype.point=function(e,t,n){
  if(e<t||n.heightRelevant){ … } else t>e&&this.span(e,t); … }

Object.defineProperty(t.prototype,"heightRelevant",{get:function(){
  return this.block||!!this.widget&&(this.widget.estimatedHeight>=5||this.widget.lineBreaks>0)}})
```

y la tercera pieza, la del diff (`heightRelevantDecoChanges`):

```js
comparePoint=function(e,t,n,i){(e<t||n&&n.heightRelevant||i&&i.heightRelevant)&&ln(e,t,this.changes,5)}
```

> **Un widget inline de ancho cero, sin `estimatedHeight` y sin `lineBreaks`, no
> entra nunca al mapa de alturas.** `from === to` y `heightRelevant` es `false`,
> así que `point` cae en el `else` y `t > e` es falso: no hace nada.

De ahí la división, que no es una excepción a la regla sino su otra mitad:

| Qué | Dónde | Por qué |
|---|---|---|
| El `Decoration.replace` del token | **`StateField`** | Tiene `from < to`: alimenta `line.collapsed` y la estimación descuenta el token |
| La fila de botones | **`ViewPlugin`** sobre `visibleRanges` | El mapa no la ve venga de donde venga, así que recorrer el documento entero sería DOM de más y nada de menos |

**Y la trampa que eso deja armada:** el día que alguien le ponga
`estimatedHeight` a ese widget o lo haga `block`, vuelve a ser relevante para el
mapa — y desde un `ViewPlugin` el mapa lo descarta, que es el bug de esta misma
sección entrando por la puerta de al lado. `test/filaDeBotones.test.ts` falla ese
día, y no meses después en el ciclo de medición.

**13. Construir la fila cuesta 0,036 ms.** Medido el 30/08/2026 con
`npm run test:corpus`, sobre ventanas de 40 líneas y en el peor caso realista
—`tareas_COLE` con un token en cada tarea, 287 tokens—: mediana **0,036 ms**,
p90 0,097 ms. Contra los **0,65 ms** de decorar el documento entero, que es lo
que corre en la misma tecla.

**Y la primera versión de esa medición estaba mal, y el test pasaba igual.**
Medía una pasada sola: informaba 0,711 ms para la primera nota y 0,02-0,12 para
las seis siguientes. No era una nota cara, era el JIT. Se descubrió **mirando la
salida**, no por un test en rojo — el techo de 16 ms lo pasaba de todas formas—.
Un instrumento que informa un número que no es el que dice medir es peor que no
medir; ahora hay una pasada de calentamiento que se descarta.

**14. La posición de un widget no se guarda: se le pide a CodeMirror.** El
invariante 10 sobre un botón sería fácil de romper —el widget se construye con
un número de línea que envejece— y la salida es `view.posAtDOM(ancla)`. Leído en
`@codemirror/view` 6.38.6:

```js
posFromDOM(node, offset) { return nearest(node).localPosFromDOM(node, offset) + view.posAtStart }
```

`WidgetView` no sobreescribe `localPosFromDOM`, así que usa la genérica de
`ContentView`, y para un widget de **longitud cero y sin hijos** todos sus
caminos devuelven `0`. O sea que el resultado es exactamente `posAtStart`, que
con el ancla en `line.from` es el comienzo de la línea. De ahí sale el texto de
ahora, y de ahí en adelante manda `elegirTarea`, que ya existía.

Eso tiene una consecuencia de diseño que no es obvia: **`eq()` no puede llevar
el número de línea**. Si lo llevara, teclear en cualquier línea de más arriba
reharía el DOM de todas las filas de abajo —se perdería el hover en el medio del
gesto y se pagaría en cada tecla—. Las dos cosas son la misma decisión.

### Lo que la primera verificación del paso 4b midió

**31/08/2026.** Cuatro cosas, y una de ellas refuta algo que esta spec afirmaba.

**15. `Ctrl-Z` sí deshace una escritura del plugin, si la nota está abierta.**
La §8 y la §11 dicen lo contrario —«`vault.process()` no pasa por el editor, así
que Ctrl-Z no lo deshace»— y se usó para justificar que el reinicio de un grupo
cíclico pida confirmación. **Medido en el uso: lo deshace.** Lo que la
afirmación no contemplaba es que la escritura vuelve al editor como un cambio
externo (§5.5 punto 5) y **esa transacción entra al historial de deshacer del
editor**; deshacerla revierte el buffer, que después se guarda solo.

El límite, que es donde la afirmación original sigue valiendo: **solo con la
nota abierta**, y solo mientras esa vista viva. Una escritura sobre una nota
cerrada —que es lo que va a hacer la vista de workbenches del paso 5, y lo que
hace el archivado del paso 6 sobre el LOG— no tiene ningún historial detrás.
O sea que la confirmación de la §11 se justifica igual, pero por otra razón:
**no porque nunca se pueda deshacer, sino porque a veces sí y a veces no**, y un
mecanismo de rescate que depende de si la nota estaba abierta no es un mecanismo
de rescate.

**16. Un clic que cae en la fila y no en un botón manda el cursor al comienzo de
la línea.** Reportado como falla errática y explicado leyendo
`@codemirror/view` 6.38.6: `skipAtomsForSelection` solo corre desde
`applyDOMChange` con `userEvent` `select.pointer`, o sea **cuando el navegador
movió el caret y CodeMirror lo lee de vuelta**. El widget es una isla
`contentEditable="false"` anclada en `line.from`; sin un `preventDefault` que lo
ataje, el navegador pone el caret al lado de la isla y `posFromDOM` lo resuelve
exactamente en `line.from` — donde Live Preview desarma el `- [ ] `. El
`preventDefault` estaba en cada botón y no en la fila, así que el relleno y los
huecos quedaban descubiertos. De ahí el «a veces».

**17. El viewport real es de 46 a 103 líneas**, medido desde la consola
scrolleando la nota de prueba. El test de costo usaba una ventana de 40 elegida
a ojo; ahora usa 103, que es el caso caro. Con eso, construir la fila cuesta
**0,097 ms** de mediana y 0,338 de p90 sobre `tareas_COLE` saturada, contra los
0,65 ms de decorar el documento entero.

**Y el instrumento en vivo no puede resolver eso:** `performance.now()` adentro
de Obsidian viene redondeado a **0,1 ms**, así que todos los números de la
consola son múltiplos de 0,1 y el costo de la fila cae bajo la resolución del
reloj. La consola sirve para ver que no se dispara; para el número está el test.

**18. La línea de base del ciclo de medición sigue sin reproducirse.** Tercera
vez. Con la nota de prueba cargada de tokens, la ventana angostada, scrolleando
en las dos direcciones y en las tres condiciones —fila + decoraciones, solo
decoraciones, nada— **no aparece ni un `Measure loop restarted` ni un `Viewport
failed to stabilize`**. Sigue sin poder evaluarse, y sigue sin ser verde.

### Lo que la segunda verificación del paso 4b midió

**31/08/2026.** Tres respuestas y una pregunta que sigue abierta.

**19. El cursor mal ubicado al unir es de Outliner, no del plugin.** Con Outliner
**desactivado**, repitiendo la unión con Backspace muchas veces, no falla nunca.
Con él instalado falla una de cada tantas. Los tres filtros de este plugin
dejan el cursor en la costura con las cinco formas de unión —probado offline— así
que quien lo mueve después es el otro. No se corrige desde acá: corregirlo sería
pelearle una selección a un plugin que la puso a propósito, y eso es una guerra
de filtros que se pierde en la próxima versión de cualquiera de los dos.

**20. Que la flecha llegue a las posiciones de adentro del `- [ ] ` es de
Obsidian.** Medido con `scripts/espia-cursor.js`: la flecha izquierda recorre
`168:7 → 168:6 → … → 168:0`, una transacción por tecla, **todas con selección
explícita y `userEvent: "select"`**. Son posiciones reales del documento y
siempre estuvieron; el widget de la fila no agrega ninguna, porque es de
longitud cero. Lo que sí es del plugin, y anda, es el salto de `168:0` a
`167:35`: el rango atómico se lleva el token entero de un teclazo.

Si alguna vez molesta, la salida es hacer atómico el `- [ ] ` en las líneas de
tarea. **No se hizo**: cambiaría también qué borra un Backspace ahí, que es
justo el gesto que la §5.5 punto 10 dejó funcionando (borrar el checkbox
convierte la tarea en bullet). Es una decisión de diseño, no una corrección.

**21. Un instrumento que imprime tokens tiene que usar `console.log("%s", …)`.**
El espía del cursor mostraba `%t:id=l748;wb=foco%`. La consola de Chrome trata
el primer argumento como cadena de formato aunque sea el único, y `%%` es su
escape para un `%` literal: **el instrumento mentía sobre lo único que este
plugin escribe.** Node no lo reproduce, así que la terminal no sirve para
probarlo.

**22. Queda una tarea donde el cursor sigue saltando al comienzo de la línea**,
y solo con las acciones de workbench. No se reprodujo: se montó offline el
camino entero —plan, diff recortado como el que despacha Obsidian, transacción
con `userEvent: "set"`— con el subárbol y con una sola línea, y con el cursor en
las cuatro posiciones de la línea; **no se mueve en ningún caso**. O sea que no
es el mapeo de la escritura: lo mueve el navegador en algún camino del clic que
el `preventDefault` del ancla no ataja.

En vez de seguir buscando cuál, se hace cumplir la regla directamente: la fila
guarda la selección en el `mousedown` y la **devuelve** en el `click` si cambió.
Entre esos dos eventos no hay ninguna razón legítima para que la selección se
mueva. No pregunta de qué forma vino el cambio —eso es lo que la §8 del método
prohíbe—: afirma el invariante que la fila tiene que cumplir.

### Lo que la tercera verificación del paso 4b midió

**31/08/2026.** El espía cerró la falla que dos vueltas no habían podido cerrar,
y de paso mostró que la reproducción offline anterior medía otra cosa.

**23. Lo que movía el cursor era la escritura, no el clic.** El punto 22 decía lo
contrario y estaba mal. Con `scripts/espia-cursor.js`:

```
#103 376:0 → 376:41  ← selección explícita  · doc +0  · select.pointer
#104 376:41 → 376:0                          · doc +30 · set
```

El clic deja el cursor en la columna 41; **la transacción `set` que trae de
vuelta nuestra propia escritura lo manda a la 0, sin poner ninguna selección
explícita**. O sea que lo mueve el **mapeo**.

**Y por qué la reproducción offline del punto 22 no lo encontró:** usaba un diff
**mínimo**, carácter a carácter, donde el cambio empieza adentro del token —o
sea después del cursor— y no lo toca. **El diff de Obsidian arranca en el
comienzo de la línea**, y `ChangeSet.mapPos` de una posición que cae adentro de
un rango reemplazado devuelve el comienzo del rango. Esa diferencia era todo. La
lección es de método: **una reproducción tiene que copiar la forma del sistema,
no una forma razonable.**

La corrección es `src/editor/cursorExterno.ts`, y la regla es la del invariante
10 aplicada al cursor: **la línea se identifica por su texto visible, no por su
número.** Se compara el texto sin el tramo oculto porque es justo el tramo lo que
la escritura cambia. Si ese texto no aparece, o aparece varias veces y la línea
se movió, no se toca nada y manda el mapeo de CodeMirror. Sirve igual para lo que
llega por Sync, que es el otro origen de un cambio externo.

**24. La fila en el margen tiene que ser un `gutter`, no un widget.** La versión
anterior de `columna` posicionaba la fila con `right: calc(100% + …)` adentro de
`.cm-line`, y eso solo funciona si la nota deja espacio a los costados. Medido en
el uso: con «longitud de línea legible» **apagada** los botones quedan recortados
fuera de la pantalla, y con ella encendida la pastilla se dibuja **encima** de
los números de línea. Son dos cosas que no saben una de la otra.

Un `gutter` de CodeMirror es una **columna de verdad** y resuelve las tres cosas
de arriba sin ninguna cuenta: el orden que pedía la propuesta —número de línea ·
botones · filete · plegado · checkbox— sale de registrar el margen con
`Prec.lowest`, porque «el orden en que aparecen los márgenes lo decide la
precedencia de su extensión».

Y resuelve una cuarta de arriba: en el margen los botones viven **afuera de
`.cm-content`**, así que el navegador no tiene dónde poner un caret y toda la
familia de fallas del cursor con el clic desaparece de raíz. El clic tampoco
necesita `posAtDOM`: los `domEventHandlers` de un margen reciben el `BlockInfo`
de la línea **fresco en el momento del evento**, que es la misma garantía del
invariante 10 por una puerta más directa.

**25. Lo que quedó dicho y no se corrige.** Con Outliner instalado la unión con
Backspace sigue dejando el cursor donde él quiera (punto 19), y la flecha sigue
entrando a las posiciones de adentro del `- [ ] ` (punto 20). Las dos son de
otro, están medidas, y corregirlas sería pelearle una selección a un plugin que
la puso a propósito.

### Lo que la cuarta verificación del paso 4b midió

**31/08/2026.** El cursor quedó cerrado —las cuatro comprobaciones en verde— y
apareció lo que faltaba del margen.

**26. Un margen no es descendiente de la línea, así que el `:hover` del CSS no
lo alcanza.** Con la fila adentro de `.cm-line` bastaba
`.cm-line:hover .tareas-fila`. Un `gutter` es **hermano** de `.cm-content`, y
`:hover` no cruza de costado: los botones solo aparecían apuntando a la columna
angosta del margen, no pasando el mouse por la tarea. CodeMirror mantiene
`.cm-activeLineGutter`, pero esa es la línea **del cursor**, no la del mouse.

La solución es llevar el dato: un oyente de `mousemove` para el editor entero
publica qué línea tiene el mouse encima y `gutterLineClass` la marca. **No
contradice la §15 punto 1** —«el modo de revelación es un parámetro, nunca un
`mouseenter` cableado adentro»— porque el modo sigue viajando como clase de
`body` y esto es **un** oyente que solo publica un dato, no uno por fila. En
móvil no hay `mousemove` y nunca se enciende, que es lo que aquella regla quería.

Se despacha solo cuando **cambia la línea**, no en cada píxel.

**27. El filete se sale del contenido y se mete en el margen.** Se dibuja como
`::before` de `.cm-line` a `-1.9rem` de su borde, o sea fuera de la caja del
contenido. Con el margen pegado, el ⋯ quedaba abajo del filete. No es un
problema del filete ni del margen por separado: es que uno se dibuja en
coordenadas del otro. El hueco de la derecha del margen es lo que los separa, y
es un valor que hay que **mirar**, no deducir.

### Lo que la quinta verificación del paso 4b midió

**31/08/2026.**

**28. Una regla de CSS sin scope alcanza a las dos formas de la fila.** Hay dos
—el widget, que vive adentro de `.cm-line`, y el marcador del margen, que vive
afuera— y se revelan distinto, porque el `:hover` de la línea no llega al
margen. Al pasar la columna a un `gutter` quedó en pie un
`body.tareas-revelar-hover … .tareas-fila { opacity: 0 }` **sin decir cuál**, y
se cayó el override que lo restauraba: en el margen los botones no aparecían
nunca en modo hover y sí en modo siempre.

No lo agarró ningún test, y no lo podía agarrar: resolver una cascada de CSS
pide un navegador. Lo que sí se puede es prohibir la forma que lo causa.
`scripts/humo.mjs` se niega a desplegar un `styles.css` donde un bloque toque
`opacity` o `pointer-events` sobre `.tareas-fila` sin nombrar `.cm-line` o
`.cm-gutter` — verificado volviendo a meter la regla vieja y viendo fallar el
despliegue.

### Lo que la sexta verificación del paso 4b midió

**01/09/2026.** Dos cosas, y las dos las contestó `scripts/espia-margen.js`
después de que dos correcciones a ojo fallaran. **Adivinar un número dos veces
seguidas es la señal de que falta el instrumento, no la idea.**

**29. Entre los números de línea y la fila hay un tercer margen, y es de otro
plugin.** Medido: `cm-lineNumbers` 30,7px · **`zot-badge-gutter` 29,1px** ·
`tareas-margen` 108,2px. Los 29px de hueco que se veían son el margen de badges
de Anotaciones, que se dibuja también en las notas de tareas. El
`margin-inline-start` negativo de este plugin **sí** se aplica —figura en la
tabla— pero le pelea al vecino equivocado.

No se corrige desde acá: es la interfaz de otro plugin, y esconderla es una
decisión del usuario, no del código. Tampoco se arregla con precedencia: entre
`default` y `high` no hay ningún nivel donde pararse, así que no hay forma de
quedar entre dos márgenes de la misma precedencia.

**30. El `em` de un margen no es el `em` de la línea.** El botón quedaba 2,8px
más arriba que el checkbox, y la causa no era un `padding` que faltara sino una
unidad que se resuelve distinto de cada lado:

| | valor | en la línea | en el margen |
|---|---|---|---|
| `--list-spacing` | `0.075em` | 1,2px | 0,2px |
| `--line-height-normal` | `1.5` (sin unidad) | 24px | 19,2px |

La línea usa `--font-text-size` (16px) y el margen `--font-ui-smaller`, que es
`--font-text-size * 0.8`. Los dos errores sumaban justo los 2,8px medidos.

**La corrección no es un número: es fijar el contexto.** Con la letra de la
línea puesta en la celda del margen, las dos variables valen lo mismo de los dos
lados. Y se puede hacer sin deformar nada porque CodeMirror le pone la altura a
esa celda con `style.height` —leído en `GutterElement.update`—, no con su
contenido.

Es la misma clase de error que el punto 27: **una cosa dibujada en las
coordenadas de otra.** Ahí eran píxeles de posición; acá, unidades relativas.
