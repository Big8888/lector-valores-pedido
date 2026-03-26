const HOJAS_COBRO = ['Mauro', 'Diogo', 'GIAN', 'LIBRE1'];
const FILA_INICIO_PEDIDOS = 8;
const RANGO_LIMPIEZA_CONTROLES_VIEJOS = 'O1:P6';
const CELDA_BOTON_COBRO = 'A7';
const TITULO_IMAGEN_COBRO = 'COBROS_BUTTON';
const COLOR_COBRADO = '#d9ead3';
const COLUMNAS_COBRO = {
  accion: 1, // A
  numeroPedidoInterno: 2, // B
  estadoPago: 3, // C
  total: 4, // D
  tarjeta: 5, // E
  efectivo: 6, // F
  transferencia: 7, // G
  enviosLejanos: 8, // H
  propinaWeb: 9, // I
  salidaDinero: 10, // J
  enCamino: 11, // K
  finalizado: 12, // L
  anotaciones: 13 // M
};

function crearMenuCobros() {
  SpreadsheetApp.getUi()
    .createMenu('COBROS')
    .addItem('Abrir calculadora de cobro', 'abrirVentanaCobro')
    .addItem('Recrear boton en hojas', 'crearBotonCobrosEnHojas')
    .addToUi();
}

function abrirPedidosSeleccionados() {
  abrirVentanaCobro();
}

function limpiarBotonesCobroEnHojas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  HOJAS_COBRO.forEach((nombreHoja) => {
    const hoja = ss.getSheetByName(nombreHoja);
    if (!hoja) return;

    limpiarBotonesCobro_(hoja);
    hoja.getRange(RANGO_LIMPIEZA_CONTROLES_VIEJOS)
      .clearContent()
      .clearDataValidations()
      .clearNote()
      .setBackground(null);
  });
}

function crearBotonCobrosEnHojas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const boton = crearImagenBotonCobros_();

  HOJAS_COBRO.forEach((nombreHoja) => {
    const hoja = ss.getSheetByName(nombreHoja);
    if (!hoja) return;

    limpiarBotonesCobro_(hoja);
    hoja.getRange(RANGO_LIMPIEZA_CONTROLES_VIEJOS)
      .clearContent()
      .clearDataValidations()
      .clearNote()
      .setBackground(null);

    hoja.setRowHeight(7, 34);
    const botonColumna = hoja.getRange(CELDA_BOTON_COBRO).getColumn();
    hoja.setColumnWidth(botonColumna, 132);

    const image = hoja.insertImage(
      boton.copyBlob(),
      hoja.getRange(CELDA_BOTON_COBRO).getColumn(),
      hoja.getRange(CELDA_BOTON_COBRO).getRow(),
      2,
      3
    );

    image.assignScript('abrirPedidosSeleccionados');
    image.setAltTextTitle(TITULO_IMAGEN_COBRO);
    image.setAltTextDescription('Abre la calculadora de cobro de esta hoja');
    image.setWidth(126);
    image.setHeight(26);
  });
}

function abrirVentanaCobro() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getActiveSheet();

  if (!HOJAS_COBRO.includes(hoja.getName())) {
    ui.alert('Esta herramienta solo funciona en las hojas Mauro, Diogo, GIAN y LIBRE1.');
    return;
  }

  const datos = obtenerPedidosSeleccionados_(hoja);
  if (datos.items.length === 0) {
    ui.alert('Marca en A los pedidos que queres cobrar y despues toca ABRIR COBROS.');
    return;
  }

  const template = HtmlService.createTemplateFromFile('CobroModal');
  template.sheetName = hoja.getName();
  template.items = datos.items;
  template.totalTarjeta = datos.totalTarjeta;
  template.totalEfectivo = datos.totalEfectivo;
  template.totalTransferencia = datos.totalTransferencia;
  template.totalGeneral = datos.totalGeneral;

  const html = template.evaluate()
    .setWidth(560)
    .setHeight(650);

  ui.showModalDialog(html, 'Cobro de pedidos seleccionados');
}

function confirmarCobro(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = String((payload && payload.sheetName) || '').trim();
  const hoja = ss.getSheetByName(sheetName);

  if (!hoja) {
    throw new Error('No se encontro la hoja del cobro.');
  }

  const filas = Array.isArray(payload && payload.filas)
    ? payload.filas
        .map((fila) => Number(fila))
        .filter((fila) => Number.isFinite(fila) && fila >= FILA_INICIO_PEDIDOS)
    : [];

  if (filas.length === 0) {
    throw new Error('No se recibieron filas validas para cobrar.');
  }

  const totalEfectivo = toNumberCobro_(payload && payload.totalEfectivo);
  const montoPago = toNumberCobro_(payload && payload.montoPago);
  const vuelto = toNumberCobro_(payload && payload.vuelto);
  const hora = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm:ss');

  filas.forEach((fila) => {
    hoja.getRange(fila, 1, 1, COLUMNAS_COBRO.anotaciones).setBackground(COLOR_COBRADO);

    const anotacionCelda = hoja.getRange(fila, COLUMNAS_COBRO.anotaciones);
    const anotacionActual = String(anotacionCelda.getValue() || '').trim();
    const detalleCobro = totalEfectivo > 0
      ? 'COBRADO ' + hora + ' | Efectivo ' + totalEfectivo + ' | Pago ' + montoPago + ' | Vuelto ' + vuelto
      : 'COBRADO ' + hora;
    const nuevaAnotacion = anotacionActual ? anotacionActual + ' | ' + detalleCobro : detalleCobro;

    anotacionCelda.setValue(nuevaAnotacion);
    hoja.getRange(fila, COLUMNAS_COBRO.accion).setValue(false);
  });

  return {
    ok: true,
    mensaje: 'Cobro registrado correctamente.'
  };
}

function obtenerPedidosSeleccionados_(hoja) {
  const lastRow = hoja.getLastRow();
  if (lastRow < FILA_INICIO_PEDIDOS) {
    return buildCobroVacio_();
  }

  const rango = hoja.getRange(
    FILA_INICIO_PEDIDOS,
    1,
    lastRow - FILA_INICIO_PEDIDOS + 1,
    COLUMNAS_COBRO.anotaciones
  );

  return obtenerCobroSeleccionado_(hoja, rango);
}

function obtenerCobroSeleccionado_(hoja, rango) {
  const startRow = rango.getRow();
  const numRows = rango.getNumRows();
  const valores = hoja
    .getRange(startRow, 1, numRows, COLUMNAS_COBRO.anotaciones)
    .getValues();

  const resultado = buildCobroVacio_();

  valores.forEach((filaValores, index) => {
    const fila = startRow + index;
    if (fila < FILA_INICIO_PEDIDOS) return;

    const accionMarcada = filaValores[COLUMNAS_COBRO.accion - 1] === true;
    const numeroPedidoInterno = String(
      filaValores[COLUMNAS_COBRO.numeroPedidoInterno - 1] || ''
    ).trim();
    const estadoPago = String(
      filaValores[COLUMNAS_COBRO.estadoPago - 1] || ''
    ).trim();
    const anotaciones = String(
      filaValores[COLUMNAS_COBRO.anotaciones - 1] || ''
    ).trim();
    const total = toNumberCobro_(filaValores[COLUMNAS_COBRO.total - 1]);
    const tarjeta = toNumberCobro_(filaValores[COLUMNAS_COBRO.tarjeta - 1]);
    const efectivo = toNumberCobro_(filaValores[COLUMNAS_COBRO.efectivo - 1]);
    const transferencia = toNumberCobro_(filaValores[COLUMNAS_COBRO.transferencia - 1]);

    if (/COBRADO/i.test(anotaciones)) {
      return;
    }

    if (!accionMarcada) {
      return;
    }

    if (!numeroPedidoInterno && total <= 0 && tarjeta <= 0 && efectivo <= 0 && transferencia <= 0) {
      return;
    }

    const totalFila = total + tarjeta + efectivo + transferencia;

    resultado.totalTarjeta += tarjeta;
    resultado.totalEfectivo += efectivo;
    resultado.totalTransferencia += transferencia;
    resultado.totalGeneral += totalFila;

    resultado.items.push({
      fila,
      numeroPedidoInterno,
      estadoPago,
      tarjeta,
      efectivo,
      transferencia,
      totalFila
    });
  });

  return resultado;
}

function buildCobroVacio_() {
  return {
    items: [],
    totalTarjeta: 0,
    totalEfectivo: 0,
    totalTransferencia: 0,
    totalGeneral: 0
  };
}

function toNumberCobro_(value) {
  if (value === null || value === undefined || value === '') return 0;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const normalized = String(value).replace(/[^\d.,-]/g, '').trim();
  if (!normalized) return 0;

  const parsed = Number(
    normalized.includes(',')
      ? normalized.replace(/\./g, '').replace(',', '.')
      : normalized
  );

  return Number.isFinite(parsed) ? parsed : 0;
}

function limpiarBotonesCobro_(hoja) {
  if (!hoja.getImages) return;

  const images = hoja.getImages();
  images.forEach((image) => {
    const altTitle = image.getAltTextTitle ? image.getAltTextTitle() : '';
    if (altTitle === TITULO_IMAGEN_COBRO) {
      image.remove();
    }
  });
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
