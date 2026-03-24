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

function asNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapOrderToSheetRow(order) {
  return {
    numeroPedidoInterno: order.numeroPedidoInterno || '',
    tarjeta: asNumber(order.tarjeta),
    efectivo: asNumber(order.efectivo),
    transferencia: asNumber(order.transferencia),
    enviosLejanos: asNumber(order.enviosLejanos),
    propinaWeb: asNumber(order.propinaWeb),
    nroPedido: '',
    importe: '',
    telefono: asPlainText(order.telefono),
    fecha: formatFecha(order.fecha)
  };
}

module.exports = {
  mapOrderToSheetRow
};
