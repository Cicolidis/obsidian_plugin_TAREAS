# Tareas (outline)

Plugin de Obsidian para gestión de tareas: un **outliner con vistas
superpuestas**. Las tareas se escriben en notas markdown como se escriben hoy, y
el plugin agrega interfaz encima de esas notas.

El markdown es la fuente de verdad. Si el plugin desaparece, las notas siguen
siendo legibles y editables.

> **Estado: prototipo.** Hoy hace una sola cosa —el checkbox automático— porque
> es lo único que podía fallar de un modo que cambiara el diseño. El resto está
> especificado en [`plugin-tareas-spec.md`](plugin-tareas-spec.md) y todavía no
> construido. No hay token, ni store, ni vistas.

## Qué hace hoy

Dentro de las notas de tareas configuradas, y solo ahí:

| Gesto | Antes | Ahora |
|---|---|---|
| Enter al final de `- 1A` | nace `- ` | nace `- [ ] ` |
| Backspace sobre una `- [ ] ` vacía | se une con la línea de arriba | queda `- ` |

La segunda es la inversa de la primera: es cómo se escribe un bullet sin
checkbox cuando el default pasó a ser la tarea.

Fuera de la lista de notas —que se configura en los ajustes del plugin— no
intercepta ni una tecla. Y hay un interruptor para apagarlo entero.

## Instalación

No está en el registro de complementos de la comunidad, así que no aparece en el
buscador de Obsidian. Con [BRAT](https://github.com/TfTHacker/obsidian42-brat):
*Add beta plugin* y pegar la dirección de este repositorio.

A mano, copiando `main.js`, `manifest.json` y `styles.css` de la última release
a `‹vault›/.obsidian/plugins/tareas-outline/`.

## Desarrollo

```bash
npm install
npm test          # vitest
npm run typecheck
npm run build
npm run deploy    # compila, copia al vault y corre la prueba de humo
npm run medir     # mide el corpus de notas de tareas
```

`OBSIDIAN_VAULT` apunta al vault; si no está, usa
`$HOME/Downloads/obsidian/mental palace`.

El método de trabajo está en [`CLAUDE.md`](CLAUDE.md), y la especificación
completa —con el porqué de cada decisión— en
[`plugin-tareas-spec.md`](plugin-tareas-spec.md).
