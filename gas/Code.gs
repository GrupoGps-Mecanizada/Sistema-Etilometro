/**
 * SGE — ETILOMETRIA: BACKEND (Google Apps Script)
 * Self-configuring backend that auto-creates and validates the Sheets structure
 * on every request. No manual setup needed.
 * 
 * DEPLOY:
 * 1. Create a Google Sheet (blank)
 * 2. Extensions > Apps Script > paste this code
 * 3. Deploy > New deployment > Web app (Anyone, Execute as Me)
 * 4. Copy URL → paste in js/config.js (gasUrl)
 */

// ===================== SCHEMA DEFINITION =====================
const SCHEMA = {
  Etilometria: {
    headers: ['ID', 'Data/Hora', 'Operador', 'Aparelho', 'Local', 'Colaborador', 'CPF/Mat', 'Função', 'Resultado', 'Status', 'Observações', 'Assinatura', 'Teste Synced'],
    colWidths: [150, 150, 150, 100, 150, 250, 120, 150, 100, 100, 200, 300, 100],
    validation: {
      9: { values: ['NEGATIVO', 'ATENÇÃO', 'POSITIVO'] }
    }
  }
};

// ===================== AUTO-SETUP ENGINE =====================

let _structureVerified = false;

function ensureStructure() {
  if (_structureVerified) return;

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    Logger.log('Could not obtain lock, continuing anyway: ' + e);
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    Object.keys(SCHEMA).forEach(tabName => {
      const def = SCHEMA[tabName];
      let sheet = ss.getSheetByName(tabName);

      if (!sheet) {
        sheet = ss.insertSheet(tabName);
        setupSheetFromSchema(sheet, def);
      } else {
        repairSheet(sheet, def);
      }
    });

    const defaultSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('Página1') || ss.getSheetByName('Planilha1');
    if (defaultSheet) {
      try {
        const data = defaultSheet.getDataRange().getValues();
        if (data.length <= 1 && data[0].join('').trim() === '') {
          if (ss.getSheets().length > 1) ss.deleteSheet(defaultSheet);
        }
      } catch (e) { }
    }

    _structureVerified = true;
  } finally {
    lock.releaseLock();
  }
}

function setupSheetFromSchema(sheet, def) {
  sheet.appendRow(def.headers);

  const headerRange = sheet.getRange(1, 1, 1, def.headers.length);
  headerRange
    .setFontWeight('bold')
    .setBackground('#e8ebf0')
    .setFontColor('#2d3748')
    .setFontFamily('Inter, Arial, sans-serif')
    .setFontSize(10)
    .setHorizontalAlignment('center')
    .setBorder(false, false, true, false, false, false, '#c5cbda', SpreadsheetApp.BorderStyle.SOLID);

  sheet.setFrozenRows(1);

  def.colWidths.forEach((w, i) => {
    sheet.setColumnWidth(i + 1, w);
  });

  applyValidation(sheet, def);

  if (sheet.getLastRow() >= 1) {
    sheet.getRange(1, 1, 1, def.headers.length).createFilter();
  }
}

function repairSheet(sheet, def) {
  const data = Math.max(1, sheet.getLastColumn());
  const existingHeaders = sheet.getRange(1, 1, 1, data).getValues()[0] || [];

  let needsUpdate = false;
  if (existingHeaders.length !== def.headers.length || existingHeaders.join(',') !== def.headers.join(',')) {
    needsUpdate = true;
  }

  if (needsUpdate) {
    const maxCols = sheet.getMaxColumns();
    if (maxCols < def.headers.length) {
      sheet.insertColumnsAfter(maxCols || 1, def.headers.length - (maxCols || 0));
    }
    const headerRange = sheet.getRange(1, 1, 1, def.headers.length);
    headerRange.setValues([def.headers]);

    headerRange
      .setFontWeight('bold')
      .setBackground('#e8ebf0')
      .setFontColor('#2d3748')
      .setFontFamily('Inter, Arial, sans-serif')
      .setFontSize(10)
      .setHorizontalAlignment('center');

    sheet.setFrozenRows(1);
  }

  def.colWidths.forEach((w, i) => {
    sheet.setColumnWidth(i + 1, w);
  });

  applyValidation(sheet, def);

  if (!sheet.getFilter() && sheet.getLastRow() >= 1) {
    try {
      sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), def.headers.length).createFilter();
    } catch (e) { }
  }
}

function applyValidation(sheet, def) {
  if (!def.validation) return;
  const lastRow = Math.max(sheet.getLastRow(), 100);

  Object.keys(def.validation).forEach(colIdx => {
    const col = parseInt(colIdx);
    const rule = def.validation[colIdx];
    if (rule.values) {
      const validation = SpreadsheetApp.newDataValidation()
        .requireValueInList(rule.values, true)
        .setAllowInvalid(true)
        .build();
      sheet.getRange(2, col + 1, lastRow, 1).setDataValidation(validation);
    }
  });
}

function getSheet(name) {
  ensureStructure();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(name);
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===================== API ROUTING =====================

function doPost(e) {
  if (!e || !e.postData) return jsonResponse({ success: false, error: 'No data' });
  
  try {
    ensureStructure();
    
    let body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch(err) {
      return jsonResponse({ success: false, error: 'Invalid JSON payload' });
    }

    const action = body.action;
    const params = body.params || {};
    let result;

    switch (action) {
      case 'salvar_etilometria':
        result = salvarEtilometria(params);
        break;
      default:
        // Retrocompatibility with older frontends just in case
        if(body.nomeTestado) {
             result = salvarEtilometria(body);
        } else {
             return jsonResponse({ success: false, error: `Ação desconhecida: ${action}` });
        }
    }
    return jsonResponse({ success: true, data: result });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

function doGet(e) {
  try {
    ensureStructure();
    const action = (e && e.parameter && e.parameter.action) || 'status';
    let result;

    switch (action) {
      case 'listar_diario':
        result = listarDiario();
        break;
      case 'pesquisar_etilometria':
        result = pesquisarEtilometria(e.parameter.query || '');
        break;
      case 'status':
        result = { success: true, status: 'API Etilometria Ativa', timestamp: new Date().toISOString() };
        break;
      default:
        return jsonResponse({ success: false, error: `Ação GET desconhecida: ${action}` });
    }
    return jsonResponse({ success: true, data: result });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

// ===================== BUSINESS LOGIC =====================

function salvarEtilometria(params) {
  const sheet = getSheet('Etilometria');
  
  sheet.appendRow([
    params.id || `ETL-${new Date().getTime()}`,
    params.data_hora || new Date().toISOString(), // Use provided Data/Hora or fallback to now
    params.operador || '',
    params.numeroSerie || '',
    params.local || '',
    params.nomeTestado || '',
    params.cpfMatricula || '',
    params.postoFuncao || '',
    params.resultado || '',
    params.status || '',
    params.observacoes || '',
    params.assinatura || '',  // Base64 string
    'TRUE'
  ]);
  
  return { saved: true, id: params.id };
}

function listarDiario() {
  const sheet = getSheet('Etilometria');
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0];
  const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  const results = [];
  
  for (let i = data.length - 1; i >= 1; i--) {
       const row = data[i];
       const dataStr = String(row[headers.indexOf('Data/Hora')] || '');
       
       if(dataStr.includes(todayStr)) {
           results.push({
               id: row[headers.indexOf('ID')],
               data_hora: row[headers.indexOf('Data/Hora')],
               operador: row[headers.indexOf('Operador')],
               aparelho: row[headers.indexOf('Aparelho')],
               local: row[headers.indexOf('Local')],
               colaborador: row[headers.indexOf('Colaborador')],
               cpf_mat: row[headers.indexOf('CPF/Mat')],
               funcao: row[headers.indexOf('Função')],
               resultado: row[headers.indexOf('Resultado')],
               status: row[headers.indexOf('Status')],
               assinatura: row[headers.indexOf('Assinatura')]
           });
       } else if (results.length > 0 && !dataStr.includes(todayStr) && i < data.length - 30) {
           break; 
       }
       if(results.length >= 100) break; 
  }
  
  return results;
}

function pesquisarEtilometria(query) {
  const sheet = getSheet('Etilometria');
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0];
  const qLower = String(query).toLowerCase();
  
  const results = [];
  
  for(let i = data.length - 1; i >= 1; i--) {
       const row = data[i];
       const name = String(row[headers.indexOf('Colaborador')] || '').toLowerCase();
       const cpf = String(row[headers.indexOf('CPF/Mat')] || '').toLowerCase();
       const func = String(row[headers.indexOf('Função')] || '').toLowerCase();
       const dataStr = String(row[headers.indexOf('Data/Hora')] || '');
       
       if(name.includes(qLower) || cpf.includes(qLower) || func.includes(qLower) || dataStr.includes(qLower)) {
           results.push({
               id: row[headers.indexOf('ID')],
               data_hora: row[headers.indexOf('Data/Hora')],
               operador: row[headers.indexOf('Operador')],
               aparelho: row[headers.indexOf('Aparelho')],
               local: row[headers.indexOf('Local')],
               colaborador: row[headers.indexOf('Colaborador')],
               cpf_mat: row[headers.indexOf('CPF/Mat')],
               funcao: row[headers.indexOf('Função')],
               resultado: row[headers.indexOf('Resultado')],
               status: row[headers.indexOf('Status')],
               assinatura: row[headers.indexOf('Assinatura')]
           });
           
           if(results.length >= 50) break; 
       }
  }
  
  return results;
}
