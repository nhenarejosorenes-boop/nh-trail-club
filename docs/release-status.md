# Cierre de fichas y revisión de preparación — 27 de octubre de 2026

## Este paquete

- Sustituye las secciones «Próximamente» de la ficha por consultas reales: objetivos, planificación, evolución, informes y salidas del mes.
- Verifica el rol administrador antes de consultar datos personales de la ficha. RLS sigue siendo la autorización de base de datos; no se amplían permisos.
- Filtra cada consulta de seguimiento por la cuenta vinculada. Los informes corresponden a las sesiones del mes seleccionado, no a su fecha de modificación.
- Permite abrir la planificación y el panel del entrenador con el deportista y periodo correctos, además de objetivos y conversación.
- Conserva explícitamente fichas sin cuenta vinculada, sin asociarlas por correo ni crear usuarios.
- Pagina fichas, planes, salidas, objetivos e informes. Los listados visibles resumidos explican su límite; los totales usan el mes completo.
- Distingue vacío, falta de acceso y fallos de consulta. Oculta los resultados anteriores al cambiar de ficha o mes.
- Libera los controles de alta, edición y eliminación aunque falle la conexión, y bloquea operaciones simultáneas. No cambia la naturaleza de la eliminación ni ejecuta eliminaciones durante las pruebas.

## Validación y límites

La suite automatizada cubre autorización previa de la ficha, propiedad de las consultas,
paginación, selección de mes, lotes de informes, errores y contenido renderizado.
Se comprueban TypeScript, compilación y el worker de importación.

La versión pública del panel redirige al inicio de sesión en el navegador de pruebas.
Falta una sesión real para recorrer administración → ficha → plan → informe y corredor →
importar → guardar → comparar sin datos simulados. No se han creado usuarios o datos reales
para sortear ese paso.

Garmin automático y envío al reloj siguen dependiendo del acceso aprobado de organización,
sus credenciales y la documentación técnica de evaluación. No se presentan como completados.
Las cuotas siguen registrándose y verificándose manualmente por el club; no hay pasarela de cobro.
La ficha resume datos registrados; no incorpora un módulo de pruebas físicas sin modelo de datos.
