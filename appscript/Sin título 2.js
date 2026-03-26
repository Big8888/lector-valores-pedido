function myFunction() {
}

function onEdit(e) {
  if (!e || !e.range) return;

  const hoja = e.range.getSheet();
  if (!hoja) return;

  const nombreHoja = hoja.getName();
  if (!['Mauro', 'Diogo', 'GIAN', 'LIBRE1'].includes(nombreHoja)) return;

  const fila = e.range.getRow();
  const columna = e.range.getColumn();
  if (fila < 8 || columna !== 1) return;

  const checked = e.range.getValue() === true;
  actualizarFilasCobroSeleccionadas_(hoja, [fila], checked);
}
