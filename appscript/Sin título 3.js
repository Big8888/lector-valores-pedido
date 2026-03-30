function ocultarColumnasAuxiliares() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojasPermitidas = ['Mauro', 'Brisa', 'Diogo', 'GIAN', 'LIBRE1', 'Venta Mostrador', 'Lector Pedidosya'];

  hojasPermitidas.forEach((nombreHoja) => {
    const hoja = ss.getSheetByName(nombreHoja);
    if (!hoja) return;

    hoja.hideColumns(28, 3); // AB y AC para respaldos internos, AD para tracking tecnico
  });
}

function sincronizarNumeroPedidoVisibleEnVentaMostrador() {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Venta Mostrador');
  if (!hoja) return;

  const ultimaFila = hoja.getLastRow();
  if (ultimaFila < 8) return;

  const cantidadFilas = ultimaFila - 7;
  const valoresNumeroPedido = hoja.getRange(8, 2, cantidadFilas, 1).getValues();
  hoja.getRange(8, 14, cantidadFilas, 1).setValues(valoresNumeroPedido);
}

function sincronizarSalidaDineroAZEnHojasRepartidores() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojasRepartidores = ['Mauro', 'Brisa', 'Diogo', 'GIAN', 'LIBRE1'];

  hojasRepartidores.forEach((nombreHoja) => {
    const hoja = ss.getSheetByName(nombreHoja);
    if (!hoja) return;

    const ultimaFila = hoja.getLastRow();
    if (ultimaFila < 8) return;

    const cantidadFilas = ultimaFila - 7;
    const valoresSalidaDinero = hoja.getRange(8, 10, cantidadFilas, 1).getValues();
    hoja.getRange(8, 26, cantidadFilas, 1).setValues(valoresSalidaDinero);
  });
}
