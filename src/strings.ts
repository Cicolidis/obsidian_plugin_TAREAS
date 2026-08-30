/**
 * Todos los textos de interfaz, juntos.
 *
 * Van acá desde el primer día aunque hoy sean cinco y no haya mecanismo de
 * idioma: en Anotaciones agruparlos después costó recorrer 18.000 líneas. Si
 * alguna vez el plugin sale del vault propio, el idioma es un requisito
 * (spec §20, «antes de compartirlo»).
 */
export const STRINGS = {
  ajustes: {
    checkboxAutomatico: {
      nombre: "Checkbox automático",
      descripcion:
        "Al apretar Enter sobre un bullet de una nota de tareas, la línea nueva nace como «- [ ] ». " +
        "Un Backspace sobre una tarea recién nacida y todavía vacía le saca el checkbox y la deja " +
        "como bullet común.",
    },
    notas: {
      nombre: "Notas de tareas",
      descripcion:
        "Una ruta por línea, desde la raíz del vault. El plugin solo actúa en estas notas. " +
        "Dejarlo vacío desactiva el plugin en todo el vault.",
      marcador: "0_inbox/tareas_VIDA.md",
      restaurar: "Volver a la lista original",
    },
    notaDeLog: {
      nombre: "Nota de historial",
      descripcion:
        "A dónde va lo archivado. El plugin no la parsea al arrancar: el historial se lee " +
        "cuando se abre la vista.",
    },
    decoraciones: {
      nombre: "Decoraciones en la nota",
      descripcion:
        "Esconde el token de metadatos en Live Preview y pinta la prioridad. En modo lectura " +
        "el token se esconde solo, porque es un comentario de Obsidian. Un token que no se " +
        "entiende queda a la vista a propósito: es la única forma de arreglarlo.",
    },
    estiloDePrioridad: {
      nombre: "Prioridad: cómo se dibuja",
      descripcion:
        "Los tres se ven distinto y los tres distinguen los niveles sin depender del color. " +
        "Se cambian en caliente: alcanza con mirar la nota al lado.",
      opciones: {
        barra: "Barra corta en el margen (la altura dice el nivel)",
        checkbox: "El checkbox de la tarea, coloreado",
        fondo: "Línea teñida con filete (el primero)",
      },
    },
    indicadorGlifo: {
      nombre: "Prioridad: signo al final del texto",
      descripcion:
        "Un «!» para alta y «!!» para muy alta, al final de la línea. Se suma al estilo " +
        "elegido arriba. Suma ancho al renglón: medido, empuja el corte unas tres letras.",
    },
    workbenchFavorito: {
      nombre: "Workbench favorito",
      descripcion:
        "El workbench del comando de asignación. Conviene que no se llame por unidad de " +
        "tiempo: «foco» o «mudanza», no «hoy». Un workbench llamado «hoy» obliga a " +
        "mantenerlo al día; uno llamado «foco» no caduca.",
    },
    verificacion: {
      titulo: "Verificación",
      descripcion:
        "Andamiaje para probar el plugin. Apagado, no cambia nada de cómo funciona.",
      congelarStore: {
        nombre: "Congelar el índice en memoria",
        descripcion:
          "El índice deja de actualizarse: queda a propósito desfasado del archivo. Sirve " +
          "para comprobar que una acción escribe en la línea correcta aunque se haya " +
          "tecleado arriba. Acordate de apagarlo.",
      },
      registrarEventos: {
        nombre: "Registrar eventos en la consola",
        descripcion:
          "Imprime cada relectura de una nota con su demora, y cada escritura con lo que " +
          "escribió.",
      },
    },
  },
  comandos: {
    completar: "Completar la tarea del cursor",
    workbench: "Asignar la tarea del cursor al workbench favorito",
    subirPrioridad: "Subir la prioridad de la tarea del cursor",
    bajarPrioridad: "Bajar la prioridad de la tarea del cursor",
  },
  /** Los tres niveles de la §14, para decirlos en los avisos. */
  prioridades: ["normal", "alta", "muy alta"] as const,
  avisos: {
    fueraDeLaLista: "Esta nota no está en la lista de notas de tareas.",
    sinTarea: "El cursor no está sobre una tarea.",
    sinIndice: "Esta nota todavía no está en el índice. Revisá la lista en los ajustes.",
    /**
     * Los dos de abajo son distintos de «no hay tarea acá»: hay una, pero el
     * índice está desfasado y no se puede saber a cuál corresponde. Decirlo con
     * el mensaje de «no hay tarea» fue un bug: mandaba a mirar el cursor cuando
     * el cursor estaba bien.
     */
    lineaAusente:
      "Esa tarea todavía no está en el índice. Si la acabás de escribir, esperá un " +
      "segundo; si tenés el índice congelado, acordate de apagarlo.",
    /**
     * Sin «a cuál de las dos»: nada garantiza que sean dos. En el corpus de hoy
     * todos los textos repetidos aparecen exactamente dos veces —20 de 20,
     * medido— pero eso es una foto del vault, no una regla.
     */
    lineaAmbigua: (n: number) =>
      `Esa línea aparece ${n} veces en la nota y el índice está desfasado: no se ` +
      "puede saber a cuál apuntás, así que no se toca ninguna. Esperá un segundo y " +
      "probá de nuevo; si tenés el índice congelado, apagalo.",
    yaCompleta: "Esa tarea ya está completa.",
    completadas: (n: number) => (n === 1 ? "1 tarea completada." : `${n} tareas completadas.`),
    entraAlWorkbench: (n: number, wb: string) =>
      `${n === 1 ? "1 tarea" : `${n} tareas`} a «${wb}».`,
    saleDelWorkbench: (n: number, wb: string) =>
      `${n === 1 ? "1 tarea" : `${n} tareas`} fuera de «${wb}».`,
    sinCambios: "No había nada que cambiar.",
    /** El aviso que importa: no se escribió, y por qué. */
    noUbicada:
      "No se escribió nada: alguna línea ya no está donde estaba, o aparece repetida. " +
      "No se adivina cuál era. Volvé a intentar.",
    prioridad: (nombre: string) => `Prioridad ${nombre}.`,
    /**
     * `subir` y `bajar` topan en vez de dar la vuelta, así que hay un caso en
     * que no pasa nada. Decirlo evita que parezca que el comando no anda.
     */
    prioridadEnElTope: (nombre: string) => `La prioridad ya está en ${nombre}.`,
    /**
     * El límite del modelo, dicho. La prioridad normal no escribe campo (§5.2)
     * y sin campo la hija vuelve a heredar, así que no hay forma de bajarla sin
     * bajar la de la madre. Decirlo es mejor que un comando que no hace nada.
     */
    prioridadHeredada:
      "Esta tarea hereda la prioridad de su tarea madre, así que no se puede bajar sola. " +
      "Bajale la prioridad a la madre, o subile la de esta para que tenga la suya.",
    ilegibles: (n: number) =>
      `${n === 1 ? "1 línea tiene" : `${n} líneas tienen`} el token ilegible y no se ` +
      "tocaron. Hay que arreglarlas a mano.",
  },
} as const;
