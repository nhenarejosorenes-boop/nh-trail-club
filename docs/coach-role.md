# Perfil Entrenador

El entrenador se registra y confirma su correo como cualquier usuario. Desde
Administración → Entrenadores, el propietario busca su correo de registro exacto,
comprueba la identidad y activa el perfil. No se comparte la cuenta del propietario.
Desde la misma pantalla se puede buscar de nuevo y retirar el acceso.

## Alcance

- Programación de fuerza y trail para los deportistas con ficha y cuenta vinculadas.
- Objetivos, etapas, revisiones y consulta de resultados y registros deportivos.
- Lectura de plantillas y biblioteca; creación de ejercicios y plantillas del equipo.
- Conversaciones con los deportistas del club.
- Panel de inicio propio y acceso sin cuota comercial para el entrenador.

El entrenador no gestiona cuotas, solicitudes de suscripción, permisos, altas,
edición o vinculación de fichas, ni la administración de actividades del club.
El listado de programación proporciona nombre, nivel e identificadores: no da
acceso a los correos ni teléfonos de las fichas. La mensajería corresponde al
equipo entrenador y conserva el historial existente.

Esta primera versión permite trabajar con los deportistas del club; no incorpora
asignación exclusiva de corredores a cada entrenador. Los resultados y salidas
registrados por un deportista siguen siendo editables solo por su propietario.

## Control de permisos

El rol es `profiles.role = 'coach'`. La creación de cuentas continúa asignando
`athlete`; los usuarios no pueden elegir ni cambiar su rol desde el registro.
Las comprobaciones de permisos se realizan contra el rol actual de la base de
datos, no contra metadatos editables ni un rol guardado en el token.

Los RPC públicos son SECURITY INVOKER. Sus implementaciones privilegiadas están
en el esquema privado `nh_staff`, con autorización interna y search_path fijo.
Activar o retirar acceso exige administración, identidad y rol revisados; bloquea
la fila y audita el cambio en la misma transacción. No permite cambiar cuentas
administradoras ni la propia cuenta. La protección de roles solo permite la
escritura desde la implementación privada propiedad de postgres, con un
administrador autenticado y una transición athlete/coach.

Las cuentas deben estar confirmadas y activas para recibir permisos. Las cuentas
piloto están excluidas. Un entrenador bloqueado, eliminado o anónimo no conserva
acceso deportivo por mantener un token anterior. Se permite retirar un perfil
coach aunque su cuenta esté bloqueada. Una retirada exige recargar las pantallas
abiertas para actualizar sus controles; las nuevas peticiones se autorizan con
el rol actualizado.

No se promueve ninguna cuenta al instalar la migración.

## Validación

Pruebas con PostgreSQL aislado mediante PGlite y una copia sin datos de las
columnas, claves primarias/únicas, políticas y funciones relevantes de producción.
Verifican escritura deportiva, seguimiento, mensajería, denegación de acceso
económico y administrativo, transición de roles, identidad, auditoría atómica y
revocación. No emulan todo Supabase Auth, todos los triggers, restricciones ni
concurrencia de múltiples conexiones.

Pruebas de interfaz de acceso, revisión de identidad, guardados inciertos y
enlaces del panel. Se comprueban TypeScript, la compilación y el lector compilado
de actividades. La validación visual autenticada del nuevo perfil requiere la
cuenta de un entrenador; no se cambia el rol de ningún usuario real para probar.
