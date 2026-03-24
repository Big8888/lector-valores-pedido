function stringifyFlags(flags = {}) {
  const active = [];

  if (flags.hasReplacement) active.push('REEMPLAZO');
  if (flags.hasNotes) active.push('NOTAS');
  if (flags.hasFries) active.push('PAPAS');
  if (flags.hasMeat) active.push('CARNE');

  return active.join(' | ');
}

function buildAnnotations(order, assignment) {
  const parts = [];

  if (assignment?.courier) {
    parts.push(`Repartidor asignado: ${assignment.courier}`);
  }

  const alerts = stringifyFlags(order.flags);
  if (alerts) {
    parts.push(`Alertas: ${alerts}`);
  }

  if (order.rawText) {
    parts.push(`Notas: ${order.rawText}`);
  }

  if (order.itemsText) {
    parts.push(`Items: ${order.itemsText}`);
  }

  return parts.join(' | ');
}

function mapOrderToSheetRow(order, assignment) {
  return {
    pedido: order.pedido || '',
    tarjeta: '',
    efectivo: '',
    transferencia: '',
    enviosLejanos: '',
    propinaWeb: '',
    anotaciones: buildAnnotations(order, assignment),
    nroPedido: order.pedido || '',
    importe: order.total || '',
    telefono: order.telefono || '',
    fecha: new Date().toLocaleString('es-UY'),
    repartidor: assignment?.courier || '',
    hojaDestino: assignment?.sheetName || ''
  };
}

module.exports = {
  mapOrderToSheetRow
};
