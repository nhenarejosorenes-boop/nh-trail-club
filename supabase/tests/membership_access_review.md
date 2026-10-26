# Control de acceso por modalidad y pago

Estado: activado en NH Trail Club TEST y en producción el 26 de octubre de 2026, con autorización expresa del usuario.

La migración `20261026162858_membership_access_guards.sql` añade seis políticas restrictivas. El nombre de archivo se sincronizó con la versión registrada por Supabase al activarla. Las reglas de propiedad y administración existentes siguen vigentes: los nuevos controles se combinan con ellas mediante AND.

- Los planes semanales, rutinas y ejercicios individuales requieren PLUS o PLUS Performance aprobada y una cuota positiva marcada como pagada para el mes actual.
- La consulta de salidas y la creación de inscripciones y reservas requieren una modalidad aprobada y pagada, incluida Básica.
- La condición mensual se calcula con el calendario de Europe/Madrid.
- Administración mantiene la excepción de pago, sujeta a las reglas existentes de cada tabla. La migración no amplía sus permisos de propiedad.
- La función de completar una sesión comprueba autenticación, pago premium y propiedad o administración. Solo modifica `completed` y rechaza estados nulos.
- El cálculo de acceso vive en un esquema separado del API público. No usa metadatos editables del usuario. Las funciones fijan `search_path` vacío y no conceden ejecución a visitantes anónimos.

## Alcance de la validación

La suite ampliada de base de datos obtuvo **184/184 comprobaciones correctas**, con reversión de todos sus datos temporales. Incluye acceso por modalidad, pago pendiente/vencido, aprobación pendiente, pago del mes anterior, aislamiento de datos, función de completar sesiones y rechazo de modificaciones ajenas.

La suite ampliada de autenticación y API obtuvo **133/133 comprobaciones correctas** con tokens reales. Incluye finalización de sesiones propias/ajenas, rechazo de estados nulos, bloqueo anónimo y ausencia del cálculo interno en el API público. El total de ambas suites es **317/317**. La limpieza final confirmó cero usuarios, sesiones de autenticación, planes y suscripciones temporales. Las credenciales temporales locales se eliminaron.

Evidencia: `membership_rls_results_20261026.json` y `membership_api_results_20261026.json`.

No se sustituyeron las políticas permisivas existentes en TEST: la revisión automática rechazó ese cambio por el riesgo de debilitar su protección. Se utilizó la alternativa aditiva. TEST sigue teniendo diferencias con producción en políticas, triggers y permisos; estos resultados no certifican una réplica exacta de producción. La suite prueba directamente la nueva función de autorización y la función de completar sesiones, además de los accesos bajo las reglas combinadas.

## Revisión de funciones privilegiadas

El asesor de Supabase avisa de que `mark_training_completed` es una función SECURITY DEFINER ejecutable por usuarios autenticados. Es intencional para permitir cambiar exclusivamente el estado de finalización sin dar permiso de edición del contenido prescrito. La función comprueba el usuario, su acceso y la fila afectada. Las otras dos funciones avisadas son las utilidades `nh_test_*` preexistentes de TEST.

[Referencia del aviso SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

También aparece el aviso de protección contra contraseñas filtradas desactivada en TEST. No se ha cambiado la configuración de Auth durante este trabajo. [Referencia de contraseñas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Activación en producción

La migración se aplicó correctamente a `mibhnqgkbfirxhurxlfg` y quedó registrada con versión `20261026162858`. Se compararon las políticas antes y después: las **21 políticas anteriores permanecen sin cambios** y se añadieron **6 políticas restrictivas**. Las dos funciones nuevas o actualizadas permiten ejecución a usuarios autenticados y la deniegan al rol anónimo.

Una comprobación posterior con las **3 cuentas existentes** realizó **17 verificaciones de lectura, sin fallos**: acceso general/premium, visibilidad de planes propios, aislamiento de planes y rutinas ajenos, y bloqueo de contenidos según pago/modalidad. No creó cuentas de prueba ni modificó cuotas, entrenamientos, reservas o inscripciones. Esta comprobación no sustituye una prueba visual autenticada de la web.

El asesor de producción también detecta avisos preexistentes en `controlar_plazas` y `obtener_plazas_actividad`, ejecutables por visitantes anónimos, y en la protección de contraseñas filtradas. No se modificaron esas funciones ni Auth durante esta activación. [Referencia del acceso anónimo a funciones privilegiadas](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).

La protección está activa sin necesitar un nuevo despliegue de la web. Para conceder acceso a un corredor se requiere solicitud aprobada y mensualidad positiva del mes actual marcada como pagada; para los planes individuales se requiere PLUS o Performance. Administración mantiene la excepción de pago sujeta a las reglas de propiedad previas.
