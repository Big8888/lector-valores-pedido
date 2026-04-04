const HOJAS_REPARTIDORES = ['Mauro', 'Brisa', 'Diogo', 'GIAN', 'LIBRE1'];

function onOpen() {
  crearDesplegableMedioPago();
  configurarColoresEstadoAutomaticosEnHojas();
  ocultarColumnasAuxiliares();
  sincronizarNombreHojaEnEncabezados();
  crearMenuCobros();
  crearMenuCierreDia();
  try {
    asegurarBotonCierreDelDiaEnHoja();
  } catch (error) {
    Logger.log('No se pudo asegurar el boton de cierre del dia: ' + error);
  }
  SpreadsheetApp.getActiveSpreadsheet().toast('Marca en A los pedidos a cobrar y usa el boton en A5.', 'COBROS', 5);
}

function onInstall() {
  onOpen();
}

function crearDesplegableMedioPago() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojasPermitidas = ['Mauro', 'Brisa', 'Diogo', 'GIAN', 'LIBRE1', 'Venta Mostrador', 'Lector Pedidosya'];
  const hojasSoloCheckbox = ['Venta Mostrador', 'Lector Pedidosya'];

  hojasPermitidas.forEach((nombreHoja) => {
    const hoja = ss.getSheetByName(nombreHoja);
    if (!hoja) return;

    const totalRows = Math.max(hoja.getMaxRows() - 7, 1);

    const rangoAccion = hoja.getRange(8, 1, totalRows, 1);
    rangoAccion.insertCheckboxes();

    if (hojasSoloCheckbox.includes(nombreHoja)) {
      return;
    }

    hoja.getRange(8, 12, totalRows, 1).clearDataValidations();
    hoja.getRange(8, 10, totalRows, 1).clearDataValidations();
  });
}

function sincronizarNombreHojaEnEncabezados() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojasPermitidas = HOJAS_REPARTIDORES;

  hojasPermitidas.forEach((nombreHoja) => {
    const hoja = ss.getSheetByName(nombreHoja);
    if (!hoja) return;

    hoja.getRange(7, 1).setValue(hoja.getName());
    hoja.getRange(7, 2).setValue(hoja.getName());
    const columnaNombre = detectarColumnaNombreHoja_(hoja, hojasPermitidas);
    hoja.getRange(7, columnaNombre).setValue(hoja.getName());
  });
}

function sincronizarContadorPedidosEnHojas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  HOJAS_REPARTIDORES.forEach((nombreHoja) => {
    const hoja = ss.getSheetByName(nombreHoja);
    if (!hoja) return;

    // Cuenta todos los pedidos cargados desde la fila 8, aunque el numero llegue como texto.
    hoja.getRange('D2').setFormula('=COUNTA(B8:B)');
  });
}

function detectarColumnaNombreHoja_(hoja, hojasPermitidas) {
  const valores = hoja.getRange(7, 1, 1, 4).getDisplayValues()[0];
  const columnaExistente = valores.findIndex((valor) => {
    const texto = String(valor || '').trim();
    return hojasPermitidas.includes(texto);
  });

  return columnaExistente >= 0 ? columnaExistente + 1 : 2;
}
