/**
 * Servinorte SRL — Registro de solicitudes de vacaciones
 * =====================================================
 * 1) Escribe la fila en REGISTRO (con datos).
 * 2) Descuenta los días en CONTROL (columna del período).
 * El PDF se genera en la web privada /rrhh con el diseño original.
 *
 * IMPORTANTE tras pegar este código:
 * Implementar → Administrar implementaciones → Editar → Versión nueva → Implementar
 *
 * Encabezado REGISTRO (fila 3):
 * LEG | EMPLEADO | PUESTO | DESDE | HASTA | DIAS | PERIODO | ESTADO
 * Cada solicitud inserta una fila NUEVA en la fila 4 (empuja el historial abajo).
 *
 * CONTROL (desde fila 3):
 * A=LEG | B=EMPLEADO | C=2023 | D=2024 | E=2025 | F=2026
 */

var SHEET_ID = '1aaWSfGKGIU1BhZqNjOgLPn2xC3mVp1gULvEXQvCWI_Q';
var HOJA_REGISTRO = 'REGISTRO';
var HOJA_CONTROL = 'CONTROL';
var FILA_DATOS = 4;
var CONTROL_FILA_INICIO = 3;
var COL_PERIODO = { '2023': 3, '2024': 4, '2025': 5, '2026': 6 };

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
    if (accion === 'corregirproporcionales' || accion === 'corregir_proporcionales') {
      var clave = String(data.clave || data.key || '').trim();
      if (clave !== 'ServinorteRRHH2026') {
        return json_({ ok: false, error: 'Clave inválida.' });
      }
      return json_(corregirProporcionalesLCT_());
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

    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sh = getHoja_(ss, HOJA_REGISTRO, 'REGISTRO');
    limpiarVaciasArribaRapido_(sh);

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

    var written = sh.getRange(FILA_DATOS, 1, 1, 8).getDisplayValues()[0];
    if (!String(written[1] || '').trim()) {
      return json_({
        ok: false,
        error: 'La fila se insertó pero los datos no quedaron grabados.',
        written: written
      });
    }

    var control = descontarControl_(ss, leg, empleado, periodo, diasNum);
    SpreadsheetApp.flush();

    return json_({
      ok: true,
      message: 'Solicitud registrada y saldo descontado en CONTROL.',
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
      written: written,
      control: control
    });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function getHoja_(ss, nombre, fallbackUpper) {
  var sh = ss.getSheetByName(nombre);
  if (!sh) {
    var sheets = ss.getSheets();
    for (var i = 0; i < sheets.length; i++) {
      if (String(sheets[i].getName()).toUpperCase() === String(fallbackUpper || nombre).toUpperCase()) {
        sh = sheets[i];
        break;
      }
    }
  }
  if (!sh) throw new Error('No se encontró la hoja ' + nombre + '.');
  return sh;
}

function getHojaRegistro_() {
  return getHoja_(SpreadsheetApp.openById(SHEET_ID), HOJA_REGISTRO, 'REGISTRO');
}

function norm_(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/** Descuenta días del período en CONTROL. Devuelve saldo anterior/nuevo. */
function descontarControl_(ss, leg, empleado, periodo, diasNum) {
  var sh = getHoja_(ss, HOJA_CONTROL, 'CONTROL');
  var col = COL_PERIODO[String(periodo)];
  if (!col) {
    throw new Error('Período no válido para CONTROL: ' + periodo);
  }

  var last = Math.max(sh.getLastRow(), CONTROL_FILA_INICIO);
  var numRows = last - CONTROL_FILA_INICIO + 1;
  if (numRows < 1) throw new Error('CONTROL sin filas de datos.');

  var values = sh.getRange(CONTROL_FILA_INICIO, 1, numRows, 6).getDisplayValues();
  var empN = norm_(empleado);
  var legS = String(leg || '').trim();
  var found = -1;

  // 1) Match exacto por nombre
  for (var i = 0; i < values.length; i++) {
    var nom = String(values[i][1] || '').trim();
    if (!nom || norm_(nom) === 'EMPLEADOS') continue;
    if (norm_(nom) === empN) {
      found = i;
      break;
    }
  }

  // 2) Fallback por LEG + coincidencia parcial de nombre
  if (found < 0 && legS) {
    for (var j = 0; j < values.length; j++) {
      var legRow = String(values[j][0] || '').trim();
      var nomRow = String(values[j][1] || '').trim();
      if (legRow !== legS || !nomRow) continue;
      var a = norm_(nomRow).split(' ');
      var b = empN.split(' ');
      var hits = 0;
      for (var x = 0; x < a.length; x++) {
        if (a[x].length > 1 && b.indexOf(a[x]) >= 0) hits++;
      }
      if (hits >= 1) {
        found = j;
        break;
      }
    }
  }

  if (found < 0) {
    throw new Error('No se encontró a "' + empleado + '" en CONTROL para descontar días.');
  }

  var sheetRow = CONTROL_FILA_INICIO + found;
  var cell = sh.getRange(sheetRow, col);
  var raw = String(cell.getDisplayValue() || '').trim();
  if (raw === '***') {
    throw new Error('El período ' + periodo + ' no aplica (*** ) para este empleado.');
  }

  var anterior = 0;
  if (raw && raw !== '-') {
    anterior = Number(String(raw).replace(/[^\d-]/g, ''));
    if (!isFinite(anterior)) anterior = 0;
  }
  var nuevo = Math.max(0, anterior - diasNum);
  cell.setValue(nuevo);

  return {
    hoja: HOJA_CONTROL,
    fila: sheetRow,
    periodo: Number(periodo),
    columna: col,
    anterior: anterior,
    nuevo: nuevo,
    descontado: anterior - nuevo,
    leg: String(values[found][0] || ''),
    empleado: String(values[found][1] || '')
  };
}

/** Solo limpia vacías arriba del bloque de datos (rápido). */
function limpiarVaciasArribaRapido_(sh) {
  var maxCheck = Math.min(sh.getLastRow(), FILA_DATOS + 25);
  for (var r = maxCheck; r >= FILA_DATOS; r--) {
    var row = sh.getRange(r, 1, 1, 8).getDisplayValues()[0];
    var joined = row.join('').replace(/\s+/g, '');
    if (!joined) sh.deleteRow(r);
    else break;
  }
}

/**
 * Corrige días LCT mal calculados en hojas 2023/2024/2025 (columna F)
 * y ajusta CONTROL si el pendiente aún refleja el valor incorrecto.
 *
 * También se puede ejecutar a mano: seleccionar esta función → Ejecutar.
 * O por URL (después de Versión nueva):
 * .../exec?accion=corregirProporcionales&clave=ServinorteRRHH2026
 */
function corregirProporcionalesLCT() {
  var out = corregirProporcionalesLCT_();
  Logger.log(JSON.stringify(out));
  return out;
}

function corregirProporcionalesLCT_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  // Fixes: [periodoHoja, leg, debe]
  var fixes = [
    ['2023', '97', 8],
    ['2023', '99', 8],
    ['2023', '100', 8],
    ['2023', '102', 6],
    ['2023', '103', 5],
    ['2023', '105', 14],
    ['2023', '106', 14],
    ['2024', '106', 14],
    ['2024', '129', 6],
    ['2024', '130', 5],
    ['2025', '148', 6],
    ['2025', '149', 3],
    ['2025', '150', 1]
  ];

  var resultados = [];
  var shControl = getHoja_(ss, HOJA_CONTROL, 'CONTROL');

  for (var i = 0; i < fixes.length; i++) {
    var hoja = fixes[i][0];
    var leg = String(fixes[i][1]);
    var debe = Number(fixes[i][2]);
    var sh = getHoja_(ss, hoja, hoja);
    var last = Math.max(sh.getLastRow(), 1);
    var vals = sh.getRange(1, 1, last, 6).getDisplayValues();
    var found = -1;
    for (var r = 0; r < vals.length; r++) {
      if (String(vals[r][0] || '').trim() === leg) {
        found = r;
        break;
      }
    }
    if (found < 0) {
      resultados.push({ ok: false, hoja: hoja, leg: leg, error: 'No encontrado en hoja período' });
      continue;
    }

    var row = found + 1; // 1-based
    var tieneRaw = String(vals[found][5] || '').trim();
    var tiene = Number(String(tieneRaw).replace(/[^\d-]/g, ''));
    if (!isFinite(tiene)) tiene = 0;
    var item = {
      ok: true,
      hoja: hoja,
      leg: leg,
      nombre: String(vals[found][1] || '').trim(),
      tiene: tiene,
      debe: debe
    };

    if (tiene !== debe) {
      sh.getRange(row, 6).setValue(debe);
      item.periodoActualizado = true;
    } else {
      item.periodoActualizado = false;
    }

    // Ajuste CONTROL: si el pendiente del período == "tiene" (valor viejo), pasar a "debe".
    // Si pendiente es otro número, aplicar delta (debe - tiene).
    var col = COL_PERIODO[String(hoja)];
    var ctrlFix = ajustarControlPendiente_(shControl, leg, col, tiene, debe);
    item.control = ctrlFix;
    resultados.push(item);
  }

  // Agustina: CONTROL 2025/2026 todavía en 21 → 14 (escala incorrecta <5 años)
  var agustinaExtra = [];
  ['2025', '2026'].forEach(function (per) {
    var col = COL_PERIODO[per];
    var info = forzarControlSiValor_(shControl, '106', col, 21, 14);
    if (info) agustinaExtra.push(info);
  });

  SpreadsheetApp.flush();
  return {
    ok: true,
    message: 'Proporcionales LCT corregidos (Art. 151: < mitad de año = 1 día c/20 días corridos; si no, escala por antigüedad).',
    resultados: resultados,
    agustinaControlExtra: agustinaExtra
  };
}

function ajustarControlPendiente_(shControl, leg, col, tiene, debe) {
  var last = Math.max(shControl.getLastRow(), CONTROL_FILA_INICIO);
  var num = last - CONTROL_FILA_INICIO + 1;
  var values = shControl.getRange(CONTROL_FILA_INICIO, 1, num, 6).getDisplayValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0] || '').trim() !== String(leg)) continue;
    var sheetRow = CONTROL_FILA_INICIO + i;
    var cell = shControl.getRange(sheetRow, col);
    var raw = String(cell.getDisplayValue() || '').trim();
    if (!raw || raw === '-' || raw === '***') {
      return { fila: sheetRow, raw: raw, accion: 'sin_cambio' };
    }
    var pend = Number(String(raw).replace(/[^\d-]/g, ''));
    if (!isFinite(pend)) return { fila: sheetRow, raw: raw, accion: 'sin_cambio' };

    var delta = debe - tiene;
    var nuevo;
    if (pend === tiene) nuevo = debe;
    else nuevo = Math.max(0, pend + delta);

    if (nuevo !== pend) {
      cell.setValue(nuevo);
      return { fila: sheetRow, anterior: pend, nuevo: nuevo, accion: 'ajustado' };
    }
    return { fila: sheetRow, anterior: pend, nuevo: pend, accion: 'sin_cambio' };
  }
  return { accion: 'leg_no_encontrado_en_control' };
}

function forzarControlSiValor_(shControl, leg, col, valorActual, valorNuevo) {
  var last = Math.max(shControl.getLastRow(), CONTROL_FILA_INICIO);
  var num = last - CONTROL_FILA_INICIO + 1;
  var values = shControl.getRange(CONTROL_FILA_INICIO, 1, num, 6).getDisplayValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0] || '').trim() !== String(leg)) continue;
    var sheetRow = CONTROL_FILA_INICIO + i;
    var cell = shControl.getRange(sheetRow, col);
    var raw = String(cell.getDisplayValue() || '').trim();
    var pend = Number(String(raw).replace(/[^\d-]/g, ''));
    if (isFinite(pend) && pend === valorActual) {
      cell.setValue(valorNuevo);
      return { leg: leg, fila: sheetRow, columna: col, anterior: pend, nuevo: valorNuevo };
    }
    return { leg: leg, fila: sheetRow, columna: col, raw: raw, accion: 'sin_cambio' };
  }
  return null;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
