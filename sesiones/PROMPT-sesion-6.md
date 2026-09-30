# Prompt para la sesión 6 en Claude Code

> Abrir Claude Code en `~/Downloads/claude/obsidian_plugin_TAREAS`, entrar en
> **plan mode** y pegar lo de abajo.

---

Seguimos con el plugin de tareas de Obsidian. La especificación está en
`plugin-tareas-spec.md`, en la raíz. **Leela entera antes de proponer nada** — la
§5.5 tiene ahora treinta apartados y casi todos son mediciones. El método de
trabajo está en `CLAUDE.md` y no lo repito acá.

## Dónde estamos

Las capas 1 y 2 están cerradas, y el **paso 4 entero** también: la decoración
pasiva (4a) y la fila de botones (4b). Son **615 tests** en `npm test` y **124**
en `npm run test:corpus`.

Hay token invisible en Live Preview, color de prioridad con cinco estilos
intercambiables, tres filtros que defienden el token, un guardia que evita que un
cambio externo mueva el cursor, cuatro comandos de paleta, y la fila `★ ◐ → ⋯`
sobre cada tarea, con seis lugares donde puede vivir. **Seis vueltas de
verificación en vivo**, en `VERIFICAR-sesion-5.md` y sus vueltas 2 a 6, y de cada
una salieron cosas que ningún test había visto.

Lo que quedó decidido y no hace falta volver a discutir. `git log` es largo y
vale leer los mensajes:

- **Las reglas que preguntan de qué forma vino un cambio fallan.** Los filtros
  reconocen **el defecto**: calculan en qué quedaría el documento y deciden sobre
  eso.
- **Un cambio externo llega como un diff con `userEvent: "set"`**, incluido lo
  que el propio plugin acaba de escribir, y **su diff no es mínimo**: arranca en
  el comienzo de la línea. Eso movía el cursor a la columna 0 y lo arregla
  `editor/cursorExterno.ts` con la regla del invariante 10 aplicada al cursor.
- **Las decoraciones van en un `StateField`**, con un límite exacto: un widget
  inline de ancho cero sin altura declarada **no entra al mapa de alturas venga
  de donde venga**, y para eso un `ViewPlugin` es lo correcto (§5.5 punto 12).
- La fila vive en un **`gutter` propio** (`columna`), que es lo que le da su
  orden y evita que el navegador tenga dónde poner un caret.
- Tres filtros con precedencias fijadas por tests: `unirLimpio` decide el
  **texto**, `protegerTramo` el **token**, `autoCheckbox` el **checkbox**.
- **Dos comportamientos del cursor son de otros y no se corrigen:** la unión con
  Backspace la termina Outliner, y que la flecha entre al `- [ ] ` es de Obsidian
  (§5.5 puntos 19 y 20).
- **El ⋯ solo lleva lo que tiene capa 1 y 2 detrás.** Hoy: prioridad y «completar
  y descartar». Ponerlo gris es lo mismo que no ponerlo.

**Y una cosa que sigue sin ser verde:** la línea de base del ciclo de medición de
la §5.5 **no se reproduce**, por tercera vez. Con la nota cargada de tokens, la
ventana angostada y scrolleando en las dos direcciones no aparece ningún aviso,
ni con el plugin ni sin él. La predicción falsable de ese apartado sigue sin
poder evaluarse. **No anotarlo como verde.**

**El repositorio es público** y la regla está en `CLAUDE.md`: no entra contenido
real de mis notas, ni siquiera en un mensaje de commit.

## Alcance de esta sesión: el paso 6, y solo su primera mitad

La §20 llama al paso 6 «completar / descartar / archivar al LOG». Son dos
trabajos de naturaleza distinta y **propongo partirlo**:

| | Qué | Por qué va junto |
|---|---|---|
| **6a — esta sesión** | **Completar y archivar** al LOG (§12) y **eliminar** con confirmación | Los dos son «terminar una tarea», los dos rompen el mismo supuesto de la capa 2, y los dos necesitan confirmación |
| 6b — la que sigue | **Fecha** y **recurrencia** en el ⋯, más el botón de reinicio por grupo (§11) | Es otra cosa: necesita controles de entrada —un selector de fecha, un nombre de grupo— y `resolverDue` contra el reloj |

Al terminar 6a, el ⋯ pasa de dos ítems a cuatro y **la §12 queda cerrada**, que
es el hallazgo que ordena la spec entera: solo el 7,5% de las tareas están
completadas porque tildar cuesta más que borrar.

### Qué queda explícitamente afuera

- **La vista de archivadas** («archivadas» como origen en la pestaña Buscar,
  §12). Es el paso 7. El archivo se escribe **como si la vista no existiera**,
  que es la D1.
- Fecha y recurrencia, por lo de arriba.
- La pestaña Workbenches (paso 5).

---

## Lo primero, porque decide la arquitectura

**Dos supuestos de la capa 2 se rompen en este paso, y los dos están escritos en
el código.** Hay que resolverlos antes de tocar `archivado.ts`, que ya está.

### 1. `ubicar.ts` solo sabe reemplazar líneas

Su propio comentario lo dice, en `src/ubicar.ts`:

> Se resuelve cada cambio **contra el archivo original**, no contra el resultado
> parcial de los anteriores. Es legítimo porque un lote solo reemplaza líneas
> —no inserta ni borra—, así que ninguna resolución corre a las que siguen. **Si
> algún día un plan insertara líneas, esto hay que rehacerlo, no parchearlo.**

Archivar **inserta** (en el LOG) y eliminar **borra** (en la nota). O sea que
este paso es exactamente el día que ese comentario anticipa. **Rehacerlo, no
parchearlo**, y con el invariante 10 intacto: cada cambio sigue llevando el texto
que esperaba encontrar, y un lote sigue siendo todo o nada.

`documento.ts` ya tiene `insertarLineas` y `eliminarLineas`, y los dos renumeran.
Lo que falta es cómo se **ubica** un lote que corre las líneas de abajo.

### 2. Archivar toca **dos archivos**, y `vault.process()` es de a uno

`escribir(app, archivo, cambios)` recibe **un** archivo. Archivar escribe en la
nota (marcar `[x]`, escribir `done`) **y** en el LOG (insertar el bloque). No hay
forma de hacer las dos atómicamente: `process` es por archivo.

O sea que la regla «o se aplican todos los cambios o ninguno» (§8) **no se puede
cumplir entre archivos**, y hay que decidir qué pasa cuando la primera anda y la
segunda no. Mi propuesta, para discutir:

> **Primero el LOG, después la nota.** Si falla la segunda, queda una entrada en
> el historial de una tarea que sigue pendiente: se ve, y se arregla. Al revés
> queda una tarea completada sin registro, que es una pérdida que **no se nota**.
> Entre dos daños, el mismo criterio que eligió el rango atómico del token.

Y hay que decirlo en el aviso: media operación no puede terminar en silencio.

### 3. El LOG no está en el store, a propósito

La §12 y `notasDeTrabajo` lo excluyen: es el único conjunto que solo recibe y
crece sin techo, y **se lee cuando se abre la vista, nunca al arrancar**. Así que
archivar tiene que leerlo **fresco** en el momento, y `planDeArchivado` necesita
un `Documento` del LOG que no sale del store.

Medido hoy: el LOG tiene **50 líneas, 37 bullets, 0 checkboxes y 0 marcas de
fecha**. O sea que `[✓ AAAA-MM-DD]` sigue siendo formato nuevo, como dice la §12.

---

## Lo que ya está hecho y no hay que volver a escribir

`src/archivado.ts` es **323 líneas de capa 1 con 291 de tests**, y no escribe
nada. Leerlo antes de diseñar:

| Función | Qué da |
|---|---|
| `bloqueParaElLog(doc, nodo, hoy)` | Las líneas del bloque, bullets sin checkbox, token limpio, subárbol completo |
| `caminoDeArchivado(archivo, proyecto)` | `[nota]` o `[nota, proyecto]` |
| `planDeArchivado(log, camino, bloque)` | **Dónde** insertar y **qué**, creando solo los headings que falten |
| `aplicarArchivado(log, plan)` | El LOG resultante, en memoria |
| `archivarPorDefecto(nodo)` | El default de la §12, derivado del tamaño del bloque |
| `parseLog(log)` | El ida y vuelta, probado como propiedad |

Lo que falta es **la capa 2 y la 3**: traducir `PlanDeArchivado` a una escritura
por rango, y los dos ítems del ⋯ con su confirmación.

## Cómo quiero que quede

| Archivo | Capa | Qué es |
|---|---|---|
| `src/ubicar.ts` *(rehecho)* | 1 | Ubicar un lote que **inserta y borra**, no solo reemplaza |
| `src/acciones.ts` *(modificado)* | 1 | `planDeEliminar`: el descarte físico de la §12 |
| `src/vault/escribir.ts` *(modificado)* | 2 | Escritura en **dos archivos**, con orden y con aviso de media operación |
| `src/comandos.ts` *(modificado)* | 3 | `archivarTarea` y `eliminarTarea`, hermanas de las tres que ya están |
| `src/editor/menuDeTarea.ts` *(modificado)* | 3 | Los dos ítems nuevos del ⋯, con confirmación |
| `src/ui/confirmar.ts` *(nuevo)* | 3 | El modal, forma de `ui/ConfirmModal.ts` de Anotaciones |
| `src/strings.ts` | — | Los textos, juntos como siempre |

Decisiones por archivo:

1. **La confirmación es obligatoria para lo grande** (§11, §12) y tiene que decir
   **cuántas líneas y en qué nota**. El subárbol más grande del corpus son **77
   líneas**, medido. Para eso hay que tener el plan **antes** de aplicarlo, que
   es para lo que `acciones.ts` existe.
2. **Eliminar no es completar.** Borra la línea y su subárbol de la nota, no
   escribe en el LOG, y no se deshace desde la interfaz. Confirmación aparte y
   más dura.
3. **Ninguno de los dos borra por su cuenta.** «Completar y archivar» deja la
   tarea `[x]` en su lugar (§12): las vistas la ocultan, el archivo no la pierde.
4. **El aviso de Ctrl-Z, ahora que está medido** (§5.5 punto 15): con la nota
   **abierta** el editor sí deshace nuestra escritura; con la nota **cerrada** no
   hay nada que lo deshaga. El LOG está siempre cerrado. Eso es lo que justifica
   la confirmación, y conviene que el texto lo diga.

## Las trampas que ya costaron caro

- **Nada reescribe el archivo entero.** Por rango, con `vault.process()`.
- **Toda escritura lleva el texto que esperaba encontrar** (invariante 10), y el
  lote es todo o nada — dentro de un archivo.
- **`process` con un contenido idéntico no dispara `modify` ni `changed`** y deja
  el `mtime` igual. Sobre un vault en Sync eso importa.
- **Antes de escribir se fuerza `save()`** sobre toda vista abierta del archivo:
  sin eso se verifica contra una foto de hasta 2 segundos de atraso.
- **Insertar al final de un archivo no es lo mismo según cómo termine**: cinco de
  las siete notas no terminan en `\n`. `insertarLineas` lo documenta.
- **Un log crece por abajo.** Una sección nueva va al final. Ese bug no lo agarró
  ninguno de los 60 tests del corpus: apareció **mirando la salida**.
- **Las secciones del LOG no se duplican**: es el invariante 6, y `planDeArchivado`
  ya lo cumple. Cualquier cosa que se le agregue tiene que seguir cumpliéndolo.

## Antes de escribir código, medir

1. **Cuántas tareas tienen subárbol**, que es lo que decide el default de la §12
   entre descartar y archivar. Está `archivarPorDefecto`, pero no está contado
   sobre el corpus: contarlo con `npm run test:corpus` y decir el número.
2. **Cuánto tarda una escritura de dos archivos.** La de uno cuesta 8 ms de
   `save()` más el `process`, medido. La de dos es el doble más el LOG, que se
   lee entero cada vez. Si crece, medirlo antes de que se note.
3. **La línea de base del ciclo de medición sigue sin reproducirse.** Si aparece
   un aviso, medirla de nuevo antes de concluir nada.

## Los tests

- **`ubicar.test.ts` es el que más crece.** Insertar y borrar corren las líneas
  de abajo: hay que fijar como propiedad que un lote mixto se aplique igual sin
  importar el orden en que vengan los cambios, y que siga siendo todo o nada.
- El **invariante 6** ya está en `test/archivado.test.ts` y en el corpus:
  archivar y volver a leer recupera texto, fecha, nota y proyecto, y archivar N
  bloques en el mismo camino crea el camino una sola vez.
- El **invariante 9** —parsear y reescribir sin cambios no altera un byte— tiene
  que seguir valiendo con el LOG.
- Los planes nuevos, en `acciones.test.ts`, con `aplicarPlan`.
- Y si se toca algún filtro, volver a correr con `{ numRuns: 20000 }` las dos
  propiedades: encontró dos bugs que los casos no.

## Dónde puede escribir

Sobre `0_inbox/tareas_PRUEBA.md`, que está habilitada en ajustes. **Y por primera
vez sobre el LOG**, que es donde el archivado escribe: conviene una copia de
`tareas_LOG.md` antes de la primera prueba en vivo.

Vale la regla dura de `CLAUDE.md`: **no escribas vos en el vault**, ni con las
herramientas del MCP de Obsidian, que puede.

## Cómo quiero trabajar

- **Plan primero**, y esperá que lo apruebe.
- **Aclarame siempre de qué consola hablás.** Hay dos: la terminal, y la de
  Obsidian (*Ver → Alternar herramientas de desarrollo*). Etiquetá los bloques.
- **Medí en vez de suponer**, y acordate de que **la spec también es una medición
  con fecha**.
- **Una reproducción tiene que copiar la forma del sistema.** En la sesión 5 una
  reproducción con un diff mínimo descartó la causa correcta durante dos vueltas.
- **Cuando una propiedad falle, fijate primero si la propiedad dice la verdad.**
- **Una hipótesis que no falla su test se revierte.**
- **Mirá la salida, no solo los tests** — y cuando el ojo no llegue, convertí la
  regla en algo que el pipeline pueda comprobar.
- Español en comentarios, documentación y mensajes de commit.

## Qué espero al final

El ⋯ con cuatro ítems, el LOG recibiendo bloques bien formados, el descarte
físico con su confirmación, `npm test` y `npm run test:corpus` en verde, y una
**lista concreta de qué observar** en Obsidian, que es lo único que no se puede
comprobar desde Claude Code:

- que la confirmación diga **cuántas líneas y en qué nota**, y que el número sea
  el correcto sobre una tarea con subárbol;
- que el bloque quede **bien puesto en el LOG**: bajo la nota de origen, al final
  de su sección, sin duplicar headings al archivar dos veces seguidas;
- que las notas sin checkbox del subárbol lleguen **verbatim**;
- que la tarea quede `[x]` en su nota y **no se borre**;
- que eliminar sí borre, y solo el subárbol;
- que cancelar cualquiera de las dos **no escriba nada**;
- y que los cuatro gestos del editor que ya costaron caro sigan igual: clic al
  final de la línea, flecha, Backspace desde abajo y Enter.
