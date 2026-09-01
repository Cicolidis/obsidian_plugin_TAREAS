# Plugin de tareas — especificación

Estado: 22 de agosto de 2026. Documento de entrada para la implementación en Claude Code.

Dice **qué** es el plugin y **por qué** cada decisión es la que es. El orden de trabajo va al final.

Referencia constante: el plugin **Anotaciones (Zotero + papel)** (`anotaciones-outline`) resolvió varios de estos problemas y su código es reutilizable. Cada vez que aparece «(Anot. §X)» hay algo concreto que portar o una trampa ya documentada en su `NOTAS-DE-METODO.md`.

---

## 1. Qué es, en una frase

Un **outliner de tareas con vistas superpuestas**: las tareas se escriben en notas markdown como se escriben hoy, y el plugin agrega interfaz encima de esas notas más tres vistas que filtran sin duplicar nada.

### Lo que no es

- No es un gestor con una nota por tarea. Eso atomiza el outline y es lo que expulsó al usuario de BeautyTasks y TaskNotes.
- No es una base de datos. El markdown es la fuente de verdad; si el plugin desaparece, las notas siguen siendo legibles y editables.
- No es un calendario ni un sistema de recordatorios. Los turnos, clases y compromisos van a un plugin aparte (ver §16).

### El principio que ordena todo

> La clasificación de una tarea surge de **dónde está escrita**, no de lo que el usuario cliqueó. Todo metadato que no se deduce de la ubicación se escribe con un botón, nunca a mano, y no se ve.

---

## 2. El corpus real, medido

Medido el 22/08/2026 con `scripts/medir-tareas.mjs` sobre las siete notas. Los números no son decorativos: cada decisión de más abajo apunta a uno.

| | |
|---|---|
| Tareas totales | **386** |
| Distribución | `tareas_COLE` tiene 304 (79%) |
| Completadas | **29 (7,5%)** — y solo 3 en COLE |
| Bullets sin checkbox | 194 (32,8% de los bullets); **34** cuelgan de una tarea |
| Checkboxes vacíos (separadores) | 11 |
| Texto libre | 39 líneas · tablas 8 · imágenes 2 |
| Estados de checkbox usados | solo `[ ]` (368) y `[x]` (29) |
| Profundidad de tarea | p50 **2** · p90 **4** · máx **6** |
| Subárbol de tarea raíz | p50 **2** · p90 **12** · máx **76** líneas |
| Headings por nivel | H1 12 · H2 21 · H3 7 · H4 12 |
| Headings por tipo | proyecto 14 · área **1** · otro enlace 3 · sección 34 |
| Referencias a proyecto | 3 con wikilink, **15 en texto plano** |
| Tareas sin heading semántico | **134 (35%)** |
| Indentación | **tabs en las siete notas**, ninguna mezcla |
| Fechas escritas en prosa | 25 |

**Notas que casi no tienen tareas:** `tareas_LOG` (0 tareas / 37 bullets), `tareas_CÍCLICAS` (0 / 16), `tareas_CLAUDE` (5 / 54).

---

## 3. Decisiones cerradas

| # | Decisión | Por qué |
|---|---|---|
| D1 | Markdown fuente de verdad + índice en memoria | Sobrevive al plugin, a Sync y a Git; permite editar la tarea donde nació |
| D2 | El plugin lee una **lista explícita de notas**, no el vault | 2.394 notas serían inaceptables, sobre todo en móvil |
| D3 | La unidad es el **bloque**, no la línea | 32,8% de los bullets no son tareas |
| D4 | Un **único token oculto** al final de la línea | Dos `Decoration.replace` no se pueden anidar (Anot. §8) |
| D5 | Se abandona la sintaxis de emojis de Tasks | Es visible por diseño; el usuario quiere invisibilidad en Live Preview |
| D6 | El tipo de heading lo da el **prefijo del enlace** (`p_`/`a_`), no el nivel | H1 y H4 aparecen como proyecto y como sección: el nivel no distingue nada |
| D7 | Solo `[ ]` y `[x]` | No hay un solo `[/]` ni `[-]` en el corpus |
| D8 | **Áreas fuera de la v1** | Un solo heading de área en 386 tareas |
| D9 | Workbenches con semántica «lo que yo puse ahí», sin rollover | Pedido explícito |
| D10 | No borrar líneas al completar | Destructivo e irreversible desde la UI |
| D11 | No construir mosaico de paneles propio | Obsidian ya lo tiene; `openPopoutLeaf` para el layout |
| D12 | Prioridad como número, dibujada como color | Ordenar necesita ordinal; la paleta debe poder cambiar |
| D13 | Móvil = capturar + mirar workbench | Ver §15 |

---

## 4. Gramática del markdown

Dentro de una nota de tareas hay **exactamente cuatro** clases de línea.

### 4.1 Heading

```
## sección libre                        → agrupador, sin efecto semántico
### [[p_6_Sheets]]                      → proyecto
## [[a_Reuniones semanales]]            → área (reconocida, sin vista en v1)
```

- El **tipo** sale del prefijo del destino del enlace: `p_` proyecto, `a_` área, cualquier otra cosa o sin enlace → sección.
- El **nivel** solo determina anidamiento y herencia: un heading de proyecto bajo uno de área hereda el área.
- **Se usa wikilink, no texto plano.** Si el proyecto se renombra, Obsidian actualiza el enlace y el plugin lo sigue; con texto plano la desconexión es silenciosa.
- **Un enlace no resuelto es válido.** Un proyecto cuyos archivos están en Finder y todavía no tiene nota se escribe igual; el enlace en otro color significa «existe, su nota no».

### 4.2 Tarea

```
- [ ] texto de la tarea %%t:…%%
```

Estados: `[ ]` pendiente, `[x]` completada. Nada más.

### 4.3 Nota de tarea

Un bullet **sin** checkbox que cuelga de una tarea. Se muestra colapsado con la tarea y **se preserva verbatim en toda reescritura**. Es donde viven los instructivos, los datos de pago y las listas de referencia de `tareas_MES`.

### 4.4 Todo lo demás

Texto libre, tablas, imágenes embebidas, y los 11 checkboxes vacíos usados como separador. **El plugin no los toca ni los cuenta.** Un `- [ ]` sin texto se ignora en silencio.

---

## 5. El token

### 5.1 Forma

```
- [ ] llamar a Flow %%t:id=a3f2;wb=foco,mudanza;due=2026-08-29;p=2%%
```

- `%%…%%` es comentario nativo de Obsidian: en modo lectura se oculta solo. En Live Preview lo oculta la decoración del plugin. (Anot. `color.ts`.)
- Va **siempre al final de la línea**, siempre uno solo, siempre con los campos en orden fijo.
- El usuario **nunca lo escribe**. Lo escriben los botones.

### 5.2 Campos

| Campo | Valor | Cuándo se escribe |
|---|---|---|
| `id` | 4-8 chars `[a-z0-9]` | **Solo al asignar la tarea a un workbench.** Ver §5.4 |
| `wb` | lista separada por comas | Al tocar un botón de workbench |
| `due` | `AAAA-MM-DD`, o `D`/`DD` (día del mes) si la tarea es cíclica | Desde el menú, o al confirmar una fecha detectada |
| `rec` | nombre libre del **grupo de reinicio** (`lunes`, `mensual`, …) | Desde el menú |
| `p` | `1` (alta) \| `2` (muy alta) | Desde la barra de prioridad. Normal no escribe nada |
| `done` | `AAAA-MM-DD` | Al completar |

Prioridad normal **no escribe campo**: es el caso del 95% y no debe dejar rastro.

### 5.3 Reescritura

Una sola función pura:

```ts
setTaskToken(line: string, patch: Partial<TaskMeta>): string
```

Dos propiedades testeadas:

- **Idempotencia:** aplicarla dos veces da el mismo resultado que una.
- **Estabilidad:** aplicarla con un patch vacío no modifica el archivo.

Y una regla de seguridad: **si el token no parsea, la línea no se reescribe.** Se trata como tarea sin metadatos. Nunca reparar a ciegas.

`FORMAT_VERSION` desde el día 1, con el patrón de Anotaciones.

### 5.4 El id se pone tarde, a propósito

Poner id a las 386 tareas al arrancar tocaría los cinco archivos en cada dispositivo cada vez que se abre Obsidian: receta para conflictos de Sync con archivos de 300 tareas. **El id se escribe solo cuando la tarea entra a un workbench**, que es el único momento en que hace falta identidad estable.

Si una tarea aparece sin id porque un Backspace se llevó el token (Anot. §8: un rango atómico se borra entero), el plugin le pone uno nuevo en silencio. Se pierde la asignación al workbench, no la tarea. El peor caso es «hay que volver a ponerle la estrella».

### 5.5 Riesgo real: los rangos atómicos

Reescribir el token es una función pura y fácil. El riesgo está en la capa de CodeMirror, donde Anotaciones acumuló tres bugs de Backspace. Se porta `hiddenTail.ts` completo: la definición del tramo oculto vive en un solo lugar y todo mecanismo que parta o borre líneas la respeta.

Regla heredada: **ante cualquier rango atómico, preguntarse qué pasa cuando alguien borra hacia atrás desde el otro lado.**

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

---

## 6. Modelo de datos

```ts
interface Task {
  id: string | null;           // null hasta que entra a un workbench
  texto: string;               // sin el token
  hecha: boolean;
  archivo: string;
  linea: number;               // volátil: se recalcula en cada parseo
  nivel: number;               // profundidad dentro del árbol
  padre: string | null;        // id interno de sesión, no el `id` del token
  hijos: string[];
  notas: string[];             // bullets sin checkbox, verbatim
  proyecto: string | null;     // del heading más cercano hacia arriba
  area: string | null;
  seccion: string | null;      // heading no semántico, p. ej. "WORKBENCH"
  workbenches: string[];
  due: string | null;
  rec: "w" | "m" | null;
  prioridad: 0 | 1 | 2;
  done: string | null;
}
```

`linea` es volátil por diseño: la identidad es `id`, nunca la posición.

---

## 7. Store reactivo

No es una nota ni un archivo. Es un `Map<string, Task>` en memoria dentro del proceso del plugin.

1. **Arranque:** se parsean las notas de D2 y se arma el mapa. **Menos el LOG**, que solo recibe y crece sin techo (§12).
2. **Suscripción:** `metadataCache.on("changed")`. Cambia un archivo → se reparsea **solo ese archivo**. **Sin debounce**, ver abajo.
3. **Lectura:** las vistas no abren archivos nunca. Leen el store, filtran, renderizan.
4. **Escritura:** el plugin edita el markdown → **`vault.process()` devuelve lo que quedó escrito y eso entra al store en el acto** → las vistas se redibujan solas. El evento llega después con lo mismo y no reparsea nada.

**Un solo camino de escritura, un solo camino de lectura.** Ninguna vista se actualiza a mano después de una acción; eso es lo que evita que el workbench y la nota digan cosas distintas.

### No hay debounce, y eso está medido

**Revisado el 24/08/2026.** La versión anterior decía: «el debounce importa más
que la estructura: reparsear las 398 líneas de `tareas_COLE` en cada tecla es
invisible en escritorio y perceptible en móvil». **Las dos mitades de esa frase
son falsas**, y ninguna estaba verificada cuando se escribió.

Medido con `scripts/espia-eventos.js` en la consola de Obsidian, tecleando sin
parar 15 segundos sobre una nota de 388 líneas:

| | |
|---|---|
| eventos en 15 s de tecleo continuo | `modify`×8 · `changed`×8 |
| hueco entre `changed` consecutivos | mín **2023 ms** · mediana **2100** · máx 7288 |
| demora `modify` → `changed` | mín 16 ms · mediana **21** · máx 28 |
| costo de parsear **las siete notas enteras** | **0,31 ms** |

- **`changed` no llega por tecla.** Llega una vez por guardado del editor, que es
  el `requestSave` de 2 segundos de `TextFileView`. No existe el caso «en cada
  tecla» que la versión anterior quería evitar.
- **Un debounce no junta nada**, porque nada llega más junto que 2023 ms. Lo
  único que agregaría es su propia espera entre la acción y el redibujo.
- **El costo tampoco lo justifica**: 0,31 ms por las siete notas, no por una.

Conclusión: el store se suscribe directo. La constante `DEBOUNCE_MS = 150` que
existió unas horas quedó sin trabajo que hacer y se borró. Si alguna vez aparece
una fuente de eventos más rápida —Sync escribiendo el mismo archivo en ráfaga—
se vuelve a medir antes de agregar nada.

Con 406 tareas el mapa son unos pocos MB.

---

## 8. Escritura sobre el vault

Dos reglas, las dos por conflictos de Sync. `tareas_COLE` tiene 304 tareas en un archivo: un conflicto no afecta una tarea, afecta decenas.

1. **Nunca reescribir el archivo entero.** Solo el rango de las líneas que cambian, con `vault.process()` (lectura-modificación-escritura atómica), no `modify()` con el contenido completo. Es el §6 de Anotaciones convertido en requisito.
2. **Ninguna escritura de mantenimiento automática.** El plugin no toca un archivo si el usuario no pidió una acción sobre una tarea de ese archivo. Ver §5.4.

### El riesgo que las dos reglas no cubren

**Agregado el 24/08/2026, al construir el paso 3.** Las dos reglas de arriba
hablan de *cuánto* se escribe y *cuándo*. Falta *dónde*, y ahí estaba el agujero:

> El plan dice que la tarea está en la línea 42; para cuando se escribe, ya no lo
> está, porque alguien tecleó arriba. Escribir en la 42 igual no falla ni avisa:
> **pisa otra tarea.**

Por eso **toda escritura lleva el texto que esperaba encontrar** y se verifica
contra el archivo en el momento de escribir, adentro de `vault.process()`, que
es el único lugar sin carrera entre verificar y escribir. Si la línea sugerida no
coincide, se busca ese texto exacto: **una sola aparición** se escribe, **cero o
varias no**, y se avisa. Nunca adivinar cuál de dos líneas iguales era. Es el
invariante 10, y vive en `src/ubicar.ts`.

Dos cosas medidas que dimensionan el riesgo:

- **40 de las 398 líneas de tarea del corpus (10,1%) están repetidas**: 20 textos
  distintos, cada uno exactamente dos veces, de 30 caracteres de mediana. Todas
  en `tareas_COLE`. Son las que, con el índice atrasado, hacen que la acción se
  niegue en vez de escribir. Se corrige sola donde importa: **una tarea que entra
  a un workbench recibe un `id`, y eso vuelve su línea única** (§5.4).
- **El disco puede estar hasta 2 segundos atrasado respecto del editor.**
  `TextFileView.requestSave` es «debounced save in 2 seconds from now», y
  `vault.process()` lee del disco. Medido: con la nota abierta y recién
  tecleada, disco 13354 bytes contra editor 13403, y `process` escribió
  **13393 = 13354 + 39**. Es decir, **calculó sobre el disco viejo e ignoró lo
  que el usuario acababa de escribir.** El invariante 10 no puede atajarlo:
  adentro de `process` esa foto se ve perfectamente consistente.

  **Lo que la medición refutó** (24/08/2026, el mismo día en que se escribió
  esta sección): la primera versión decía que el volcado posterior del editor
  «pisa la escritura». No pasa. A los 2004 ms el editor guardó 13442 = 13403 +
  39, o sea que Obsidian **fusiona** el cambio externo en el buffer sucio en vez
  de descartarlo. No se perdió ni lo tecleado ni lo escrito.

  Aun así, antes de escribir se fuerza `save()` sobre toda vista abierta del
  archivo, y no por la pérdida que no ocurre: sin él, la verificación del
  invariante 10 corre contra una foto que no incluye lo recién tecleado —el
  desfasaje exacto del que este mecanismo defiende— y la corrección pasa a
  depender de que la fusión de Obsidian mapee bien los números de línea, que no
  está medido. Con `save()` no hay fusión: la secuencia es lineal y cuesta 8 ms.

**O se aplican todos los cambios de una acción o ninguno.** Media operación deja
el árbol en un estado que el usuario no pidió, y con la nota **cerrada** no hay
nada que lo deshaga. (Con la nota abierta sí: la escritura vuelve al editor y
entra a su historial. Ver §5.5 punto 15 — a veces sí y a veces no, que es peor
que nunca.)

---

## 9. Árboles

| Situación | Comportamiento |
|---|---|
| Marcar el padre | Completa todos los hijos |
| Completar todos los hijos | **No** completa al padre |
| Enviar a un workbench | Va el **árbol completo**, no una hoja suelta |
| Misma tarea en varias vistas | Permitido y esperado |
| Bullets sin checkbox dentro del árbol | Son notas; se preservan verbatim; nunca se cuentan como tareas |

### Colapso en las vistas

p50 del subárbol = 2 líneas, p90 = 12, máx = 76. Colapsar todo por defecto sería molesto para el caso típico y no colapsar nada haría inusable el workbench.

> **Se expande si el subárbol tiene ≤ 5 líneas; se colapsa si tiene más, con contador `(3/60)`.** Cada tarea lleva un botón visible de desplegar/colapsar todo.

### Reordenar

**No implementar.** Outliner ya está instalado y sus comandos de mover e indentar bloque funcionan sobre checkboxes sin adaptación: un `- [ ] x` es un bullet. Verificar primero; si algo falla, portar `outline.ts` de Anotaciones (`parseOutline`, `subtreeOf`, detección de la unidad de indentación), que ya tiene tests.

---

## 10. Workbenches

Un workbench es **un filtro sobre el store**. No tiene almacenamiento propio. Por construcción no puede existir una tarea que viva solo ahí.

- Se crean escribiendo un nombre. No hay panel de administración.
- **No se llaman por unidad de tiempo.** «foco», «mudanza», «semana en el cole» — no «hoy». Un workbench llamado «hoy» obliga psicológicamente a mantenerlo al día; uno llamado «foco» no caduca. Es el arreglo más barato del plugin y va como texto por defecto, no como sugerencia.
- Acciones: **vaciar workbench** (quita asignaciones, no toca ninguna tarea) y **archivar las completadas de este workbench**. Un clic cada una.
- «Sacar del workbench», «completar» y «descartar» funcionan desde la vista de workbench igual que desde la nota.

### Crear una tarea desde el workbench

El diálogo tiene **texto** y **destino**.

- El destino se autocompleta con el último destino usado en ese workbench.
- Si no hay ninguno, va a fleeting (`tareas_INBOX`).
- Un atajo cambia el destino sin salir del campo de texto.
- El plugin **inserta la línea en la nota destino**, al final de la sección del heading correspondiente, con el `wb` ya puesto. No hay camino de escritura especial.

### Tareas sin proyecto

134 tareas (35%) no cuelgan de un heading semántico: viven bajo `## WORKBENCH`, `## semana 10 - 17` o `# INBOX`. **No son fleeting: son tareas cuyo proyecto está implícito.** Se distinguen tres estados:

| Estado | Qué es |
|---|---|
| Con proyecto | Cuelga de un heading `p_` |
| **Sin clasificar** | Está en una nota de tareas, bajo una sección no semántica |
| Fleeting | Está en `tareas_INBOX` |

La vista Buscar tiene un filtro «sin proyecto» con acción de asignar. Y **al mandar una tarea sin clasificar a un workbench, el plugin pide el proyecto**: es el momento en que el usuario ya está pensando en esa tarea, así que la fricción es mínima.

---

## 11. Tareas cíclicas

**Revisado el 23/08/2026.** La versión anterior era regenerativa: al completar,
la tarea quedaba `[x]` y el plugin insertaba una instancia nueva, oculta hasta
su fecha de activación, y le corría la fecha a la que no se hubiera completado.
Se reemplazó por lo de abajo porque chocaba consigo misma en tres lugares. El
detalle está en los comentarios de `src/tareas.ts`.

### El modelo: una etiqueta y un botón

`rec` es el nombre de un **grupo de reinicio**, no un motor: `rec=lunes`,
`rec=mensual`, `rec=mudanza`. Se crean escribiéndolos, como los workbenches.

Un botón por grupo **destilda todas las tareas de ese grupo y les borra el
`done`**. Nada más: no se crea ninguna instancia, no se clona ningún hijo y no
se corre ninguna fecha.

- **El disparador es el usuario, nunca el calendario.** Es lo que resuelve el
  choque con la §8: un reinicio por calendario haría que todos los dispositivos
  con Obsidian abierto reescribieran las mismas líneas en el mismo momento,
  sobre archivos en Sync. Peor que el caso que la §8 vino a prevenir.
- **Solo toca las tareas etiquetadas.** En `tareas_MES` el registro por mes son
  hijos sin etiqueta, con el monto de cada mes; un reinicio que barriera la nota
  entera los convertiría en tareas pendientes y perdería el dato.
- **Los workbenches y el `due` sobreviven al reinicio.** Sin eso hay que rearmar
  el workbench cada lunes, que es la fricción a eliminar.
- **No se mide el atraso.** Decisión explícita: una cíclica que no se reinició
  no está vencida, está igual que ayer.
- **Las cíclicas van agrupadas aparte** de las de una sola vez, en las vistas.

### El vencimiento adentro del período

Una cíclica puede tener plazo propio: 3 tareas del corpus dicen «antes del día
10» o «antes del segundo vencimiento». Para esas, **`due` guarda el día del mes,
no la fecha**: `due=10` es «el 10 del mes en curso», y se resuelve contra el
reloj con `resolverDue`. Guardar `2026-09-10` obligaría a que algo le corriera
el mes en octubre, que es la escritura automática otra vez por la puerta de
atrás. Un día que no existe en ese mes se recorta al último: `due=31` en febrero
es el 28.

### Al reiniciar, el usuario elige qué pasa con lo completado

La confirmación ofrece **reiniciar** o **archivar y reiniciar**; la segunda
escribe el bloque en `tareas_LOG.md` con la fecha (§12) antes de destildar. Así
la semanal trivial no llena el LOG y la mensual del alquiler deja rastro, sin
decidirlo de antemano.

**La confirmación es obligatoria.** Es la escritura más grande del plugin —23
líneas de un tirón en `tareas_MES`, medido— sobre un archivo en Sync. Tiene que
decir cuántas tareas va a reiniciar y en qué nota.

La razón **cambió** con lo que midió la primera verificación del paso 4b (§5.5
punto 15). La versión anterior decía «`vault.process()` no pasa por el editor,
así que Ctrl-Z no la deshace», y eso es falso cuando la nota está abierta: la
escritura vuelve al editor como cambio externo y esa transacción entra al
historial de deshacer. Con la nota **cerrada** —que es el caso del reinicio de un
grupo que toca varias notas— no hay historial ninguno. O sea: **a veces se
deshace y a veces no**, y un rescate que depende de si la nota estaba abierta no
es un rescate. Eso justifica la confirmación mejor que la afirmación anterior.

### tareas_CÍCLICAS: sigue fuera de la v1, pero ya no es caro

Hoy son bullets sin checkbox agrupados por día de la semana: 0 tareas
completables en 43 líneas. No se completan, se consultan. En v1 la pestaña
Agenda **muestra la sección del día en modo lectura, sin checkboxes**.

Lo que cambia respecto de la versión anterior de esta sección: convertirlas ya
no agrega ninguna obligación diaria. Con el botón, si un día no se reinicia no
pasa nada y nada queda marcado como atrasado. El mecanismo es `rec=lunes`,
`rec=martes`, … y un botón por día.

## 12. Terminar una tarea: dos verbos, no uno

**El hallazgo que ordena esta sección:** solo el 7,5% de las tareas están completadas, y en `tareas_COLE` son 3 de 304. El usuario **borra** la mayoría de las tareas breves, y las que quiere guardar «trata» de pasarlas al LOG a mano, sin sostener el hábito.

Conclusión de diseño: **tildar tiene que costar menos que borrar**, y hay dos intenciones distintas.

| Verbo | Qué hace | Cuándo es el default |
|---|---|---|
| **Completar y descartar** | Marca `[x] done=`, la saca de las vistas, **no** escribe en el LOG | Tarea hoja, sin hijos ni notas |
| **Completar y archivar** | Marca `[x] done=`, escribe el bloque en `tareas_LOG.md`, la saca de las vistas | Tarea con subárbol o con notas |

El default se deriva del tamaño del bloque (p50 = 2 líneas: la mayoría son hojas), y siempre se puede forzar el otro con un modificador. **Ninguno de los dos borra la línea de la nota**: la tarea queda `[x]` en su lugar y las vistas la ocultan. El descarte físico es una acción aparte, explícita, con confirmación.

### Formato del LOG

**Revisado el 24/08/2026.** La versión anterior decía «bajo el mismo camino de
headings que la tarea tenía en su nota» y a la vez «organizado por proyecto».
Las dos cosas se contradicen: el camino literal arrastra al historial los
andamios de la nota de trabajo —`WORKBENCH`, `INBOX`, `semana 24 - 28`—, que son
secciones para organizarse hoy y no categorías de lo hecho; y «por proyecto» no
es aplicable mientras solo el wikilink defina proyecto (§4.1), porque hoy no hay
ninguno.

- El destino es **la nota de origen, y el proyecto debajo si lo hay**:
  `# tareas_COLE` / `## p_6_Sheets`. No se elige: sale de dónde vivía la tarea.
  No depende de la migración del paso 8 y da un historial navegable desde el
  primer día.
- **Una sección nueva se agrega al final del archivo.** Un log crece por abajo.
- Se escribe **bullet sin checkbox**: es lo que el LOG ya usa (37 bullets, 0
  checkboxes). **La fecha al final, `[✓ 2026-08-22]`, es formato nuevo** —
  medido: ninguno de los 37 bullets de hoy tiene fecha.
- **Se limpia el token.** El id ya no apunta a nada vivo.
- Va el subárbol completo, incluidas las notas sin checkbox. En el LOG actual
  esas líneas son el contenido valioso. La fecha va en la raíz del bloque; un
  descendiente solo la lleva si tiene un `done` escrito y **distinto**.

### El LOG se lee por una vista, y el archivo sigue siendo legible solo

Decisión del usuario: el historial no se consulta abriendo la nota, sino desde
la interfaz, con orden y filtros. Va como **un origen más en la pestaña Buscar**
(§13.2) —«archivadas», junto a los filtros que ya tiene— y no como una pestaña
nueva: misma lista, misma virtualización, y es donde uno busca «¿dónde está eso
que hice?». Una vista dedicada se decide más adelante, con el LOG lleno; hoy
lleva 54 días sin tocarse y no hay evidencia de qué haría falta.

Dos restricciones que salen de esa decisión:

1. **El archivo se escribe como si la vista no existiera.** Es la D1: si el
   plugin desaparece, las notas siguen siendo legibles. El historial es lo que
   más probablemente sobreviva al plugin y lo menos re-derivable de todo el
   vault.
2. **La lectura endurece el formato, no lo relaja.** Para ordenar por fecha y
   filtrar por proyecto hay que **recuperar** esos campos del archivo, así que
   `[✓ AAAA-MM-DD]` deja de ser decoración y pasa a ser sintaxis, y el camino de
   headings pasa a ser el índice. El ida y vuelta está probado como propiedad
   (`parseLog`).

El archivo crece sin techo —es el único conjunto que solo recibe— así que **se
lee cuando se abre la vista, nunca al arrancar el plugin**: el store de la §7 se
arma con las notas de trabajo, que se mantienen de tamaño porque las cosas salen
de ellas.

---

## 13. Vistas

### 13.0 El frente principal: la nota

El grueso del plugin son **extensiones de CodeMirror sobre las notas de tareas**, no un panel lateral. La nota es donde se escribe, se edita y se asigna. Las tres pestañas son consumidores secundarios del mismo store.

Sobre cada línea de tarea, al pasar el mouse:

```
[✓]  texto de la tarea …                    [★] [◐] [→] [⋯]
```

- **★ ◐** — dos botones fijos, asignables en settings a los dos workbenches favoritos. Un clic, toggle. Es el 90% del uso.
- **→** — popover con todos los workbenches, numerados 1-9. Un clic más una tecla. Escala a cualquier cantidad.
- **⋯** — menú: fecha, prioridad, recurrencia, completar y descartar, completar y archivar, eliminar.

Indicador persistente: el ★ queda relleno si la tarea está en ese workbench. Sin esto se hace doble clic sin darse cuenta, porque la tarea no se va de la nota al asignarla.

**El componente de fila recibe el modo de revelación como parámetro** (`hover` | `siempre` | `swipe`). Nunca `mouseenter` cableado adentro. Ver §15.

### Lo que el paso 4b construyó, y lo que dejó afuera

**30/08/2026.** La fila existe. `src/botones.ts` decide **qué** botones van y en
qué estado —capa 1, sin DOM, calculado del texto de la línea y no del store, que
puede estar atrasado— y `src/editor/filaDeBotones.ts` la dibuja.

**Los cuatro botones terminan en las tres funciones que ya usaban los comandos de
paleta.** Ningún camino de escritura nuevo: `posAtDOM` → `elegirEnLinea` → plan
puro → `escribir` → `absorber`.

**El ⋯ lleva solo lo que tiene capa 1 y 2 detrás.** De las seis cosas que esta
sección lista, entran dos —prioridad y «completar y descartar»— y las otras
cuatro **no aparecen**, ni grises:

| Del menú | Por qué no |
|---|---|
| Fecha | `setTaskToken` sabe escribir `due`, pero no hay con qué elegir una |
| Recurrencia | Ídem con `rec`, y el botón por grupo es de la §11 |
| Completar y archivar | `archivado.ts` tiene la lógica pura y **ninguna** escritura: toca dos archivos a la vez. Paso 6 |
| Eliminar | Es el descarte físico de la §12, con confirmación. Paso 6 |

Un ítem gris ocupa el mismo lugar que uno que anda y no hace nada. La misma
regla decidió el ◐: **el segundo workbench favorito arranca vacío, y vacío
significa que el botón no se dibuja.** Inventarle un nombre por omisión sería
peor — se escribiría en el token de la primera tarea que el usuario toque sin
haberlo elegido.

**Seis lugares donde puede vivir la fila**, y conviven (patrón `designFlags.ts`):
sobre el final de la línea con degradado, sin fondo, en pastilla; en el margen
derecho; antes del checkbox; y una **columna en el margen izquierdo** con el
orden que pidió el usuario en la segunda vuelta — número de línea · botones ·
filete · plegado · checkbox.

Esa última contesta una pregunta que la §13.0 no tenía resuelta: **cómo mostrar
siempre los workbenches donde la tarea ya está y hacer aparecer el resto al pasar
el mouse, sin que los primeros se corran.** La respuesta es no sacar nada del
flujo: los cuatro botones están siempre, y lo único que cambia es la opacidad y
el fondo de la pastilla. Con `display: none` o con un ancho variable, la fila
está anclada por la derecha y cada botón que aparece empujaría a los de al lado
— el ★ se movería justo cuando el mouse va hacia él.

**De los tres modos de revelación se ofrecen dos.** `hover` y `siempre` son CSS
puro, con la clase en `body` como el estilo de prioridad; `swipe` está declarado
en el tipo —la §15 punto 1 pide que el modo sea un parámetro— y no está en el
desplegable, por lo mismo que los cuatro ítems de arriba.

**Los éxitos de ★ ◐ → son silenciosos.** El botón que se rellena *es* el aviso, y
llega solo: la escritura vuelve al editor como cambio externo y el widget se
reconstruye. Un cartel por clic sería ruido sobre la acción más frecuente del
plugin. Los fracasos avisan siempre.

**Y sobre una línea con el token ilegible la fila se dibuja igual, apagada.**
Esconderla dejaría una tarea sin botones y sin explicación. Los cuatro tooltips
dicen que el token es ilegible y no lo que harían: los cuatro son inertes, y un
control que promete lo que no puede hacer es peor que uno apagado. **Eso salió
de mirar la salida** —los tests pasaban y el tooltip decía «Mandar a foco»—, no
de un test.

### 13.1 Pestaña Workbenches

La principal. Selector de workbench arriba; uno o varios en columnas. Colapso según §9. Recurrentes agrupadas aparte. Editar, completar, descartar y sacar del workbench, todo desde acá.

### 13.2 Pestaña Buscar

Todas las tareas de las notas de D2, con filtros: proyecto, nota, vencimiento, prioridad, con/sin workbench, **sin proyecto**, completadas. No es donde se trabaja: es donde se **encuentra y asigna**. Caso de uso: filtrar por `p_HOGAR`, hacer clic en la estrella de seis tareas, cerrar.

### 13.3 Pestaña Agenda

Lo único temporal: tareas con `due`, ordenadas por fecha, vencidas arriba. Más la sección del día de `tareas_CÍCLICAS` en modo lectura (§11).

### 13.4 Editar

En las pestañas se edita **solo el título** inline, más un botón «ir a la tarea» que abre la nota con el cursor en esa línea. **No se embeben editores markdown en las listas**: el subárbol llega a 76 líneas.

### 13.5 Layout de paneles

Un comando abre N notas en una ventana nueva (`workspace.openPopoutLeaf`), con la lista de notas con tareas tomada del store. El core plugin **Espacios de trabajo** cubre las disposiciones fijas. Solo escritorio (§15).

---

## 14. Prioridad

Tres niveles: normal (sin color), alta (amarillo), muy alta (rojo).

- **Se guarda un número (`p=1`/`p=2`), se dibuja un color.** Ordenar necesita un ordinal, y guardar el nombre del color ata la paleta para siempre. En Anotaciones el color *es* el dato porque viene de Zotero; acá es presentación.
- **El color pinta la línea de la tarea, no el subárbol.** Los hijos llevan un filete de 2px del mismo color en el borde izquierdo. Con árboles de 76 líneas, teñir todo deja media nota roja.
- Se porta el mecanismo de Anotaciones: decoración de línea + `colorClass()` + la barra de colores rápidos configurable de `settingsData.ts`.
- **Verificar contraste en tema claro y oscuro.** Amarillo sobre fondo claro es el peor caso.
- Los tres niveles deben distinguirse **también sin color** (un indicador de forma), por accesibilidad y por pantallas al sol.

### Lo que el paso 4a decidió y midió

**25/08/2026.**

**La prioridad se escribe en la línea de la tarea y en ninguna más.** Es la
diferencia con completar y con asignar a un workbench, que bajan por el subárbol
entero (§9). Sale de la regla de arriba —el color pinta la línea, los hijos
llevan filete— y de una consecuencia que la regla no dice: si el `p=` se
escribiera en cada hija, **bajarle la prioridad a la madre no podría distinguir
una hija que la heredó de una que el usuario subió a mano**. El filete es
dibujo, no dato, y lo calcula la decoración mirando la herencia.

**El amarillo de Anotaciones no sirve, y ahora está medido.** «Amarillo sobre
fondo claro es el peor caso» era una anticipación correcta sin número. El
número: `#c99a00` sobre blanco da **2,59:1**, por debajo del 3:1 que la WCAG
1.4.11 pide para un componente y muy por debajo del 4,5:1 de texto. La paleta
que quedó —`#8c6500` y `#c62828` en claro, `#e3c052` y `#e07070` en oscuro—
tiene **4,63:1 en el peor de los ocho casos**.

**Son dos indicadores de forma, no uno, y se encienden por separado.** Decisión
del usuario: uno, el otro o los dos.

| Indicador | Qué dibuja | Por omisión |
|---|---|---|
| Filete con textura | alta = filete sólido de 3px; muy alta = 5px con muescas | encendido |
| Signo al final | `!` y `!!` después del texto | apagado |

Que estén separados no es solo gusto: **el glifo suma ancho al renglón y el
filete no**, y el ancho es lo que decide si una línea entra en un renglón o en
dos. Con la ventana angosta eso alimenta el mismo bucle de medición de la §5.5,
así que tenerlos en dos interruptores deja ver cuál de los dos, si alguno, mueve
la cuenta de avisos. Es el patrón `designFlags.ts` haciendo de instrumento.

Las clases viven en `body` y no en la decoración: el `StateField` pone siempre
la misma clase de nivel y la hoja de estilos decide qué dibuja. Así alternar un
ajuste no obliga a reconstruir las decoraciones de cada editor abierto.

**`scripts/revisar-especificidad.mjs` no se portó.** Su heurística es la de
Anotaciones —selectores de etiqueta pelada, `button:not(.clickable-icon)`— y no
mira el riesgo de acá, que es clase contra clase sobre `.cm-line`. La pregunta
se contestó leyendo el `app.css` del asar instalado: de las diez reglas de
Obsidian que tocan `.cm-line` o `.cm-content` en propiedades que este plugin
usa, la única con `!important` es `.cm-content > * { margin: 0 !important }` —la
que costó cara en Anotaciones— y `styles.css` no toca `margin`. Ninguna pinta
`background-color` sobre `.cm-line` ni usa su `::before`.

Sí se portó **`scripts/extraer-css-de-obsidian.mjs`**, que es lo que permitió
contestarla, con un arreglo: el de Anotaciones lee el `.asar` del instalador en
`/Applications`, y Obsidian se actualiza solo y corre el de
`~/Library/Application Support/obsidian/obsidian-N.asar`. Medir la versión
equivocada es peor que no medir.

---

## 15. Móvil

**Caso de uso: capturar y mirar el workbench.** Nadie edita un árbol de 60 nodos en un teléfono. Consecuencia: el frente principal de escritorio (CodeMirror sobre las notas) es lo que menos importa en móvil, y las pestañas —secundarias en escritorio— son la aplicación móvil entera.

**Alcance actual:** el plugin se construye como si fuera solo para escritorio, pero respetando la separación en capas de §17. Eso deja la puerta abierta a publicarlo como community plugin —donde móvil deja de ser opcional, porque el manifiesto lo declara con `isDesktopOnly`— sin pagar el precio por adelantado.

### No existen en móvil

| Propuesta | Qué pasa |
|---|---|
| Botones en hover | No hay hover. Alternativa: swipe (derecha = workbench favorito, izquierda = completar) |
| Paneles en ventana nueva | `openPopoutLeaf` es solo escritorio |
| Atajos de teclado | No hay teclado físico |
| Drag & drop | Eventos de mouse; con el dedo compite con el scroll |
| Chips de metadatos a la derecha | En 390 px compiten con el texto |
| Filtros simultáneos visibles | No entran |

### Lo que hay que prever ahora

1. **El modo de revelación de los botones es un parámetro del componente.** Si nace con `mouseenter` adentro, después se reescribe entero.
2. **El `transactionFilter` del checkbox automático es el mayor riesgo de divergencia.** El teclado de software escribe por composición (IME) con autocorrección, y las transacciones no tienen la misma forma. **Hipótesis fundada, no verificada** — hay que probarlo en el teléfono, según el §1 de las notas de método. Salida de emergencia: en móvil no se intercepta nada y se escribe `- [ ]` a mano.
3. **La lista tiene que ser virtualizable.** Obsidian móvil es una WebView con menos memoria. Meter virtualización después obliga a rehacer la vista, porque cambia el cálculo de alturas, scroll y colapso. Es la decisión más cara de postergar.
4. **Token oculto sin widget en móvil.** Cuanto menos superficie tenga, menos chances de que el handle de selección táctil caiga adentro.
5. **Objetivos táctiles de 44 px.** Cuatro botones ocupan 176 px de 390. Otro argumento para el swipe.
6. **Áreas seguras y teclado.** El diálogo de captura al pie se lo come el teclado; usar las variables de área segura y las clases `is-mobile`.

---

## 16. Fuera de alcance

- **Recordatorios** (turnos, clases, compromisos). No son tareas: no se completan, ocurren; tienen hora y duración; su valor está en el aviso previo. Además, **un plugin de Obsidian solo puede notificar con Obsidian abierto** — no hay notificaciones de sistema en segundo plano ni en móvil. El aviso real vive en Google Calendar. Va a un plugin aparte, más simple.
- **Áreas** como concepto con vista propia (D8).
- **Convertir `tareas_CÍCLICAS` en tareas completables** (§11).
- **`workbench.md`**: es un pizarrón para pegar texto, no una nota de tareas. No entra en D2.
- **Reordenar por drag & drop** (§9).

---

## 17. Arquitectura

Tres capas y una prohibición.

1. **Lógica pura** — parser, token, outline, recurrencia, archivado, filtros. Sin Obsidian, sin DOM. Testeable offline. Es el §5 de las notas de método.
2. **Escritura sobre el vault** — sin DOM. Sujeta a §8.
3. **Vistas** — extensiones de CodeMirror y las tres pestañas, con un punto de entrada por plataforma.

> `Platform.isMobile` solo puede aparecer en la capa 3. Nunca en 1 ni en 2.

Si se respeta, la versión móvil es un frente nuevo. Si no, es una reescritura.

### Reutilizable de Anotaciones

| Módulo | Para qué |
|---|---|
| `hiddenTail.ts` | Casi tal cual: el tramo oculto al final de la línea es el mismo problema |
| `outline.ts` | Mover subárboles, detectar la unidad de indentación. Solo si Outliner falla |
| `color.ts` + `settingsData.ts` | Token de color, `colorClass`, barra de colores rápidos |
| `editor/annotationDecorations.ts` | Estructura de decoraciones de línea, caché, nivel como variable CSS |
| `blockId.ts` | El patrón, no el código: parseo tolerante que devuelve null en vez de tirar |
| `designFlags.ts` | Encender un diseño nuevo sin reemplazar el anterior (§17 de las notas) |
| `NOTAS-DE-METODO.md` §8 | Las trampas de CodeMirror. Leer antes de tocar decoraciones |
| Pipeline `npm run deploy` / `humo.mjs` / `revisar-especificidad.mjs` | Tal cual |

---

## 18. Invariantes testeables

Estas son las propiedades que sostienen el modelo. Si alguna se rompe, el plugin miente.

1. **Toda tarea visible en cualquier vista tiene exactamente una línea en una nota de tareas.** Los workbenches no almacenan.
2. **`setTaskToken` es idempotente**, y con patch vacío no modifica el archivo.
3. **Reescribir una tarea nunca modifica sus bullets sin checkbox.**
4. **Ninguna operación reescribe un archivo entero.**
5. **Reiniciar un grupo cíclico dos veces seguidas da el mismo archivo**, y no toca una sola línea que no lleve la etiqueta de ese grupo.
6. **Archivar y volver a leer recupera lo archivado**: texto, fecha, nota y proyecto. Y archivar N bloques en el mismo camino crea el camino una sola vez.
7. **Un token que no parsea deja la línea intacta.**
8. **Un `- [ ]` vacío nunca aparece como tarea.**
9. **Parsear las siete notas y volver a escribirlas sin cambios no altera ningún byte.** Es la prueba diferencial más barata y la que más bugs de reescritura atrapa.
10. **Ninguna línea se identifica por su número: se identifica por su texto.**
    Vale en los dos extremos de una acción —al **elegir** sobre qué tarea actúa
    el usuario, y al **escribir**— porque en los dos hay una coordenada fresca
    contra una foto vieja. Y una acción se aplica entera o no se aplica.

    Es el que impide el error más caro y menos visible del plugin: actuar sobre
    la tarea de al lado porque el índice estaba atrasado. **Verificado que hace
    falta en los dos lados:** la primera versión de los comandos lo cumplía al
    escribir y no al elegir, y con cinco líneas tecleadas arriba elegía otra
    tarea y la escribía impecablemente. Ver §8.

---

## 19. Migración

Chica, medida:

1. **15 referencias en texto plano** (`⮕ p_6_Sheets`) a wikilink (`⮕ [[p_6_Sheets]]`). Un script, cinco notas.
2. **Las secciones `## WORKBENCH` a mano ya son workbenches.** El plugin las lee en la migración y las convierte en asignaciones reales, en vez de arrancar de cero. El usuario empieza con sus workbenches armados.
3. **Reformatear `tareas_LOG.md` por proyecto** (§12).
4. `tareas_CLAUDE` entra en D2: es una nota de tareas e ideas que recién arranca, sin deadline. Hoy tiene 5 tareas y 54 bullets; se espera que la proporción cambie con el uso.

Ninguna migración toca nombres de archivo ni estructura de carpetas.

---

## 20. Orden de trabajo

Criterio heredado del `PLAN.md` de Anotaciones: **primero lo que produce evidencia sobre la premisa que sigue sin confirmar.**

| # | Paso | Por qué acá |
|---|---|---|
| 0 | ~~Medir el corpus~~ | Hecho. Los números están en §2 |
| 1 | **Prototipo del `transactionFilter`** del checkbox automático, conviviendo con Outliner, probado en escritorio **y en el teléfono** | Es lo único que puede salir mal de un modo que cambie el diseño. Si falla, §15 punto 2 |
| 2 | **Capa 1 completa con tests**: parser de las cuatro clases de línea, token, árboles, reinicio de cíclicas, archivado | Lógica pura primero, interfaz después. Y da los invariantes 2, 3, 5, 6, 7, 8, 9 sin tocar Obsidian |
| 3 | **Store + capa de escritura**, con el invariante 9 como prueba diferencial contra las siete notas reales | Antes de dibujar nada, garantizar que leer y escribir no corrompe |
| 4a | **Decoración pasiva sobre la nota**: ocultar el token, defender el rango atómico, colores de prioridad | El frente principal (§13.0). Es un port re-arquitecturado con las trampas ya documentadas |
| 4b | ~~**La fila de botones** de la §13.0: ★ ◐ → ⋯~~ | Hecho. Código sin precedente: Anotaciones no tiene botones sobre la línea, tiene una barra global y gutters |
| 5 | **Pestaña Workbenches**, con el componente de lista virtualizable desde el principio | La vista que más se usa |
| 6 | **Completar / descartar / archivar al LOG** | Resuelve el hallazgo del 7,5% |
| 7 | Pestañas Buscar y Agenda, con «archivadas» como origen en Buscar (§12) | |
| 8 | Migración (§19) | Al final: reescribe notas reales, y conviene que el parser esté probado |
| 9 | Layout de paneles | Alcance chico, entra en cualquier hueco |

### Antes de compartirlo como community plugin

Solo si sale del vault propio. Está listado acá para que no sea un olvido: idioma (los textos van juntos desde el principio, como en Anotaciones), accesibilidad de botones y teclado, `isDesktopOnly` y el trabajo de §15, convivencia con instalaciones sin Outliner, y la primera migración de `FORMAT_VERSION`.
