# Los eventos del vault, medidos

Medido el 24 de agosto de 2026 con `scripts/espia-eventos.js` pegado en la
consola de Obsidian, sobre `0_inbox/tareas_PRUEBA.md` (388 líneas, ~309 tareas).
Todo se reproduce pegando ese script y corriendo las funciones que se nombran.

Se midió porque la §7 de la spec afirmaba, **sin verificar**, que reparsear
`tareas_COLE` «en cada tecla» es perceptible en móvil, y de ahí salía un
debounce. Las dos mitades de esa afirmación resultaron falsas.

---

## 1. `changed` no llega por tecla: llega cada 2 segundos

`espiaEventos.resumen()`, después de teclear sin parar 15 segundos:

| | |
|---|---|
| eventos | `modify`×8 · `changed`×8 |
| hueco entre `changed` consecutivos | mín **2023 ms** · mediana **2100** · máx 7288 |
| demora `modify` → `changed` | mín 16 ms · mediana **21** · máx 28 |

Los huecos crudos: `7288, 2152, 2067, 2023, 2100, 2052, 2155`. El primero es el
tiempo hasta que se empezó a teclear; los otros seis están todos entre 2023 y
2155 ms.

**Qué lo explica.** `TextFileView.requestSave` está documentado como «debounced
save in 2 seconds from now»: el editor guarda cada dos segundos mientras se
escribe, cada guardado dispara un `modify`, y `changed` llega 21 ms después.
Quince segundos de tecleo continuo produjeron **ocho** eventos, no cientos.

**Consecuencia.** Un debounce propio no junta nada: nada llega más junto que
2023 ms. Lo único que agrega es su propia espera entre la acción y el redibujo.
`DEBOUNCE_MS = 150` existió unas horas y se borró; el store se suscribe directo.

Del otro lado, el costo tampoco lo justificaba: parsear las **siete notas
enteras** cuesta 0,31 ms.

---

## 2. `process` que no cambia nada no escribe nada

`espiaEventos.probarProcess()`:

| sonda | resultado |
|---|---|
| `process(f, d => d)` | `modify`×0 · `changed`×0 · `mtime` igual |
| `process(f, () => { throw })` | la promesa rechaza · 0 eventos · contenido intacto |

Las dos preguntas eran la misma por dos lados: cuando el lote no se puede
ubicar, ¿cómo se aborta sin tocar el archivo? **Las dos salidas sirven.**
`vault/escribir.ts` usa la primera —devolver `data` intacto— porque no necesita
excepciones para un caso que no es excepcional.

Importa sobre un vault en Sync: una escritura idéntica seguiría siendo un cambio
que propagar a los otros dispositivos.

---

## 3. La ventana de 2 segundos existe, y `process` cae adentro

`espiaEventos.probarEditorAbierto()`, con la nota abierta y el buffer recién
ensuciado por la API del editor:

| | disco | editor | lo que escribió `process` |
|---|---|---|---|
| sin `save()` previo | 13354 | 13403 | **13393** |
| con `save()` previo | 13442 | 13491 | **13530** |

**El número que importa es 13393 = 13354 + 39.** `process` calculó sobre el
disco viejo e ignoró los 49 bytes que el editor tenía sin guardar. La ventana
existe y la escritura del plugin cae adentro.

El invariante 10 **no puede atajar esto**: adentro de `process` esa foto se ve
perfectamente consistente —la línea está donde el índice dijo, con el texto que
esperaba— y no hay nada que delate que le falta lo último.

### Lo que la medición refutó

La hipótesis con la que se escribió `vault/escribir.ts` era que el volcado
posterior del editor **pisa** la escritura, y que ese sería el peor modo de
falla: silencioso e intermitente.

**No pasa.** A los 2004 ms el editor guardó 13442 = 13403 + 39: Obsidian
**fusionó** el cambio externo en el buffer sucio en vez de descartarlo. No se
perdió ni lo tecleado ni lo escrito. Las dos condiciones terminaron en
`SOBREVIVIÓ`.

Una corrida por condición. Alcanza para refutar la hipótesis fuerte —un solo
caso donde no pisa basta— pero no para afirmar que nunca pisa.

### Por qué el `save()` previo se queda igual

No por evitar una pérdida que no ocurre. Por dos razones que la medición sí
sostiene:

1. **Sin él, el invariante 10 verifica contra una foto vieja.** Es el desfasaje
   exacto del que `src/ubicar.ts` defiende, entrando por la puerta de atrás:
   `ubicarLinea` mira un documento que no incluye lo que el usuario acaba de
   teclear, así que da `ok` sobre un número de línea que ya no es el bueno.
2. **Con él no hay fusión.** Sin `save()`, que el resultado quede bien depende de
   que Obsidian mapee correctamente los números de línea al fusionar. Eso no está
   medido, es caro de medir, y no hace falta: `save()` costó **8 ms** y deja la
   secuencia lineal.

---

## Lo que cambió por esto

- **`src/vault/puertoObsidian.ts`**: se borró el debounce.
- **Spec §7**: reescrita, con la tabla de arriba y diciendo qué reemplaza.
- **Spec §8**: corregida la afirmación sobre el volcado que pisa, que era mía y
  duró dos horas.
- **`src/vault/escribir.ts`**: el `save()` previo se queda, con la justificación
  correcta en vez de la que se creía.

## Reproducir

```bash
cat scripts/espia-eventos.js | pbcopy
```

Pegar en la consola de Obsidian (Ver → Alternar herramientas de desarrollo) y:

```js
espiaEventos.resumen()                  // §1, después de teclear un rato
await espiaEventos.probarProcess()      // §2
await espiaEventos.probarEditorAbierto()                  // §3
await espiaEventos.probarEditorAbierto({ conSave: true }) // §3
```

Las sondas que escriben solo tocan `0_inbox/tareas_PRUEBA.md`, y dejan líneas con
la marca «sonda del espía» que hay que borrar a mano.
