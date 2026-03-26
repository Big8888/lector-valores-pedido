const sheetsConfig = require('../config/sheetsConfig');

function formatFecha(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return String(value || '');
  }

  return new Intl.DateTimeFormat('es-UY', {
    timeZone: sheetsConfig.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
}

function formatHora(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value || '').trim();
  }

  return new Intl.DateTimeFormat('es-UY', {
    timeZone: sheetsConfig.timeZone,
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
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveNumber(incomingValue, fallbackValue, defaultValue = 0) {
  const incoming = asNumber(incomingValue);
  if (incoming !== null) return incoming;

  const fallback = asNumber(fallbackValue);
  if (fallback !== null) return fallback;

  return defaultValue;
}

function resolveText(incomingValue, fallbackValue, defaultValue = '') {
  const incoming = String(incomingValue || '').trim();
  if (incoming) return incoming;

  const fallback = String(fallbackValue || '').trim();
  if (fallback) return fallback;

  return defaultValue;
}

function mapOrderToSheetRow(order, existingRow = null) {
  const paymentMethod = String(order.paymentMethod || '').trim().toLowerCase();
  const hasPaymentMethod = paymentMethod && paymentMethod !== 'no_especificado';

  const authoritativeAmount = resolveNumber(
    order.total,
    existingRow?.total ?? existingRow?.tarjeta ?? existingRow?.efectivo ?? existingRow?.transferencia,
    0
  );

  const enviosLejanos = resolveNumber(order.enviosLejanos, existingRow?.enviosLejanos, 0);
  const propinaWeb = resolveNumber(order.propinaWeb, existingRow?.propinaWeb, 0);

  const enCamino = order.finalizado
    ? resolveText(existingRow?.enCamino, '', '')
    : resolveText(
        order.enCamino ? formatHora(order.enCamino) : '',
        existingRow?.enCamino,
        ''
      );

  const finalizado = resolveText(
    order.finalizado ? formatHora(order.finalizado) : '',
    existingRow?.finalizado,
    ''
  );

  return {
    numeroPedidoInterno: order.numeroPedidoInterno || '',
    estadoPago: order.paymentStatus || order.estadoPago || '',
    total: hasPaymentMethod ? 0 : authoritativeAmount,
    tarjeta: paymentMethod === 'tarjeta' ? authoritativeAmount : 0,
    efectivo: paymentMethod === 'efectivo' ? authoritativeAmount : 0,
    transferencia: paymentMethod === 'transferencia' ? authoritativeAmount : 0,
    enviosLejanos,
    propinaWeb,
    salidaDinero: order.salidaDinero || existingRow?.salidaDinero || '',
    enCamino,
    finalizado,
    nroPedido: order.nroPedido || existingRow?.nroPedido || '',
    telefono: asPlainText(order.telefono),
    fecha: formatFecha(order.fecha)
  };
}

module.exports = {
  mapOrderToSheetRow
};
