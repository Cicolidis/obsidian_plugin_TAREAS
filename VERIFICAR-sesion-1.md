# Qué verificar — sesión 1

El comportamiento del editor —cursor, teclado, cómo se ve algo— no se puede
comprobar desde Claude Code. Esto es la lista de lo que hay que mirar, con **qué
tiene que quedar exactamente** en cada caso, no un «probalo a ver».

## Antes de empezar

```bash
npm run deploy
```

Escribe en el vault (`.obsidian/plugins/tareas-outline/`), por eso no se corrió
en la sesión. Después, en Obsidian: Configuración → Complementos de la comunidad
→ activar **Tareas (outline)**.

En la pantalla de ajustes del plugin están el interruptor del checkbox
automático y la lista de notas. **Si algo molesta, se apaga ahí**: no hay que
desinstalar nada.

Todo lo de abajo se prueba en `0_inbox/tareas_COLE.md`, que es donde conviven
las dos clases de bullet.

---

## Enter

| # | Partís de | Con el cursor | Tiene que quedar |
|---|---|---|---|
| 1 | `- pasar notas a la app` | al final | línea nueva **`- [ ] `**, con el cursor después del espacio |
| 2 | `	- 1A` | al final | **`	- [ ] `** — con el mismo tab, no al ras |
| 3 | `- [ ] IB` | al final | `- [ ] ` **una sola vez**. Mirar que no salga `- [ ] [ ] ` |
| 4 | `- [x] algo hecho` | al final | `- [ ] ` **destildado** |
| 5 | `- pasar notas a la app` | después de «pasar» | abajo queda `- notas a la app`, **sin** checkbox |
| 6 | una línea de texto suelto | al final | una línea vacía, **sin bullet ni checkbox** |
| 7 | `- ` recién creado y vacío | al final | **salís de la lista**: el guion desaparece o desindenta |
| 8 | `- [ ] ` recién creado y vacío | al final | ídem 7: **tenés que poder salir de la lista** |
| 9 | `- pasar notas a la app` | al **principio**, antes del guion | anotar qué pasa: no está legislado |
| 10 | cualquier bullet en `1_proyectos/…` u otra nota | al final | **nada cambia**: nace `- ` como siempre |

El **7 y el 8 son los importantes**: si alguno deja un `- [ ] ` del que no se
puede salir apretando Enter, el prototipo está mal y hay que decirlo, porque
significa quedar atrapado en la lista.

## Backspace

| # | Partís de | Con el cursor | Tiene que quedar |
|---|---|---|---|
| 11 | la `- [ ] ` recién nacida del caso 1 | al final (que es donde queda solo) | **`- `** — el bullet pelado para escribir una nota de tarea |
| 12 | esa misma `- ` del caso 11 | al final | ahora **sí** se une con la línea de arriba |
| 13 | `- [ ] tangram` con una línea debajo | al principio de la línea de abajo | unión normal: el `[ ] ` de arriba **no** se pierde |
| 14 | uno de los `- [ ]` vacíos que ya usás de separador | al final | se convierte en `- ` — **es la consecuencia conocida**, no un bug |
| 15 | seleccionar tres líneas terminando en una `- [ ] ` vacía | Delete | **se borra la selección entera**, no solo el checkbox |

El **12 es el costo del diseño**: unir una tarea vacía con la de arriba pasa a
costar dos Backspace en vez de uno. Si en el uso resulta molesto, se dice y se
cambia la regla B.

## Convivencia con Outliner

| # | Qué | Por qué |
|---|---|---|
| 16 | Repetir 1, 2 y 11 con **Outliner desactivado** | La forma de la transacción cambia. La regla no la mira, pero eso está probado offline, no en la app |
| 17 | Repetir 1 con `stickCursor` en «Never» | Cambia dónde puede pararse el cursor, que es de qué depende el caso 11 |

---

## Si algo no coincide: medirlo, no discutirlo

En la consola de Obsidian (Ver → Alternar herramientas de desarrollo), con el
cursor en la nota, pegar entero el contenido de `scripts/espia.js`. Después:

1. apretar **una sola vez** la tecla del caso que falló,
2. copiar el bloque que imprime la consola,
3. `espiaTareas.off()` para apagarlo.

Lo que importa de esa salida son tres cosas: el rango `[from, to]`, el texto
insertado, y si dice `← CRUZA A LA LÍNEA DE ABAJO`. Con eso se sabe qué forma
tiene el cambio y el arreglo sale medido.

---

## Lo que este prototipo NO hace todavía

Es descartable por diseño (spec §20 paso 1): no hay token `%%t:…%%`, ni store,
ni vistas, ni colores, ni escritura sobre el vault. Escribe `[ ] ` y saca `[ ] `,
nada más.

---

# Segunda vuelta

Resultado de la primera: **todos los casos con resultado esperado dieron el
resultado esperado.** Lo que sigue es lo que quedó abierto.

## Ya resuelto sin tocar código

**Casos 9 y 13** — «es imposible poner el cursor antes del guion». Correcto, y
no es una falla: es `stickCursor` de Outliner, que con `bullet-and-checkbox`
impide que el cursor entre al marcador y al checkbox. Los dos casos son
inalcanzables en esta configuración, así que no hay nada que verificar ahí.

## Corregido: el caso 17

El síntoma eran dos cosas —«no genera el ícono del checkbox» y «el cursor se
para delante de los elementos»— pero es **un solo defecto**: el cursor quedaba
cuatro caracteres antes, y Live Preview muestra el marcado en crudo cuando el
cursor cae dentro de un token. Sin ícono porque el cursor estaba mal, no además.

La causa está leída en el código de Outliner, no supuesta: su
`ChangesApplicator.apply` hace `editor.replaceRange(...)` y **después**
`editor.setSelections(...)`. Son dos transacciones, y la segunda calcula el
cursor sobre una línea que todavía no tenía el `[ ] `. Con `stickCursor`
encendido, el `transactionExtender` de Outliner volvía a empujar el cursor fuera
del checkbox y tapaba el problema.

| # | Con `stickCursor` en «Never» y Outliner encendido | Tiene que quedar |
|---|---|---|
| 21 | Caso 1 otra vez | `- [ ] ` **con el ícono dibujado** y el cursor **después** del espacio |
| 22 | Caso 2 otra vez | ídem, y con el tab |
| 23 | En esa `- [ ] ` vacía, flecha izquierda cuatro veces | el cursor **entra** al checkbox y se queda: no lo devuelve de un salto |

El 23 importa porque la defensa del cursor dura **una sola transacción**. Si el
cursor rebota al final cada vez que apretás la flecha, la ventana se quedó
abierta de más.

## Sin medir: el caso 16 (Outliner desactivado, checkbox a la altura del padre)

Acá hace falta un control antes de arreglar nada. **El filtro no puede estar
quitando el tab**: la corrección inserta cuatro caracteres dentro del texto que
ya venía y no toca la sangría. O sea que o lo hace Obsidian por su cuenta, o hay
un segundo paso de reindentado.

| # | Qué | Qué discrimina |
|---|---|---|
| 24 | Con Outliner desactivado **y el interruptor del plugin apagado**, Enter al final de `	- 1A` | Si el bullet nuevo igual nace a la altura del padre, **es Obsidian y no el plugin**: no hay nada que arreglar |
| 25 | Si el 24 sale bien (nace con el tab), repetir con el interruptor encendido y **el espía puesto** | Ahí sí es nuestro, y el espía dice exactamente qué transacción llega |

Para el 25: pegar `scripts/espia.js` en la consola, apretar Enter **una sola
vez**, copiar el bloque, `espiaTareas.off()`. Lo que importa es el rango
`[from, to]` y el texto insertado.

## El teléfono: por qué no aparece en el menú

No es un problema de sincronización. **El buscador de complementos de la
comunidad solo lista plugins publicados en el registro de Obsidian**, y este no
lo está ni tiene por qué estarlo. Nunca va a aparecer ahí.

Este vault no usa Obsidian Sync (no hay `sync.json` ni plugin de
sincronización), así que la ruta elegida es **BRAT**, que ya está instalado.

### Lo que falta para que funcione

Ya está hecho: el repositorio es
[`Cicolidis/obsidian_plugin_TAREAS`](https://github.com/Cicolidis/obsidian_plugin_TAREAS)
y la release `0.0.1` tiene adjuntos los tres archivos que BRAT baja.

En el teléfono, en el vault ya sincronizado:

1. Ajustes → BRAT → **Add beta plugin**.
2. Pegar `Cicolidis/obsidian_plugin_TAREAS` y aceptar.
3. Ajustes → Complementos de la comunidad → activar **Tareas (outline)**.

De ahí en más, cada `npm run release` le llega como actualización.

### Y recién ahí, los casos del teléfono

| # | Qué |
|---|---|
| 18 | Caso 1 en el teléfono, tecleando normal |
| 19 | Caso 1 aceptando una **sugerencia de autocorrección** antes de apretar Enter |
| 20 | Caso 11 en el teléfono |

Es el punto 2 de la §15 de la spec y la única parte del prototipo con una
hipótesis **sin fundamento medido**: el teclado de software escribe por
composición (IME) y las transacciones pueden no tener la misma forma.

Si 18–20 fallan, la salida está prevista y no cuesta nada: se apaga el
interruptor y en el teléfono se escribe `- [ ]` a mano, como hoy.

---

# Tercera vuelta

De la segunda quedó **cerrado casi todo**:

- **18, 19, 20 (teléfono): OK.** Era el único riesgo capaz de cambiar el
  diseño (§15 punto 2 de la spec). El teclado por composición no rompe el
  filtro. La salida de emergencia queda sin usar.
- **21, 22 (el arreglo del cursor): OK.**
- **23: OK.** El cursor entra al checkbox, lo recorre y sale hasta el
  comienzo de la línea. La defensa dura una transacción, como tenía que ser.
- **24 (control): el tab se conserva.** Obsidian solo, sin Outliner y sin el
  plugin, hace nacer la línea nueva con su tab y como bullet.

## Lo que el log invalidó

La prueba 25 no midió nada: **el espía tiraba excepción dentro del
`dispatch`**, la transacción nunca llegaba a despacharse, y Obsidian caía a su
camino de salida insertando un salto pelado. «Al ras, sin bullet» era el espía,
no el plugin. Ya está corregido: ahora el logueo va dentro de un `try` y el
`dispatch` original se llama siempre.

## Prueba 26 — el caso 16, otra vez y sin espía

Puede que ya esté resuelto: el filtro aplastaba el `userEvent` de `input.type`
a `input`, y CodeMirror discrimina por el subtipo —`indentOnInput` solo reacciona
a `input.type`—, así que apagaba comportamiento del entorno sin que se notara.
Ahora se conserva tal cual.

```bash
npm run deploy
```

Y desactivar/activar **Tareas (outline)** en Obsidian para que cargue el bundle
nuevo.

| # | Configuración | Acción | Tiene que quedar |
|---|---|---|---|
| 26 | Outliner **desactivado**, «Checkbox automático» **encendido**, sin espía | Enter al final de `	- 1A` | `	- [ ] ` **con el tab**, al mismo nivel |

Si sale bien, el caso 16 estaba causado por el `userEvent` y no queda nada
abierto. Si sigue naciendo al ras, **ahí sí** va el espía corregido: pegarlo,
un solo Enter, copiar el bloque, `espiaTareas.off()`.
