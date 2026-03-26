function myFunction() {
}

function onEdit(e) {
  if (!e || !e.range) return;

  const hoja = e.range.getSheet();
  const hojasPermitidas = ['Mauro', 'Diogo', 'GIAN', 'LIBRE1'];
  if (!hojasPermitidas.includes(hoja.getName())) return;

  const fila = e.range.getRow();
  const col = e.range.getColumn();

  const FILA_INICIO = 8;
  if (fila < FILA_INICIO) return;

  const COL_ACCION = 1; // A
  const COL_TOTAL = 4; // D
  const COL_TARJETA = 5; // E
  const COL_EFECTIVO = 6; // F
  const COL_TRANSFER = 7; // G
  const COL_SELECTOR = 10; // J

  if (col !== COL_ACCION) return;

  const accionActiva = e.value === true || e.value === 'TRUE' || e.value === 'true';
  if (!accionActiva) return;

  const opcionNueva = String(hoja.getRange(fila, COL_SELECTOR).getValue() || '').trim();

  const cellTotal = hoja.getRange(fila, COL_TOTAL);
  const cellTarjeta = hoja.getRange(fila, COL_TARJETA);
  const cellEfectivo = hoja.getRange(fila, COL_EFECTIVO);
  const cellTransfer = hoja.getRange(fila, COL_TRANSFER);

  const valorTotal = Number(cellTotal.getValue()) || 0;
  const valorTarjeta = Number(cellTarjeta.getValue()) || 0;
  const valorEfectivo = Number(cellEfectivo.getValue()) || 0;
  const valorTransfer = Number(cellTransfer.getValue()) || 0;

  const importeFila = valorTotal || valorTarjeta || valorEfectivo || valorTransfer || 0;
  if (importeFila === 0) {
    e.range.setValue(false);
    return;
  }

  if (opcionNueva === '') {
    cellTotal.setValue(importeFila);
    cellTarjeta.setValue(0);
    cellEfectivo.setValue(0);
    cellTransfer.setValue(0);
    e.range.setValue(false);
    return;
  }

  if (opcionNueva === 'Tarjeta') {
    cellTotal.setValue(0);
    cellTarjeta.setValue(importeFila);
    cellEfectivo.setValue(0);
    cellTransfer.setValue(0);
    e.range.setValue(false);
    return;
  }

  if (opcionNueva === 'Efectivo') {
    cellTotal.setValue(0);
    cellTarjeta.setValue(0);
    cellEfectivo.setValue(importeFila);
    cellTransfer.setValue(0);
    e.range.setValue(false);
    return;
  }

  if (opcionNueva === 'Transferencia') {
    cellTotal.setValue(0);
    cellTarjeta.setValue(0);
    cellEfectivo.setValue(0);
    cellTransfer.setValue(importeFila);
    e.range.setValue(false);
    return;
  }

  cellTotal.setValue(importeFila);
  cellTarjeta.setValue(0);
  cellEfectivo.setValue(0);
  cellTransfer.setValue(0);
  hoja.getRange(fila, COL_SELECTOR).clearContent();
  e.range.setValue(false);
}
