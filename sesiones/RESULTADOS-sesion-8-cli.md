# Verificación del paso 6c, corrida por Claude Code con la CLI

Corrido con `scripts/verificar/` sobre el vault de prueba. commit 91fde07 · main.js 187785 bytes, 2026-09-30T03:16:58.275Z.

**61 en verde · 0 fallas · 3 a mano**, de 64.

| # | Qué | Estado | Qué midió |
|---|---|---|---|
| A1 | sin fecha ni grupo: los dos indicadores apagados, y ocultos sin hover | ✅ | 7 botones · 📅 activo=false opacidad=0 · 🔁 activo=false opacidad=0 |
| A2 | poner fecha desde el 📅 (Mañana): queda encendido y visible sin hover | ✅ | activo=true opacidad=1 · disco: «- [ ] tarea sin fecha ni grupo %%t:due=2026-10-01%%» |
| A3 | el tooltip del 📅 dice la fecha con el año | ✅ | «Vence el 1 oct 2026.» |
| A4 | poner un grupo: el 🔁 queda encendido y dice el grupo | ✅ | menú: 1 · mensual / 2 · semanal / Grupo nuevo… / No es cíclica · «Cíclica, en el grupo «mensual».» · disco: «- [ ] tarea para ponerle grupo %%t:rec=mensual%%» |
| A5 | cíclica con due=5 (hoy ya pasó el 5): dice el día y la fecha del mes que viene | ✅ | «Vence el día 5 de cada mes; el próximo, el 5 oct.» (esperaba «5 oct») |
| A6 | clic en el 📅 abre el submenú y no escribe | ✅ | 9 ítems · archivo intacto |
| A7 | clic en el 🔁 abre el submenú de recurrencia | ✅ | 1 · mensual / 2 · semanal / Grupo nuevo… / No es cíclica |
| A8 | «Sin fecha» apaga el 📅 y el ★ no se corre | ✅ | ★ en x=757.6 sin fecha y x=757.6 con fecha |
| A9 | token roto: los siete inertes y dicen que es ilegible | ✅ | 7 botones · inertes 7 · «Esta tarea tiene el token ilegible: no se puede escribir sobre ella.» |
| A10 | con la ventana angosta, ¿el margen se come demasiado texto? | ✋ a mano | es un juicio sobre cómo se ve |
| A11 | apagar los dos indicadores: cinco botones sin recargar, margen más angosto | ✅ | 5 botones · margen 168.4 → 128.4 px |
| A12 | cuánto cuestan los dos indicadores en el ancho del margen | ✅ | 40 px (168.4 con, 128.4 sin) |
| B1 | «semana»: siete ítems, los días de lunes a domingo | ✅ | hoy es miércoles: Hoy · 30 sep · Mañana · 1 oct · Lunes · 5 oct · Martes · 6 oct · Viernes · 2 oct · Sábado · 3 oct · Domingo · 4 oct |
| B2 | «cronológico»: arranca en hoy, día por día, siete ítems | ✅ | Hoy · 30 sep · Mañana · 1 oct · Viernes · 2 oct · Sábado · 3 oct · Domingo · 4 oct · Lunes · 5 oct · Martes · 6 oct |
| B3 | «discontinuo»: seis ítems y el último es «En 30 días» | ✅ | Hoy · 30 sep · Mañana · 1 oct · Pasado mañana · 2 oct · En una semana · 7 oct · En dos semanas · 14 oct · En 30 días · 30 oct |
| B4 | en ninguno de los tres se repite una fecha | ✅ | ninguna repetida, en los tres |
| B5 | sobre una tarea con fecha de mañana, el tilde marca uno solo | ✅ | semana: Mañana · 1 oct · cronologico: Mañana · 1 oct · discontinuo: Mañana · 1 oct |
| B6 | cuál de los tres órdenes convence | ✋ a mano | es una elección |
| C1 | el selector nativo aparece solo al abrir «Otra fecha…» | ✋ a mano | el selector del navegador no está en el DOM: no se puede leer desde la CLI |
| C2 | con la grilla: el mes actual, lunes primero, y hoy marcado | ✅ | «septiembre 2026» · 30 celdas · hoy: «2026-09-30» · columnas: L M M J V S D |
| C3 | un clic en un día elige y no acepta: el campo cambia y aparece «Va a escribir» | ✅ | campo=2026-09-20 · modal abierto |
| C4 | aceptar escribe lo mismo que decía «Va a escribir» | ✅ | disco: «- [ ] tarea para la grilla %%t:due=2026-09-20%%» |
| C5 | navegar dos meses adelante y dos atrás: la grilla no cambia de alto | ✅ | altos 498/498/498/498/498 · septiembre 2026 → octubre 2026 → noviembre 2026 → octubre 2026 → septiembre 2026 |
| C6 | escribir a mano una fecha de otro mes: la grilla se va a ese mes y la marca | ✅ | «febrero 2027», elegido 14 |
| C7 | en una cíclica la grilla son los 31 días, sin semanas | ✅ | 31 celdas · cabecera de días: false |
| C8 | elegir el 31 y aceptar: due=31, y el aviso dice que guarda el día | ✅ | disco: «- [ ] regar los canteros %%t:due=31;rec=mensual%%» · aviso: «Vencimiento: día 31 de cada mes. Es cíclica, así que guarda el día y no la fecha.» |
| D1 | el submenú ofrece los grupos en uso y después la semilla, numerados | ✅ | 1 · mensual / 2 · semanal / Grupo nuevo… / No es cíclica |
| D2 | la tecla 2 con el menú abierto etiqueta y cierra | ✅ | disco: «- [ ] tarea sin fecha ni grupo %%t:rec=semanal%%» · menús abiertos: 0 |
| D3 | un grupo nuevo desde «Grupo nuevo…» | ✅ | disco: «- [ ] tarea para la grilla %%t:rec=lunes%%» |
| D4 | reabierto: ordenado por uso, sin repetir los sugeridos | ✅ | 1 · mensual / 2 · lunes / 3 · semanal / Grupo nuevo… / No es cíclica |
| D5 | sugeridos «quincenal, anual»: aparecen detrás de los que están en uso | ✅ | 1 · mensual / 2 · lunes / 3 · semanal / 4 · quincenal / 5 · anual / Grupo nuevo… / No es cíclica |
| D6 | sugeridos vacío: no sugiere nada, y los que existen siguen | ✅ | 1 · mensual / 2 · lunes / 3 · semanal / Grupo nuevo… / No es cíclica |
| D7 | «con;punto» se descarta: rompería el token | ✅ | guardado: ["anual"] |
| D8 | abrir el submenú, cerrarlo con Escape y teclear 2: se escribe el dígito | ✅ | menús abiertos tras Escape: 0 · línea: «- [ ] 2tarea con fecha absoluta %%t:due=2026-» · disco sin rec: true |
| E1 | el modal tiene tres botones y el foco en «Cancelar» | ✅ | botones: Cancelar / Archivar y reiniciar / Reiniciar · foco: Cancelar |
| E2 | dice cuántas tareas y notas, y cuánto va al historial | ✅ | Reiniciar un grupo cíclico Se destildan 3 tareas y se les borra la fecha de completado, en 2 notas. En: tareas_PRUEBA, tareas_PRUEBA_2. No se toca ninguna tarea que no lleve la etiqueta de este grupo, ni los workbenches, ni el vencimiento. «Archivar y reiniciar» copia 13 líneas al historial antes de |
| E3 | Enter sin tocar nada no escribe | ✅ | modal cerrado · archivos intactos |
| E4 | Cancelar: nada escrito en ningún lado | ✅ | las tres notas y el historial, byte a byte iguales |
| E5 | «Archivar y reiniciar»: el aviso dice tareas, notas y líneas | ✅ | 3 tareas reiniciadas en 2 notas, y 13 líneas al historial. |
| E6 | el historial tiene una sección por nota de origen | ✅ | headings: # tareas_VIEJA · # tareas_PRUEBA_2 · # tareas_PRUEBA · ## p_Huerta |
| E7 | un heading de nivel 1 por nota, aunque una aportó dos tareas | ✅ | # tareas_VIEJA · # tareas_PRUEBA_2 · # tareas_PRUEBA |
| E8 | el bloque con hijos va entero, sin checkboxes ni token | ✅ | - regar los canteros [✓ 2026-09-30] ⏎ ⇥- revisar el riego por goteo ⏎ ⇥- anotar cuánto tardó |
| E9 | la raíz lleva la fecha de completado, no la de hoy | ✅ | «- podar el limonero [✓ 2026-09-15]» |
| E10 | las etiquetadas quedan [ ] y sin done; due y rec siguen | ✅ | - [ ] regar los canteros %%t:rec=mensual%% \| - [ ] podar el limonero %%t:due=5;rec=mensual%% \| - [ ] pagar la cuota del club %%t:rec=mensual%% |
| E11 | las tareas sin etiqueta no se tocaron | ✅ | - [x] tarea ya hecha sin grupo %%t:done=2026-09-01%% \| - [x] completada sin etiqueta %%t:done=2026-09-10%% |
| E12 | otra vuelta de archivar y reiniciar: no crea headings nuevos | ✅ | headings 4 → 4 · «regar los canteros» 2 veces en el historial |
| E13 | «Reiniciar» a secas destilda y no escribe en el historial | ✅ | historial igual · - [ ] - [ ] |
| E14 | con todo pendiente: «no hay nada que reiniciar» y no escribe | ✅ | No hay nada que reiniciar en «mensual»: ninguna tarea del grupo está completada. |
| E15 | con la nota de historial inexistente, el segundo botón no aparece y dice por qué | ✅ | botones: Cancelar / Reiniciar |
| F1 | el modal cuenta 2 tareas en 2 notas | ✅ | Reiniciar un grupo cíclico Se destildan 2 tareas y se les borra la fecha de completado, en 2 notas. En: tareas_PRUEBA, tareas_PRUEBA_2. No se toca ninguna tarea |
| F5 | congelado y con el texto cambiado: se niega y dice que no escribió nada | ✅ | No se escribió nada, en ninguna nota NI en el historial. En tareas_PRUEBA alguna línea ya no está donde estaba, o aparece repetida. Volvé a intentar; si tenés el índice congelado, apagalo. |
| F6 | el historial tiene las mismas líneas que antes | ✅ | 4 → 4 líneas |
| F7 | la otra nota quedó intacta, con su tarea en [x] | ✅ | «- [x] pagar la cuota del club %%t:rec=mensual;done=2026-09-30%%» |
| F9 | descongelado y sin tocar nada: ahora escribe en las dos y en el historial | ✅ | 2 tareas reiniciadas en 2 notas, y 12 líneas al historial. |
| G1 | clic en el vacío a la derecha de una tarea: el cursor cae en esa línea | ✅ | línea 19, col 30: «- [ ] tarea con fecha absoluta %%t:due=2» |
| G2 | flecha derecha desde el fin del texto cruza el token de un teclazo | ✅ | de 24:33 a 25:0 |
| G3 | Backspace desde el comienzo de la línea de abajo: saca el checkbox, y el segundo une limpio | ✅ | 1.º «- tarea de abajo para unir» · 2.º «- [ ] tarea de arriba para unir tarea de abajo para unir» |
| G4 | Enter al final de una tarea: nace «- [ ] » y el token se queda arriba | ✅ | «- [ ] tarea para partir con token %%t:id=c3d4;wb=foco%%» ⏎ «- [ ] » |
| G5 | tildar una tarea con fecha: completa, no toca el due y el cursor no se mueve | ✅ | disco: «- [x] tarea para tildar con fecha %%t:due=2026-11-20;done=2026-09-30%%» · cursor 16:10 → 16:10 |
| G6 | Cmd+clic en el checkbox archiva al historial | ✅ | historial: # tareas_VIEJA · # tareas_PRUEBA · - tarea sin fecha ni grupo [✓ 2026-09-30] |
| G7 | una nota que no es de tareas, al lado de una que sí: no se le cobra margen | ✅ | otra-nota: clase false · margen 0 px · la de tareas conserva el suyo: true |
| G8 | pasar el mouse: aparecen los siete y no se apagan yendo hacia ellos | ✅ | sobre el texto: 1,1,1,1,1,1,1 · botones visibles yendo al margen: 7,7,7,7,7,7,7 |
| H1 | el espía demuestra que el parche está puesto | ✅ | parche comprobado: true |
| H2 | la cuenta del ciclo de medición, con la ventana angosta y subiendo | ✅ | Measure loop restarted 0 · Viewport failed 0 · editor 341 px, lineWrapping true · 40 pasos · ventana visible |
