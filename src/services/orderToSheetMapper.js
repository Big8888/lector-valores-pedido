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

function getStoredAmount(existingRow = {}) {
  const candidates = [
    asNumber(existingRow.total),
    asNumber(existingRow.tarjeta),
    asNumber(existingRow.efectivo),
    asNumber(existingRow.transferencia)
  ].filter((value) => value > 0);

  return candidates.length > 0 ? candidates[0] : 0;
}

function mapOrderToSheetRow(order, existingRow = null) {
  const storedAmount = getStoredAmount(existingRow || {});
  const incomingAmount = asNumber(order.total);
  const hasPaymentMethod = order.paymentMethod && order.paymentMethod !== 'no_especificado';
  const authoritativeAmount = hasPaymentMethod
    ? (storedAmount > 0 ? storedAmount : incomingAmount)
    : (incomingAmount > 0 ? incomingAmount : storedAmount);
  const enviosLejanos = hasPaymentMethod && existingRow
    ? asNumber(existingRow.enviosLejanos)
    : asNumber(order.enviosLejanos);
  const propinaWeb = asNumber(order.propinaWeb) > 0
    ? asNumber(order.propinaWeb)
    : asNumber(existingRow && existingRow.propinaWeb);

  return {
    numeroPedidoInterno: order.numeroPedidoInterno || '',
    total: hasPaymentMethod ? 0 : authoritativeAmount,
    tarjeta: order.paymentMethod === 'tarjeta' ? authoritativeAmount : 0,
    efectivo: order.paymentMethod === 'efectivo' ? authoritativeAmount : 0,
    transferencia: order.paymentMethod === 'transferencia' ? authoritativeAmount : 0,
    enviosLejanos,
    propinaWeb,
    nroPedido: '',
    importe: '',
    telefono: asPlainText(order.telefono),
    fecha: formatFecha(order.fecha)
  };
}

module.exports = {
  mapOrderToSheetRow
};
