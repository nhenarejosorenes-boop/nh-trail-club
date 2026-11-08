# Recorrido funcional del piloto — 8 de noviembre de 2026

Se han utilizado las tres cuentas sintéticas de Básica, PLUS y PLUS Performance
en producción, con sesiones reales de Supabase Auth y peticiones REST/RPC. Los
datos de actividad, objetivos y resultados son simulados y llevan el marcador
`PILOTO-QA-20261108-A`; no representan entrenamientos prescritos ni realizados.

## Resultados confirmados

- Recorrido principal: 83 comprobaciones correctas, sin fallos.
- Control adicional de contexto de entrenamiento en mensajes: 7 comprobaciones
  correctas tras corregir el fallo encontrado.
- Respuesta automática del entrenador, lectura monotónica y aforo exacto de tres
  participantes: 14 comprobaciones correctas, sin fallos.
- Total final de comprobaciones funcionales por Auth/REST: 104 correctas.
- Suite del proyecto: 249 pruebas correctas, incluidas cinco regresiones nuevas
  para los permisos del contexto de entrenamiento.

El recorrido principal comprueba inicio de sesión, acceso propio a ficha y
suscripción temporal, niveles de modalidad, ausencia de cuotas ficticias y bloqueo
de altas comerciales desde cuentas de prueba. Verifica también que Básica no
consulta planes individuales ni los completa y que PLUS y Performance acceden a
sus propios planes, sin poder leer o completar los de otro deportista.

Se han guardado resultados de fuerza, comprobado su prescripción original y el
control de revisiones para no sobrescribir cambios de otra ventana. Se han
consultado objetivos, fases y revisiones con sus respectivos permisos.

Las tres cuentas han probado inscripción, rechazo de duplicados, cancelación y
nueva inscripción en una actividad virtual. Han registrado y corregido una salida
manual e importado resúmenes FIT, TCX y GPX mediante el mismo lector de archivos
que utiliza la aplicación. Los archivos son sintéticos; no se suben recorridos
GPS. Se han comprobado reintentos idempotentes, duplicados entre formatos, rechazo
de enlaces a sesiones ajenas, historial mensual y comparación con el plan.

Los mensajes comprueban envío, reintento sin duplicación, lectura, bandeja propia
y rechazo de conversaciones ajenas. Las sesiones de las pruebas se cierran al
terminar y se comprueba que el acceso anónimo no lee datos privados.

## Fallo encontrado y corregido

Una cuenta Básica podía enviar el identificador de una sesión propia oculta en
`messaging_send` y obtener su título en el contexto guardado del mensaje. La
consulta del plan estaba bloqueada por RLS, pero la implementación privilegiada
de mensajes no comprobaba el acceso premium antes de consultar ese título.

La migración `20261108185427_protect_message_training_context.sql` exige ahora
`nh_access.has_paid_access(true)` antes de crear un contexto nuevo de sesión.
Conserva el envío de mensajes normales, los permisos del entrenador y la lectura
del historial ya guardado. La regresión se ha verificado en PostgreSQL aislado y
en la API de producción con las tres modalidades. El informe anterior al arreglo
se conserva para documentar la reproducción; el informe posterior no tiene fallos.

## Alcance y límites de navegador

En navegador se han comprobado las páginas públicas de instalación y recuperación
y la redirección de administración al inicio de sesión cuando no hay cuenta.
No se ha completado el acceso seguro del navegador. Por tanto, este informe no
certifica un recorrido visual autenticado ni una instalación física en Android o
iPhone. El restablecimiento de contraseña por correo no se ha ejecutado con los
dominios reservados de las cuentas de prueba.

PLUS y Performance comparten el nivel de acceso premium implementado. Las pruebas
no validan una sincronización automática con Garmin ni envío al reloj: esas fases
siguen pendientes de acceso aprobado al proveedor.

## Evidencia reproducible

- `supabase/tests/pilot_live_results_20261108.json`
- `supabase/tests/pilot_context_before_fix_20261108.json`
- `supabase/tests/pilot_context_results_20261108.json`
- `supabase/tests/pilot_reply_capacity_results_20261108.json`
- `scripts/pilot-live-check.mjs`

El ejecutor exige el proyecto y las cuentas sintéticas previstos, recibe las
credenciales por entrada estándar y no las guarda en los informes. El recorrido
principal debe ejecutarse una vez por conjunto nuevo de datos; sus casos de
duplicados vuelven a enviar expresamente cada operación dentro de la misma prueba.

## Estado al terminar

La salida virtual se ha retirado y no quedan inscripciones de ese evento. Se ha
eliminado el mensaje sintético que reprodujo la fuga inicial del título. Las
conversaciones de prueba quedan marcadas como leídas para el entrenador.

Se conservan seis sesiones sintéticas y doce registros de trail, junto con los
objetivos, resultados y conversaciones de las cuentas PILOTO, para facilitar su
revisión posterior. No se han creado solicitudes comerciales ni cuotas para esas
cuentas. La comprobación de aforo verificó tres inscritos y cero plazas disponibles
antes de cancelar las inscripciones y retirar la actividad.
