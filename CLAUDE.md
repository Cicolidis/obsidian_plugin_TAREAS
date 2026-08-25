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
