# CLAUDE.md — plugin de tareas para Obsidian

## Qué es esto

Plugin de Obsidian para gestión de tareas. **La especificación está en `plugin-tareas-spec.md`** — leerla antes de trabajar. Es la parte normativa: qué es el plugin y qué quedó decidido. Las bitácoras de las secciones que más crecieron (§5.5 y §13.0) están en `informes/`, y se leen cuando se toca esa sección. Este archivo dice cómo se trabaja, no qué se construye; **el porqué de cada regla** —con la sesión y el bug que la produjo— está en `NOTAS-DE-METODO.md`.

Segundo plugin del proyecto. El primero, **Anotaciones (Zotero + papel)**, está en `~/Downloads/claude/obsidian_plugin_anotaciones` y es **referencia de solo lectura**: 18.000 líneas de TS, 468 tests, y varios módulos que esta spec pide portar (`hiddenTail.ts`, `outline.ts`, `color.ts`, `settingsData.ts`, `editor/annotationDecorations.ts`).

Vault de trabajo: `~/Downloads/obsidian/mental palace`. Notas de tareas: `0_inbox/tareas_*.md`. **Vault de prueba**: `tareas-vault-prueba/`, adentro del repo (ver «Verificar en vivo»).

Los traspasos entre sesiones (`PROMPT-sesion-N.md`), las guías de verificación (`VERIFICAR-*.md`) y sus resultados están en `sesiones/`.

---

## Método

Una línea por regla. La historia de cada una está en `NOTAS-DE-METODO.md`.

### Las reglas

- **Verificar contra el sistema real, no razonar sobre documentación.** Si hay una duda sobre cómo se comporta Obsidian, medirla.
- **Medir antes de diseñar, y antes de optimizar.** La medición dimensiona, no vetea.
- **La spec también es una medición, y tiene fecha.** Antes de apoyar una decisión en un dato de la spec, contarlo. Ningún test hardcodea los números de la §2.
- **Una foto del vault envejece.** Todo instrumento que guarde una foto detecta que quedó vieja y se saltea diciéndolo.
- **Una reproducción tiene que copiar la forma del sistema**, no una forma razonable. Cuando no se sabe la forma, la dice el instrumento en vivo.
- **Una hipótesis que no falla su test se revierte.** El test queda como caracterización.
- **Un test que expone el bug antes de arreglarlo.** Los invariantes de la §18 son propiedades, no casos.
- **Cuando una propiedad falla, la primera pregunta es si la propiedad dice la verdad.** Una que falla de forma intermitente se caza (`{ numRuns: 20000 }`), no se ignora.
- **Mirar la salida, no solo los tests**: el texto que se genera, el DOM que se construye, lo que imprime un instrumento.
- **Lo que no se puede mirar, hacerlo fallar en el pipeline** (`humo.mjs`).
- **Un instrumento miente antes que el código.** Sospechar del cero. Antes de creerle a un resultado sorprendente, correrlo con el cambio revertido. Un instrumento con reloj propio miente sin avisar. Todo `console.log` de un espía va como `console.log("%s", texto)`.
- **Una comprobación que en dos vueltas no produce un número** no se pide otra vez: se pregunta si se puede medir.
- **Una unidad relativa vale distinto en cada contexto.** La corrección no es un número: es fijar el contexto.
- **Un cambio de diseño se prueba encendiéndolo**, no reemplazando el anterior (patrón `designFlags.ts` de Anotaciones). Y **cuando el usuario elige, la alternativa que perdió se borra**: si no, los ajustes crecen sin techo.

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

### Los instrumentos

| Qué | Para qué |
|---|---|
| `scripts/espia.js` | Las transacciones del editor. El argumento llega como **spec**, no como `Transaction` |
| `scripts/espia-eventos.js` | Los eventos del vault: cuándo llega `changed`, si llega para las escrituras propias, cuánto tarda |
| `scripts/espia-cursor.js` | **Quién movió el cursor**: qué transacción, con qué `userEvent`, con selección explícita o no |
| `scripts/espia-margen.js` | Lo que se ve y no se deduce: cuántos márgenes hay, qué ancho tiene cada uno |
| `scripts/espia-medicion.js` | El ciclo de medición de CodeMirror (§5.5): cuenta, scrollea solo y demuestra que el parche está puesto |
| `scripts/extraer-css-de-obsidian.mjs` | Leer el CSS o el JS internos de Obsidian en vez de deducirlos |
| La CLI de Obsidian, por `scripts/obs.mjs` | Todo lo anterior sin pegar nada en una consola, y las verificaciones en vivo. Ver abajo |

Los espías se pueden seguir pegando en la consola, y también se cargan desde la CLI: `node scripts/obs.mjs eval-archivo scripts/espia-medicion.js`.

Hay además un **MCP conectado al Obsidian de esta máquina** (`get_note_outline`, `get_outgoing_links`: el parser propio de Obsidian). Tres reglas: `src/` no lo importa nunca; puede escribir en el vault y no se usa para eso; lee del `metadataCache`, así que puede ir atrasado y nunca va en la suite normal.

---

## Verificar en vivo: la CLI de Obsidian

Desde la sesión 9, **Claude Code verifica el comportamiento del plugin en un Obsidian real**, con la CLI de Obsidian (1.12 o posterior: Ajustes → General → «Command line interface»). Antes lo hacía el usuario a mano: 216 comprobaciones pedidas entre las sesiones 6 y 8.

```bash
npm run vault:prueba     # arma el vault de prueba y lo abre en una ventana propia
npm run deploy:prueba    # compila, prueba de humo, copia y recarga el plugin ahí
node scripts/verificar/paso-6c.mjs [A B …]   # una verificación, por secciones
node scripts/verificar/colores.mjs [#hex …]   # contraste de la prioridad en los dos temas, con capturas
```

- **El vault de prueba es `tareas-vault-prueba/`**, adentro del repo y fuera de git. Se arma desde `test/vault-semilla/` —inventada, porque el repo es público— con Outliner copiado del vault real, porque la forma de una edición depende de él. `node scripts/vault-prueba.mjs notas` lo restaura.
- **Todo pasa por `scripts/obs.mjs`**, que fija `vault=tareas-vault-prueba` y se niega a recibir otro. `obsidian eval` puede escribir en cualquier vault abierto, y el real está en Sync. Nunca `obsidian` a secas.
- **Cada guía `VERIFICAR-*.md` tiene su script** en `scripts/verificar/`, con los mismos identificadores. El informe va a `sesiones/RESULTADOS-sesion-N-cli.md` y arranca con el commit y el `main.js` sobre el que corrió.
- **Cada comprobación informa lo que midió**, no solo «ok». Y antes de darla por buena, se comprueba que **distingue**: que el mismo instrumento ve el estado contrario, o que falla con el cambio revertido.
- **Teclas y clics reales, por el protocolo de Chrome** (`tecla`, `clicEn` en `scripts/verificar/lib.mjs`). Un `KeyboardEvent` sintético no escribe nada en el editor.
- **El gesto se reproduce con la forma que tiene de verdad.** En Live Preview el comienzo de una tarea es la columna 6, después del checkbox; la primera versión de G3 usaba la 0 y fallaba sin que nada estuviera roto.

**Trampas que ya costaron** (sesión 9 y el `docs/spikes.md` de COMENTARIOS INLINE):

- Con la ventana tapada, Chromium la cuenta como oculta y frena sus timers hasta colgar un `eval` minutos enteros. `lib.mjs` la trae al frente sin quitar el foco (`showInactive()` + `moveTop()`) **antes de cada tecla o clic real** —una vez al empezar no alcanza si el usuario está usando la Mac—, y falla diciéndolo si igual queda tapada. Los recorridos largos los da Node, un paso por `eval`. Apagar el freno con `setBackgroundThrottling(false)` se probó y fue peor: los eventos de `dev:cdp` quedaron esperando un cuadro. `obs.mjs` corta a los 150 s.
- Una ventana a pantalla completa ignora `setSize`: la primera cuenta del ciclo de medición salió con el editor en 1561 px. Salir de pantalla completa congela la ventana unos segundos.
- En Obsidian 1.13 el botón de cerrar un modal ya no es `.modal-close-button`: se cierra con un clic en `.modal-bg`. Un modal viejo abajo hace que la comprobación siguiente lea el equivocado.
- Restaurar el disco con una nota abierta no restaura nada: el editor guarda su buffer encima. `reiniciarVault()` cierra los editores primero.
- `dev:screenshot` devuelve el cuadro anterior: sacar dos. La ventana de ajustes es otra ventana y no sale en la captura.
- Después de `plugin:reload`, lo ya dibujado conserva el código viejo: volver a abrir la nota.
- Si se corta una corrida a mitad de camino, el depurador de `dev:debug` queda puesto y, si fue a mitad de un clic, **el botón queda apretado** del lado de Chromium: el próximo `mousePressed` se cuelga. `lib.mjs` suelta el botón al empezar; a mano, `node scripts/obs.mjs dev:debug off`.

**Lo que sigue siendo del usuario**: cómo se ve algo y si convence; elegir entre alternativas; el teléfono (`dev:mobile` emula la pantalla, no el teclado por composición); Sync entre dispositivos; y el uso real, que es de donde salieron los pedidos de las sesiones 6 a 8. Las guías se parten en dos: **lo que ya corrió Claude Code, con su resultado**, y **lo que queda a mano**.

**Un resultado de verificación vale sobre un binario, no en abstracto.** Toda guía empieza diciendo sobre qué corrió —commit y `mtime` del `main.js`—, y si se commitea mientras la verificación está en curso, se dice qué caducó. Las guías prometen un número de comprobaciones que `humo.mjs` cuenta.

---

## Comandos

```bash
npm test                # vitest: unitarias y propiedades, sin vault
npm run test:corpus     # diferencial contra las notas reales (opt-in)
npm run typecheck
npm run build
npm run deploy          # compila, copia al vault real y corre la prueba de humo
npm run humo            # prueba de humo del bundle
npm run medir           # node scripts/medir-tareas.mjs "$OBSIDIAN_VAULT"
npm run vault:prueba    # arma y abre el vault de prueba
npm run deploy:prueba   # despliega en el vault de prueba y recarga el plugin
```

`npm run test:corpus` y `npm run medir` leen la lista de notas de `notas-de-tareas.json`, que es **local y está fuera de git**: lleva las rutas del vault real. La forma está en `notas-de-tareas.ejemplo.json`. Sin ese archivo o sin `OBSIDIAN_VAULT`, el diferencial se saltea diciéndolo. El bloque que compara contra el parser de Obsidian necesita además `outline-obsidian.local.json` y se saltea solo si falta o si quedó viejo. Ver `informes/INFORME-gramaticas.md`.

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
- **No escribir en el vault real** salvo que el paso lo pida explícitamente y esté aprobado. El de prueba está para eso, y se habla con él **solo** por `scripts/obs.mjs`.
- Nada que borre o pise corre sin mirar primero.
- Si la spec no cubre algo, **preguntar**. No inventar comportamiento.
