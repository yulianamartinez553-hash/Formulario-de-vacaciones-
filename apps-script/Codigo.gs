/**
 * Servinorte SRL — Registro de vacaciones + PDF
 * =============================================
 * IMPORTANTE: después de pegar este código hay que volver a IMPLEMENTAR
 * (Implementar → Administrar implementaciones → Editar → Versión: Nueva → Implementar)
 * Si no, Vercel sigue hablando con la versión vieja rota.
 *
 * 1) Planilla → Extensiones → Apps Script
 * 2) Pegá ESTE archivo completo (reemplazá todo)
 * 3) Guardá → Implementar → Nueva implementación / Nueva versión
 *      - Tipo: Aplicación web
 *      - Ejecutar como: Yo
 *      - Quién tiene acceso: Cualquier persona
 * 4) La URL /exec ya está en index.html (CONFIG.appsScriptUrl)
 *
 * Acciones:
 *   ?accion=ping
 *   ?accion=registrar&leg=&empleado=&puesto=&desde=&hasta=&dias=&periodo=&estado=
 *     → inserta fila con DATOS en REGISTRO (arriba) + genera PDF en Drive
 */

var SHEET_ID = '1aaWSfGKGIU1BhZqNjOgLPn2xC3mVp1gULvEXQvCWI_Q';
var HOJA_REGISTRO = 'REGISTRO';
var FILA_ENCABEZADO = 3;
var FILA_DATOS = 4; // primera fila de datos debajo del encabezado
var CARPETA_PDF = 'Vacaciones PDF Servinorte'; // se crea en Mi unidad si no existe
var CIUDAD = 'Ciudad de Salta';

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

    // insertRowBefore + getRange(row, col, numRows, numColumns)
    // OJO: el 3er y 4to argumento son CANTIDAD, no fila/columna final.
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

    // Verificar que quedó escrito
    var written = sh.getRange(FILA_DATOS, 1, 1, 8).getDisplayValues()[0];
    if (!String(written[1] || '').trim()) {
      return json_({
        ok: false,
        error: 'La fila se insertó pero los datos no quedaron grabados.',
        written: written
      });
    }

    var registro = {
      leg: leg,
      empleado: empleado,
      puesto: puesto,
      desde: desde,
      hasta: hasta,
      dias: diasNum,
      periodo: periodo,
      estado: estado,
      retorno: fechaRetorno_(hasta)
    };

    var pdf = null;
    var pdfError = '';
    try {
      pdf = generarPdf_(registro);
    } catch (pdfErr) {
      pdfError = String(pdfErr && pdfErr.message ? pdfErr.message : pdfErr);
    }

    return json_({
      ok: true,
      message: 'Solicitud registrada en REGISTRO con datos.',
      fila: FILA_DATOS,
      registro: registro,
      written: written,
      pdf: pdf,
      pdfError: pdfError || undefined
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

function fechaRetorno_(hastaStr) {
  var d = parseFecha_(hastaStr);
  if (!d) return '—';
  d.setDate(d.getDate() + 1);
  return d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear();
}

function parseFecha_(v) {
  var m = String(v || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  var a = Number(m[3]);
  if (a < 100) a += 2000;
  return new Date(a, Number(m[2]) - 1, Number(m[1]));
}

function fechaLargaHoy_() {
  var meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  var d = new Date();
  return d.getDate() + ' de ' + meses[d.getMonth()] + ' de ' + d.getFullYear();
}

function carpetaPdf_() {
  var it = DriveApp.getFoldersByName(CARPETA_PDF);
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder(CARPETA_PDF);
}

/**
 * Genera un PDF de la Comunicación de Licencia Anual en Drive
 * y lo deja con enlace para cualquiera con el link.
 */
function generarPdf_(reg) {
  var titulo = 'Licencia Anual — ' + reg.empleado + ' — ' + reg.periodo;
  var doc = DocumentApp.create(titulo);
  var body = doc.getBody();
  body.clear();

  body.appendParagraph('Original · Empleado / Duplicado · Empresa')
    .setForegroundColor('#1F3C8C');

  var h = body.appendParagraph('COMUNICACIÓN DE LICENCIA ANUAL');
  h.setHeading(DocumentApp.ParagraphHeading.HEADING1);
  h.setForegroundColor('#1F3C8C');
  h.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  body.appendParagraph(CIUDAD + ', ' + fechaLargaHoy_())
    .setAlignment(DocumentApp.HorizontalAlignment.RIGHT);

  body.appendParagraph('LEG  ' + (reg.leg || '—'));
  body.appendParagraph('SEÑOR:  ' + reg.empleado);
  body.appendParagraph('PUESTO:  ' + (reg.puesto || '—'));
  body.appendParagraph('');

  body.appendParagraph(
    'Comunicamos a Ud. que su licencia anual correspondiente al año ' + reg.periodo +
    ' ha sido diagramada para iniciarla el día ' + reg.desde +
    ', concluyendo la misma el día ' + reg.hasta +
    ', debiendo retomar sus tareas habituales el día ' + reg.retorno + '.-'
  );

  body.appendParagraph(
    'Asimismo dejamos constancia que por el período ' + reg.periodo +
    ' se solicitan ' + reg.dias + ' días de la Licencia Anual.'
  );

  body.appendParagraph(
    'Los mencionados días serán otorgados de acuerdo a las normativas legales laborales vigentes.'
  ).setItalic(true);

  body.appendParagraph('');
  body.appendParagraph('_______________________          _______________________          _______________________');
  body.appendParagraph('Responsable de Área              p/Recursos Humanos               Firma del Empleado');

  doc.saveAndClose();

  var docFile = DriveApp.getFileById(doc.getId());
  var pdfBlob = docFile.getAs(MimeType.PDF);
  pdfBlob.setName(titulo + '.pdf');
  var pdfFile = carpetaPdf_().createFile(pdfBlob);
  pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  docFile.setTrashed(true);

  return {
    id: pdfFile.getId(),
    name: pdfFile.getName(),
    url: 'https://drive.google.com/file/d/' + pdfFile.getId() + '/view',
    downloadUrl: 'https://drive.google.com/uc?export=download&id=' + pdfFile.getId()
  };
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
