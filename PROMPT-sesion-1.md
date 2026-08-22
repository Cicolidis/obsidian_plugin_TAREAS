# Prompt para la sesión 1 en Claude Code

> Abrir Claude Code en `~/Downloads/claude/obsidian_plugin_TAREAS`
> (o donde vaya a vivir el repo), entrar en **plan mode** y pegar lo de abajo.
> Antes: copiar ahí `plugin-tareas-spec.md` y `CLAUDE.md`.

---

Vamos a arrancar un plugin de Obsidian de gestión de tareas. Ya está todo diseñado: la especificación completa está en `plugin-tareas-spec.md`, en la raíz de este repo. **Leela entera antes de proponer nada** — no la resumas para vos, seguila.

## Contexto que necesitás

Este es mi segundo plugin de Obsidian. El primero está en `~/Downloads/claude/obsidian_plugin_anotaciones` y es **material de referencia, no lo modifiques**. Tiene 18.000 líneas de TypeScript, 468 tests y varios módulos que la spec pide portar. Leé de ahí, como mínimo:

- `NOTAS-DE-METODO.md` — **§8 completo, antes de tocar cualquier cosa de CodeMirror.** Son trampas ya pagadas: rangos atómicos, `transactionFilter`, decoraciones que no se anidan, y cómo se comporta Enter con Outliner instalado.
- `src/hiddenTail.ts` — el tramo oculto al final de la línea. La spec §5.5 lo pide casi tal cual.
- `src/outline.ts` — mover subárboles y detectar la unidad de indentación.
- `src/color.ts` y `src/settingsData.ts` — token de color y barra de colores rápidos.
- `package.json`, `esbuild.config.mjs`, `tsconfig.json`, `scripts/humo.mjs` — el andamiaje que quiero replicar.

Mi vault está en `~/Downloads/obsidian/mental palace`. Las notas de tareas son `0_inbox/tareas_{VIDA,COLE,ACADEMIA,MES,CLAUDE,CÍCLICAS,LOG}.md`. **No escribas en el vault en esta sesión.**

## Alcance de esta sesión: dos cosas y nada más

### 1. Andamiaje del repo

Replicá la estructura de Anotaciones: TypeScript estricto, esbuild, vitest, `manifest.json`, y los scripts `test`, `typecheck`, `build`, `dev`, `deploy`, `humo`. El `deploy` tiene que copiar al vault vía la variable `OBSIDIAN_VAULT` con el mismo fallback que usa Anotaciones. Id del plugin: `tareas-outline`.

Copiá también `scripts/medir-tareas.mjs`, que ya está en `scripts/` y ya corrió: sus resultados son la §2 de la spec.

### 2. El prototipo de mayor riesgo: el checkbox automático

Es el paso 1 de la §20 de la spec y **es lo único que puede fallar de un modo que cambie el diseño**, así que va antes que todo lo demás.

Quiero que al apretar Enter dentro de una nota de tareas, la línea nueva nazca ya como `- [ ]`, sin que yo escriba los corchetes.

Lo que ya sabemos y no hay que redescubrir (está en el §8 de las notas de método):

- La continuación de listas de Obsidian **no pasa por el keymap de CodeMirror**. Hay que usar `EditorState.transactionFilter`.
- **La forma de la edición depende de qué plugins haya instalados.** Con Outliner y `betterEnter` —que yo tengo instalado— Enter reemplaza la línea entera; sin él, Obsidian inserta el salto. La regla tiene que funcionar sin mirar la forma de la transacción.
- Un `transactionFilter` **no puede encadenar specs**: todas se resuelven contra el documento original. No se puede reparar mirando el resultado; hay que corregir la entrada.

Restricciones del prototipo:

- Solo actúa en las notas de la lista, nunca en el resto del vault.
- Es descartable. No lo integres con nada. Si la hipótesis falla, se tira.
- Si algo del comportamiento de Obsidian no se entiende, **usá el espía de transacciones** del §1 de las notas de método antes de la tercera hipótesis. Treinta segundos que ahorraron tres intentos fallidos la vez pasada.

## Cómo quiero trabajar

- **Plan primero.** Antes de escribir código, mostrame el plan y esperá que lo apruebe.
- **Lógica pura primero, interfaz después.** Nada que se pueda testear offline debe depender de Obsidian.
- **No decidas por inferencia lo que se puede medir.** Si hay una duda sobre cómo se comporta Obsidian, medila.
- **Preguntame cuando la spec no alcance.** Es larga pero no es completa; si algo no está definido, no lo inventes: preguntá.
- Español en comentarios, mensajes de commit y nombres de archivos de documentación. Código en inglés donde sea convención.

## Qué te voy a pedir al final

Una lista concreta de **qué tengo que verificar yo**, porque el comportamiento del editor no lo podés comprobar vos. Para el prototipo espero al menos: qué pasa con Enter al final de una línea, en el medio de una línea, en una línea vacía, sobre una línea indentada, y qué pasa con Backspace desde la línea de abajo.
