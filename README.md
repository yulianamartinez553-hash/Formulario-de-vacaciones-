# Vacaciones — Servinorte SRL

## Rutas Vercel

| Ruta | Quién | Qué hace |
|---|---|---|
| `/` | Uso general | **Control**: saldos y **Generar solicitud** → inserta fila en `REGISTRO` |
| `/rrhh` | Solo RRHH (usuario/clave) | Formulario imprimible / **PDF** desde datos de `REGISTRO` |

Sitio: https://formulario-de-vacaciones.vercel.app/

## Acceso privado `/rrhh`

El navegador pide usuario y contraseña (Basic Auth).

**Por defecto**
- Usuario: `rrhh`
- Contraseña: `ServinorteRRHH2026`

**Recomendado:** en Vercel → Project → Settings → Environment Variables:
- `RRHH_USER`
- `RRHH_PASSWORD`

Luego redeploy.

## Planilla

`https://docs.google.com/spreadsheets/d/1aaWSfGKGIU1BhZqNjOgLPn2xC3mVp1gULvEXQvCWI_Q`

| Hoja | Uso |
|---|---|
| `Empleados` | Legajo, nombre, puesto, fecha de alta |
| `CONTROL` | Días pendientes por período |
| `REGISTRO` | Solicitudes (fila nueva arriba) |
| `2023`–`2026` | Detalle por período |

Lectura: planilla pública **Cualquiera con el enlace → Lector**.

## Apps Script (escritura en REGISTRO)

1. Planilla → Extensiones → Apps Script → pegar `apps-script/Codigo.gs`
2. Implementar → Aplicación web → acceso **Cualquier persona**
3. URL ya configurada en `index.html` (`CONFIG.appsScriptUrl`)

## Flujo

1. `/` → Solicitar → Calcular → **Generar solicitud** (solo registra en Drive)
2. `/rrhh` (con clave) → Cargar última de REGISTRO → Descargar PDF / Imprimir
