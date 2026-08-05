/**
 * Servinorte SRL — Registro de solicitudes de vacaciones
 * =====================================================
 * INSTALACIÓN (una sola vez):
 * 1) Abrí la planilla:
 *    https://docs.google.com/spreadsheets/d/1aaWSfGKGIU1BhZqNjOgLPn2xC3mVp1gULvEXQvCWI_Q
 * 2) Extensiones → Apps Script
 * 3) Borrá el código por defecto y pegá ESTE archivo completo
 * 4) Guardá → Implementar → Nueva implementación → Tipo: Aplicación web
 *      - Descripción: Registro vacaciones
 *      - Ejecutar como: Yo
 *      - Quién tiene acceso: Cualquier persona
 * 5) Copiá la URL de la implementación
 * 6) Pegala en CONFIG.appsScriptUrl de:
 *      - index.html
 *      - control_vacaciones_servinorte.html
 *
 * La hoja REGISTRO debe tener encabezados en la fila 3:
 * LEG | EMPLEADO | PUESTO | DESDE | HASTA | DIAS | PERIODO | ESTADO
 * Cada solicitud inserta una fila NUEVA en la fila 4 y empuja el resto hacia abajo.
 */

var SHEET_ID = '1aaWSfGKGIU1BhZqNjOgLPn2xC3mVp1gULvEXQvCWI_Q';
var HOJA_REGISTRO = 'REGISTRO';
var FILA_ENCABEZADO = 3;
var FILA_DATOS = 4;

function doGet(e) {
  return handle_(e && e.parameter ? e.parameter : {});
}

function doPost(e) {
  var data = {};
  try {
    if (e && e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      data = e.parameter;
    }
  } catch (err) {
    return json_({ ok: false, error: 'JSON inválido: ' + err });
  }
  return handle_(data);
}

function handle_(data) {
  try {
    var accion = String(data.accion || data.action || 'registrar').toLowerCase();
    if (accion === 'ping') {
      return json_({ ok: true, ping: true, ts: new Date().toISOString() });
    }
    if (accion !== 'registrar') {
      return json_({ ok: false, error: 'Acción no soportada: ' + accion });
    }

    var leg = String(data.leg || data.LEG || '').trim();
    var empleado = String(data.empleado || data.emp || data.EMPLEADO || '').trim();
    var puesto = String(data.puesto || data.PUESTO || '').trim();
    var desde = String(data.desde || data.DESDE || '').trim();
    var hasta = String(data.hasta || data.HASTA || '').trim();
    var dias = data.dias != null ? data.dias : data.DIAS;
    var periodo = String(data.periodo || data.per || data.PERIODO || '').trim();
    var estado = String(data.estado || data.ESTADO || 'SOLICITADA').trim().toUpperCase();

    if (!empleado || !desde || !hasta || dias === '' || dias == null || !periodo) {
      return json_({
        ok: false,
        error: 'Faltan campos obligatorios (empleado, desde, hasta, dias, periodo).'
      });
    }

    var diasNum = Number(dias);
    if (!isFinite(diasNum) || diasNum <= 0) {
      return json_({ ok: false, error: 'DIAS debe ser un número positivo.' });
    }

    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sh = ss.getSheetByName(HOJA_REGISTRO);
    if (!sh) return json_({ ok: false, error: 'No se encontró la hoja REGISTRO.' });

    // Inserta arriba (fila 4), empuja el historial hacia abajo
    sh.insertRowBefore(FILA_DATOS);
    sh.getRange(FILA_DATOS, 1, FILA_DATOS, 8).setValues([[
      leg,
      empleado,
      puesto,
      desde,
      hasta,
      diasNum,
      periodo,
      estado
    ]]);

    return json_({
      ok: true,
      message: 'Solicitud registrada en REGISTRO (fila ' + FILA_DATOS + ').',
      fila: FILA_DATOS,
      registro: {
        leg: leg,
        empleado: empleado,
        puesto: puesto,
        desde: desde,
        hasta: hasta,
        dias: diasNum,
        periodo: periodo,
        estado: estado
      }
    });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
