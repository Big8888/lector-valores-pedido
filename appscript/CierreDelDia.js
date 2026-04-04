const HOJA_DATOS_CIERRE = 'Datos';
const HOJA_CIERRE_CAJA = 'Cierre de caja';
const HOJAS_REPARTIDORES_CIERRE = ['Mauro', 'Brisa', 'Diogo', 'GIAN', 'LIBRE1'];
const HOJAS_COBRO_CIERRE = [...HOJAS_REPARTIDORES_CIERRE, 'Venta Mostrador', 'Lector Pedidosya'];
const CELDA_BOTON_CIERRE_DIA = 'J5';
const TITULO_BOTON_CIERRE_DIA = 'CIERRE_DIA_BUTTON';
const DESCRIPCION_BOTON_CIERRE_DIA = 'Guarda los datos del dia y limpia las planillas operativas';
const ANCHO_BOTON_CIERRE_DIA = 170;
const ALTO_BOTON_CIERRE_DIA = 52;
const OFFSET_X_BOTON_CIERRE_DIA = 2;
const OFFSET_Y_BOTON_CIERRE_DIA = 3;
const URL_BOTON_CIERRE_DIA = 'https://raw.githubusercontent.com/Big8888/lector-valores-pedido/main/assets/cerrar-dia-button.png';
const FILA_MAX_ARCHIVO_DATOS = 65;

function crearMenuCierreDia() {
  SpreadsheetApp.getUi()
    .createMenu('CIERRE')
    .addItem('Procesar cierre del dia', 'procesarCierreDelDia')
    .addItem('Recrear boton cierre del dia', 'asegurarBotonCierreDelDiaEnHoja')
    .addToUi();
}

function asegurarBotonCierreDelDiaEnHoja() {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_CIERRE_CAJA);
  if (!hoja) return;

  const existentes = getBotonesCierreDelDia_(hoja);
  if (existentes.length === 1) {
    return;
  }

  limpiarBotonCierreDelDia_(hoja);
  const celda = hoja.getRange(CELDA_BOTON_CIERRE_DIA);
  const image = hoja.insertImage(
    URL_BOTON_CIERRE_DIA,
    celda.getColumn(),
    celda.getRow(),
    OFFSET_X_BOTON_CIERRE_DIA,
    OFFSET_Y_BOTON_CIERRE_DIA
  );

  image.assignScript('procesarCierreDelDia');
  image.setAltTextTitle(TITULO_BOTON_CIERRE_DIA);
  image.setAltTextDescription(DESCRIPCION_BOTON_CIERRE_DIA);
  image.setWidth(ANCHO_BOTON_CIERRE_DIA);
  image.setHeight(ALTO_BOTON_CIERRE_DIA);
}

function procesarCierreDelDia() {
  const ui = SpreadsheetApp.getUi();
  const respuesta = ui.alert(
    'Cerrar dia',
    'Se van a guardar los datos del dia en la hoja Datos y luego se van a limpiar las planillas operativas. Queres continuar?',
    ui.ButtonSet.YES_NO
  );

  if (respuesta !== ui.Button.YES) {
    return {
      ok: false,
      canceled: true
    };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojaDatos = ss.getSheetByName(HOJA_DATOS_CIERRE);
  const hojaCierre = ss.getSheetByName(HOJA_CIERRE_CAJA);

  if (!hojaDatos) {
    throw new Error('No se encontro la hoja Datos.');
  }

  if (!hojaCierre) {
    throw new Error('No se encontro la hoja Cierre de caja.');
  }

  const archivo = archivarFilaResumenDatos_(hojaDatos);
  copiarValoresCierreCaja_(hojaCierre);
  limpiarCobrosOperativos_(ss);
  limpiarHojasOperativasDelDia_(ss);
  SpreadsheetApp.flush();
  ss.toast('Cierre del dia procesado correctamente.', 'CIERRE', 6);

  return {
    ok: true,
    archivo
  };
}

function archivarFilaResumenDatos_(hojaDatos) {
  const sourceRange = hojaDatos.getRange('B2:AT2');
  const sourceValues = sourceRange.getValues()[0];
  const sourceDisplayValues = sourceRange.getDisplayValues()[0];
  const sourceFormats = sourceRange.getNumberFormats()[0];

  if (filaVaciaCierre_(sourceDisplayValues)) {
    return {
      archived: false,
      reason: 'Sin datos en B2:AT2'
    };
  }

  const startRow = 2;
  const startColumn = columnToNumberCierre_('AU');
  const width = sourceValues.length;
  const maxRows = Math.max(FILA_MAX_ARCHIVO_DATOS - startRow + 1, 1);
  const targetRange = hojaDatos.getRange(startRow, startColumn, maxRows, width);
  const existingValues = targetRange.getValues();
  const existingDisplays = targetRange.getDisplayValues();
  const existingFormats = targetRange.getNumberFormats();

  const registros = [];
  existingValues.forEach((row, index) => {
    const displayRow = existingDisplays[index] || [];
    if (filaVaciaCierre_(displayRow)) {
      return;
    }

    registros.push({
      values: row.slice(0, width),
      displayValues: displayRow.slice(0, width),
      formats: (existingFormats[index] || []).slice(0, width),
      sortKey: getSortKeyFechaCierre_(row[0], displayRow[0]),
      originalIndex: index
    });
  });

  const sourceFingerprint = JSON.stringify(sourceDisplayValues);
  const alreadyExists = registros.some((registro) => JSON.stringify(registro.displayValues) === sourceFingerprint);
  if (!alreadyExists) {
    if (registros.length >= maxRows) {
      throw new Error(`No hay lugar libre en Datos!AU2:CM${FILA_MAX_ARCHIVO_DATOS} para guardar otro cierre.`);
    }

    registros.push({
      values: sourceValues.slice(0, width),
      displayValues: sourceDisplayValues.slice(0, width),
      formats: sourceFormats.slice(0, width),
      sortKey: getSortKeyFechaCierre_(sourceValues[0], sourceDisplayValues[0]),
      originalIndex: registros.length
    });
  }

  registros.sort((left, right) => {
    if (left.sortKey !== right.sortKey) {
      return left.sortKey - right.sortKey;
    }

    return left.originalIndex - right.originalIndex;
  });

  if (registros.length > 0) {
    const writeRange = hojaDatos.getRange(startRow, startColumn, registros.length, width);
    writeRange.setValues(registros.map((registro) => registro.values));
    writeRange.setNumberFormats(registros.map((registro) => registro.formats));
  }

  if (registros.length < maxRows) {
    hojaDatos.getRange(startRow + registros.length, startColumn, maxRows - registros.length, width).clearContent();
  }

  return {
    archived: !alreadyExists,
    duplicateSkipped: alreadyExists,
    rowCount: registros.length
  };
}

function copiarValoresCierreCaja_(hojaCierre) {
  const bloqueUno = hojaCierre.getRange('G22:G27').getValues();
  const bloqueDos = hojaCierre.getRange('G29:G33').getValues();

  hojaCierre.getRange('B22:B27').setValues(bloqueUno);
  hojaCierre.getRange('B29:B33').setValues(bloqueDos);
}

function limpiarCobrosOperativos_(ss) {
  HOJAS_COBRO_CIERRE.forEach((nombreHoja) => {
    const hoja = ss.getSheetByName(nombreHoja);
    if (!hoja) return;

    hoja.getRange('A8:A114').setValue(false);
    hoja.getRange('AB8:AC114').clearContent();
  });
}

function limpiarHojasOperativasDelDia_(ss) {
  HOJAS_REPARTIDORES_CIERRE.forEach((nombreHoja) => {
    const hoja = ss.getSheetByName(nombreHoja);
    if (!hoja) return;

    ['B8:AA114', 'F2:G2', 'K4:L4', 'M2'].forEach((a1) => hoja.getRange(a1).clearContent());
  });

  const hojaVenta = ss.getSheetByName('Venta Mostrador');
  if (hojaVenta) {
    ['B8:AA114', 'K2'].forEach((a1) => hojaVenta.getRange(a1).clearContent());
  }

  const hojaLector = ss.getSheetByName('Lector Pedidosya');
  if (hojaLector) {
    hojaLector.getRange('B8:AA114').clearContent();
  }

  const hojaCierre = ss.getSheetByName(HOJA_CIERRE_CAJA);
  if (hojaCierre) {
    [
      'B11:B15',
      'D11:D15',
      'G6',
      'G9',
      'G12',
      'G15',
      'G39:G45',
      'G47:G51'
    ].forEach((a1) => hojaCierre.getRange(a1).clearContent());
  }
}

function filaVaciaCierre_(row) {
  return !Array.isArray(row) || row.every((cell) => String(cell || '').trim() === '');
}

function getSortKeyFechaCierre_(rawValue, displayValue) {
  const date = parseFechaCierre_(rawValue, displayValue);
  return date ? date.getTime() : Number.MAX_SAFE_INTEGER;
}

function parseFechaCierre_(rawValue, displayValue) {
  if (Object.prototype.toString.call(rawValue) === '[object Date]' && !Number.isNaN(rawValue.getTime())) {
    return rawValue;
  }

  const text = String(displayValue || rawValue || '').trim();
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) {
    return null;
  }

  const day = String(match[1]).padStart(2, '0');
  const month = String(match[2]).padStart(2, '0');
  const year = match[3];
  const parsed = new Date(`${year}-${month}-${day}T00:00:00-03:00`);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function columnToNumberCierre_(column) {
  return String(column || '')
    .trim()
    .toUpperCase()
    .split('')
    .reduce((acc, char) => (acc * 26) + char.charCodeAt(0) - 64, 0);
}

function limpiarBotonCierreDelDia_(hoja) {
  getBotonesCierreDelDia_(hoja).forEach((image) => image.remove());
}

function getBotonesCierreDelDia_(hoja) {
  if (!hoja || !hoja.getImages) return [];

  return hoja.getImages().filter((image) => {
    const altTitle = image.getAltTextTitle ? image.getAltTextTitle() : '';
    const anchor = image.getAnchorCell ? image.getAnchorCell() : null;
    if (altTitle === TITULO_BOTON_CIERRE_DIA) {
      return true;
    }

    return !!anchor && anchor.getRow() === 5 && anchor.getColumn() === 10;
  });
}
