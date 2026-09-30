# Qué verificar — paso 4a, tercera vuelta

Los cinco arreglos de la segunda vuelta. **Veinte comprobaciones**, y la
plantilla al final.

Sigue pendiente lo de siempre: mirar los **tres estilos de prioridad**, que es lo
que quedó de la vuelta anterior y no depende de esto.

Teclas de este Mac: `Cmd+→` y `Cmd+←` hacen de `Fin` e `Inicio`.

---

## Qué cambió

| # | Qué reportaste | Qué se hizo |
|---|---|---|
| **P11** | subir la prioridad de una hija que hereda «muy alta» la dejaba en «alta» | Los comandos parten del nivel que **se ve**. Y cuando no se puede bajar, lo dice |
| **U5** | al unir, la línea de abajo subía con su checkbox | Unir deja **una línea limpia**: con espacio y sin el marcador de la absorbida |
| — | «que ofrezca primero un espacio entre ambos textos» | Es lo mismo que U5: una sola regla |
| **P10** | el checkbox se «desarmaba» al correr un comando | Era el cursor, y lo movía mi filtro. Ahora los cambios que vienen del disco no pasan por él |
| **T1** | costaba pararse al final de la línea; saltaba abajo | El clic se corrige antes de que el rango atómico lo mande abajo |

Lo que lo explica todo: **cuando el archivo cambia en disco, Obsidian mete el
cambio en el editor como un diff con `userEvent: "set"`** —leído del asar—. Eso
nunca es el gesto de nadie, y ahora el filtro ni lo mira.

---

## 0. Antes de empezar

1. *Configuración → Complementos de la comunidad* → apagar y prender **Tareas
   (outline)**.
2. En los ajustes hay uno nuevo: **«Unir tareas deja una línea limpia»**,
   encendido por omisión.
3. Que `tareas_PRUEBA.md` siga limpia:

```bash
grep -n '%%t:' "$HOME/Downloads/obsidian/mental palace/0_inbox/tareas_PRUEBA.md" | grep -vE '%%t:[^%]*%%[ \t]*$'
```

---

## A. La prioridad heredada *(era P11)*

Preparate un árbol: una tarea madre con dos hijas y una nieta.

| # | Qué hacer | Qué tiene que quedar |
|---|---|---|
| A1 | Subir la madre a **muy alta**. Cursor sobre una **hija** → **Subir** | «La prioridad ya está en muy alta.» y **nada cambia**. Antes le ponía `p=1` y parecía que bajaba |
| A2 | Sobre esa misma hija → **Bajar** | Pasa a **alta**: se pinta con su propio color adentro del bloque de la madre. En modo fuente tiene `p=1` |
| A3 | Sobre esa hija (ahora alta) → **Bajar** otra vez | Aviso: «Esta tarea hereda la prioridad de su tarea madre, así que no se puede bajar sola…» y **no escribe nada** |
| A4 | Sobre la **nieta** de la hija en `p=1` → **Subir** | Pasa a **muy alta** (`p=2`): partió de la que heredaba, que era alta |
| A5 | Bajar la **madre** a normal. Mirar la hija de A2 | La hija sigue en `p=1` con su color; las que no tenían propio quedan sin marca |
| A6 | Una tarea suelta, sin madre con prioridad → **Bajar** | «La prioridad ya está en normal.» |

---

## B. Unir dos tareas *(era U5 y el espacio)*

| # | Preparás | Qué hacer | Qué tiene que quedar |
|---|---|---|---|
| B1 | `- [ ] comprar` y debajo `- [ ] pan` | Backspace desde abajo hasta unir | **`- [ ] comprar pan`** — un espacio, y sin el `- [ ] ` de abajo |
| B2 | Lo mismo | **Suprimir** desde el final de la de arriba | Lo mismo que B1 |
| B3 | La de arriba **con token** | Unir | `- [ ] comprar pan` con el token al final, escondido |
| B4 | Las **dos** con token | Unir | Ídem, y en modo fuente **un solo** `%%t:`, el de arriba |
| B5 | Debajo una línea **sin** bullet (texto suelto) | Unir | Se une **como antes**: no hay marcador que sacar y no se inventa un espacio |
| B6 | Debajo una tarea **vacía** (`- [ ] `) | Unir | No se toca: no hay contenido que separar |
| B7 | Apagar el ajuste **«Unir tareas deja una línea limpia»** y repetir B1 | Vuelve `- [ ] comprar- [ ] pan` |
| B8 | Volver a encenderlo. Repetir B1 con **Outliner desactivado** | Mismo resultado que con Outliner |
| B9 | Después de unir, mirar dónde quedó el cursor | En la **costura**, justo después del texto de arriba |

---

## C. El clic al final de la línea *(era T1)*

| # | Qué hacer | Qué tiene que quedar |
|---|---|---|
| C1 | Clic en el **vacío a la derecha** del texto de una tarea con token | El cursor queda al **final del texto**, en esa línea. Ya no salta abajo |
| C2 | Clic sobre el texto, en el medio | Donde clicaste, como siempre |
| C3 | Clic en el vacío a la derecha de una tarea **sin** token | Como siempre: no hay nada escondido que corregir |
| C4 | **Doble clic** sobre la última palabra | Selecciona la palabra |
| C5 | **Shift+clic** para extender una selección hasta el final de una tarea | Extiende, no se reemplaza por un cursor |
| C6 | **Opción+clic** (Opción sola) en otra tarea | Agrega un segundo cursor |
| C7 | Arrastrar una selección **desde el texto visible** hacia la derecha | Selecciona normal |

> El costo conocido: arrastrar **empezando** en el vacío invisible de la derecha
> ya no arranca una selección. Si te molesta, decilo.

---

## D. El cursor y el checkbox *(era P10)*

| # | Qué hacer | Qué tiene que quedar |
|---|---|---|
| D1 | Cursor en el medio del texto de una tarea → **«Asignar al workbench favorito»** | El cursor **no se mueve** y ningún checkbox se «desarma» |
| D2 | Ídem con **Subir la prioridad** | Ídem |
| D3 | Ídem sobre una tarea **con hijos** | Ni la madre ni las hijas cambian de aspecto salvo por el color |

> Si D1 o D2 siguen moviendo el cursor, **no lo arreglo a ciegas**: hay que
> medirlo con `scripts/espia.js` en la consola de Obsidian, porque entonces la
> causa es otra.

---

## E. Que no haya roto lo de antes

| # | Qué hacer | Qué tiene que quedar |
|---|---|---|
| E1 | **Enter** al final de una tarea con token | El token se queda arriba; abajo nace `- [ ] ` |
| E2 | **Enter** en el **medio** del texto | El token se queda **arriba**; la mitad de abajo sin token |
| E3 | Escribir un **espacio** al final del texto visible | Se ve |
| E4 | Escribir `%%t:id=ABCD%%` a mano al final de una tarea | Se ve entero, la línea no se pinta |
| E5 | **Flecha derecha** desde el final visible | Cruza abajo de un solo teclazo |

---

## Plantilla de respuesta

````text
# Verificación del paso 4a — tercera vuelta

## Entorno
- Obsidian:  · Tema:
- Outliner: activado / desactivado · stickCursor:

## A — la prioridad heredada
A1  ok / MAL:
A2  ok / MAL:
A3  ok / MAL:
A4  ok / MAL:
A5  ok / MAL:
A6  ok / MAL:

## B — unir dos tareas
B1  ok / MAL:
B2  ok / MAL:
B3  ok / MAL:
B4  ok / MAL:          ← ¿cuántos %%t: quedaron?
B5  ok / MAL:
B6  ok / MAL:
B7  ok / MAL:
B8  ok / MAL:
B9  ok / MAL:

## C — el clic al final
C1  ok / MAL:
C2  ok / MAL:
C3  ok / MAL:
C4  ok / MAL:
C5  ok / MAL:
C6  ok / MAL:
C7  ok / MAL:
¿Te molesta no poder arrastrar desde el vacío de la derecha?  sí / no

## D — el cursor y el checkbox
D1  ok / MAL:
D2  ok / MAL:
D3  ok / MAL:

## E — regresión
E1  ok / MAL:
E2  ok / MAL:
E3  ok / MAL:
E4  ok / MAL:
E5  ok / MAL:

## Los tres estilos de prioridad (pendiente de la vuelta anterior)
Cuál preferís: barra / checkbox / fondo
Qué le cambiarías:

## Otras cosas que noté
````
