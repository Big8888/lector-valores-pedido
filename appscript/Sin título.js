function onOpen() {
  crearDesplegableMedioPago();
  configurarTablaVueltasCompartidas();
  ocultarColumnasAuxiliares();
  crearMenuCobros();
  crearBotonCobrosEnHojas();
  SpreadsheetApp.getActiveSpreadsheet().toast('Marca en A los pedidos a cobrar y usa el boton en A7.', 'COBROS', 5);
}

function onInstall() {
  onOpen();
}

function crearDesplegableMedioPago() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojasPermitidas = ['Mauro', 'Mauro 1', 'Diogo', 'GIAN', 'LIBRE1'];

  hojasPermitidas.forEach((nombreHoja) => {
    const hoja = ss.getSheetByName(nombreHoja);
    if (!hoja) return;

    const totalRows = Math.max(hoja.getMaxRows() - 7, 1);

    const rangoAccion = hoja.getRange(8, 1, totalRows, 1);
    rangoAccion.insertCheckboxes();

    hoja.getRange(8, 12, totalRows, 1).clearDataValidations();

    const rango = hoja.getRange(8, 10, totalRows, 1);
    const regla = SpreadsheetApp.newDataValidation()
      .requireValueInList(['Tarjeta', 'Efectivo', 'Transferencia'], true)
      .setAllowInvalid(false)
      .build();

    rango.setDataValidation(regla);
  });
}
