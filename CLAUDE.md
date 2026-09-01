# CLAUDE.md — plugin de tareas para Obsidian

## Qué es esto

Plugin de Obsidian para gestión de tareas. **La especificación completa está en `plugin-tareas-spec.md`** — leerla antes de trabajar. Este archivo dice cómo se trabaja, no qué se construye.

Segundo plugin del proyecto. El primero, **Anotaciones (Zotero + papel)**, está en `~/Downloads/claude/obsidian_plugin_anotaciones` y es **referencia de solo lectura**: 18.000 líneas de TS, 468 tests, y varios módulos que esta spec pide portar (`hiddenTail.ts`, `outline.ts`, `color.ts`, `settingsData.ts`, `editor/annotationDecorations.ts`).

Vault de trabajo: `~/Downloads/obsidian/mental palace`. Notas de tareas: `0_inbox/tareas_*.md`.

---

## Método

Estas reglas salieron de construir Anotaciones. Están desarrolladas en su `NOTAS-DE-METODO.md`; acá va lo que aplica a todo lo que se haga en este repo.

### Verificar contra el sistema real, no razonar sobre documentación

Si hay una duda sobre cómo se comporta Obsidian, medirla. El espía de transacciones, en la consola de Obsidian con el foco en el editor:

```js
const v = app.workspace.activeEditor.editor.cm;
const o = v.dispatch.bind(v);
v.dispatch = (...a) => { console.log(a); return o(...a); };
```

El argumento llega como **spec**, no como `Transaction`: `iterChanges` no existe sobre él.
El espía completo, con las trampas ya resueltas, está en `scripts/espia.js`.

Para los eventos del vault —cuándo llega `metadataCache.on("changed")`, si llega
también para las escrituras del propio plugin, cuánto tarda, y la distancia entre
`modify` y `changed`— está `scripts/espia-eventos.js`, que se pega igual en la
consola.

Para saber **quién movió el cursor** —cuál transacción, con qué `userEvent`, y
si traía una selección explícita— está `scripts/espia-cursor.js`, que se pega
igual en la consola. Sirve para lo que los tests con filtros encadenados no
pueden ver: Outliner interceptando la tecla, y lo que Obsidian despacha detrás.

Para lo que se ve en pantalla y no se puede deducir —cuántos márgenes hay, qué
ancho tiene cada uno, cuánto mide un hueco— está `scripts/espia-margen.js`. Nació
de una cuenta que daba 7 px donde la pantalla mostraba 45: cuando el número
calculado y el visto no coinciden, falta un elemento en el modelo, y eso solo lo
contesta el navegador.

Para leer el CSS o el JS internos de Obsidian en vez de deducirlos, están los scripts de Anotaciones (`extraer-css-de-obsidian.mjs`).

Hay además un **MCP conectado al Obsidian de esta máquina**. Sirve como tercer
instrumento —`get_note_outline` y `get_outgoing_links` dan el parser propio de
Obsidian, que es independiente de los dos míos— con tres reglas:

- **`src/` no lo importa nunca.** El plugin tiene que funcionar con Obsidian
  cerrado. Es para medir y para tests opt-in, no una dependencia.
- **Puede escribir en el vault** (`patch_vault_file`, `search_and_replace`,
  `delete_vault_file`) y no se usa para eso. Vale la regla dura de más abajo.
- **Es otro instrumento y puede mentir.** Lee del `metadataCache`, así que
  necesita la aplicación abierta y puede ir atrasado respecto del disco. Nunca en
  la suite normal.

No expone ítems de lista, así que para las tareas no hay diferencial por ese lado.

### Lógica pura primero, interfaz después

Todo lo que se pueda testear sin Obsidian y sin DOM va en su propio módulo y se verifica offline. La interfaz se apoya en eso, nunca al revés.

**Tres capas, y una prohibición:**

1. Lógica pura — parser, token, árboles, recurrencia, archivado, filtros.
2. Escritura sobre el vault — sin DOM.
3. Vistas — CodeMirror y las pestañas.

> `Platform.isMobile` solo puede aparecer en la capa 3. Nunca en 1 ni en 2.

### Nada que reescriba el documento entero

El criterio no es «¿borra?» sino «¿reescribe el documento entero?». Se escribe **por rango**, con `vault.process()`, nunca `modify()` con el contenido completo. `tareas_COLE.md` tiene más de 300 tareas en un archivo y el vault está en Sync: un conflicto no afecta una tarea, afecta decenas.

**Ninguna escritura de mantenimiento automática.** El plugin no toca un archivo si el usuario no pidió una acción sobre una tarea de ese archivo.

### CodeMirror en Obsidian: lo que ya costó caro

- `display: none` no saca nada del documento. Para que algo no ocupe lugar: `Decoration.replace` + `atomicRanges`.
- Un rango atómico al final de línea tiene que incluir el salto de línea, o hay que apretar la flecha dos veces.
- **Un rango atómico no se borra de a un carácter: se borra entero.** Ante cualquiera, preguntarse qué pasa cuando alguien borra hacia atrás desde el otro lado. Tres bugs de la fase 2 de Anotaciones salieron de ahí.
- **Dos `Decoration.replace` no se pueden anidar.** CodeMirror tira excepción y se cae *todo* el conjunto en la nota entera. Por eso los metadatos van en un solo token.
- La continuación de listas de Obsidian no pasa por el keymap. Lo que ve todo cambio es `EditorState.transactionFilter`.
- Un `transactionFilter` no puede encadenar specs: se resuelven contra el documento original. Hay que corregir la entrada, no el resultado.
- **La forma de una edición depende de qué plugins haya instalados.** Con Outliner (instalado acá) Enter reemplaza la línea entera; sin él inserta el salto. Escribir reglas que **no miren la forma**.
- **Varios `transactionFilter` sí se encadenan, y corren de menor a mayor precedencia.** Cada uno recibe la transacción del anterior, resuelta contra el mismo `startState`. `Prec.low` corre **primero**. El orden entre dos filtros que tocan el mismo gesto es una decisión de diseño, no un detalle de registro: fijala con un test.
- **Rangos superpuestos no tiran excepción: se fusionan.** `[0,5)→X` y `[3,7)→Y` sobre `abcdefghij` da `XYhij`. Un filtro que agranda el rango que reescribe puede comerse en silencio la edición de otro cursor, y eso es peor que un error visible.
- **Las decoraciones tienen que ir en un `StateField`, no en un `ViewPlugin`.** El mapa de alturas hace `filter(d => typeof d != "function")` y descarta las que aporta un `ViewPlugin`. El síntoma no se ve en pantalla: se ve en el ciclo de medición, meses después.
- **Un cambio externo llega al editor como un diff con `userEvent: "set"`.** Obsidian no reemplaza el documento cuando el archivo cambia en disco: recorta prefijo y sufijo comunes y despacha el resto. Eso incluye **lo que el propio plugin acaba de escribir**. Un filtro que no lo descarte va a confundir su propia escritura con una edición del usuario.
- **`atomicRanges` también decide dónde cae un clic**, con `bias 0`: `pos - from < to - pos`. Un rango que llega hasta el salto de línea manda al renglón de abajo cualquier clic en el vacío de la derecha. Es el precio de que la flecha cruce de un teclazo, y se paga en el clic, no en el rango.
- **La regla del `StateField` tiene un límite exacto, y hay que leerlo.** El mapa
  de alturas descarta las decoraciones que llegan como función, sí — pero
  `point(from,to,deco)` solo hace algo `if (from < to || deco.heightRelevant)`, y
  `heightRelevant` es `this.block || widget.estimatedHeight >= 5 ||
  widget.lineBreaks > 0`. **Un widget inline de ancho cero sin altura declarada no
  entra al mapa venga de donde venga**, así que para *eso* un `ViewPlugin` sobre
  el viewport es lo correcto. Y deja una trampa: el día que alguien le declare
  altura, vuelve a importar y desde un `ViewPlugin` se descarta. Escribir el test
  que falla ese día.
- **La posición de un widget no se guarda: se le pide a CodeMirror**
  (`view.posAtDOM`). Para un widget de longitud cero y sin hijos, todos los
  caminos de `localPosFromDOM` devuelven 0, así que el resultado es exactamente su
  `posAtStart`. Y eso no es solo prolijidad con el invariante 10: es lo que
  permite que `eq()` **no** lleve el número de línea, que si lo llevara reharía el
  DOM de todas las filas de abajo en cada tecla.
- **Obsidian se actualiza solo y el `.asar` del instalador no es el que corre.** El que vale está en `~/Library/Application Support/obsidian/obsidian-N.asar`. Leer el de `/Applications` es medir otra versión y creerle.

### Medir antes de diseñar, y antes de optimizar

El corpus se midió con `scripts/medir-tareas.mjs` y los resultados están en la §2 de la spec. Si aparece una decisión que depende de cómo son las notas, medirla en vez de suponerla. La medición dimensiona, no vetea.

**La spec también es una medición, y tiene fecha.** Sus afirmaciones fácticas
envejecen y algunas ya eran falsas: la §2 decía 386 tareas y hoy son 395; la §12
justificaba el formato `[✓ fecha]` diciendo que el LOG «ya lo usa», y ninguno de
sus 37 bullets tiene fecha; la §7 daba por perceptible un costo de parseo que
medido es de 0,31 ms para las siete notas. Antes de apoyar una decisión en un
dato de la spec, contarlo. Y **ningún test hardcodea los números de la §2**: el
corpus se sigue escribiendo.

**Una foto del vault envejece rápido.** Medido: dos de las siete notas cambiaron
en disco en las horas entre tomar el volcado de headings de Obsidian y correr el
test. Todo instrumento que guarde una foto tiene que **detectar que quedó vieja y
saltearse diciéndolo**, no fallar como si el código estuviera mal. Una alarma
falsa que se repite es una alarma que se ignora.

### Una reproducción tiene que copiar la forma del sistema

En la sesión 5 el cursor saltaba al comienzo de la línea al asignar un workbench.
Se montó offline el camino entero —plan, diff, transacción con
`userEvent: "set"`— y **no se reprodujo**, así que se descartó la escritura como
causa. Estaba mal: la reproducción usaba un diff **mínimo**, carácter a carácter,
y el de Obsidian arranca en el comienzo de la línea. `ChangeSet.mapPos` de una
posición adentro de un rango reemplazado devuelve el comienzo del rango, y ahí
estaba todo.

Una reproducción que elige la forma «razonable» de un cambio en vez de la que el
sistema produce de verdad no refuta nada: mide otra cosa. Cuando no se pueda
saber la forma, el instrumento en vivo lo dice —el espía la mostró en dos
líneas— y eso vale más que una hora de razonar sobre el diff que uno habría
escrito.

### Una hipótesis que no falla su test se revierte

En la sesión 5 el cursor quedaba mal después de unir dos tareas y la explicación
parecía obvia: un `transactionFilter` que devuelve un `TransactionSpec` reemplaza
la transacción entera, así que `protegerTramo` estaría pisando la selección que
puso `unirLimpio`. Se escribió el arreglo y **después** el test que tenía que
exponerlo. Pasó con el arreglo y **también sin él**: con las cinco formas de
unión, con token y sin token, el cursor cae siempre en la costura, y
`protegerTramo` no deja ningún camino con `cursor: null`.

El arreglo se revirtió. Un cambio sin un test que lo justifique es un cambio de
comportamiento apoyado en un razonamiento, que es exactamente de donde salieron
los tres bugs de ese módulo. Los tests quedaron, como **caracterización**: fijan
dónde cae el cursor hoy. Y para lo que no se puede reproducir offline —Outliner
interceptando la tecla— la respuesta es un instrumento, no una corrección a
ciegas.

### Un test que expone el bug antes de arreglarlo

Y las propiedades encuentran lo que los casos no. Los invariantes de la §18 de la spec son propiedades, no casos: escribirlos así.

**Cuando una propiedad falla, la primera pregunta es si la propiedad dice la
verdad.** En la sesión 2 fallaron cuatro veces y **tres fueron del generador o de
la propiedad**, no del código: un patch mal tipado que ninguna llamada real puede
producir, un conteo que no contemplaba un camino repetido dos veces, y una
propiedad que exigía `ok` donde lo correcto era `sin-token`. Esa última importa:
afirmaba algo **más fuerte que la verdad**, y eso habría tapado una regresión
real en el caso vacío.

**Una propiedad que falla de forma intermitente hay que cazarla, no encogerse de
hombros.** Pasó cinco corridas seguidas y fallaba una de cada tantas; apareció
con `{ numRuns: 20000 }` en un archivo temporal, y el contraejemplo era de cuatro
caracteres.

### Mirar la salida, no solo los tests

Los tests comprueban lo que se te ocurrió. El bug de que las secciones nuevas del
LOG se insertaban **arriba de todo**, por encima de los headings que ya estaban,
no lo agarró ninguno de los 60 tests del corpus: apareció imprimiendo la
estructura del archivo resultante y mirándola. Cuando algo genera texto para que
lo lea una persona, generarlo una vez y leerlo.

Eso vale también para el **DOM** y para los **instrumentos**. En la sesión 5 la
misma práctica encontró dos cosas que ningún test iba a agarrar:

- Sobre una tarea con el token roto, los cuatro botones de la fila prometían
  «Mandar a foco» y clickearlos no hacía nada. Un control que miente es peor que
  uno apagado, y ninguna aserción lo miraba.
- La primera versión del test de costo informaba 0,711 ms para la primera nota y
  0,02 para las siguientes. No era una nota cara: era el JIT, y con dos ventanas
  «la mediana» eran dos muestras. **El test pasaba** —el techo era 16 ms— y el
  número que informaba no era el que decía medir. Todo instrumento que promedie
  necesita una pasada de calentamiento que se descarte y suficientes muestras
  para que la mediana signifique algo.

Sin entorno DOM instalado, mirar lo que construye un `toDOM` cuesta un
`document` mínimo instrumentado en el scratchpad y un `esbuild --bundle`. Es más
barato que agregar una dependencia, y alcanza para leer estructura, clases y
atributos, que es donde estaba el bug.

**Y lo que no se puede mirar, hay que hacerlo fallar en el pipeline.** Una
cascada de CSS no se resuelve sin un navegador: en la sesión 5, al pasar la fila
de botones a un margen, quedó en pie un `opacity: 0` sobre `.tareas-fila` sin
decir **cuál** de las dos formas —el widget vive adentro de `.cm-line`, el
marcador del margen afuera— y en el margen no había nada que la volviera a
encender. Ningún test lo agarró y yo no lo podía ver. Lo que sí se puede es
escribir la regla que la prohíbe: `humo.mjs` se niega a desplegar un
`styles.css` donde un bloque toque `opacity` o `pointer-events` sobre
`.tareas-fila` sin nombrar `.cm-line` o `.cm-gutter`. Cuando el ojo no llega, la
alternativa no es mirar más fuerte: es convertir la regla en algo que el
pipeline pueda comprobar.

Y hay que leer la salida **de los instrumentos**, no solo la del código. En la
sesión 5 el espía del cursor imprimía el token como `%t:id=…%`: la consola de
Chrome —que es la de Obsidian— trata el primer argumento de `console.log` como
cadena de formato aunque sea el único, y ahí `%%` es el escape de un `%`
literal. El instrumento mentía sobre lo único que este plugin escribe. **Node no
lo reproduce**, así que probarlo en la terminal no sirve de nada: con un solo
argumento devuelve la cadena tal cual. Todo `console.log` de un espía va como
`console.log("%s", texto)`.

### Lo que solo puede verificar el usuario

El comportamiento del editor —cursor, selección, teclado, cómo se ve algo— no se puede comprobar desde acá. Al terminar un cambio que lo toque, entregar una **lista concreta de qué observar**, no un «probalo a ver».

Un cambio de diseño se prueba **encendiéndolo**, no reemplazando el anterior. Ver `designFlags.ts` de Anotaciones.

---

## Comandos

```bash
npm test                # vitest: unitarias y propiedades, sin vault
npm run test:corpus     # diferencial contra las siete notas reales (opt-in)
npm run typecheck
npm run build
npm run deploy          # compila, copia al vault y corre la prueba de humo
npm run humo            # prueba de humo del bundle
npm run medir           # node scripts/medir-tareas.mjs "$OBSIDIAN_VAULT"
```

`npm run test:corpus` se saltea sin `OBSIDIAN_VAULT`. El bloque que compara
contra el parser de Obsidian necesita además `outline-obsidian.local.json`
—ignorado por git, porque lleva los títulos reales de las notas— y se saltea
solo si falta o si quedó viejo. Ver `INFORME-gramaticas.md`.

`OBSIDIAN_VAULT` por defecto es `$HOME/Downloads/obsidian/mental palace`.

---

## Convenciones

- Español en comentarios, documentación, mensajes de commit y nombres de archivos `.md`. Código en inglés donde es convención del lenguaje.
- Los comentarios explican **por qué**, no qué. El qué se lee en el código.
- Los textos de interfaz van todos juntos en `strings.ts` desde el principio, aunque no haya mecanismo de idioma todavía.
- `FORMAT_VERSION` desde el primer commit que escriba en las notas.
- Una lista de valores hardcodeada en varios archivos va a divergir: un solo lugar.

## Reglas duras

- **No modificar `obsidian_plugin_anotaciones`.** Es referencia.
- **El repositorio es público.** No entra contenido real de las notas: ni textos de tarea, ni nombres de proyecto, ni títulos de heading, ni en el código, ni en los tests, ni en los mensajes de commit. Las fixtures son inventadas y reproducen las **formas** de la §2; las notas de verdad se comparan solo en `npm run test:corpus`, que no está en el repositorio y no puede estarlo.
- **No escribir en el vault** salvo que el paso lo pida explícitamente y esté aprobado.
- Nada que borre o pise corre sin mirar primero.
- Si la spec no cubre algo, **preguntar**. No inventar comportamiento.
