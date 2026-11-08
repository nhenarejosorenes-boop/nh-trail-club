# Preparación del piloto de las tres modalidades

La ruta administrativa `/admin/piloto` reúne el estado actual de fichas,
suscripciones y cuotas y un recorrido de prueba para Básica, PLUS y PLUS
Performance. Está enlazada desde el panel principal del administrador y desde
Administración.

Las consultas requieren sesión verificada y rol administrador antes de leer datos
del club. Se seleccionan identificadores y estados, sin nombres, correos ni
teléfonos. Las RLS existentes siguen siendo la autorización de base de datos.
El panel no elige participantes ni registra que un piloto se haya ejecutado.

Las cuentas activas se clasifican una sola vez por su modalidad pagada de mayor
nivel, usando la misma resolución de acceso que la aplicación. Requieren solicitud
aprobada y cuota mensual pagada con importe positivo. El periodo se calcula en
Europe/Madrid. Se distinguen cuentas activas sin ficha vinculada, fichas sin cuenta,
cuentas aprobadas sin cuota válida y cuentas con solicitud pendiente.

Los contadores son un resumen de los registros de administración. No consultan
Auth para certificar la identidad, el estado actual de la cuenta ni la disponibilidad
del corredor. Estos requisitos se revisan antes de acordar la participación.

Las consultas paginan en lotes de 500 y dividen las cuotas por grupos de 100
suscripciones. Un error invalida el resumen completo. Durante la actualización
se ocultan los datos anteriores. Se actualiza al recuperar foco, visibilidad,
cambiar la sesión o transcurrir un minuto en primer plano. Si cambia el mes
durante una consulta se descarta ese resultado y se vuelve a consultar.

La guía incluye acceso móvil, salidas e inscripciones, acceso permitido o bloqueado
a planes individuales, importación e historial, mensajes, cuotas y privacidad.
Todos los recorridos con participantes reales permanecen pendientes.

No requiere migraciones, claves nuevas ni cambios de datos. TEST permanece
inactivo. La validación automatizada cubre autorización, recuentos, duplicados,
prioridad de modalidad, periodo de Madrid, propiedad de cuotas, paginación y
fallos de consulta. Se completa con TypeScript y compilación.
