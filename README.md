# Vacaciones — Servinorte SRL

## Rutas Vercel

| Ruta | Quién | Qué hace |
|---|---|---|
| `/` | Uso general | Control → **Generar solicitud** (escribe datos en `REGISTRO` + PDF en Drive) |
| `/rrhh` | Solo RRHH | Reimprimir / PDF (usuario y contraseña) |

Sitio: https://formulario-de-vacaciones.vercel.app/

### Acceso `/rrhh`
- Usuario: `rrhh`
- Contraseña: `ServinorteRRHH2026`  
(o variables `RRHH_USER` / `RRHH_PASSWORD` en Vercel)

## Apps Script (obligatorio actualizar)

El registro vacío se debía a un bug en `getRange`. El código nuevo:

1. Escribe bien LEG, EMPLEADO, PUESTO, DESDE, HASTA, DIAS, PERIODO, ESTADO
2. Genera el PDF en Drive (carpeta **Vacaciones PDF Servinorte**)

### Cómo actualizar (si no, sigue la versión rota)

1. Abrí la planilla → **Extensiones → Apps Script**
2. Borrá todo y pegá `apps-script/Codigo.gs`
3. Guardá
4. **Implementar → Administrar implementaciones → ✎ Editar**
5. Versión: **Nueva versión** → **Implementar**
6. La primera vez autorizá acceso a Sheets y Drive

URL ya configurada en `index.html`:
`CONFIG.appsScriptUrl`

## Planilla

https://docs.google.com/spreadsheets/d/1aaWSfGKGIU1BhZqNjOgLPn2xC3mVp1gULvEXQvCWI_Q

| Hoja | Uso |
|---|---|
| `Empleados` | Alta / puesto |
| `CONTROL` | Pendientes |
| `REGISTRO` | Solicitudes (fila nueva arriba, con datos) |
