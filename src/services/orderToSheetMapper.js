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

function asPlainText(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return `'${text}`;
}

function mapOrderToSheetRow(order) {
  const total = Number(order.total || order.importe || 0);

  return {
    numeroPedidoInterno: order.numeroPedidoInterno || '',
    total,
    enviosLejanos: Number(order.enviosLejanos || 0),
    propinaWeb: Number(order.propinaWeb || 0),
    nroPedido: asPlainText(order.nroPedido),
    importe: total,
    telefono: asPlainText(order.telefono),
    fecha: formatFecha(order.fecha)
  };
}

module.exports = {
  mapOrderToSheetRow
};
