'use strict';

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function safeNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const number = Number(value);
  return Number.isNaN(number) ? 0 : number;
}

function buildToppingsSummary(toppings = []) {
  if (!Array.isArray(toppings) || toppings.length === 0) return '';

  return toppings
    .map((topping) => `${safeNumber(topping.quantity || 1)}x ${topping.name || 'Sin nombre'}`)
    .join(' | ');
}

function detectAlerts(text) {
  const normalized = normalizeText(text);
  const alerts = [];

  if (
    normalized.includes('sin ') ||
    normalized.includes('sin cebolla') ||
    normalized.includes('sin pepino') ||
    normalized.includes('sin ketchup') ||
    normalized.includes('sin mostaza')
  ) {
    alerts.push('MODIFICACION');
  }

  if (
    normalized.includes('cambiar') ||
    normalized.includes('reemplazar') ||
    normalized.includes('reemplazo')
  ) {
    alerts.push('REEMPLAZO');
  }

  if (
    normalized.includes('aparte') ||
    normalized.includes('separado') ||
    normalized.includes('bien cocida') ||
    normalized.includes('bien cocido')
  ) {
    alerts.push('COCINA');
  }

  return alerts.join(' | ');
}

function countKeywords(orderDetails, keywords) {
  let total = 0;

  for (const item of orderDetails) {
    const productName = item?.product?.name || '';
    const toppings = Array.isArray(item?.product?.toppings) ? item.product.toppings : [];
    const combined = normalizeText(
      [
        productName,
        item?.comment || '',
        ...toppings.map((topping) => topping.name || '')
      ].join(' ')
    );

    if (keywords.some((keyword) => combined.includes(normalizeText(keyword)))) {
      total += safeNumber(item.quantity || 1);
    }
  }

  return total;
}

function interpretOlaClickPayload(payload = {}) {
  const data = payload?.data || {};
  const client = data?.client || {};
  const orderDetails = Array.isArray(data?.order_details) ? data.order_details : [];
  const costDetails = data?.cost_details || {};

  const detailRows = orderDetails.map((item) => {
    const toppings = Array.isArray(item?.product?.toppings) ? item.product.toppings : [];
    const lineText = [
      item?.product?.name || '',
      item?.comment || '',
      ...toppings.map((topping) => topping.name || '')
    ].join(' | ');

    return {
      fechaHora: data?.created_at || '',
      orderId: data?.order_id || '',
      cliente: client?.name || '',
      telefono: client?.phone_number || '',
      direccion: client?.address || '',
      productName: item?.product?.name || '',
      productSku: item?.product?.sku || '',
      quantity: safeNumber(item?.quantity || 0),
      lineTotal: safeNumber(item?.total || 0),
      lineComment: item?.comment || '',
      unitPrice: safeNumber(item?.unit_price || 0),
      unitRegularPrice: safeNumber(item?.unit_regular_price || 0),
      unitDiscount: safeNumber(item?.unit_discount || 0),
      toppingsSummary: buildToppingsSummary(toppings),
      toppingsCount: toppings.reduce((acc, topping) => acc + safeNumber(topping.quantity || 1), 0),
      alerta: detectAlerts(lineText),
      rawProductJson: JSON.stringify(item)
    };
  });

  const pedidoRow = {
    eventType: payload?.event_type || '',
    eventId: payload?.event_id || '',
    merchantId: payload?.merchant_id || '',
    fechaHora: data?.created_at || '',
    orderId: data?.order_id || '',
    cliente: client?.name || '',
    telefono: client?.phone_number || '',
    direccion: client?.address || '',
    orderType: data?.order_type || '',
    status: data?.status || '',
    paymentMethod: data?.payment_method || '',
    paymentStatus: data?.payment_status || '',
    source: data?.source || '',
    subtotalProductos: safeNumber(costDetails?.products_price || 0),
    totalToppings: safeNumber(costDetails?.toppings_price || 0),
    deliveryPrice: safeNumber(costDetails?.delivery_price || 0),
    packagingPrice: safeNumber(costDetails?.packaging_price || 0),
    tip: safeNumber(costDetails?.tip || 0),
    descuentoProductos: safeNumber(costDetails?.products_discount || 0),
    descuentoCupon: safeNumber(costDetails?.coupon_discount || 0),
    total: safeNumber(costDetails?.total || 0),
    comentarioGeneral: data?.comment || '',
    cantidadLineas: orderDetails.length,
    cantidadTotalItems: orderDetails.reduce((acc, item) => acc + safeNumber(item.quantity || 0), 0),
    hamburguesas: countKeywords(orderDetails, ['hamburguesa', 'burger', 'smash']),
    papas: countKeywords(orderDetails, ['papa', 'papas', 'fries']),
    bebidas: countKeywords(orderDetails, ['coca', 'sprite', 'fanta', 'bebida', 'agua']),
    extras: countKeywords(orderDetails, ['cheddar', 'bacon', 'extra', 'ketchup', 'mostaza']),
    alerta: detectAlerts(
      [
        data?.comment || '',
        ...orderDetails.map((item) => item?.comment || ''),
        ...orderDetails.flatMap((item) =>
          Array.isArray(item?.product?.toppings)
            ? item.product.toppings.map((topping) => topping.name || '')
            : []
        )
      ].join(' | ')
    ),
    rawJson: JSON.stringify(payload)
  };

  return {
    pedidoRow,
    detailRows
  };
}

module.exports = {
  interpretOlaClickPayload,
  normalizeText,
  safeNumber,
  buildToppingsSummary,
  detectAlerts,
  countKeywords
};
