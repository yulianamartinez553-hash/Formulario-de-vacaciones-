# Vacaciones — Servinorte SRL

## Rutas

| Ruta | Uso |
|---|---|
| `/rrhh` | Panel central: registrar solicitudes, ver "Vacaciones registradas", control por período y generar/imprimir el PDF de licencia |
| `/`, `/formulario`, `/control`, `/control_vacaciones_servinorte.html` | Alias viejos, redirigen a `/rrhh` (`middleware.js`) |

Sitio: https://formulario-de-vacaciones.vercel.app/

### `/rrhh`
- Abrí: https://formulario-de-vacaciones.vercel.app/rrhh
- Clave: `ServinorteRRHH2026` (gate de UI, no reemplaza la seguridad de la base — ver más abajo)

## Datos

Todo el dato (empleados, saldos, solicitudes, histórico) vive en **una sola base**: el mismo proyecto Supabase que usa la intranet de Servinorte (`servinorte-intranet`). No hay Google Sheets ni Apps Script — ese flujo viejo se dio de baja.

- `vac_empleados_publico` (vista de solo lectura, columnas seguras) — empleados, vía anon key.
- `vac_saldos`, `vac_solicitudes` — saldos y solicitudes de vacaciones.
- `vac_hist_empleados`, `vac_hist_saldos`, `vac_hist_solicitudes` — histórico importado de la planilla previa a la app.

Con `anon` (sin login) se puede: leer todo lo anterior, e insertar filas en `vac_solicitudes`. La clave `ServinorteRRHH2026` es solo un gate de la interfaz — cualquiera con el anon key de la página puede llamar a la API de Supabase directo, así que no depender de esa clave para nada sensible.

## Empleados

Los perfiles de empleado (nombre, legajo, sector, fecha de alta, etc.) se gestionan desde la intranet — ahí es donde viven los datos completos (DNI, domicilio, obra social, etc., no expuestos acá). Esta app solo lee el subconjunto público vía `vac_empleados_publico`.
