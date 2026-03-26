const HOJAS_COBRO = ['Mauro', 'Diogo', 'GIAN', 'LIBRE1'];
const FILA_INICIO_PEDIDOS = 8;
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
    .createMenu('Cobros')
    .addItem('Cobrar seleccionados', 'abrirVentanaCobro')
    .addToUi();
}

function abrirVentanaCobro() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getActiveSheet();

  if (!HOJAS_COBRO.includes(hoja.getName())) {
    ui.alert('Esta herramienta solo funciona en las hojas Mauro, Diogo, GIAN y LIBRE1.');
    return;
  }

  const rango = hoja.getActiveRange();
  if (!rango) {
    ui.alert('Seleccioná las filas de los pedidos primero.');
    return;
  }

  const datos = obtenerCobroSeleccionado_(hoja, rango);
  if (datos.items.length === 0) {
    ui.alert('No encontré pedidos válidos en la selección.');
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
