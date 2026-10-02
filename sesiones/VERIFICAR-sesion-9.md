# Qué verificar — sesión 9: las alternativas elegidas y la sección «Desarrollo»

Claude Code ya corrió con la CLI lo que se puede medir:

- `sesiones/RESULTADOS-sesion-9-cli.md`: que lo que no elegiste **ya no está**
  —ni en la nota, ni en los ajustes—, que «Desarrollo» quedó al final con los
  tres instrumentos, y que una configuración de antes carga sin romper.
- `sesiones/RESULTADOS-sesion-8-cli.md`: la guía del 6c entera, otra vez, sobre
  este binario.

Lo que queda es lo que se juzga **mirando y usando**. Son **5 comprobaciones**.

## 0. Desplegar en tu vault, y sobre qué binario

Lo de esta sesión todavía no está en tu vault real: hasta acá solo se desplegó
en el de prueba. **Terminal:**

```bash
cd ~/Downloads/claude/obsidian_plugin_TAREAS && npm run deploy && echo "commit $(git rev-parse --short HEAD)" && stat -f '%Sm  %z bytes' "$HOME/Downloads/obsidian/mental palace/.obsidian/plugins/tareas-outline/main.js"
```

Después, en Obsidian, apagá y prendé el plugin. Pegá las dos últimas líneas al
principio del informe.

## 1. Lo que solo se ve usándolo

| # | Qué hacer | Qué mirar |
|---|---|---|
| M1 | Angostá la ventana hasta la mitad y pasá el mouse por varias tareas | ¿El margen de botones se come demasiado texto? ¿Los botones aparecen sin titilar cuando vas del texto hacia ellos? Si molesta, decime con qué ancho |
| M2 | Poné una tarea en prioridad alta y otra en muy alta (⋯ → prioridad), con una hija abajo. Miralas en tema claro y en oscuro | ¿Se distinguen los dos niveles por la altura de la barra y por el anillo del checkbox, aun sin mirar el color? ¿La línea fina de la hija se lee como parte del bloque? |
| M3 | Ponele fecha a dos o tres tareas reales con ⋯ → «Fecha…» | ¿Te alcanzan los seis atajos (hoy, mañana, pasado, 7, 14 y 30 días)? Lo que falte se elige con la grilla |
| M4 | «Otra fecha…» en una tarea normal y en una cíclica | ¿La grilla es cómoda? Un clic **elige** y «Poner la fecha» **escribe**: ¿se entiende así o esperabas que el clic aceptara? |
| M5 | Abrí los ajustes del plugin en tu vault | Tus notas, tus dos favoritos y la nota de historial siguen como estaban, y los tres instrumentos están juntos en «Desarrollo», al final |

## 2. Dos ajustes de tu vault que quedaron de la verificación del 6c

No son pruebas: son restos que conviene volver a su lugar.

- **«Nota de historial»** apunta a `0_inbox/tareas_LOG_PRUEBA.md`. Volvela a
  `0_inbox/tareas_LOG.md` cuando quieras que el archivado escriba en el de
  verdad.
- **«Registrar eventos en la consola»** (ahora en «Desarrollo») está encendido.
  Apagalo si no estás midiendo nada.

## Para anotar

Se llena y se pega entero como prompt.

```
commit:
main.js:

M1:
M2:
M3:
M4:
M5:

Otras cosas que vi:
```

## Lo que contestó el usuario (01/10/2026)

| Id | Respuesta | Qué se hizo |
|---|---|---|
| M1 | Bien | — |
| M2 | En oscuro, bien. En claro, el ocre de alta no se destaca | Alta pasó a naranja `#d16f00` en tema claro (el signo `!`, a `#a85000`). Medido y con capturas por `scripts/verificar/colores.mjs`; detalle en la §14 |
| M3 | Alcanzan, aunque solo va a estar seguro usando el plugin entero | — |
| M4 | Se entiende | — |
| M5 | Mejor, pero hace falta una revisión final: que cada ajuste sea necesario, en categorías y con separaciones visuales claras | Paso 10 de la §20 |
| §2 | Ajustes del vault real corregidos a mano | — |

Y una propuesta aprobada: **unir debajo de una tarea con el token ilegible**
pone el texto absorbido antes del token, con un espacio. Queda como tarea suelta
en la §20.
