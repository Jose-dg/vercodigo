/** Parámetros de URL del modal de Configuración (compartidos entre servidor y cliente). */

/** `/settings` lleva al inicio con este parámetro para abrir el modal (opcionalmente en una sección). */
export const SETTINGS_PARAM = "configuracion";

/**
 * Al volver de Google/Apple, Clerk regresa a la página donde estaba la persona con este
 * parámetro; el modal se abre solo en Cuentas vinculadas y avisa el resultado.
 */
export const LINKED_RETURN_PARAM = "vinculada";
