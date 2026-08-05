# Formulario de vacaciones — Servinorte SRL

HTML estático conectado a la planilla de Google Sheets.

## Archivos

- `control_vacaciones_servinorte.html` — saldos pendientes y armado de solicitud
- `index.html` — formulario imprimible / PDF + envío a REGISTRO
- `apps-script/Codigo.gs` — escribe cada solicitud como fila nueva arriba en `REGISTRO`

## Planilla

`https://docs.google.com/spreadsheets/d/1aaWSfGKGIU1BhZqNjOgLPn2xC3mVp1gULvEXQvCWI_Q`

| Hoja | Uso |
|---|---|
| `Empleados` | Legajo, nombre, puesto, fecha de alta |
| `CONTROL` | Días pendientes por período |
| `REGISTRO` | Historial de solicitudes / tomados |
| `2023`–`2026` | Detalle por período |

La planilla debe estar compartida como **Cualquiera con el enlace → Lector** para lectura.

## Activar el registro automático (Apps Script)

1. Abrí la planilla → **Extensiones → Apps Script**
2. Pegá el contenido de `apps-script/Codigo.gs`
3. **Implementar → Nueva implementación → Aplicación web**
   - Ejecutar como: Yo
   - Quién tiene acceso: Cualquier persona
4. Copiá la URL y pegala en `CONFIG.appsScriptUrl` de `index.html` (y opcionalmente del control)

Sin ese paso, el formulario igual permite **Descargar PDF** e **Imprimir**; solo falla **Enviar solicitud**.

## Flujo

1. Abrir `control_vacaciones_servinorte.html`
2. Buscar empleado → **Solicitar** → días + fecha → **Calcular**
3. **Abrir formulario** (lleva los datos por URL)
4. **Descargar PDF** y/o **Imprimir**
5. **Enviar solicitud** → inserta fila en `REGISTRO` con estado `SOLICITADA`
