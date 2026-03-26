function myFunction() {
}

function onEdit(e) {
  if (!e || !e.range) return;

  const hoja = e.range.getSheet();
  const hojasPermitidas = ['Mauro', 'Diogo', 'GIAN', 'LIBRE1'];
  if (!hojasPermitidas.includes(hoja.getName())) return;

  const fila = e.range.getRow();
  const col = e.range.getColumn();
  const ROW_BOTON_COBRO = 1;
  const COL_BOTON_COBRO = 14; // N

  if (fila === ROW_BOTON_COBRO && col === COL_BOTON_COBRO) {
    const activado = e.range.getValue() === true;
    if (!activado) return;

    e.range.setValue(false);
    abrirVentanaCobro();
    return;
  }

  const FILA_INICIO = 8;
  if (fila < FILA_INICIO) return;

  const COL_TOTAL = 3; // C
  const COL_TARJETA = 4; // D
  const COL_EFECTIVO = 5; // E
  const COL_TRANSFER = 6; // F
  const COL_SELECTOR = 9; // I

  if (col !== COL_SELECTOR) return;

  const opcionNueva = String(e.range.getValue() || '').trim();

  const cellTotal = hoja.getRange(fila, COL_TOTAL);
  const cellTarjeta = hoja.getRange(fila, COL_TARJETA);
  const cellEfectivo = hoja.getRange(fila, COL_EFECTIVO);
  const cellTransfer = hoja.getRange(fila, COL_TRANSFER);

  const valorTotal = Number(cellTotal.getValue()) || 0;
  const valorTarjeta = Number(cellTarjeta.getValue()) || 0;
  const valorEfectivo = Number(cellEfectivo.getValue()) || 0;
  const valorTransfer = Number(cellTransfer.getValue()) || 0;

  const importeFila = valorTotal || valorTarjeta || valorEfectivo || valorTransfer || 0;
  if (importeFila === 0) return;

  cellTotal.setValue(0);
  cellTarjeta.setValue(0);
  cellEfectivo.setValue(0);
  cellTransfer.setValue(0);

  if (opcionNueva === '') {
    cellTotal.setValue(importeFila);
    return;
  }

  if (opcionNueva === 'Tarjeta') {
    cellTarjeta.setValue(importeFila);
    return;
  }

  if (opcionNueva === 'Efectivo') {
    cellEfectivo.setValue(importeFila);
    return;
  }

  if (opcionNueva === 'Transferencia') {
    cellTransfer.setValue(importeFila);
    return;
  }

  cellTotal.setValue(importeFila);
  e.range.clearContent();
}
