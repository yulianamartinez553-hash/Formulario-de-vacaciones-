# Vacaciones — Servinorte SRL

## Rutas

| Ruta | Uso |
|---|---|
| `/` | Control → **Generar solicitud** (solo escribe en `REGISTRO`) |
| `/rrhh` | PDF con diseño original (membrete) · autocompleta con la **última fila** de `REGISTRO` |

Sitio: https://formulario-de-vacaciones.vercel.app/

### `/rrhh` (privado)
- Usuario: `rrhh`
- Contraseña: `ServinorteRRHH2026`

## Flujo

1. En `/` → Solicitar → Calcular → **Generar solicitud**  
   → inserta LEG, EMPLEADO, PUESTO, DESDE, HASTA, DIAS, PERIODO, ESTADO en `REGISTRO`
2. En `/rrhh` → carga sola la última fila → **Descargar PDF** / Imprimir  
   (diseño original del formulario, no un PDF distinto de Drive)

## Apps Script

Solo registra filas (no genera PDF). Archivo: `apps-script/Codigo.gs`

Tras cambiar el código: **Implementar → Versión nueva**.
