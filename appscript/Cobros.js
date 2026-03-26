const HOJAS_COBRO = ['Mauro', 'Diogo', 'GIAN', 'LIBRE1'];
const FILA_INICIO_PEDIDOS = 8;
const CELDA_BOTON_COBRO = 'N6';
const RANGO_LIMPIEZA_BOTON_VIEJO = 'N1:O2';
const TITULO_IMAGEN_COBRO = 'COBROS_BUTTON';
const COLUMNAS_COBRO = {
  numeroPedidoInterno: 1, // A
  estadoPago: 2, // B
  total: 3, // C
  tarjeta: 4, // D
  efectivo: 5, // E
  transferencia: 6, // F
  enviosLejanos: 7, // G
  propinaWeb: 8, // H
  salidaDinero: 9, // I
  enCamino: 10, // J
  finalizado: 11, // K
  anotaciones: 12 // L
};
const COLOR_COBRADO = '#d9ead3';

function crearMenuCobros() {
  SpreadsheetApp.getUi()
    .createMenu('COBROS')
      .addItem('Abrir calculadora de cobro', 'abrirVentanaCobro')
      .addToUi();
}

function limpiarBotonesCobroEnHojas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  HOJAS_COBRO.forEach((nombreHoja) => {
    const hoja = ss.getSheetByName(nombreHoja);
    if (!hoja) return;

    limpiarBotonesCobro_(hoja);
    hoja.getRange(RANGO_LIMPIEZA_BOTON_VIEJO).clearContent().clearDataValidations().clearNote().setBackground(null);
    hoja.getRange(CELDA_BOTON_COBRO).clearContent().clearDataValidations().clearNote().setBackground(null);
  });
}

function crearBotonCobrosEnHojas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const boton = crearImagenBotonCobros_();

  HOJAS_COBRO.forEach((nombreHoja) => {
    const hoja = ss.getSheetByName(nombreHoja);
    if (!hoja) return;

    limpiarBotonesCobro_(hoja);
    hoja.getRange(RANGO_LIMPIEZA_BOTON_VIEJO).clearContent().clearDataValidations().clearNote();
    hoja.getRange(CELDA_BOTON_COBRO).clearContent().clearDataValidations().setNote('Click sobre el boton verde para abrir cobros.');
    hoja.setRowHeight(6, 48);
    hoja.setColumnWidth(14, 180);
    hoja.setColumnWidth(15, 60);

    const image = hoja.insertImage(boton.copyBlob(), hoja.getRange(CELDA_BOTON_COBRO).getColumn(), hoja.getRange(CELDA_BOTON_COBRO).getRow());
    image.assignScript('abrirVentanaCobro');
    image.setAltTextTitle(TITULO_IMAGEN_COBRO);
    image.setAltTextDescription('Abre la ventana de cobro para esta hoja');
    image.setAnchorCell(hoja.getRange(CELDA_BOTON_COBRO));
    image.setAnchorCellXOffset(6);
    image.setAnchorCellYOffset(4);
    image.setWidth(210);
    image.setHeight(44);
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

  const datos = obtenerPedidosDisponibles_(hoja);
  if (datos.items.length === 0) {
    ui.alert('No encontré pedidos válidos para cobrar en esta hoja.');
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
  const hoja = ss.getSheetByName(String(payload && payload.sheetName || '').trim());

  if (!hoja) {
    throw new Error('No se encontró la hoja del cobro.');
  }

  const filas = Array.isArray(payload && payload.filas)
    ? payload.filas
        .map((fila) => Number(fila))
        .filter((fila) => Number.isFinite(fila) && fila >= FILA_INICIO_PEDIDOS)
    : [];

  if (filas.length === 0) {
    throw new Error('No se recibieron filas válidas para cobrar.');
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
      ? `COBRADO ${hora} | Efectivo ${totalEfectivo} | Pago ${montoPago} | Vuelto ${vuelto}`
      : `COBRADO ${hora}`;
    const nuevaAnotacion = anotacionActual ? `${anotacionActual} | ${detalleCobro}` : detalleCobro;

    anotacionCelda.setValue(nuevaAnotacion);
  });

  return {
    ok: true,
    mensaje: 'Cobro registrado correctamente.'
  };
}

function obtenerCobroSeleccionado_(hoja, rango) {
  const startRow = rango.getRow();
  const numRows = rango.getNumRows();
  const valores = hoja.getRange(startRow, 1, numRows, COLUMNAS_COBRO.anotaciones).getValues();

  const resultado = {
    items: [],
    totalTarjeta: 0,
    totalEfectivo: 0,
    totalTransferencia: 0,
    totalGeneral: 0
  };

  valores.forEach((filaValores, index) => {
    const fila = startRow + index;
    if (fila < FILA_INICIO_PEDIDOS) return;

    const numeroPedidoInterno = String(filaValores[COLUMNAS_COBRO.numeroPedidoInterno - 1] || '').trim();
    const estadoPago = String(filaValores[COLUMNAS_COBRO.estadoPago - 1] || '').trim();
    const total = toNumberCobro_(filaValores[COLUMNAS_COBRO.total - 1]);
    const tarjeta = toNumberCobro_(filaValores[COLUMNAS_COBRO.tarjeta - 1]);
    const efectivo = toNumberCobro_(filaValores[COLUMNAS_COBRO.efectivo - 1]);
    const transferencia = toNumberCobro_(filaValores[COLUMNAS_COBRO.transferencia - 1]);

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

function obtenerPedidosDisponibles_(hoja) {
  const lastRow = hoja.getLastRow();
  if (lastRow < FILA_INICIO_PEDIDOS) {
    return {
      items: [],
      totalTarjeta: 0,
      totalEfectivo: 0,
      totalTransferencia: 0,
      totalGeneral: 0
    };
  }

  const rango = hoja.getRange(FILA_INICIO_PEDIDOS, 1, lastRow - FILA_INICIO_PEDIDOS + 1, COLUMNAS_COBRO.anotaciones);
  return obtenerCobroSeleccionado_(hoja, rango);
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
  const images = hoja.getImages ? hoja.getImages() : [];

  images.forEach((image) => {
    const anchorCell = image.getAnchorCell();
    const isCobroButton = image.getAltTextTitle && image.getAltTextTitle() === TITULO_IMAGEN_COBRO;
    const isOnCobroCell = anchorCell && anchorCell.getA1Notation() === CELDA_BOTON_COBRO;

    if (isCobroButton || isOnCobroCell) {
      image.remove();
    }
  });
}

function crearImagenBotonCobros_() {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="420" height="88" viewBox="0 0 420 88">',
    '<rect x="2" y="2" width="416" height="84" rx="18" fill="#34a853" stroke="#1e7c3b" stroke-width="4"/>',
    '<text x="210" y="55" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" font-weight="700" fill="#ffffff">ABRIR COBROS</text>',
    '</svg>'
  ].join('');

  return Utilities.newBlob(svg, 'image/svg+xml', 'cobros-button.svg');
}
