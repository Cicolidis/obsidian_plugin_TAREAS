/**
 * Todos los textos de interfaz, juntos.
 *
 * Van acá desde el primer día aunque hoy sean cinco y no haya mecanismo de
 * idioma: en Anotaciones agruparlos después costó recorrer 18.000 líneas. Si
 * alguna vez el plugin sale del vault propio, el idioma es un requisito
 * (spec §20, «antes de compartirlo»).
 */
/**
 * Los meses, en un solo lugar.
 *
 * Los usan `fechaCorta` —los atajos del ⋯— y el encabezado de la grilla del
 * calendario. Estaban escritos adentro de `fechaCorta` y con la grilla habrían
 * quedado en dos archivos, que es exactamente lo que CLAUDE.md prohíbe: una
 * lista de valores repetida diverge, y esta se lee en pantalla.
 */
export const MESES_CORTOS: readonly string[] = [
  "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic",
];

export const MESES_LARGOS: readonly string[] = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** Las iniciales de la semana en el encabezado de la grilla, lunes primero. */
export const DIAS_INICIALES: readonly string[] = ["L", "M", "M", "J", "V", "S", "D"];

/** `2026-09-07` → «7 sep». Para lo que está a días de distancia. */
function fechaCorta(valor: string): string {
  return `${Number(valor.slice(8, 10))} ${MESES_CORTOS[Number(valor.slice(5, 7)) - 1]}`;
}

/** `2026-09-07` → «7 sep 2026». Para lo que puede estar a un año. */
function fechaLegible(valor: string): string {
  return `${fechaCorta(valor)} ${valor.slice(0, 4)}`;
}

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
      marcador: "carpeta/tareas.md",
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
    indicadorGlifo: {
      nombre: "Prioridad: signo al final del texto",
      descripcion:
        "Un «!» para alta y «!!» para muy alta, al final de la línea, además de la barra y " +
        "el color del checkbox. Suma ancho al renglón: medido, empuja el corte unas tres letras.",
    },
    /**
     * Los dos indicadores del paso 6c, en un solo bloque con dos interruptores.
     *
     * Van juntos en la pantalla y separados en los datos: hacen lo mismo, y cada
     * uno cuesta un lugar de ancho en el margen. Separados se puede ver cuál de
     * los dos, si alguno, molesta con la ventana angosta.
     */
    indicadores: {
      nombre: "Indicadores de fecha y de recurrencia en la fila",
      descripcion:
        "Dos botones más que se encienden cuando la tarea tiene vencimiento o grupo de " +
        "reinicio, y que al pasarles el mouse dicen cuál. Es lo único que muestra esos dos " +
        "datos: el token está oculto. Un clic abre el mismo submenú del ⋯, y nunca escribe " +
        "solo. Ocupan su lugar aunque estén apagados, para que el ★ no se mueva.",
      fecha: "Indicador de vencimiento",
      recurrencia: "Indicador de recurrencia",
    },
    gruposSugeridos: {
      nombre: "Grupos de reinicio sugeridos",
      descripcion:
        "Nombres separados por comas, que el submenú de recurrencia ofrece aunque no exista " +
        "todavía ninguna tarea con ellos. Los que sí existen van primero, ordenados por " +
        "cuántas tareas los llevan — eso sale de las notas, no de un contador guardado. " +
        "Vacío está bien: no sugiere nada.",
      marcador: "semanal, mensual",
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
    completarAlTildar: {
      nombre: "Tildar el checkbox completa la tarea",
      descripcion:
        "Al tildar una tarea a mano, el plugin le escribe la fecha de completado y tilda " +
        "también lo que cuelga de ella, igual que «Completar y descartar» del ⋯. Sin esto, " +
        "tildar deja la tarea hecha pero sin fecha, y el historial la necesita. Reconoce el " +
        "hecho, no el gesto: anda con el mouse, con el teclado y con Outliner. No archiva.",
    },
    archivarConModificador: {
      nombre: "Cmd+clic en el checkbox: completar y archivar",
      descripcion:
        "Ctrl+clic fuera de macOS. Hace de un gesto lo que el ⋯ hace en dos. Es el único " +
        "mecanismo del plugin que intercepta un clic —un modificador no deja rastro en el " +
        "documento, así que no hay otra forma de verlo— y por eso es más frágil: en el " +
        "teléfono no existe. El ⋯ anda siempre.",
    },
    botonEliminar: {
      nombre: "Fila de botones: incluir 🗑 Eliminar",
      descripcion:
        "Un quinto botón, al final de la fila, que borra la tarea y su subárbol. Obsidian no " +
        "es un outliner y borrar una tarea anidada a mano es incómodo; esto lo hace de un " +
        "clic. Va último, lo más lejos posible del ★.",
    },
    confirmaciones: {
      nombre: "Preguntar antes de escribir",
      descripcion:
        "Archivar no pierde nada: la tarea queda «[x]» en su lugar y el bloque va al " +
        "historial. Eliminar sí borra, y con la nota cerrada no hay Ctrl-Z que lo deshaga: " +
        "el subárbol más grande del corpus son 77 líneas, medido. Archivar pregunta igual " +
        "cuando la tarea ya figura en el historial, porque ahí el cartel evita una entrada " +
        "repetida en vez de agregar un paso.",
      archivar: "Preguntar antes de archivar",
      eliminar: "Preguntar antes de eliminar",
    },
    filaDeBotones: {
      nombre: "Fila de botones sobre la tarea",
      descripcion:
        "★ y ◐ mandan al workbench de arriba, → los muestra todos, y ⋯ abre prioridad, " +
        "completar, archivar y eliminar. No suma ancho al renglón ni cambia la altura de " +
        "la línea.",
    },
    /**
     * Los instrumentos, juntos y al final (30/09/2026). Hasta entonces las
     * decoraciones estaban entre los ajustes de uso, y no son uno: existen para
     * medir A/B y como salida de emergencia.
     */
    desarrollo: {
      titulo: "Desarrollo",
      descripcion:
        "Instrumentos para probar y medir el plugin. Con los valores de fábrica no cambian " +
        "nada de cómo funciona.",
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
    masAcciones: "Prioridad, completar, eliminar…",
    eliminar: "Eliminar la tarea y todo lo que cuelga de ella",
    /**
     * Los dos indicadores del paso 6c.
     *
     * Son el único lugar donde se puede **ver** que una tarea tiene fecha o
     * grupo sin abrir el ⋯: el token está oculto (§5.1) y hasta acá esos dos
     * datos no se veían en ningún lado. Por eso la etiqueta no dice qué hace el
     * botón sino **qué dice el dato**; que además abra el submenú es el atajo,
     * no lo que el control comunica.
     */
    sinFecha: "Sin fecha de vencimiento. Clic para poner una.",
    /**
     * **Con el año**, a diferencia de los atajos del menú.
     *
     * Aquellos son todos de esta semana, así que «7 sep» no puede confundirse
     * con nada. Un `due` escrito puede estar a un año, y ahí «7 sep» sí es
     * ambiguo. Salió de mirar la salida: la primera versión mostraba
     * `2026-09-07` crudo, o sea dos formatos del mismo dato en la misma
     * pantalla, a dos centímetros uno del otro.
     */
    vence: (fecha: string) => `Vence el ${fechaLegible(fecha)}.`,
    /** La forma cíclica sin reloj: solo lo guardado. No pasa en la aplicación. */
    venceElDia: (dia: string) => `Vence el día ${dia} de cada mes.`,
    /**
     * Y con reloj, las **dos** cosas: el día guardado y contra qué fecha cae
     * ahora. Son datos distintos —uno está en el token y el otro sale de
     * `resolverDue`— y mostrar solo uno deja la mitad de la pregunta sin
     * contestar, que es lo mismo que decidieron los atajos del menú.
     *
     * Dice «el próximo» y no «este mes»: si el día ya pasó, `resolverDue`
     * devuelve el del mes que viene —«el vencimiento de una mensual siempre
     * está por delante»— y «este mes» sería falso justo la mitad del mes.
     * Apareció auditando la guía de verificación, no con un test.
     */
    venceElDiaResuelto: (dia: string, fecha: string) =>
      `Vence el día ${dia} de cada mes; el próximo, el ${fechaCorta(fecha)}.`,
    sinRecurrencia: "No es cíclica. Clic para ponerle un grupo de reinicio.",
    grupo: (nombre: string) => `Cíclica, en el grupo «${nombre}».`,
    /** El tooltip de la fila entera cuando la línea tiene el token roto. */
    ilegible: "Esta tarea tiene el token ilegible: no se puede escribir sobre ella.",
  },
  menu: {
    prioridad: "Prioridad",
    /** Los tres niveles como ítems de menú. `prioridades` los dice en prosa. */
    niveles: ["Normal", "Alta", "Muy alta"] as const,
    fecha: "Fecha…",
    recurrencia: "Recurrencia…",
    /**
     * Los atajos del selector de fecha, y **la fecha resuelta va en la
     * etiqueta**.
     *
     * «El lunes» sobre un lunes es ambiguo —¿hoy o el que viene?— y la regla
     * que lo resuelve (hoy cuenta como hoy, igual que `resolverDue` con el día
     * del mes) no se puede adivinar desde el menú. Mostrar la fecha resuelta lo
     * contesta sin que haya que aprender nada: es el §«mirar la salida» del
     * método aplicado a un control.
     */
    atajosDeFecha: {
      hoy: "Hoy",
      manana: "Mañana",
      pasadoManana: "Pasado mañana",
      enUnaSemana: "En una semana",
      enDosSemanas: "En dos semanas",
      /** «En 30 días» y no «en un mes»: es lo que de verdad escribe. */
      enTreintaDias: "En 30 días",
    },
    /**
     * `2026-09-07` → «7 sep». Va acá porque los meses son texto de interfaz.
     *
     * Los nombres salen de `MESES_CORTOS`, que vive afuera del objeto: los
     * necesitan esto y la grilla del calendario, y una lista de valores escrita
     * en dos archivos diverge (CLAUDE.md).
     */
    fechaCorta,
    /** Un ítem del submenú: «Lunes · 7 sep». */
    atajo: (etiqueta: string, detalle: string) => `${etiqueta} · ${detalle}`,
    /**
     * Los de una cíclica. Son días del mes, no fechas (§11), y **son dos porque
     * los dos se derivan**: una lista de días «típicos» sería inventada.
     */
    atajosDeDiaDelMes: {
      mismoDiaQueHoy: "Como hoy",
      finDeMes: "Fin de mes",
    },
    /** `10` → «día 10». Para que se vea que lo que escribe no es una fecha. */
    diaDelMes: (valor: string) => `día ${valor}`,
    /**
     * Un ítem con su atajo numérico a la vista: «1 · foco».
     *
     * Lo comparten el → y el submenú de recurrencia. La §13.0 pide «un clic más
     * una tecla», y una tecla que no se ve no existe: el número **es** la mitad
     * del diseño de esos dos menús.
     */
    numerado: (n: number, texto: string) => `${n} · ${texto}`,
    otraFecha: "Otra fecha…",
    sinFecha: "Sin fecha",
    grupoNuevo: "Grupo nuevo…",
    noEsCiclica: "No es cíclica",
    completarYDescartar: "Completar y descartar",
    completarYArchivar: "Completar y archivar",
    eliminar: "Eliminar…",
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
    /**
     * «Grupo nuevo…», hermano del de workbench.
     *
     * Los grupos de reinicio «se crean escribiéndolos, como los workbenches»
     * (§11) y comparten el saneo, porque comparten la forma en el token: `;`,
     * `,` y `%` lo rompen igual.
     */
    nuevoGrupo: {
      titulo: "Grupo de reinicio nuevo",
      descripcion:
        "Un grupo de reinicio es una etiqueta, no un motor: el plugin no crea instancias ni " +
        "corre fechas solo. Un botón destilda todas las tareas del grupo cuando vos lo " +
        "apretás. «lunes», «mensual», «mudanza».",
      marcador: "mensual",
      aceptar: "Etiquetar la tarea",
      cancelar: "Cancelar",
      invalido:
        "Un nombre de grupo no puede llevar «;», «,» ni «%»: son los tres " +
        "caracteres que rompen el token y dejan la línea ilegible para siempre.",
    },
    /**
     * El selector de fecha. **Dos títulos, no uno**: una tarea cíclica guarda
     * el día del mes y una normal la fecha entera (§11), y cuál de las dos
     * escribió tiene que verse antes de aceptar, no después en la nota.
     */
    elegirFecha: {
      titulo: "Fecha de vencimiento",
      tituloCiclica: "Vencimiento adentro del período",
      descripcion: "Se escribe como AAAA-MM-DD en el token, y no se ve en la nota.",
      descripcionCiclica:
        "Esta tarea es cíclica, así que se guarda el día del mes y no la fecha: «10» es «el " +
        "10 del mes en curso», y se resuelve contra el reloj sin que nadie reescriba nada " +
        "cuando cambia el mes. Un día que no existe se recorta al último: 31 en febrero es el 28.",
      marcadorDia: "1 a 31",
      aceptar: "Poner la fecha",
      cancelar: "Cancelar",
      /** Lo que va a quedar escrito, mostrado antes de aceptar. */
      vaAEscribir: (valor: string) => `Va a escribir: ${valor}`,
      invalida: "Esa fecha no existe.",
      diaInvalido: "El día del mes va de 1 a 31.",
      /**
       * La grilla propia (paso 6c). Existe además del selector nativo porque el
       * nativo no cubre el caso cíclico: ahí el campo es un número del 1 al 31 y
       * el navegador no ofrece **ningún** selector.
       */
      mesAnterior: "Mes anterior",
      mesSiguiente: "Mes siguiente",
      /** «septiembre 2026», en el encabezado de la grilla. */
      mesYAnio: (mes: number, anio: number) => `${MESES_LARGOS[mes - 1]} ${anio}`,
      /** El `aria-label` de cada celda: la fila de números no dice el mes. */
      celda: (fecha: string) => fecha,
      celdaDelMes: (dia: string) => `Día ${dia} de cada mes`,
      volverAHoy: "Hoy",
    },
  },
  comandos: {
    completar: "Completar la tarea del cursor",
    archivar: "Completar y archivar la tarea del cursor",
    eliminar: "Eliminar la tarea del cursor",
    workbench: "Asignar la tarea del cursor al workbench favorito",
    subirPrioridad: "Subir la prioridad de la tarea del cursor",
    reiniciar: "Reiniciar un grupo cíclico…",
    bajarPrioridad: "Bajar la prioridad de la tarea del cursor",
  },
  /**
   * Los dos modales de la §12. Se escriben acá enteros porque son el único
   * lugar donde el plugin le explica al usuario qué va a pasar **antes** de que
   * pase, y eso no se improvisa en el sitio de la llamada.
   *
   * Los dos dicen lo mismo en el mismo orden: qué se toca, cuánto, y qué pasa
   * con Ctrl-Z. Lo tercero está **medido** (§5.5 punto 15) y es asimétrico: con
   * la nota abierta la escritura vuelve al editor y entra a su historial; con la
   * nota cerrada, `vault.process()` no pasa por el editor y no hay nada que lo
   * deshaga. El historial está siempre cerrado.
   */
  confirmar: {
    cancelar: "Cancelar",
    archivar: {
      titulo: "Completar y archivar",
      /** El bloque que se copia. */
      alLog: (n: number, camino: string) =>
        `${n === 1 ? "1 línea va" : `${n} líneas van`} al historial, bajo «${camino}».`,
      /** Solo si el camino todavía no existe en el historial. */
      creaSeccion: (camino: string) => `Se crea la sección «${camino}», al final del archivo.`,
      /** Lo que pasa del lado de la nota. La §12: archivar no borra. */
      enLaNota: (n: number, nota: string) =>
        `${n === 1 ? "1 tarea queda" : `${n} tareas quedan`} en «[x]» en ${nota}. No se borra nada.`,
      /** Y el caso de la que ya estaba completa: en la nota no cambia nada. */
      yaEstabaCompleta: (nota: string) =>
        `La tarea ya está completa: en ${nota} no se cambia nada.`,
      /**
       * La repetida. Esta línea es la que **fuerza** el modal aunque el bloque
       * sea de una sola línea: archivar de nuevo no es el caso frecuente.
       */
      yaEnElHistorial:
        "Ojo: esta tarea ya figura en el historial bajo ese mismo camino. Si seguís, va a " +
        "quedar escrita dos veces.",
      deshacer:
        "Con la nota abierta, Ctrl-Z deshace lo que se escribe en ella. En el historial no: " +
        "esa nota está cerrada y nada lo deshace.",
      aceptar: "Archivar",
    },
    eliminar: {
      titulo: "Eliminar la tarea",
      borra: (n: number, nota: string) =>
        `Se ${n === 1 ? "borra 1 línea" : `borran ${n} líneas`} de ${nota}: la tarea y todo lo ` +
        "que cuelga de ella, notas incluidas.",
      noArchiva: "No se escribe nada en el historial. Esto no archiva: borra.",
      deshacer:
        "No se deshace desde el plugin. Con la nota abierta queda en el historial del editor; " +
        "con la nota cerrada, no hay nada que lo deshaga.",
      aceptar: "Eliminar",
    },
    /**
     * El tercer modal, y el único que **no se puede apagar**.
     *
     * Archivar y eliminar quedaron sin confirmación por decisión del usuario
     * (§13.0 punto 3): la fricción pesaba más. El reinicio es distinto y la §11
     * lo pide, con una razón que **no es el tamaño** —medido el 02/09/2026, un
     * reinicio sobre el corpus de hoy tocaría a lo sumo 16 líneas en todo el
     * vault, no las 23 de una nota que decía esa sección—. Es que toca **varias
     * notas a la vez**, y el historial de deshacer solo existe en las que están
     * abiertas: con la nota cerrada `vault.process()` no pasa por el editor y no
     * hay nada que lo deshaga. Un rescate que depende de qué notas estaban
     * abiertas no es un rescate.
     */
    reiniciar: {
      titulo: "Reiniciar un grupo cíclico",
      destilda: (tareas: number, notas: number) =>
        `Se ${tareas === 1 ? "destilda 1 tarea" : `destildan ${tareas} tareas`} y se les borra la ` +
        `fecha de completado, en ${notas === 1 ? "1 nota" : `${notas} notas`}.`,
      /** Cuáles, si son pocas. Con muchas la lista deja de ser información. */
      notas: (nombres: readonly string[]) => `En: ${nombres.join(", ")}.`,
      soloEtiquetadas:
        "No se toca ninguna tarea que no lleve la etiqueta de este grupo, ni los workbenches, " +
        "ni el vencimiento.",
      /**
       * Lo que hace el **segundo** botón, dicho antes de apretarlo.
       *
       * El reinicio borra el `[x]` y el `done`, y el `done` es el único lugar
       * donde vive la fecha de ese ciclo: sin archivar, ese dato no queda en
       * ningún lado. Decir cuántas líneas y cuántas secciones es lo mismo que
       * hace el modal de archivar una tarea, y por lo mismo — el historial está
       * siempre cerrado, así que su destino no se puede ver de otro modo.
       */
      alLog: (lineas: number, secciones: number) =>
        `«Archivar y reiniciar» copia ${lineas === 1 ? "1 línea" : `${lineas} líneas`} al ` +
        `historial antes de destildar${
          secciones === 0
            ? ""
            : `, y crea ${secciones === 1 ? "1 sección nueva" : `${secciones} secciones nuevas`}`
        }.`,
      /**
       * Cuando el segundo botón **no** se puede ofrecer.
       *
       * La primera versión decía «no hay nada que archivar: ninguna de estas
       * tareas tiene fecha de completado», y era **texto muerto**: se archiva
       * exactamente el conjunto que el reinicio toca, así que si hay algo que
       * reiniciar hay algo que archivar. El único caso alcanzable es que falte
       * la nota de historial. Se encontró auditando la guía de verificación —
       * una comprobación que pide un estado imposible no prueba nada, y una
       * frase que describe uno tampoco.
       */
      sinHistorial: (ruta: string) =>
        (ruta === ""
          ? "Todavía no elegiste una nota de historial"
          : `No encuentro la nota de historial «${ruta}»`) +
        ", así que «archivar y reiniciar» no se puede ofrecer. Revisá «Nota de historial» en " +
        "los ajustes.",
      deshacer:
        "En las notas que tengas abiertas, Ctrl-Z lo deshace. En las cerradas no hay nada que " +
        "lo deshaga, y en el historial tampoco: esa nota está siempre cerrada.",
      aceptar: "Reiniciar",
      archivarYReiniciar: "Archivar y reiniciar",
    },
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
    /**
     * La coletilla de las escrituras que tuvieron que buscar la línea.
     *
     * Estaba escrita a mano en `comandos.ts` y siempre en plural: con una sola
     * decía «1 se habían corrido». Los textos van todos acá desde el primer día
     * justamente para que un plural no se decida en el sitio de la llamada.
     */
    movidas: (n: number) => (n === 1 ? " (1 se había corrido)" : ` (${n} se habían corrido)`),
    archivado: (n: number, camino: string) =>
      `Archivada: ${n === 1 ? "1 línea" : `${n} líneas`} al historial, bajo «${camino}».`,
    eliminado: (n: number) =>
      `${n === 1 ? "1 línea borrada" : `${n} líneas borradas`}.`,
    /**
     * El único aviso del plugin que describe un estado **a medias**, y por eso
     * es largo a propósito: media operación que termina en silencio es peor que
     * una que no ocurrió. Dice qué quedó hecho y qué hay que mirar.
     *
     * El «NO» va en mayúsculas y no en negrita porque **`Notice` no renderiza
     * markdown**: recibe un string y lo pone como `textContent`. Un `**no**`
     * se ve con los asteriscos. Se descubrió leyendo la salida, no con un test.
     */
    mediaOperacion: (n: number) =>
      `Se escribieron ${n === 1 ? "1 línea" : `${n} líneas`} en el historial, pero la tarea ` +
      "NO quedó completada en su nota: alguna línea ya no está donde estaba, o aparece " +
      "repetida. Revisá la tarea y volvé a intentar; si la archivás de nuevo, el historial va " +
      "a tener la entrada dos veces.",
    /** El LOG no existe. Nombra el ajuste, que es donde se arregla. */
    sinLog: (ruta: string) =>
      ruta === ""
        ? "Todavía no elegiste una nota de historial. Configurala en «Nota de historial», en los ajustes."
        : `No encuentro la nota de historial «${ruta}». Revisá «Nota de historial» en los ajustes.`,
    /**
     * Dos cambios para la misma nota en una sola operación. No lo puede producir
     * el store —una nota es una entrada—, así que si aparece es un error del
     * plugin, y el aviso lo dice en vez de culpar a una nota que existe.
     */
    lotesRepetidos: (notas: readonly string[]) =>
      `No se escribió nada: la operación traía dos cambios para ${notas.length === 1 ? "la nota" : "las notas"} ` +
      `${notas.map((n) => `«${n}»`).join(", ")}, y aplicarlos en fila la corrompería. Es un error del plugin.`,
    /** El ajuste mal puesto que la escritura ataja: el LOG es a la vez una nota de tareas. */
    logEsNota: (ruta: string) =>
      `No se escribió nada: «${ruta}» es la nota de historial y también una de las notas a ` +
      "reiniciar. Revisá «Nota de historial» y «Notas de tareas» en los ajustes.",
    /** La otra mitad: el archivo de la tarea desapareció entre el clic y el write. */
    sinNota: (ruta: string) => `No encuentro la nota «${ruta}». No se escribió nada.`,
    /** El aviso que importa: no se escribió, y por qué. */
    noUbicada:
      "No se escribió nada: alguna línea ya no está donde estaba, o aparece repetida. " +
      "No se adivina cuál era. Volvé a intentar.",
    prioridad: (nombre: string) => `Prioridad ${nombre}.`,
    /** Dice **qué forma** escribió, que es lo que la §11 hace ambiguo. */
    fechaPuesta: (valor: string) => `Vencimiento: ${valor}.`,
    fechaPuestaEnCiclica: (valor: string) =>
      `Vencimiento: día ${valor} de cada mes. Es cíclica, así que guarda el día y no la fecha.`,
    fechaSacada: "Sin fecha de vencimiento.",
    recurrencia: (grupo: string) => `Ahora es cíclica, en el grupo «${grupo}».`,
    /**
     * La conversión de la decisión de la sesión 7, dicha.
     *
     * Poner `rec` sobre una tarea con fecha absoluta convierte el `due` en el
     * día del mes, y se pierden el año y el mes. Es lo correcto —la §11 dice que
     * una cíclica guarda el día— pero es una pérdida, y una pérdida en silencio
     * es la que no se puede revisar.
     */
    dueConvertido: (antes: string, dia: string) =>
      `El vencimiento ${antes} pasó a ser «día ${dia} de cada mes»: una tarea cíclica guarda ` +
      "el día del mes, no la fecha. Si no era eso, volvé a ponerle la fecha sacándole el grupo.",
    noEsCiclica: "Ya no es cíclica.",
    /** Al sacar el `rec` de una tarea con `due=10`, que ahora significa otra cosa. */
    dueQuedaEnDia: (dia: string) =>
      `Le quedó el vencimiento «día ${dia}», que se sigue resolviendo contra el reloj. Si ` +
      "querés una fecha concreta, ponésela desde el ⋯.",
    reiniciado: (tareas: number, notas: number) =>
      `${tareas === 1 ? "1 tarea reiniciada" : `${tareas} tareas reiniciadas`} en ` +
      `${notas === 1 ? "1 nota" : `${notas} notas`}.`,
    /** El otro camino: lo mismo, más lo que quedó en el historial. */
    reiniciadoConArchivado: (tareas: number, notas: number, alLog: number) =>
      `${tareas === 1 ? "1 tarea reiniciada" : `${tareas} tareas reiniciadas`} en ` +
      `${notas === 1 ? "1 nota" : `${notas} notas`}, y ` +
      `${alLog === 1 ? "1 línea" : `${alLog} líneas`} al historial.`,
    /**
     * El estado a medias de «archivar y reiniciar», que es el único del plugin
     * donde el historial **ya está escrito** y las notas no.
     *
     * Se elige ese orden a propósito: al revés, si fallara el historial, la
     * fecha de completado del ciclo ya no existiría en ningún lado. Acá lo que
     * queda es una entrada de historial de una tarea que sigue tildada — se ve
     * y se arregla. El aviso tiene que decir las dos mitades.
     */
    reinicioConArchivadoAMedias: (
      hechas: readonly string[],
      faltan: readonly string[],
      alLog: number,
    ) =>
      `En el historial ya ${alLog === 1 ? "quedó 1 línea" : `quedaron ${alLog} líneas`}. Se reinició ` +
      `${hechas.length ? hechas.join(", ") : "ninguna nota"}, pero en ${faltan.join(", ")} NO: ` +
      "alguna línea se movió entre la comprobación y la escritura. Volvé a correr el reinicio a " +
      "secas sobre esas notas; si volvés a archivar, el historial va a tener las entradas dos veces.",
    /** El seco dijo que no: **no se escribió nada, ni en el historial**. */
    reinicioConArchivadoNoUbicado: (notas: readonly string[]) =>
      `No se escribió nada, en ninguna nota NI en el historial. En ${notas.join(", ")} ` +
      "alguna línea ya no está donde estaba, o aparece repetida. Volvé a intentar; si tenés " +
      "el índice congelado, apagalo.",
    sinGrupos:
      "No hay ningún grupo de reinicio todavía. Se crean desde el ⋯ de una tarea, en " +
      "«Recurrencia…»: son una etiqueta con nombre libre, como los workbenches.",
    sinQueReiniciar: (grupo: string) =>
      `No hay nada que reiniciar en «${grupo}»: ninguna tarea del grupo está completada.`,
    /**
     * El reinicio no se pudo ubicar. **Dice que no se escribió en NINGUNA**,
     * que es la garantía que el paso en seco sobre todas las notas compra y que
     * el archivado no puede dar.
     */
    reinicioNoUbicado: (notas: readonly string[]) =>
      `No se escribió nada, en ninguna nota. En ${notas.join(", ")} alguna línea ya no está ` +
      "donde estaba, o aparece repetida. No se adivina cuál era. Volvé a intentar; si tenés " +
      "el índice congelado, apagalo.",
    /** Y el estado a medias, que acá es por nota y no por mitad de una acción. */
    reinicioAMedias: (hechas: readonly string[], faltan: readonly string[]) =>
      `Se reinició ${hechas.join(", ")}, pero en ${faltan.join(", ")} NO: alguna línea se ` +
      "movió entre la comprobación y la escritura. Volvé a correr el reinicio; lo que ya está " +
      "destildado no se vuelve a tocar.",
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
