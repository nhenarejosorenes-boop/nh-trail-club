# Vinculación de fichas y cuentas

Desde Deportistas → ficha, un administrador puede buscar una cuenta por el correo
exacto de contacto, revisar el resultado, verificar su identidad con el corredor
y confirmar la vinculación. Se ignoran mayúsculas y espacios en los extremos;
no se usan coincidencias parciales ni aproximadas.

La cuenta debe tener correo confirmado en Auth, un perfil con rol `athlete` y no
estar bloqueada, eliminada ni ser anónima. El nombre es declarado por el usuario
y no constituye una prueba de identidad. El registro de la cuenta y la
confirmación de correo siguen realizándose por el deportista.

El servidor comprueba de nuevo el rol del administrador, la ficha, el correo y la
cuenta revisada al guardar. No permite sustituir una cuenta vinculada, reutilizar
la misma cuenta en otra ficha ni elegir entre varias identidades coincidentes.
La confirmación repetida de la misma vinculación es idempotente.

El bloqueo de filas y el índice único existente protegen la escritura. El cambio
y un registro de auditoría (ficha, cuenta, administrador y fecha) se realizan en
la misma transacción. La auditoría permanece en el esquema privado `nh_accounts`;
no se exponen contraseñas, claves privilegiadas ni listados de usuarios de Auth.
Las funciones públicas usan `SECURITY INVOKER`; la implementación privilegiada
permanece en el esquema privado con autorización interna y `search_path` fijo.

La herramienta no cambia suscripciones, pagos ni permisos de los deportistas.
No desvincula ni fusiona cuentas. Las escrituras directas ya permitidas a los
administradores por las políticas existentes no pasan por esta auditoría.

Ante un fallo al confirmar, la interfaz exige recargar la ficha y comprobar su
estado antes de repetir una escritura. No presupone que un fallo de red implique
que la base de datos haya rechazado la operación.

## Instalación y verificación

Migración: `supabase/migrations/20261108175452_athlete_account_linking.sql`.
La instalación no vincula ninguna cuenta ni crea participantes del piloto.
TEST permanece inactivo. La suite usa PostgreSQL aislado mediante PGlite, con
tablas mínimas compatibles, roles y RLS. Comprueba permisos, contexto cambiado,
identidades no elegibles, duplicados, idempotencia, atomicidad y propiedad de las
fichas. Es una instancia de una conexión; no simula escrituras concurrentes de
varias conexiones ni todo el servicio de Auth/PostgREST.

Las pruebas de interfaz ejercitan búsqueda explícita, revisión, casilla de
identidad, cancelación, éxito y fallo incierto. También se verifican respuestas
RPC y contexto de propietario. Queda pendiente el recorrido con sesión real de
administración y un corredor seleccionado; no se han vinculado fichas reales
para completar las pruebas.

La revisión de seguridad previa a esta migración detectó avisos existentes en
`controlar_plazas`, `obtener_plazas_actividad`, `mark_training_completed` y la
protección de contraseñas filtradas. No pertenecen a este paquete.
