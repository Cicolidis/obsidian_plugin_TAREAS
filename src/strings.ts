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
        "barra-checkbox": "Barra corta + checkbox coloreado",
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
    unirLimpio: {
      nombre: "Unir tareas deja una línea limpia",
      descripcion:
        "Al unir dos tareas, el texto de la de abajo se pega con un espacio y sin su «- [ ] ». " +
        "Sin esto queda «- [ ] comprar- [ ] pan». Apagado, se une como antes.",
    },
    workbenchFavorito: {
      nombre: "Workbench favorito (★)",
      descripcion:
        "El workbench del comando de asignación. Conviene que no se llame por unidad de " +
        "tiempo: «foco» o «mudanza», no «hoy». Un workbench llamado «hoy» obliga a " +
        "mantenerlo al día; uno llamado «foco» no caduca.",
    },
    workbenchSecundario: {
      nombre: "Segundo workbench favorito (◐)",
      descripcion:
        "El segundo botón fijo de la fila. Vacío, el ◐ no se dibuja: un botón que no " +
        "puede hacer nada es peor que un botón que no está.",
      marcador: "vacío = sin segundo botón",
    },
    filaDeBotones: {
      nombre: "Fila de botones sobre la tarea",
      descripcion:
        "★ y ◐ mandan al workbench de arriba, → los muestra todos, y ⋯ abre prioridad y " +
        "completar. No suma ancho al renglón ni cambia la altura de la línea.",
    },
    modoDeRevelacion: {
      nombre: "Fila de botones: cuándo se ve",
      descripcion:
        "Con el mouse encima, o siempre. Es una clase en el cuerpo del documento y lo " +
        "resuelve la hoja de estilos: no hay ningún gesto cableado en el código.",
      opciones: {
        hover: "Con el mouse sobre la línea",
        siempre: "Siempre",
      },
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
  /**
   * La fila de botones de la §13.0. Los textos son los `aria-label` y los
   * tooltips: la fila se dibuja con íconos, así que **es lo único que la
   * describe** para quien navega con teclado o con lector de pantalla.
   */
  fila: {
    mandarA: (wb: string) => `Mandar a «${wb}»`,
    sacarDe: (wb: string) => `Sacar de «${wb}»`,
    todosLosWorkbenches: "Todos los workbenches…",
    masAcciones: "Prioridad, completar…",
    /** El tooltip de la fila entera cuando la línea tiene el token roto. */
    ilegible: "Esta tarea tiene el token ilegible: no se puede escribir sobre ella.",
  },
  menu: {
    prioridad: "Prioridad",
    /** Los tres niveles como ítems de menú. `prioridades` los dice en prosa. */
    niveles: ["Normal", "Alta", "Muy alta"] as const,
    completarYDescartar: "Completar y descartar",
    workbenchNuevo: "Workbench nuevo…",
    nuevoWorkbench: {
      titulo: "Workbench nuevo",
      descripcion:
        "Un workbench es un filtro: no guarda nada, y la tarea sigue viviendo donde está. " +
        "Conviene que no se llame por unidad de tiempo — «foco» o «mudanza», no «hoy» —, " +
        "porque un workbench que caduca hay que mantenerlo al día.",
      marcador: "foco",
      aceptar: "Mandar la tarea ahí",
      cancelar: "Cancelar",
      invalido:
        "Un nombre de workbench no puede llevar «;», «,» ni «%»: son los tres " +
        "caracteres que rompen el token y dejan la línea ilegible para siempre.",
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
    /**
     * El de una sola línea, para el clic de la fila. `ilegibles` cuenta las de
     * un subárbol y su plural no sirve acá: «1 línea tiene … no se tocaron».
     */
    tokenIlegible:
      "Esta tarea tiene el token de metadatos ilegible, así que no se toca (§5.3). " +
      "Se ve entero en la nota a propósito: es la única forma de arreglarlo a mano.",
    ilegibles: (n: number) =>
      `${n === 1 ? "1 línea tiene" : `${n} líneas tienen`} el token ilegible y no se ` +
      "tocaron. Hay que arreglarlas a mano.",
  },
} as const;
