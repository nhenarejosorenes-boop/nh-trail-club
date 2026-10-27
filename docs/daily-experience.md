# Panel diario del corredor

El inicio incluye «Tu día en NH»: sesiones de hoy (con su estado), próxima sesión
pendiente dentro de los siguientes 13 días, accesos a importar y registrar, y registros
por completar de los últimos 30 días naturales, incluido hoy. Los vínculos con el plan
son opcionales. Una salida puede carecer de RPE y de vínculo: se cuenta una vez en la
lista de revisión, aunque aparezca en ambos contadores. Se muestran las cinco más recientes.

Las consultas se filtran por el corredor autenticado y paginan sin truncar los totales.
El panel diario no consulta el plan individual para una modalidad sin acceso premium.
No se modifica ningún registro ni se marca una sesión como completada al consultar el resumen.
Un fallo de consulta muestra reintento, nunca un mensaje de seguimiento completo.
La fecha y los límites semanales usan Europe/Madrid; volver a la pestaña actualiza el resumen.

Los enlaces a sesiones abren su semana y día para el corredor, también fuera de la
semana actual. El acceso del administrador a otros corredores mantiene sus validaciones.
Los enlaces de revisión seleccionan el mes y abren la edición de la salida solicitada
solo si figura en el historial propio cargado. Un identificador ausente o ajeno muestra
un aviso sin mostrar sus datos. El editor no guarda nada hasta que se confirme.

El plan semanal del inicio distingue errores de consulta de una semana sin sesiones.
Sin cambios de esquema, nuevas credenciales, notificaciones externas ni sincronización Garmin.

Validación: suite de pruebas (calendario, horizontes, orden, filtros de propietario,
paginación, modalidad Básica, parámetros y errores), TypeScript y compilación. La comprobación
con sesión real de corredor sigue pendiente.
