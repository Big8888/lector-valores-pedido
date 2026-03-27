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
  const paymentStatus = String(order.paymentStatus || order.estadoPago || '').trim().toUpperCase();
  const incomingTarjeta = resolveNumber(order.tarjeta, null, 0);
  const incomingEfectivo = resolveNumber(order.efectivo, null, 0);
  const incomingTransferencia = resolveNumber(order.transferencia, null, 0);
  const hasExplicitPaymentAmounts = Boolean(order.hasExplicitPaymentAmounts);
  const explicitPaymentsAreCurrentSnapshot = order.explicitPaymentsAreCurrentSnapshot !== false;
  const isUnpaidLike = paymentStatus === 'NO PAGADO' || paymentStatus === 'UNPAID' || paymentStatus === 'PENDIENTE' || paymentStatus === 'PENDING';

  const authoritativeAmount = resolveNumber(
    order.total,
    existingRow?.total ?? existingRow?.tarjeta ?? existingRow?.efectivo ?? existingRow?.transferencia,
    0
  );

  const enviosLejanos = resolveNumber(order.enviosLejanos, existingRow?.enviosLejanos, 0);
  const propinaWeb = existingRow
    ? resolveNumber(existingRow?.propinaWeb, 0, 0)
    : resolveNumber(order.propinaWeb, 0, 0);
  const enCaminoFormatted = order.enCamino ? formatHora(order.enCamino) : '';
  const enCamino = resolveText(
    enCaminoFormatted,
    existingRow?.enCamino,
    ''
  );
  const finalizado = resolveText(
    order.finalizado ? formatHora(order.finalizado) : '',
    existingRow?.finalizado,
    ''
  );

  const existingTarjeta = resolveNumber(existingRow?.tarjeta, 0, 0);
  const existingEfectivo = resolveNumber(existingRow?.efectivo, 0, 0);
  const existingTransferencia = resolveNumber(existingRow?.transferencia, 0, 0);
  const existingHasPaymentAmounts = existingTarjeta > 0 || existingEfectivo > 0 || existingTransferencia > 0;
  const incomingPaymentTotal = incomingTarjeta + incomingEfectivo + incomingTransferencia;

  let totalValue = hasPaymentMethod ? 0 : authoritativeAmount;
  let tarjetaValue = paymentMethod === 'tarjeta' ? authoritativeAmount : 0;
  let efectivoValue = paymentMethod === 'efectivo' ? authoritativeAmount : 0;
  let transferenciaValue = paymentMethod === 'transferencia' ? authoritativeAmount : 0;

  if (isUnpaidLike && !hasExplicitPaymentAmounts) {
    totalValue = authoritativeAmount;
    tarjetaValue = 0;
    efectivoValue = 0;
    transferenciaValue = 0;
  } else if (hasExplicitPaymentAmounts) {
    const shouldMergePartialPayment =
      existingHasPaymentAmounts &&
      incomingPaymentTotal > 0 &&
      incomingPaymentTotal < authoritativeAmount &&
      !explicitPaymentsAreCurrentSnapshot;

    totalValue = 0;

    if (shouldMergePartialPayment) {
      tarjetaValue = incomingTarjeta > 0 ? (existingTarjeta > 0 ? Math.max(existingTarjeta, incomingTarjeta) : incomingTarjeta) : existingTarjeta;
      efectivoValue = incomingEfectivo > 0 ? (existingEfectivo > 0 ? Math.max(existingEfectivo, incomingEfectivo) : incomingEfectivo) : existingEfectivo;
      transferenciaValue = incomingTransferencia > 0 ? (existingTransferencia > 0 ? Math.max(existingTransferencia, incomingTransferencia) : incomingTransferencia) : existingTransferencia;
    } else {
      tarjetaValue = incomingTarjeta;
      efectivoValue = incomingEfectivo;
      transferenciaValue = incomingTransferencia;
    }
  } else if (existingHasPaymentAmounts) {
    totalValue = resolveNumber(existingRow?.total, 0, 0);
    tarjetaValue = existingTarjeta;
    efectivoValue = existingEfectivo;
    transferenciaValue = existingTransferencia;
  }

  return {
    numeroPedidoInterno: order.numeroPedidoInterno || '',
    estadoPago: order.paymentStatus || order.estadoPago || '',
    total: totalValue,
    tarjeta: tarjetaValue,
    efectivo: efectivoValue,
    transferencia: transferenciaValue,
    enviosLejanos,
    propinaWeb,
    salidaDinero: order.salidaDinero || existingRow?.salidaDinero || '',
    enCamino,
    finalizado,
    numeroPedidoVisible: order.numeroPedidoInterno || existingRow?.numeroPedidoInterno || '',
    importeTransferenciaVisible: transferenciaValue > 0 ? transferenciaValue : '',
    telefono: asPlainText(order.telefono),
    fecha: formatFecha(order.fecha)
  };
}

module.exports = {
  mapOrderToSheetRow
};
