function onOpen() {
  crearDesplegableMedioPago();
  crearMenuCobros();
  crearBotonCobrosEnHojas();
  SpreadsheetApp.getActiveSpreadsheet().toast('Tenes el boton ABRIR COBROS en la hoja y tambien el menu COBROS arriba.', 'COBROS', 5);
}

function onInstall() {
  onOpen();
}

function crearDesplegableMedioPago() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojasPermitidas = ['Mauro', 'Diogo', 'GIAN', 'LIBRE1'];

  hojasPermitidas.forEach((nombreHoja) => {
    const hoja = ss.getSheetByName(nombreHoja);
    if (!hoja) return;

    hoja.getRange('K8:K35').clearDataValidations();

    const rango = hoja.getRange('I8:I35');
    const regla = SpreadsheetApp.newDataValidation()
      .requireValueInList(['Tarjeta', 'Efectivo', 'Transferencia'], true)
      .setAllowInvalid(false)
      .build();

    rango.setDataValidation(regla);
  });
}
