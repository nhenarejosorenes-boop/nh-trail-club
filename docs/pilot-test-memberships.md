# Suscripciones temporales para cuentas de prueba

Cada cuenta de piloto tiene su modalidad en `club_pilot_memberships`, una
suscripción temporal separada de solicitudes comerciales y cuotas. No se crean
recibos ni se registran cobros ficticios. No se incluyen en los totales económicos.

La tabla tiene RLS de lectura propia o administrativa. Los clientes no pueden
crear, ampliar, borrar ni cambiar una suscripción de prueba. Su duración máxima es
de 30 días; las tres cuentas iniciales se preparan para siete días. La política de
solicitudes comerciales rechaza altas de estas cuentas, incluso tras caducar.

La autorización existente `nh_access.has_paid_access` conserva el comportamiento
para administradores y cuentas con cuota real y añade la alternativa temporal.
Solo se habilita para perfiles de deportista, cuentas confirmadas y disponibles y
un periodo vigente. Básica permite club; PLUS y Performance permiten además planes
individuales. La caducidad se comprueba en cada operación protegida.

La interfaz resuelve el acceso temporal desde la fila propia y lo identifica como
prueba, con fecha de caducidad y sin cuota. El panel de preparación separa las
cuentas de prueba de las cuentas con cuota pagada. Una suscripción de prueba no
representa que el piloto ya haya superado sus recorridos.

Las cuentas iniciales tienen correos reservados `.example` y fichas marcadas
PILOTO. No reciben correos. Las credenciales se generan aleatoriamente durante la
provisión y se entregan al propietario; no se guardan en el repositorio.

Las pruebas locales ejecutan la migración en PostgreSQL aislado con roles y RLS,
comprueban caducidad, propiedad, prohibición de modificar accesos, bloqueo de
solicitudes comerciales y conservación de acceso por cuotas reales. También se
comprueba el cliente, la resolución de modalidad y la separación de contadores.
El entorno TEST continúa inactivo.

La provisión en producción debe ser explícita y transaccional. Solo afecta a las
tres nuevas identidades sintéticas y sus fichas y suscripciones temporales. No
reutiliza ni modifica fichas reales. Tras la provisión, comprobar inicio de sesión,
lectura propia y niveles de acceso antes de comenzar el recorrido del piloto.

Migración instalada: `20261108183602_pilot_test_memberships.sql`.

Se han provisionado las tres cuentas iniciales y comprobado mediante las políticas
de producción el acceso de club, la diferencia entre Básica y premium y la lectura
exclusiva de la suscripción temporal propia. Las tres fichas están vinculadas y
no se han creado solicitudes comerciales ni cuotas.
