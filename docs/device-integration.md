# Dispositivos: orden de integración

## 1. Importación de archivos

Ruta: `/importar-actividad`, enlazada desde entrenamientos y seguimiento de trail.

- FIT: SDK oficial `@garmin/fitsdk`, integridad CRC y resumen de cada sesión.
- TCX: actividades de carrera; sumas de vueltas y estimación de desnivel desde puntos.
- GPX: tracks con tiempos; distancia GPS y suma de ascensos dentro de cada segmento, sin unir interrupciones. Sin suavizado de altitud; la revisión lo advierte.
- Hasta 20 MB, 32 actividades y 150.000 puntos por actividad XML. Trabajo en Web Worker con límite de 20 segundos. XML sin DTD ni entidades. ZIP y rutas sin actividad no admitidos.
- Revisión editable de fecha, distancia, desnivel, minutos, RPE y sensaciones. La fecha inicial usa Europe/Madrid. No se infiere RPE de la frecuencia cardiaca.
- Solo se guarda un resumen en `trail_activity_log`, con la misma autorización y los mismos totales que los registros manuales. No se sube el archivo ni se guarda el recorrido GPS.
- Procedencia inmutable y claves únicas por corredor: SHA-256 del archivo + índice y SHA-256 del inicio normalizado al segundo. Detecta copias entre formatos con el mismo inicio; no garantiza reconocer exportaciones con horas distintas. Un posible registro manual similar se muestra para revisión.
- RPC con `SECURITY INVOKER`: duplicados devuelven el registro existente sin sobrescribir correcciones. Los reintentos son idempotentes.
- Vínculo opcional a una sesión propia de trail. No modifica `completed` ni crea otro registro de carga.

Pruebas: `node --test supabase/tests/*.test.mjs`, TypeScript y compilación. Tras compilar, `node supabase/tests/verify-activity-worker.mjs` comprueba el worker emitido en un entorno simulado, sin sustituir una prueba de navegador. En TEST, aplicar el ajuste de paridad `supabase/tests/trail_log_write_parity_test_only.sql` si faltan las políticas de escritura existentes en producción, y ejecutar `activity_import_test_only.sql`. Esta suite usa roles reales y revierte todas las identidades y salidas sintéticas. Nunca ejecutar scripts `test_only` en producción.

## 2. Sincronización automática (pendiente de acceso Garmin)

La aplicación sirve a múltiples corredores: solicitar Business Starter en el [programa oficial de Garmin](https://developer.garmin.com/gc-developer-program/overview/). No utilizar la clave personal de un corredor como integración del club. El nivel Starter publica datos nuevos mediante push y no incluye importación histórica; los archivos cubren el historial inicial.

Antes de implementar el intercambio real se necesitan la aplicación aprobada, las credenciales de prueba y la documentación técnica disponible en su portal. No hay endpoints OAuth ni webhooks supuestos, credenciales de ejemplo operativas o estados de conexión ficticios en esta versión.

Diseño siguiente: autorización individual y revocable; tokens solo en servidor; eventos verificados según el contrato oficial; registro de actividad externo único por proveedor/corredor; cola con reintentos idempotentes; conciliación con importaciones previas; desconexión y tratamiento de revocaciones. Conservar registros ya confirmados y mostrar última sincronización/error real. Separar TEST de producción.

## 3. Envío al reloj (después de validar la sincronización)

Usar Training API con autorización del corredor y dispositivos compatibles. Traducir los bloques del editor de trail a pasos, repeticiones, duración, distancia y objetivos admitidos. Validar capacidades contra la documentación aprobada, mostrar previsualización y pedir envío explícito. No convertir automáticamente desnivel o terreno en objetivos que el reloj no admita.

Registrar identificador externo y revisiones de la prescripción, errores y aceptación por Garmin. Distinguir aceptación del servicio, sincronización del dispositivo y actividad realizada; no mostrar entrega al reloj sin evidencia disponible.

## Verificación pendiente

Compilación y pruebas de parser/base de datos no sustituyen una prueba con sesión real del corredor. Falta recorrer selección de archivo → revisión → guardado → historial en un navegador autenticado con un archivo real del dispositivo. Para Garmin en vivo también falta el acceso empresarial anterior.
