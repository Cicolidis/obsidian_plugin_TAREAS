---
name: handoff
description: Cerrar una sesión de trabajo y escribir el PROMPT-sesion-N.md de la siguiente. Usar cuando se pida trazar el plan del paso que sigue, decidir si conviene abrir una ventana de contexto nueva, o preparar el traspaso entre sesiones de este plugin.
---

# Handoff entre sesiones

Este proyecto se construye en sesiones de una ventana de contexto cada una, y el
traspaso es un archivo `PROMPT-sesion-N.md` en la raíz que el usuario pega en la
ventana siguiente. La forma está validada en las sesiones 2, 3 y 4: seguila.

**El handoff no es un resumen.** Es el prompt con el que otra instancia arranca
sin este contexto. Todo lo que no esté escrito ahí, en la spec, en `CLAUDE.md` o
en los commits, se pierde.

## 1. Antes de escribir nada, medir el estado

No de memoria: de los comandos.

```bash
git status --short
git log --oneline "$(ls PROMPT-sesion-*.md | sort -V | tail -1 | sed 's/.*/HEAD/')" | head -20
npm test 2>&1 | grep -E "Test Files|Tests "
npm run test:corpus 2>&1 | grep -E "Test Files|Tests "
```

Los números de tests van en el handoff **contados hoy**. Los de la §2 de la spec
envejecen: el corpus se sigue escribiendo, y ya pasó de 386 a 395 a 406 tareas.

Si el árbol no está limpio, el paso anterior no está cerrado: decilo y pará.

## 2. Proponer el alcance, y decir si conviene partirlo

El orden de trabajo es la §20 de la spec. **Un paso de la §20 no siempre es una
sesión.** Partirlo cuando las mitades son trabajos de naturaleza distinta —no por
tamaño—: por ejemplo, un port re-arquitecturado con trampas ya documentadas
contra código nuevo sin precedente. Cada mitad tiene que tener su propia lista de
verificación en vivo.

Si algo del paso no se puede **mirar** todavía —una decoración de un campo que
nada permite escribir— hace falta un comando de paleta que lo habilite, o el paso
se entrega sin verificar.

## 3. Las secciones, en este orden

1. **Encabezado** con la ruta del repo y «entrar en plan mode».
2. **Dónde estamos** — qué capas están cerradas, los números de tests, y **lo que
   ya se decidió y no hay que volver a discutir**, en viñetas cortas. Nombrar los
   informes nuevos.
3. **Alcance de esta sesión** — el paso, y qué queda explícitamente afuera.
4. **Lo primero, porque decide la arquitectura** — si hay una restricción medida
   o leída del código que cambia cómo se implementa, va **antes** que los
   módulos. Si no, se salta.
5. **Cómo quiero que quede** — tabla de archivos con su capa, y las decisiones
   por archivo. Decir qué **no** se porta de Anotaciones y por qué.
6. **Las trampas que ya costaron caro** — de `CLAUDE.md` y de la spec, cada una
   con su bug detrás.
7. **Antes de escribir código, medir** — el instrumento concreto y qué decide.
   Si hay una predicción falsable de la sesión anterior, ponerla con el número.
8. **Los tests** — qué se puede probar offline y con qué patrón ya existente.
9. **Dónde puede escribir** — y la regla dura: Claude no escribe en el vault.
10. **Cómo quiero trabajar** — plan primero; aclarar de qué consola se habla;
    medir en vez de suponer; la spec también es una medición con fecha; cuando
    una propiedad falla, preguntarse primero si la propiedad dice la verdad;
    mirar la salida; español.
11. **Qué espero al final** — incluida la **lista de lo que solo puede verificar
    el usuario**, que nunca puede faltar: el comportamiento del editor —cursor,
    selección, teclado, cómo se ve algo— no se comprueba desde Claude Code.

## 4. Antes de commitear

**El repositorio es público.** Revisar que no haya contenido real de las notas:
ni textos de tarea, ni nombres de proyecto, ni títulos de heading, ni direcciones
ni nombres de personas — ni en el archivo ni en el mensaje del commit. En la
sesión 2 se colaron una dirección y un nombre en un archivo de tests y hubo que
sacarlos.

```bash
npm test && npm run test:corpus && npm run typecheck
```

## 5. Y decir si conviene ventana nueva

Casi siempre sí, y la razón se dice: la ventana vieja carga el detalle de lo ya
resuelto, que en la nueva es ruido. Conviene **no** abrirla cuando lo que sigue
es un arreglo chico de lo recién hecho, o cuando la verificación en vivo todavía
está a mitad de camino.
