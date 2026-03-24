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

function mapOrderToSheetRow(order, existingRow = null) {
  const incomingAmount = asNumber(order.importe || order.total);
  const fallbackAmount = asNumber(
    existingRow?.importe || existingRow?.total || existingRow?.tarjeta || existingRow?.efectivo || existingRow?.transferencia
  );
  const authoritativeAmount = incomingAmount > 0 ? incomingAmount : fallbackAmount;

  const incomingEnvio = asNumber(order.enviosLejanos);
  const fallbackEnvio = asNumber(existingRow?.enviosLejanos);
  const enviosLejanos = incomingEnvio > 0 ? incomingEnvio : fallbackEnvio;

  const incomingPropina = asNumber(order.propinaWeb);
  const fallbackPropina = asNumber(existingRow?.propinaWeb);
  const propinaWeb = incomingPropina > 0 ? incomingPropina : fallbackPropina;

  const paymentMethod = String(order.paymentMethod || '').trim().toLowerCase();
  const hasPaymentMethod = paymentMethod && paymentMethod !== 'no_especificado';

  return {
    numeroPedidoInterno: order.numeroPedidoInterno || '',
    total: hasPaymentMethod ? 0 : authoritativeAmount,
    tarjeta: paymentMethod === 'tarjeta' ? authoritativeAmount : 0,
    efectivo: paymentMethod === 'efectivo' ? authoritativeAmount : 0,
    transferencia: paymentMethod === 'transferencia' ? authoritativeAmount : 0,
    enviosLejanos,
    propinaWeb,
    nroPedido: asPlainText(order.nroPedido),
    importe: authoritativeAmount,
    telefono: asPlainText(order.telefono),
    fecha: formatFecha(order.fecha)
  };
}

module.exports = {
  mapOrderToSheetRow
};
