const TARGET_SPREADSHEET_ID = '1b6thcjNOAbUPKRWSSvqhog2vp6TOk-wbo5GqokPH2hg';
const HOJAS_REPARTIDORES = ['Mauro', 'Diogo', 'GIAN', 'LIBRE1'];
const CELDA_BOTON = 'A7';
const RANGO_LIMPIEZA_CONTROLES_VIEJOS = 'O1:P6';
const TITULO_IMAGEN_COBRO = 'COBROS_BUTTON';
const ANCHO_BOTON_COBRO = 126;
const ALTO_BOTON_COBRO = 26;
const OFFSET_X_BOTON_COBRO = 2;
const OFFSET_Y_BOTON_COBRO = 3;
const FUNCION_BOTON_EN_HOJA = 'abrirPedidosSeleccionados';

function codexPing() {
  return {
    ok: true,
    scriptId: ScriptApp.getScriptId(),
    spreadsheetId: TARGET_SPREADSHEET_ID
  };
}

function recrearBotonesCobrosEnTodasLasHojas() {
  const spreadsheet = SpreadsheetApp.openById(TARGET_SPREADSHEET_ID);
  const resultado = [];

  HOJAS_REPARTIDORES.forEach((nombreHoja) => {
    const hoja = spreadsheet.getSheetByName(nombreHoja);
    if (!hoja) {
      resultado.push({ hoja: nombreHoja, ok: false, motivo: 'Hoja no encontrada' });
      return;
    }

    asegurarBotonCobroEnHoja_(hoja);
    resultado.push({ hoja: nombreHoja, ok: true });
  });

  return {
    ok: true,
    spreadsheetId: TARGET_SPREADSHEET_ID,
    resultado
  };
}

function recrearBotonCobroEnHoja(nombreHoja) {
  const hojaBuscada = String(nombreHoja || '').trim();
  if (!hojaBuscada) {
    throw new Error('Falta indicar el nombre de la hoja.');
  }

  const spreadsheet = SpreadsheetApp.openById(TARGET_SPREADSHEET_ID);
  const hoja = spreadsheet.getSheetByName(hojaBuscada);
  if (!hoja) {
    throw new Error('No se encontro la hoja: ' + hojaBuscada);
  }

  asegurarBotonCobroEnHoja_(hoja);

  return {
    ok: true,
    hoja: hojaBuscada
  };
}

function limpiarBotonesCobroEnTodasLasHojas() {
  const spreadsheet = SpreadsheetApp.openById(TARGET_SPREADSHEET_ID);

  HOJAS_REPARTIDORES.forEach((nombreHoja) => {
    const hoja = spreadsheet.getSheetByName(nombreHoja);
    if (!hoja) return;

    limpiarBotonesCobro_(hoja);
    hoja.getRange(RANGO_LIMPIEZA_CONTROLES_VIEJOS)
      .clearContent()
      .clearDataValidations()
      .clearNote()
      .setBackground(null);
  });

  return { ok: true };
}

function asegurarBotonCobroEnHoja_(hoja) {
  hoja.getRange(RANGO_LIMPIEZA_CONTROLES_VIEJOS)
    .clearContent()
    .clearDataValidations()
    .clearNote()
    .setBackground(null);

  const celdaBoton = hoja.getRange(CELDA_BOTON);
  const botonFila = celdaBoton.getRow();
  const botonColumna = celdaBoton.getColumn();

  const botones = getBotonesCobro_(hoja);
  const botonEnPosicion = botones.some((image) => {
    if (!image.getAnchorCell) return false;
    const anchor = image.getAnchorCell();
    return anchor && anchor.getRow() === botonFila && anchor.getColumn() === botonColumna;
  });

  if (botones.length === 1 && botonEnPosicion) {
    return;
  }

  limpiarBotonesCobro_(hoja);
  colocarBotonCobroEnHoja_(hoja, celdaBoton);
}

function limpiarBotonesCobro_(hoja) {
  getBotonesCobro_(hoja).forEach((image) => image.remove());
}

function getBotonesCobro_(hoja) {
  if (!hoja.getImages) return [];

  return hoja.getImages().filter((image) => {
    const altTitle = image.getAltTextTitle ? image.getAltTextTitle() : '';
    return altTitle === TITULO_IMAGEN_COBRO;
  });
}

function colocarBotonCobroEnHoja_(hoja, celdaBoton) {
  const image = hoja.insertImage(
    crearImagenBotonCobros_().copyBlob(),
    celdaBoton.getColumn(),
    celdaBoton.getRow(),
    OFFSET_X_BOTON_COBRO,
    OFFSET_Y_BOTON_COBRO
  );

  image.assignScript(FUNCION_BOTON_EN_HOJA);
  image.setAltTextTitle(TITULO_IMAGEN_COBRO);
  image.setAltTextDescription('Abre la calculadora de cobro de esta hoja');
  image.setWidth(ANCHO_BOTON_COBRO);
  image.setHeight(ALTO_BOTON_COBRO);
}

function crearImagenBotonCobros_() {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="252" height="52" viewBox="0 0 252 52">',
    '<rect x="2" y="2" width="248" height="48" rx="14" fill="#34a853" stroke="#1f6f37" stroke-width="4"/>',
    '<text x="126" y="33" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#ffffff">ABRIR COBROS</text>',
    '</svg>'
  ].join('');

  return Utilities.newBlob(svg, 'image/svg+xml', 'cobros-button.svg');
}
