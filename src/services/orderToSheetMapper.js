const sheetsConfig = require('../config/sheetsConfig');

const TIME_ZONE = sheetsConfig.timeZone || 'America/Montevideo';

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const normalized = String(value).trim().replace(/^'/, '').replace(/\./g, '').replace(',', '.');
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function asNumber(value, fallback = 0) {
  const parsed = toFiniteNumber(value);
  return parsed === null ? fallback : parsed;
}

function asPlainText(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return `'${text}`;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatFecha(value) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value || '');
  }

  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(date);
  const readPart = (type) => parts.find((part) => part.type === type)?.value || '';

  const day = readPart('day');
  const month = readPart('month');
  const year = readPart('year');
  const hour = readPart('hour');
  const minute = readPart('minute');

  if (!day || !month || !year || !hour || !minute) {
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  return `${day}/${month}/${year} ${hour}:${minute}`;
}

function getExistingStoredAmount(existingRow = {}) {
  const candidates = [
    toFiniteNumber(existingRow.total),
    toFiniteNumber(existingRow.tarjeta),
    toFiniteNumber(existingRow.efectivo),
    toFiniteNumber(existingRow.transferencia)
  ].filter((value) => value !== null && value > 0);

  return candidates.length > 0 ? candidates[0] : 0;
}

function normalizePaymentMethod(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized || normalized === 'no_especificado') {
    return '';
  }

  if (normalized === 'tarjeta' || normalized === 'efectivo' || normalized === 'transferencia') {
    return normalized;
  }

  return '';
}

function mapOrderToSheetRow(order, existingRow = null) {
  const paymentMethod = normalizePaymentMethod(order.paymentMethod);
  const incomingAmount = toFiniteNumber(order.total);
  const fallbackAmount = getExistingStoredAmount(existingRow || {});
  const shouldPreserveStoredAmount = paymentMethod && fallbackAmount > 0;
  const authoritativeAmount = shouldPreserveStoredAmount
    ? fallbackAmount
    : (incomingAmount !== null ? incomingAmount : fallbackAmount);

  const incomingEnvio = toFiniteNumber(order.enviosLejanos);
  const fallbackEnvio = toFiniteNumber(existingRow?.enviosLejanos);
  const enviosLejanos = incomingEnvio !== null ? incomingEnvio : asNumber(fallbackEnvio, 0);

  const incomingPropina = toFiniteNumber(order.propinaWeb);
  const fallbackPropina = toFiniteNumber(existingRow?.propinaWeb);
  const propinaWeb = incomingPropina !== null ? incomingPropina : asNumber(fallbackPropina, 0);

  const telefono = order.telefono || existingRow?.telefono || '';
  const fecha = order.fecha || existingRow?.fecha || '';

  return {
    numeroPedidoInterno: order.numeroPedidoInterno || existingRow?.numeroPedidoInterno || '',
    total: paymentMethod ? 0 : authoritativeAmount,
    tarjeta: paymentMethod === 'tarjeta' ? authoritativeAmount : 0,
    efectivo: paymentMethod === 'efectivo' ? authoritativeAmount : 0,
    transferencia: paymentMethod === 'transferencia' ? authoritativeAmount : 0,
    enviosLejanos,
    propinaWeb,
    telefono: asPlainText(telefono),
    fecha: formatFecha(fecha)
  };
}

module.exports = {
  mapOrderToSheetRow
};
