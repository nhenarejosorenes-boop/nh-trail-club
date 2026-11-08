# Preparación para clientes · 8 noviembre 2026

## Cambios publicados en este paquete

- Un único editor efectivo de pagos: el historial mensual. Se elimina el antiguo selector de estado en la solicitud, que no concedía acceso. Cada aprobación enlaza con su cuota preseleccionada.
- Edición concurrente protegida por `revision` y trigger de servidor. Identidad de cuota inmutable; fecha de cobro obligatoria y no futura para pagos. Se preserva el importe histórico al editar.
- Bloqueo inmediato de envíos repetidos, recuperación de errores de conexión y recarga obligatoria si no se puede confirmar un guardado de cuota. Controles de formulario congelados durante la operación; confirmación al cambiar de mensualidad con cambios pendientes.
- Informes, alertas e historial cargan páginas de 500 registros hasta completar los datos; fechas según Madrid. Historial del cliente disponible aunque su suscripción anterior esté cancelada.
- Un cliente Auth compartido. Al cerrar sesión o cambiar de identidad se oculta el contenido protegido y se fuerza una navegación completa. La renovación del token conserva la pantalla. Las políticas de base de datos siguen siendo la autorización efectiva.
- Recuperación con confirmación de contraseña, mínimo ocho caracteres, validación de sesión y enlaces de reintento. Guía pública `/ayuda`, accesible desde login y pantallas del club.
- RPC de plazas con wrapper invoker y agregado privado con comprobación explícita de acceso. Se retira acceso anónimo y ejecución directa del trigger de reservas.

Migración de producción: `20261108193917_client_launch_guardrails.sql`. Verificados wrapper invoker, permisos y ausencia de modificaciones de cuotas reales (0 registros financieros antes y después).

## Validación

254 pruebas locales superadas, incluida concurrencia de cuotas, fechas, capacidad agregada bajo RLS, denegación anónima/sin acceso y cambio/cierre de sesión. TypeScript y compilación Next.js correctos. Lector compilado de actividades verificado. La base de datos se probó primero con PGlite.

Las pruebas funcionales previas de las tres modalidades están en `pilot-functional-review-20261108.md`. No equivalen a una revisión visual autenticada de este paquete.

## Puesta en marcha

1. El cliente se registra y confirma su correo.
2. Administración vincula su cuenta con la ficha, revisa modalidad y aprueba la solicitud.
3. Se comprueba el cobro por el medio acordado y se registra la mensualidad actual como pagada, con fecha real. Una aprobación o una cuota exenta no activa el acceso. No hay cobros automáticos.
4. Se asignan entrenamientos y se realiza el primer acceso con el cliente desde su móvil.

Pendiente de verificación humana: primer recorrido autenticado en móvil físico e instalación real desde Android/iPhone. No se ha solicitado ni utilizado una contraseña del propietario. Las cuentas piloto siguen siendo temporales y separadas de clientes reales. No se ha reactivado el proyecto TEST ni habilitado servicios de pago.
