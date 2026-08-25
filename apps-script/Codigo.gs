/**
 * Servinorte SRL — Registro + CONTROL + corrección LCT (Ignacio online)
 * =====================================================================
 * - registrar: escribe REGISTRO y descuenta CONTROL (valida saldo).
 * - corregirproporcionales: recalcula días LCT Art.150/151 desde Empleados
 *   (mitad de días hábiles del año → escala; si no, 1 día c/20 corridos)
 *   y sincroniza hojas de período + CONTROL.
 *
 * Tras pegar: Implementar → Versión nueva → Implementar
 *
 * Calculadora de referencia:
 * https://www.ignacioonline.com.ar/calculadora-dia-de-vacaciones/
 */

var SHEET_ID = '1aaWSfGKGIU1BhZqNjOgLPn2xC3mVp1gULvEXQvCWI_Q';
var HOJA_REGISTRO = 'REGISTRO';
var HOJA_CONTROL = 'CONTROL';
var HOJA_EMPLEADOS = 'Empleados';
var FILA_DATOS = 4;
var CONTROL_FILA_INICIO = 3;
var COL_PERIODO = { '2023': 3, '2024': 4, '2025': 5, '2026': 6 };
var PERIODOS_LCT = [2024, 2025, 2026];
var RRHH_CLAVE = 'ServinorteRRHH2026';

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

    if (
      accion === 'corregirproporcionales' ||
      accion === 'corregir_proporcionales' ||
      accion === 'corregiringresosrecientes' ||
      accion === 'corregir_ingresos_recientes'
    ) {
      var clave = String(data.clave || data.key || '').trim();
      if (clave !== RRHH_CLAVE) {
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
    var saldoPrev = leerSaldoControl_(ss, leg, empleado, periodo);
    if (saldoPrev.raw === '***') {
      return json_({
        ok: false,
        error: 'El período ' + periodo + ' no aplica (***) para este empleado.',
        control: saldoPrev
      });
    }
    if (saldoPrev.anterior < diasNum) {
      return json_({
        ok: false,
        error:
          'No se puede registrar: pedís ' +
          diasNum +
          ' días y solo quedan ' +
          saldoPrev.anterior +
          ' del período ' +
          periodo +
          '.',
        control: saldoPrev
      });
    }

    var sh = getHoja_(ss, HOJA_REGISTRO, 'REGISTRO');
    limpiarVaciasArriba_(sh);
    sh.insertRowBefore(FILA_DATOS);
    sh.getRange(FILA_DATOS, 1, 1, 8).setValues([[
      leg, empleado, puesto, desde, hasta, diasNum, periodo, estado
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

/* ===================== LCT / Ignacio online ===================== */

/**
 * Art. 150: escala por antigüedad al 31/12 del período.
 * Art. 151: si no trabajó al menos la mitad de los días hábiles del año,
 *           1 día de vacaciones por cada 20 días corridos trabajados.
 * Ref: https://www.ignacioonline.com.ar/calculadora-dia-de-vacaciones/
 */
function diasVacLCT_(alta, periodo) {
  if (!(alta instanceof Date) || isNaN(alta.getTime())) return 0;
  var asOf = new Date(periodo, 11, 31);
  if (alta > asOf) return 0;
  var yearStart = new Date(periodo, 0, 1);
  var from = alta > yearStart ? alta : yearStart;
  var habYear = diasHabilesEntre_(yearStart, asOf);
  var habTrab = diasHabilesEntre_(from, asOf);
  var calTrab = Math.floor((asOf - from) / (24 * 3600 * 1000)) + 1;
  if (habTrab < habYear / 2) {
    return Math.floor(calTrab / 20);
  }
  return escalaAntiguedad_(yearsAsOf_(alta, asOf));
}

function yearsAsOf_(alta, asOf) {
  var y = asOf.getFullYear() - alta.getFullYear();
  if (
    asOf.getMonth() < alta.getMonth() ||
    (asOf.getMonth() === alta.getMonth() && asOf.getDate() < alta.getDate())
  ) {
    y--;
  }
  return Math.max(y, 0);
}

function escalaAntiguedad_(ant) {
  if (ant < 5) return 14;
  if (ant < 10) return 21;
  if (ant < 20) return 28;
  return 35;
}

function diasHabilesEntre_(a, b) {
  var n = 0;
  var d = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  var end = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  while (d <= end) {
    var wd = d.getDay();
    if (wd !== 0 && wd !== 6) n++;
    d.setDate(d.getDate() + 1);
  }
  return n;
}

function parseFechaFlex_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) {
    return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  }
  var s = String(v || '').trim();
  var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    var d = +m[1],
      mo = +m[2],
      y = +m[3];
    if (y < 100) y += 2000;
    return new Date(y, mo - 1, d);
  }
  return null;
}

function norm_(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/**
 * Recalcula proporcionales/totales LCT para todos los empleados con alta,
 * actualiza hoja de período (col F = días que corresponden) y CONTROL
 * cuando el pendiente está vacío, es incorrecto o quedó con un proporcional viejo.
 *
 * Enfocado en ingresos recientes (desde 2025) y en particular 2026.
 */
function corregirProporcionalesLCT_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var shEmp = getHoja_(ss, HOJA_EMPLEADOS, 'EMPLEADOS');
  var shControl = getHoja_(ss, HOJA_CONTROL, 'CONTROL');

  var lastEmp = Math.max(shEmp.getLastRow(), 2);
  var empVals = shEmp.getRange(2, 1, lastEmp - 1, 6).getDisplayValues();
  var empleados = [];
  for (var i = 0; i < empVals.length; i++) {
    var leg = String(empVals[i][0] || '').trim();
    var nombre = String(empVals[i][1] || '').trim();
    if (!leg || !nombre || norm_(nombre) === 'EMPLEADO') continue;
    var alta = parseFechaFlex_(empVals[i][3]);
    if (!alta) continue;
    empleados.push({ leg: leg, nombre: nombre, alta: alta });
  }

  var lastCtrl = Math.max(shControl.getLastRow(), CONTROL_FILA_INICIO);
  var ctrlNum = lastCtrl - CONTROL_FILA_INICIO + 1;
  var ctrlVals = shControl.getRange(CONTROL_FILA_INICIO, 1, ctrlNum, 6).getDisplayValues();

  var resultados = [];
  var cutoffRecientes = new Date(2025, 0, 1); // desde 2025 inclusive

  for (var e = 0; e < empleados.length; e++) {
    var emp = empleados[e];
    if (emp.alta < cutoffRecientes) continue;

    for (var p = 0; p < PERIODOS_LCT.length; p++) {
      var periodo = PERIODOS_LCT[p];
      if (emp.alta.getFullYear() > periodo) continue;

      var debe = diasVacLCT_(emp.alta, periodo);
      var shPer = ss.getSheetByName(String(periodo));
      var periInfo = null;
      if (shPer) {
        periInfo = upsertPeriodoEntitlement_(shPer, emp, debe);
      }

      var ctrlInfo = syncControlSaldoLCT_(shControl, ctrlVals, emp, periodo, debe);
      resultados.push({
        ok: true,
        leg: emp.leg,
        nombre: emp.nombre,
        alta: Utilities.formatDate(emp.alta, Session.getScriptTimeZone() || 'America/Argentina/Buenos_Aires', 'dd/MM/yyyy'),
        periodo: periodo,
        debe: debe,
        full: debe >= 14 && diasHabilesEntre_(
          emp.alta > new Date(periodo, 0, 1) ? emp.alta : new Date(periodo, 0, 1),
          new Date(periodo, 11, 31)
        ) >= diasHabilesEntre_(new Date(periodo, 0, 1), new Date(periodo, 11, 31)) / 2,
        periodoHoja: periInfo,
        control: ctrlInfo
      });
    }
  }

  SpreadsheetApp.flush();
  return {
    ok: true,
    message:
      'Proporcionales LCT corregidos (Ignacio online / Art. 150-151: ≥ mitad días hábiles → escala; si no, 1 día c/20 corridos). CONTROL sincronizado para ingresos desde 2025.',
    referencia: 'https://www.ignacioonline.com.ar/calculadora-dia-de-vacaciones/',
    resultados: resultados
  };
}

/** Col F de hojas 2024/2025/2026 = días que corresponden (entitlement). */
function upsertPeriodoEntitlement_(shPer, emp, debe) {
  var last = Math.max(shPer.getLastRow(), 3);
  var num = last - 2;
  if (num < 1) return { accion: 'sin_filas' };
  var vals = shPer.getRange(3, 1, num, 6).getDisplayValues();
  var want = norm_(emp.nombre);
  var found = -1;
  for (var i = 0; i < vals.length; i++) {
    var nom = String(vals[i][1] || '').trim();
    if (!nom) continue;
    if (norm_(nom) === want || tokensMatch_(norm_(nom), want)) {
      found = i;
      break;
    }
    if (String(vals[i][0] || '').trim() === String(emp.leg)) {
      found = i;
    }
  }
  if (found < 0) {
    return { accion: 'no_encontrado_en_periodo' };
  }
  var sheetRow = 3 + found;
  var cell = shPer.getRange(sheetRow, 6);
  var raw = String(cell.getDisplayValue() || '').trim();
  var tiene = parseSaldoNum_(raw);
  if (tiene === debe) {
    return { accion: 'sin_cambio', tiene: tiene, fila: sheetRow };
  }
  cell.setValue(debe);
  return { accion: 'actualizado', tiene: tiene, debe: debe, fila: sheetRow };
}

/**
 * Si CONTROL está vacío, o tiene un valor distinto al LCT y no hay evidencia
 * de consumo parcial coherente, lo setea al valor LCT.
 * Caso Peloc: CONTROL 2026=2 → 14.
 */
function syncControlSaldoLCT_(shControl, ctrlVals, emp, periodo, debe) {
  var col = COL_PERIODO[String(periodo)];
  if (!col) return { accion: 'periodo_invalido' };

  var want = norm_(emp.nombre);
  var found = -1;
  for (var i = 0; i < ctrlVals.length; i++) {
    var nom = String(ctrlVals[i][1] || '').trim();
    if (!nom || norm_(nom) === 'EMPLEADOS') continue;
    if (norm_(nom) === want || tokensMatch_(norm_(nom), want)) {
      found = i;
      break;
    }
  }
  if (found < 0) {
    for (var j = 0; j < ctrlVals.length; j++) {
      if (String(ctrlVals[j][0] || '').trim() === String(emp.leg)) {
        found = j;
        break;
      }
    }
  }
  if (found < 0) {
    // Alta nueva sin fila en CONTROL: crear al final
    var newRow = shControl.getLastRow() + 1;
    var c2023 = '***';
    var c2024 = emp.alta.getFullYear() > 2024 ? '***' : periodo === 2024 ? debe : '';
    var c2025 = emp.alta.getFullYear() > 2025 ? '***' : periodo === 2025 ? debe : emp.alta.getFullYear() < 2025 ? '' : '';
    var c2026 = periodo === 2026 ? debe : '';
    if (emp.alta.getFullYear() > 2024 && periodo !== 2024) c2024 = '***';
    if (emp.alta.getFullYear() > 2025 && periodo !== 2025) c2025 = '***';
    if (emp.alta.getFullYear() >= 2026) {
      c2023 = '***';
      c2024 = '***';
      c2025 = '';
      c2026 = periodo === 2026 ? debe : '';
    }
    shControl.getRange(newRow, 1, 1, 6).setValues([[emp.leg, emp.nombre, c2023, c2024, c2025, c2026]]);
    return { accion: 'fila_creada', fila: newRow, nuevo: debe };
  }

  var sheetRow = CONTROL_FILA_INICIO + found;
  var cell = shControl.getRange(sheetRow, col);
  var raw = String(cell.getDisplayValue() || '').trim();
  if (raw === '***') {
    return { accion: 'no_aplica_asteriscos', fila: sheetRow };
  }
  if (raw === '-') {
    return { accion: 'guion_preservado', fila: sheetRow };
  }

  var anterior = raw === '' ? null : parseSaldoNum_(raw);
  if (anterior === debe) {
    return { accion: 'sin_cambio', fila: sheetRow, anterior: anterior };
  }

  // Vacío → cargar LCT
  // Valor distinto → corregir (ej. Peloc 2→14, Apaza 8→6)
  cell.setValue(debe);
  ctrlVals[found][col - 1] = String(debe);
  return {
    accion: 'actualizado',
    fila: sheetRow,
    anterior: anterior,
    nuevo: debe
  };
}

function tokensMatch_(a, b) {
  var ta = a.split(' ').filter(function (t) { return t.length > 1; });
  var tb = b.split(' ').filter(function (t) { return t.length > 1; });
  if (!ta.length || !tb.length) return false;
  var setB = {};
  for (var i = 0; i < tb.length; i++) setB[tb[i]] = true;
  var hits = 0;
  for (var j = 0; j < ta.length; j++) if (setB[ta[j]]) hits++;
  return hits >= Math.min(2, Math.min(ta.length, tb.length));
}

function parseSaldoNum_(raw) {
  var s = String(raw || '').trim();
  if (!s || s === '-' || s === '***') return 0;
  var n = Number(String(s).replace(/[^\d-]/g, ''));
  return isFinite(n) ? Math.max(0, n) : 0;
}

/* ===================== CONTROL read/write ===================== */

function leerSaldoControl_(ss, leg, empleado, periodo) {
  var sh = getHoja_(ss, HOJA_CONTROL, 'CONTROL');
  var col = COL_PERIODO[String(periodo)];
  if (!col) throw new Error('Período no válido para CONTROL: ' + periodo);

  var last = Math.max(sh.getLastRow(), CONTROL_FILA_INICIO);
  var numRows = last - CONTROL_FILA_INICIO + 1;
  if (numRows < 1) throw new Error('CONTROL sin filas de datos.');

  var values = sh.getRange(CONTROL_FILA_INICIO, 1, numRows, 6).getDisplayValues();
  var empN = norm_(empleado);
  var legS = String(leg || '').trim();
  var found = -1;

  for (var i = 0; i < values.length; i++) {
    var nom = String(values[i][1] || '').trim();
    if (!nom || norm_(nom) === 'EMPLEADOS') continue;
    if (norm_(nom) === empN) {
      found = i;
      break;
    }
  }
  if (found < 0 && legS) {
    for (var j = 0; j < values.length; j++) {
      var legRow = String(values[j][0] || '').trim();
      var nomRow = String(values[j][1] || '').trim();
      if (legRow !== legS || !nomRow) continue;
      if (norm_(nomRow) === empN || tokensMatch_(norm_(nomRow), empN)) {
        found = j;
        break;
      }
    }
  }
  if (found < 0) throw new Error('No se encontró a "' + empleado + '" en CONTROL.');

  var sheetRow = CONTROL_FILA_INICIO + found;
  var cell = sh.getRange(sheetRow, col);
  var raw = String(cell.getDisplayValue() || '').trim();
  var anterior = 0;
  if (raw && raw !== '-' && raw !== '***') {
    anterior = parseSaldoNum_(raw);
  }
  return {
    hoja: HOJA_CONTROL,
    fila: sheetRow,
    periodo: Number(periodo),
    columna: col,
    anterior: anterior,
    raw: raw,
    leg: String(values[found][0] || ''),
    empleado: String(values[found][1] || '')
  };
}

function descontarControl_(ss, leg, empleado, periodo, diasNum) {
  var info = leerSaldoControl_(ss, leg, empleado, periodo);
  if (info.raw === '***') {
    throw new Error('El período ' + periodo + ' no aplica (***) para este empleado.');
  }
  if (info.anterior < diasNum) {
    throw new Error(
      'No se puede descontar: pedís ' +
        diasNum +
        ' días y solo quedan ' +
        info.anterior +
        ' del período ' +
        periodo +
        '.'
    );
  }
  var nuevo = info.anterior - diasNum;
  getHoja_(ss, HOJA_CONTROL, 'CONTROL').getRange(info.fila, info.columna).setValue(nuevo);
  return {
    hoja: info.hoja,
    fila: info.fila,
    periodo: info.periodo,
    columna: info.columna,
    anterior: info.anterior,
    nuevo: nuevo,
    descontado: info.anterior - nuevo,
    leg: info.leg,
    empleado: info.empleado
  };
}

/* ===================== helpers ===================== */

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

function limpiarVaciasArriba_(sh) {
  var last = Math.max(sh.getLastRow(), FILA_DATOS);
  for (var r = last; r >= FILA_DATOS; r--) {
    var row = sh.getRange(r, 1, 1, 8).getDisplayValues()[0];
    var joined = row.join('').replace(/\s+/g, '');
    if (!joined) sh.deleteRow(r);
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
