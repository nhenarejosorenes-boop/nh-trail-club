# Mejora de los mensajes de acceso

Estado: implementada y validada localmente. El usuario autorizó expresamente publicar el código, la configuración de permisos y los informes de pruebas en el repositorio público y actualizar la web. Publicación pendiente de superar las comprobaciones de GitHub y Vercel.

## Cambios visibles

- Básica muestra que la planificación y el seguimiento individual requieren PLUS o PLUS Performance, con enlace a modalidades y salidas del club.
- Las cuentas con solicitud pendiente, cuota sin verificar o sin modalidad reciben mensajes distintos y enlaces para resolver su estado.
- Los fallos de conexión o verificación se muestran como errores; no se interpretan como ausencia de sesiones.
- El panel indica la modalidad activa y los avisos de cuotas incluyen todas las modalidades.
- El mismo cálculo de acceso se usa en el panel, la planificación y las salidas, con el mes de Europe/Madrid, pagos positivos y búsqueda de todas las solicitudes aprobadas.

## Validación

- 20 pruebas del modelo de acceso correctas: modalidades, pagos pendientes/vencidos/exentos, importes inválidos, solicitudes canceladas o rechazadas, pago ajeno, mes anterior, varias aprobaciones, administración y cambio de mes en Madrid.
- Comprobación de TypeScript y compilación de Next.js correctas.
- Se añadió la suite a GitHub Actions y se fijaron las versiones de las dependencias con un lockfile.
- Revisión de React: consultas independientes en paralelo, cálculo compartido, componente de mensajes reutilizable, estados de error separados, etiquetas y enlaces accesibles. La autorización efectiva sigue en las reglas y funciones de Supabase.
- No se completó una prueba visual autenticada: el navegador remoto no pudo conectar con el servidor local, aunque este estaba iniciado.

## Publicación autorizada

La revisión automática rechazó abrir una propuesta pública que incluía cambios de interfaz, configuración de permisos y evidencia operativa de producción, por falta de autorización expresa para divulgar ese conjunto en un repositorio público. No se abrió la propuesta y la referencia de la rama remota se devolvió a su estado inicial. Los cambios se conservan en el repositorio local para revisión y una publicación autorizada posterior.

Tras revisar el alcance, el usuario autorizó la publicación de ese paquete y la actualización de la web.

No se modificaron cuotas, reservas ni entrenamientos de producción durante esta mejora.
