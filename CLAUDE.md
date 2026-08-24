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

### Lógica pura primero, interfaz después

Todo lo que se pueda testear sin Obsidian y sin DOM va en su propio módulo y se verifica offline. La interfaz se apoya en eso, nunca al revés.

**Tres capas, y una prohibición:**

1. Lógica pura — parser, token, árboles, recurrencia, archivado, filtros.
2. Escritura sobre el vault — sin DOM.
3. Vistas — CodeMirror y las pestañas.

> `Platform.isMobile` solo puede aparecer en la capa 3. Nunca en 1 ni en 2.

### Nada que reescriba el documento entero

El criterio no es «¿borra?» sino «¿reescribe el documento entero?». Se escribe **por rango**, con `vault.process()`, nunca `modify()` con el contenido completo. `tareas_COLE.md` tiene 304 tareas en un archivo y el vault está en Sync: un conflicto no afecta una tarea, afecta decenas.

**Ninguna escritura de mantenimiento automática.** El plugin no toca un archivo si el usuario no pidió una acción sobre una tarea de ese archivo.

### CodeMirror en Obsidian: lo que ya costó caro

- `display: none` no saca nada del documento. Para que algo no ocupe lugar: `Decoration.replace` + `atomicRanges`.
- Un rango atómico al final de línea tiene que incluir el salto de línea, o hay que apretar la flecha dos veces.
- **Un rango atómico no se borra de a un carácter: se borra entero.** Ante cualquiera, preguntarse qué pasa cuando alguien borra hacia atrás desde el otro lado. Tres bugs de la fase 2 de Anotaciones salieron de ahí.
- **Dos `Decoration.replace` no se pueden anidar.** CodeMirror tira excepción y se cae *todo* el conjunto en la nota entera. Por eso los metadatos van en un solo token.
- La continuación de listas de Obsidian no pasa por el keymap. Lo que ve todo cambio es `EditorState.transactionFilter`.
- Un `transactionFilter` no puede encadenar specs: se resuelven contra el documento original. Hay que corregir la entrada, no el resultado.
- **La forma de una edición depende de qué plugins haya instalados.** Con Outliner (instalado acá) Enter reemplaza la línea entera; sin él inserta el salto. Escribir reglas que **no miren la forma**.

### Medir antes de diseñar, y antes de optimizar

El corpus se midió con `scripts/medir-tareas.mjs` y los resultados están en la §2 de la spec. Si aparece una decisión que depende de cómo son las notas, medirla en vez de suponerla. La medición dimensiona, no vetea.

### Un test que expone el bug antes de arreglarlo

Y las propiedades encuentran lo que los casos no. Los invariantes de la §18 de la spec son propiedades, no casos: escribirlos así.

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
- **No escribir en el vault** salvo que el paso lo pida explícitamente y esté aprobado.
- Nada que borre o pise corre sin mirar primero.
- Si la spec no cubre algo, **preguntar**. No inventar comportamiento.
