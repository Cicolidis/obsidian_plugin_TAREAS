# Prompt para la sesión 3 en Claude Code

> Abrir Claude Code en `~/Downloads/claude/obsidian_plugin_TAREAS`, entrar en
> **plan mode** y pegar lo de abajo.

---

Seguimos con el plugin de tareas de Obsidian. La especificación está en
`plugin-tareas-spec.md`, en la raíz. **Leela entera antes de proponer nada** —
la §11 y la §12 se reescribieron en la sesión 2 y las dos dicen por qué. El
método de trabajo está en `CLAUDE.md` y no lo repito acá.

## Dónde estamos

La **capa 1 está cerrada**. Están el parser de las cuatro clases de línea, el
token, los árboles, las primitivas de escritura por rango, el reinicio de las
cíclicas y el archivado al LOG. Son 282 tests en `npm test` y 60 en
`npm run test:corpus`, con los invariantes 2, 3, 6, 7, 8 y 9 escritos como
propiedades con fast-check.

Lo que la sesión 2 dejó decidido y no hace falta volver a discutir. Está en la
spec, en los comentarios del código y en los mensajes de commit; `git log` es
corto y vale leerlo:

- **Solo el wikilink define proyecto o área** (§4.1 al pie de la letra). Hoy eso
  significa **cero proyectos** sobre las siete notas hasta la migración del paso
  8; los 15 headings en texto plano quedan anotados en `Heading.candidatoPlano`,
  que es la lista de trabajo de esa migración.
- **Las cíclicas son una etiqueta y un botón, no un motor.** `rec` es el nombre
  de un grupo de reinicio, de texto libre como `wb`. El plugin no regenera
  instancias ni corre fechas: el usuario aprieta un botón. Era la única forma de
  que la §11 no chocara con la §8.
- **El LOG se organiza por nota de origen**, y por proyecto debajo si lo hay.
  Se lee con `parseLog`, porque va a consumirlo el filtro «archivadas» de la
  pestaña Buscar.
- **`medir-tareas.mjs` está mal en un punto** y el porqué está medido en
  `INFORME-gramaticas.md`: hereda el heading con una bandera que nunca vuelve a
  null.

Hay dos gramáticas del corpus y un tercer instrumento —el parser de headings de
Obsidian— comparándose en `npm run test:corpus`. Ese diferencial se saltea sin
`OBSIDIAN_VAULT`, y el bloque de Obsidian necesita `outline-obsidian.local.json`,
que está ignorado por git y **envejece**: si cambié las notas, ese bloque se
saltea solo y avisa.

**El repositorio es público** y la regla está en `CLAUDE.md`: no entra contenido
real de mis notas, ni siquiera en un mensaje de commit. En la sesión 2 se me
colaron una dirección y el nombre de una persona en un archivo de tests, y hubo
que sacarlos.

## Alcance de esta sesión: el paso 3 de la §20

**Store y capa de escritura.** Nada de decoraciones, botones ni vistas.

El riesgo que este paso tiene que matar no es el que nombra la §8 —«nunca
reescribir el archivo entero» ya está resuelto—. Es que **el store diga que la
tarea está en la línea 42 y para cuando se escriba ya no lo esté**, porque tecleé
arriba.

### Lo que ya verifiqué de la API, para que no lo vuelvas a averiguar

- `vault.process(file, fn)`: `fn` es **síncrona**, ve el contenido de disco en
  el momento de escribir, y `process` devuelve **lo que quedó escrito**. Es el
  lugar natural donde verificar que la línea sigue siendo la esperada.
- `metadataCache.on("changed", (file, data, cache))` **ya trae el contenido**:
  el store no necesita releer nada.
- `changed` **no se dispara al renombrar**. Hacen falta `vault.on("rename")` y
  `vault.on("delete")`.
- Existen `debounce`, `cachedRead`, `getFileByPath` y `registerEvent`.

### Cómo quiero que quede

1. **`src/ubicar.ts`**, lógica pura y con propiedades. Si la línea sugerida ya
   no coincide con lo que el store esperaba, se busca ese texto exacto: si
   aparece **una sola vez** se escribe ahí; si aparece cero o varias veces **no
   se escribe y se avisa**. Nunca adivinar cuál de dos líneas iguales era.
2. **`src/vault/escribir.ts`**, el único lugar que escribe. Toda escritura pasa
   por `CambioDeLinea` —que ya existe en `src/tareas.ts` y ya lleva `antes`— así
   que nada se escribe sin decir qué esperaba encontrar. **O se aplican todos
   los cambios del lote o ninguno.**
3. **`src/store.ts`**, que recibe **un puerto y no `App`**, para que su lógica
   se pruebe offline con un puerto falso. Arranca en `workspace.onLayoutReady`.
   Se alimenta de lo que `process` devuelve, sin esperar al evento.
4. **Dos comandos de paleta y ninguna interfaz**: «completar tarea del cursor» y
   «asignar la tarea del cursor a un workbench». Es el mínimo para probar el
   camino de escritura de punta a punta.

### Antes de escribir código, medir

`scripts/espia-eventos.js` ya está: se pega en la consola de Obsidian y mide
cuándo llega `changed`, si llega también para las escrituras del propio plugin, y
cuánto tarda. **Correlo y decidí el debounce con ese número.**

La §7 dice que reparsear `tareas_COLE` en cada tecla «es perceptible en móvil»,
pero eso no está verificado y mi medición lo contradice: parsear las siete notas
enteras cuesta 0,31 ms. Si el evento ya llega espaciado por Obsidian, un debounce
puesto por las dudas solo agrega latencia entre la acción y el redibujo.

## Dónde puede escribir

Esta es la primera sesión que toca mis notas. **Primero una nota de prueba.**

1. Yo creo `0_inbox/tareas_PRUEBA.md` y la agrego en ajustes. El plugin no la
   crea: no escribe archivos que nadie pidió.
2. Me entregás una lista concreta de qué observar ahí. Entre otras cosas: que
   teclear arriba de la tarea y **después** ejecutar el comando siga escribiendo
   en la línea correcta, que es `ubicarLinea` en vivo.
3. Recién con eso en verde, habilitamos sobre las notas reales.

Vale la regla dura de `CLAUDE.md`: **no escribas vos en el vault**, ni con las
herramientas del MCP de Obsidian, que puede. Lo que ese MCP sí es —un tercer
instrumento de medición, y sus tres reglas— está en `CLAUDE.md`.

## Cómo quiero trabajar

- **Plan primero**, y esperá que lo apruebe.
- **Medí en vez de suponer.** `npm run medir` existe y el vault está en
  `$OBSIDIAN_VAULT`. Y ojo: **la spec también es una medición con fecha**, y
  algunas de sus afirmaciones ya eran falsas. Contá antes de apoyarte en un dato
  suyo.
- **Preguntame cuando la spec no alcance.** En la sesión 2 encontraste tres
  contradicciones adentro de la spec; si aparece otra, decila en vez de elegir
  por tu cuenta. Y si algo que yo decido contradice algo que yo mismo escribí
  antes, decímelo con el número al lado.
- **Cuando una propiedad falle, fijate primero si la propiedad dice la verdad.**
  En la sesión 2 fallaron cuatro veces y tres fueron del test, no del código.
- **Mirá la salida, no solo los tests.** El peor bug del archivado no lo agarró
  ninguno de los 60 tests del corpus: apareció imprimiendo el archivo resultante.
- Español en comentarios, documentación y mensajes de commit.

## Qué espero al final

El camino de escritura verificado de punta a punta sobre `tareas_PRUEBA.md`, el
store reaccionando sin recargar el plugin, `npm test` y `npm run test:corpus` en
verde, y la medición del evento anotada donde corresponda —si contradice a la
§7, que la spec quede corregida como quedaron la §11 y la §12.
