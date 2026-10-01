# Verificación de la sesión 9, corrida por Claude Code con la CLI

Corrido con `scripts/verificar/` sobre el vault de prueba. commit e3d2236 (con los cambios que quedaron en el commit 04e6e6e) · main.js 174744 bytes, 2026-10-01T02:32:48.062Z.

**7 en verde · 0 fallas · 0 a mano**, de 7.

| # | Qué | Estado | Qué midió |
|---|---|---|---|
| S1 | la fila vive solo en el margen: ninguna adentro de una línea | ✅ | 0 adentro de una línea · 17 en el margen |
| S2 | en `body` solo las clases de lo elegido | ✅ | tareas-estilo-barra tareas-estilo-checkbox tareas-revelar-hover |
| S3 | los cinco ajustes de las alternativas ya no están | ✅ | 20 ajustes, ninguno de los cinco |
| S4 | «Desarrollo» es la última sección, con los tres instrumentos adentro | ✅ | después del título: Decoraciones en la nota, Congelar el índice en memoria, Registrar eventos en la consola |
| S5 | la prioridad muy alta: barra en el margen y color en el checkbox | ✅ | barra 3px (3px 16.8px) · checkbox #e07070 · hija 1px · fondo rgba(0, 0, 0, 0) |
| S6 | el menú de fecha: los seis atajos discontinuos, y «Otra fecha…» abre la grilla | ✅ | Hoy · 30 sep · Mañana · 1 oct · Pasado mañana · 2 oct · En una semana · 7 oct · En dos semanas · 14 oct · En 30 días · 30 oct · grilla: true |
| S7 | una configuración de antes carga sin romper, y al guardar se limpia | ✅ | cargó: 17 filas en el margen, body tareas-estilo-barra tareas-estilo-checkbox tareas-revelar-hover · después de guardar no queda ninguna clave vieja |
