function formatFecha(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return String(value || '');
  }

  return new Intl.DateTimeFormat('es-UY', {
    year: '2-digit',
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

function truncate(value, max = 120) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3)}...`;
}

function mapOrderToSheetRow(order, assignment) {
  const notes = [
    order.notas ? `Notas: ${order.notas}` : '',
    order.direccion ? `Dirección: ${order.direccion}` : '',
    order.repartidor ? `Repartidor webhook: ${order.repartidor}` : '',
    assignment && assignment.courier ? `Repartidor final: ${assignment.courier}` : ''
  ].filter(Boolean).join(' | ');

  return {
    pedido: truncate(order.pedido, 80),
    tarjeta: order.tarjeta || '',
    efectivo: order.efectivo || '',
    transferencia: order.transferencia || '',
    enviosLejanos: order.enviosLejanos ? 'SI' : '',
    propinaWeb: order.propinaWeb || '',
    anotaciones: truncate(notes, 220),
    nroPedido: asPlainText(order.nroPedido),
    importe: order.importe || '',
    telefono: asPlainText(order.telefono),
    fecha: formatFecha(order.fecha)
  };
}

module.exports = {
  mapOrderToSheetRow
};
