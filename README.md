# Tareas (outline)

Plugin de Obsidian para gestión de tareas: un **outliner con vistas
superpuestas**. Las tareas se escriben en notas markdown como se escriben hoy, y
el plugin agrega interfaz encima de esas notas.

El markdown es la fuente de verdad. Si el plugin desaparece, las notas siguen
siendo legibles y editables: los metadatos van en un solo comentario
`%%t:…%%` al final de la línea, que Obsidian ya oculta en modo lectura.

> **Estado: en desarrollo, uso personal.** Está construido el frente principal
> —todo lo que pasa adentro de la nota—. Faltan las tres vistas (Workbenches,
> Buscar, Agenda) y la migración. El detalle está en la §20 de
> [`plugin-tareas-spec.md`](plugin-tareas-spec.md).

## Qué hace hoy

Dentro de las notas de tareas configuradas, y solo ahí:

- **Checkbox automático.** Enter al final de un bullet hace nacer `- [ ] `; un
  Backspace sobre el checkbox lo saca y deja un bullet común.
- **Metadatos invisibles.** El token se oculta en Live Preview y el cursor lo
  cruza de un teclazo. Partir, unir o convertir una tarea lo lleva a donde
  corresponde.
- **Una fila de botones por tarea**, en un margen propio: dos workbenches
  favoritos (★ ◐), todos los workbenches (→), un menú (⋯), eliminar (🗑), y los
  indicadores de fecha (📅) y de recurrencia (🔁).
- **Prioridad** en tres niveles, dibujada con color y con forma.
- **Terminar una tarea**: tildar el checkbox la completa con fecha; Cmd+clic la
  archiva en la nota de historial; eliminar la borra con su subárbol.
- **Fecha de vencimiento y grupos de reinicio.** Un grupo cíclico
  («mensual», «lunes»…) se reinicia desde la paleta de comandos, con la opción
  de archivar antes lo que se completó.

Fuera de la lista de notas no intercepta ni una tecla.

## Instalación y configuración

No está en el registro de complementos de la comunidad. Con
[BRAT](https://github.com/TfTHacker/obsidian42-brat): *Add beta plugin* y pegar
la dirección de este repositorio. A mano: copiar `main.js`, `manifest.json` y
`styles.css` de la última release a `‹vault›/.obsidian/plugins/tareas-outline/`.

**Arranca sin hacer nada**: la lista de notas de tareas y la nota de historial
están vacías por omisión. Se configuran en los ajustes del plugin, una ruta por
línea desde la raíz del vault.

## Desarrollo

```bash
npm install
npm test               # vitest: unitarias y propiedades
npm run typecheck
npm run build
npm run vault:prueba   # arma un vault de prueba adentro del repo y lo abre
npm run deploy:prueba  # despliega ahí y recarga el plugin
```

Las verificaciones en vivo corren con la
[CLI de Obsidian](https://obsidian.md/help/cli) sobre ese vault de prueba:
`node scripts/verificar/paso-6c.mjs`.

El método de trabajo está en [`CLAUDE.md`](CLAUDE.md) y su porqué en
[`NOTAS-DE-METODO.md`](NOTAS-DE-METODO.md). La especificación, con cada
decisión, en [`plugin-tareas-spec.md`](plugin-tareas-spec.md); las mediciones
que las sostienen, en [`informes/`](informes/).
