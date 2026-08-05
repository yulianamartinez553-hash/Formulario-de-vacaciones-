# Formulario de vacaciones — Servinorte SRL

HTML estático conectado a la planilla de Google Sheets.

## Archivos / rutas Vercel

| Ruta | Archivo | Uso |
|---|---|---|
| `/` | `index.html` | Control de vacaciones (entrada principal) |
| `/formulario` | `formulario.html` | Formulario imprimible / PDF + envío a REGISTRO |
| `/control` | rewrite → `/` | Alias del control |

- `apps-script/Codigo.gs` — escribe cada solicitud como fila nueva arriba en `REGISTRO`
- `vercel.json` — rutas de despliegue

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

Si actualizás `Codigo.gs`, volvé a **Implementar → Nueva implementación** (o “Administrar implementaciones → Editar → Versión nueva”).

## Flujo

1. Abrir `/` (Control)
2. Buscar empleado → **Solicitar** → días + fecha → **Calcular**
3. **Abrir formulario** → se completa con LEG/EMPLEADO/PUESTO/DESDE/HASTA/DIAS/PERIODO y **registra solo en REGISTRO**
4. **Descargar PDF** y/o **Imprimir**
5. También podés pulsar **Enviar solicitud** manualmente
