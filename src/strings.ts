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
  },
} as const;
