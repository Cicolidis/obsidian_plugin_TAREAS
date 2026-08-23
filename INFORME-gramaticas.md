# Las dos gramáticas: cuál está mal, y por qué

Medido el 23 de agosto de 2026 sobre las siete notas, con `npm run test:corpus`
y `npm run medir`. Todo lo de acá se reproduce con esos dos comandos.

Hasta esta sesión había **dos parseos del corpus sin forma de saber si
divergían**: el del plugin (`src/linea.ts`, `src/documento.ts`) y el de
`scripts/medir-tareas.mjs`. Ahora hay un diferencial que los compara, más un
tercer instrumento independiente —el parser de headings de Obsidian— que
arbitra cuando los dos míos podrían estar equivocados del mismo modo.

> **Los números se mueven.** Entre el principio y el final de esta sesión el
> corpus cambió tres veces: las notas están en uso. Por eso el diferencial
> compara las dos gramáticas **sobre el corpus del momento** y no contra una
> tabla, y por eso ningún test hardcodea los números de la §2.

---

## 1. Coinciden en todo lo que cuenta líneas

Sobre las siete notas, línea por línea, el parser nuevo y `medir-tareas.mjs`
dan el mismo número en: **tareas**, **completadas**, **bullets sin checkbox**,
**notas de tarea** (bullets sin checkbox que cuelgan de una tarea),
**checkboxes vacíos**, **estados de checkbox usados**, **headings por nivel** y
**profundidad máxima del árbol**.

Está en `test/corpus/gramaticas.test.ts`, nota por nota y en total.

La divergencia que yo esperaba —`- [ ]texto`, sin separador después del `]`, que
el script acepta como tarea y el plugin no— **no existe en el corpus**: cero
ocurrencias. Era una diferencia real de gramática sin una sola línea que la
manifestara.

---

## 2. `medir-tareas.mjs` hereda el heading con una bandera, no con una pila

**Está mal el script.**

```js
headingSemanticoVigente = tipo === "proyecto" || tipo === "área" ? tipo : headingSemanticoVigente;
```

Esa variable **nunca vuelve a `null`**. Una vez que apareció un heading de
proyecto, todo lo que sigue en la nota cuenta como «con proyecto», aunque
después venga un heading de sección del mismo nivel o de uno más alto que
claramente lo cierra.

La §4.1 dice que «el nivel solo determina anidamiento y herencia», y la §10
define explícitamente el estado **sin clasificar** para las tareas que están
bajo una sección no semántica. Las dos cosas piden una **pila**: un heading de
nivel N saca de la pila todo lo que tenga nivel ≥ N. Es lo que hace
`contextoPorLinea` en `src/tareas.ts`.

Medido hoy, sobre 395 tareas:

| | sin proyecto |
|---|---|
| con la bandera del script | 135 |
| con la pila de la §4.1 | **137** |

La diferencia son 2 tareas de `tareas_VIDA.md`, donde un heading de proyecto de
nivel 1 es seguido por dos headings de sección del mismo nivel. Hoy son dos; el
error no está acotado por nada más que la forma que tienen las notas en este
momento.

El diferencial lo afirma como diferencia esperada, no lo tolera: hay un test que
comprueba que con la pila quedan **más** tareas sin proyecto que con la bandera.

---

## 3. El script parte los nombres de proyecto en el primer espacio

**Está mal el script**, pero no se arregla, y conviene decir por qué.

```js
const REF_PLANA_RE = /(?:^|[\s⮕→>])([pa]_[^\s|]+)/;
```

`[^\s|]+` corta en el primer espacio. Hay al menos tres headings del corpus
cuyo proyecto tiene un espacio en el nombre, y en uno de ellos el nombre
completo **existe como carpeta** en `10_proyectos/`: el corte produce un nombre
que no es el de nada.

No se corrige porque quedó obsoleto: por decisión de esta sesión, **solo el
wikilink define proyecto o área**, así que el parser nuevo no lee texto plano en
absoluto. Queda anotado porque la migración de la §19.1 —paso 8— va a tener que
resolver este mismo problema para saber qué escribir adentro de los `[[ ]]`, y
la regla del primer espacio no le sirve.

---

## 4. Diferencias que **no** son bugs de ninguno

**a. «Enlace a otra cosa» es sección.** La §4.1 dice «cualquier otra cosa o sin
enlace → sección»; el script las cuenta aparte como `enlace-otro` (3 headings)
para poder informarlas. El parser las pliega adentro de sección, como pide la
spec. El diferencial afirma la relación exacta entre los dos conteos.

**b. Un `---` o una tabla cortan el árbol en el parser y no en el script.** El
script solo corta en los headings. En markdown un salto temático o un párrafo a
columna 0 terminan una lista, así que el parser es el correcto; pero es una
diferencia sin consecuencia medible: sobre el corpus actual los dos dan la misma
profundidad máxima, porque los 36 `---` y las 8 filas de tabla están todos entre
secciones y no adentro de un árbol.

---

## 5. La §2 de la spec está desactualizada

La tabla dice 386 tareas, 29 completadas, `tareas_COLE` con 304, 11 checkboxes
vacíos. Hoy son **395**, **29**, **309** y **13**. No es un error de la medición
original: el corpus se sigue escribiendo.

Consecuencia práctica, ya aplicada: **ningún test hardcodea esos números.** El
diferencial compara las dos gramáticas entre sí, no contra la tabla.

---

## 6. El tercer instrumento: Obsidian

`test/corpus/obsidian.test.ts` compara **nivel, texto y línea** de cada heading
contra `get_note_outline`, que lee del `metadataCache` de Obsidian. Sobre los 52
headings de las siete notas, **coinciden todos**.

Importa porque `medir-tareas.mjs` y `src/linea.ts` los escribí yo mirando el
mismo corpus, así que podrían estar equivocados de la misma manera. Obsidian no.

Obsidian **no expone ítems de lista** por esta vía, así que para las tareas no
hay diferencial por este lado: ahí el arbitraje sigue siendo entre mis dos
gramáticas.

### El instrumento tiene una trampa, y está medida

El volcado se toma con la aplicación abierta y **envejece rápido**: entre
tomarlo y correr el test por primera vez, dos de las siete notas ya habían
cambiado en disco, y la comparación falló por líneas corridas. Obsidian y el
parser coincidían; lo viejo era la foto.

Por eso el volcado guarda el `sha256` de cada nota y las que ya no coinciden
**se saltean diciéndolo**, en vez de fallar como si el parser estuviera mal. Una
alarma falsa que se repite es una alarma que se ignora. El camino de salteo está
probado: se verificó corrompiendo un hash a propósito.

Y por eso mismo el volcado no es una llamada HTTP desde el test: el servidor
pide API key, y un cliente escrito y nunca ejecutado sería un instrumento sin
verificar —el error de la sesión 1—. El volcado se produce por el canal que sí
funciona y se compara acá.

---

## 7. Lo que hoy no reconoce el parser, a propósito

Con la regla «solo wikilink», sobre las siete notas el parser reporta **0
proyectos y 0 áreas**, y las 395 tareas quedan sin proyecto. El script encuentra
15 referencias en texto plano y 3 wikilinks, y ninguno de esos 3 apunta a un
proyecto.

No es un bug: es la decisión, y su costo es exactamente ese. Los 15 headings en
texto plano quedan registrados en `Heading.candidatoPlano` —son la lista de
trabajo de la migración del paso 8— y hay un test que fija ese conteo contra el
del script. **Cuando corra la migración, ese test es el que tiene que cambiar.**

---

## Reproducir

```bash
npm test
npm run test:corpus
npm run medir
```
