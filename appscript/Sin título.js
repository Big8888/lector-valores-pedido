function onOpen() {
  crearDesplegableMedioPago();
  configurarColoresEstadoAutomaticosEnHojas();
  ocultarColumnasAuxiliares();
  sincronizarNombreHojaEnEncabezados();
  crearMenuCobros();
  SpreadsheetApp.getActiveSpreadsheet().toast('Marca en A los pedidos a cobrar y usa el boton en A5.', 'COBROS', 5);
}

function onInstall() {
  onOpen();
}

function crearDesplegableMedioPago() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojasPermitidas = ['Mauro', 'Brisa', 'Diogo', 'GIAN', 'LIBRE1', 'Venta Mostrador'];

  hojasPermitidas.forEach((nombreHoja) => {
    const hoja = ss.getSheetByName(nombreHoja);
    if (!hoja) return;

    const totalRows = Math.max(hoja.getMaxRows() - 7, 1);

    const rangoAccion = hoja.getRange(8, 1, totalRows, 1);
    rangoAccion.insertCheckboxes();

    if (nombreHoja === 'Venta Mostrador') {
      return;
    }

    hoja.getRange(8, 12, totalRows, 1).clearDataValidations();

    const rango = hoja.getRange(8, 10, totalRows, 1);
    const regla = SpreadsheetApp.newDataValidation()
      .requireValueInList(['Tarjeta', 'Efectivo', 'Transferencia'], true)
      .setAllowInvalid(false)
      .build();

    rango.setDataValidation(regla);
  });
}

function sincronizarNombreHojaEnEncabezados() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojasPermitidas = ['Mauro', 'Brisa', 'Diogo', 'GIAN', 'LIBRE1'];

  hojasPermitidas.forEach((nombreHoja) => {
    const hoja = ss.getSheetByName(nombreHoja);
    if (!hoja) return;

    hoja.getRange(7, 1).setValue(hoja.getName());
    hoja.getRange(7, 2).setValue(hoja.getName());
    const columnaNombre = detectarColumnaNombreHoja_(hoja, hojasPermitidas);
    hoja.getRange(7, columnaNombre).setValue(hoja.getName());
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
