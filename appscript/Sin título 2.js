function myFunction() {
}

const HOJAS_REPARTIDORES_EDITABLES = ['Mauro', 'Brisa', 'Diogo', 'GIAN', 'LIBRE1'];
const FILA_INICIO_PEDIDOS_EDITABLES = 8;
const COLUMNA_NUMERO_PEDIDO = 2; // B
const COLUMNA_SALIDA_DINERO = 10; // J
const COLUMNA_NUMERO_PEDIDO_VISIBLE_MOSTRADOR = 14; // N
const COLUMNA_SALIDA_DINERO_VISIBLE = 26; // Z

function onEdit(e) {
  if (!e || !e.range) return;

  const hoja = e.range.getSheet();
  if (!hoja) return;

  const nombreHoja = hoja.getName();
  if (!['Mauro', 'Brisa', 'Diogo', 'GIAN', 'LIBRE1', 'Venta Mostrador', 'Lector Pedidosya'].includes(nombreHoja)) return;

  const fila = e.range.getRow();
  const columna = e.range.getColumn();
  const cantidadFilas = e.range.getNumRows();
  const cantidadColumnas = e.range.getNumColumns();

  if (
    nombreHoja === 'Venta Mostrador' &&
    fila >= FILA_INICIO_PEDIDOS_EDITABLES &&
    columna === COLUMNA_NUMERO_PEDIDO &&
    cantidadColumnas === 1
  ) {
    hoja
      .getRange(fila, COLUMNA_NUMERO_PEDIDO_VISIBLE_MOSTRADOR, cantidadFilas, 1)
      .setValues(e.range.getValues());
  }

  if (
    HOJAS_REPARTIDORES_EDITABLES.includes(nombreHoja) &&
    fila >= FILA_INICIO_PEDIDOS_EDITABLES &&
    columna === COLUMNA_SALIDA_DINERO &&
    cantidadColumnas === 1
  ) {
    hoja
      .getRange(fila, COLUMNA_SALIDA_DINERO_VISIBLE, cantidadFilas, 1)
      .setValues(e.range.getValues());
  }

  manejarEdicionTablaVueltasCompartidas_(e);
}
