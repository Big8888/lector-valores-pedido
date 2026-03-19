function formatFecha(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return String(value || '');
  }

  return new Intl.DateTimeFormat('es-UY', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
}

function mapOrderToSheetRow(order, assignment) {
  const notes = [
    order.anotaciones,
    order.rawText && order.rawText !== order.pedido ? `Texto original: ${order.rawText}` : '',
    assignment && assignment.courier ? `Repartidor asignado: ${assignment.courier}` : ''
  ].filter(Boolean).join(' | ');

  return {
    pedido: order.pedido,
    tarjeta: order.tarjeta,
    efectivo: order.efectivo,
    transferencia: order.transferencia,
    enviosLejanos: order.enviosLejanos ? 'SI' : '',
    propinaWeb: order.propinaWeb,
    anotaciones: notes,
    nroPedido: order.nroPedido,
    importe: order.importe,
    telefono: order.telefono,
    fecha: formatFecha(order.fecha)
  };
}

module.exports = {
  mapOrderToSheetRow
};
