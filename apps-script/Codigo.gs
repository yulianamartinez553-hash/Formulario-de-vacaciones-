/**
 * Servinorte SRL — Registro de solicitudes de vacaciones
 * =====================================================
 * Solo ESCRIBE la fila en REGISTRO (con datos).
 * El PDF se genera en la web privada /rrhh con el diseño original.
 *
 * Tras pegar este código:
 * Implementar → Administrar implementaciones → Editar → Versión nueva → Implementar
 *
 * Encabezado REGISTRO (fila 3):
 * LEG | EMPLEADO | PUESTO | DESDE | HASTA | DIAS | PERIODO | ESTADO
 * Cada solicitud inserta una fila NUEVA en la fila 4 (empuja el historial abajo).
 */

var SHEET_ID = '1aaWSfGKGIU1BhZqNjOgLPn2xC3mVp1gULvEXQvCWI_Q';
var HOJA_REGISTRO = 'REGISTRO';
var FILA_DATOS = 4;

function doGet(e) {
  return handle_(e && e.parameter ? e.parameter : {});
}

function doPost(e) {
  var data = {};
  try {
    if (e && e.postData && e.postData.contents) {
      var raw = String(e.postData.contents || '').trim();
      if (raw) data = JSON.parse(raw);
    }
    if ((!data || !Object.keys(data).length) && e && e.parameter) {
      data = e.parameter;
    }
  } catch (err) {
    return json_({ ok: false, error: 'JSON inválido: ' + err });
  }
  return handle_(data);
}

function handle_(data) {
  try {
    data = data || {};
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
        error: 'Faltan campos (empleado, desde, hasta, dias, periodo).',
        recibido: data
      });
    }

    var diasNum = Number(String(dias).replace(',', '.'));
    if (!isFinite(diasNum) || diasNum <= 0) {
      return json_({ ok: false, error: 'DIAS debe ser un número positivo.', dias: dias });
    }

    var sh = getHojaRegistro_();
    limpiarVaciasArriba_(sh);

    // getRange(row, column, numRows, numColumns) — 3º y 4º son CANTIDADES
    sh.insertRowBefore(FILA_DATOS);
    sh.getRange(FILA_DATOS, 1, 1, 8).setValues([[
      leg,
      empleado,
      puesto,
      desde,
      hasta,
      diasNum,
      periodo,
      estado
    ]]);
    SpreadsheetApp.flush();

    var written = sh.getRange(FILA_DATOS, 1, 1, 8).getDisplayValues()[0];
    if (!String(written[1] || '').trim()) {
      return json_({
        ok: false,
        error: 'La fila se insertó pero los datos no quedaron grabados.',
        written: written
      });
    }

    return json_({
      ok: true,
      message: 'Solicitud registrada en REGISTRO con datos.',
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
      },
      written: written
    });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function getHojaRegistro_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = ss.getSheetByName(HOJA_REGISTRO);
  if (!sh) {
    var sheets = ss.getSheets();
    for (var i = 0; i < sheets.length; i++) {
      if (String(sheets[i].getName()).toUpperCase() === 'REGISTRO') {
        sh = sheets[i];
        break;
      }
    }
  }
  if (!sh) throw new Error('No se encontró la hoja REGISTRO.');
  return sh;
}

/** Borra filas totalmente vacías entre el encabezado y el primer dato real. */
function limpiarVaciasArriba_(sh) {
  var last = Math.max(sh.getLastRow(), FILA_DATOS);
  for (var r = last; r >= FILA_DATOS; r--) {
    var row = sh.getRange(r, 1, 1, 8).getDisplayValues()[0];
    var joined = row.join('').replace(/\s+/g, '');
    if (!joined) sh.deleteRow(r);
  }
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
