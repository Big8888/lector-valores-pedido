function asString(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function hasValue(value) {
  return value !== undefined && value !== null && value !== '';
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  const sanitized = String(value).replace(/[^\d.,-]/g, '').trim();
  if (!sanitized) return 0;

  const normalized = sanitized.includes(',')
    ? sanitized.replace(/\./g, '').replace(',', '.')
    : sanitized;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function flattenScalarValues(value, result = []) {
  if (value === null || value === undefined) {
    return result;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const text = asString(value);
    if (text) {
      result.push(text);
    }

    return result;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => flattenScalarValues(item, result));
    return result;
  }

  if (typeof value === 'object') {
    Object.values(value).forEach((item) => flattenScalarValues(item, result));
  }

  return result;
}

function normalizePaymentMethodText(value) {
  const normalized = asString(value).toLowerCase();

  if (!normalized) return '';
  if (normalized.includes('transf')) return 'transferencia';
  if (normalized.includes('cash')) return 'efectivo';
  if (normalized.includes('efect')) return 'efectivo';
  if (normalized.includes('card')) return 'tarjeta';
  if (normalized.includes('credit')) return 'tarjeta';
  if (normalized.includes('debit')) return 'tarjeta';
  if (normalized.includes('online')) return 'tarjeta';
  if (normalized === 'paid') return 'tarjeta';
  if (normalized.includes('wallet')) return 'tarjeta';
  if (normalized.includes('qr')) return 'tarjeta';

  return '';
}

function detectPedidosYaServiceType(order) {
  const directType = asString(order.expeditionType).toLowerCase();
  const hintTexts = flattenScalarValues(order.extraParameters)
    .map((value) => asString(value).toLowerCase());

  const localHints = ['dine in', 'dine-in', 'dinein', 'en el local', 'in store', 'salon', 'salón', 'local'];
  if (hintTexts.some((value) => localHints.some((hint) => value.includes(hint)))) {
    return 'local';
  }

  if (directType === 'pickup') {
    return 'pickup';
  }

  if (directType === 'delivery') {
    return 'delivery';
  }

  return 'pickup';
}

function formatServiceLabel(serviceType) {
  if (serviceType === 'local') return 'EN EL LOCAL';
  if (serviceType === 'pickup') return 'PARA RETIRAR';
  return 'DELIVERY';
}

function mapPaymentStatus(status) {
  const normalized = asString(status).toLowerCase();

  if (normalized === 'paid') return 'PAGADO';
  if (normalized === 'pending') return 'NO PAGADO';
  if (!normalized) return '';
  return normalized.toUpperCase();
}

function detectPaymentBreakdown(order, paymentStatus, total) {
  const method = normalizePaymentMethodText(
    order && order.payment
      ? order.payment.type || order.payment.remoteCode || order.payment.status
      : ''
  );

  const breakdown = {
    tarjeta: 0,
    efectivo: 0,
    transferencia: 0,
    paymentMethod: method || 'no_especificado'
  };

  if (method === 'efectivo') {
    breakdown.efectivo = total;
    return breakdown;
  }

  if (method === 'transferencia') {
    breakdown.transferencia = total;
    return breakdown;
  }

  if (method === 'tarjeta' || paymentStatus === 'PAGADO') {
    breakdown.tarjeta = total;
    breakdown.paymentMethod = method || 'tarjeta';
  }

  return breakdown;
}

function formatPedidosYaState(payload) {
  const parts = [];

  const expeditionType = asString(payload.expeditionType);
  if (expeditionType) {
    parts.push(expeditionType.toUpperCase());
  }

  if (hasValue(payload.preOrder)) {
    parts.push(payload.preOrder ? 'PREORDER' : 'RECIBIDO');
  } else {
    parts.push('RECIBIDO');
  }

  return parts.join(' | ');
}

function extractProductos(order) {
  if (!Array.isArray(order.products)) return '';

  return order.products
    .map((product) => {
      const quantity = asString(product.quantity) || '1';
      const name = asString(product.name) || 'Producto';
      return `${quantity} x ${name}`;
    })
    .filter(Boolean)
    .join(' | ');
}

function buildNotas(order, serviceLabel) {
  const notes = [];
  const customerComment = asString(order.comments && order.comments.customerComment);
  const pickupCode = asString(order.pickup && order.pickup.pickupCode);

  if (serviceLabel) {
    notes.push(serviceLabel);
  }

  if (pickupCode) {
    notes.push(`Codigo retiro: ${pickupCode}`);
  }

  if (customerComment) {
    notes.push(customerComment);
  }

  return notes.join(' | ');
}

function getPedidoListoTimestamp(order) {
  return (
    order.pickup && order.pickup.pickupTime ||
    order.delivery && order.delivery.riderPickupTime ||
    order.delivery && order.delivery.expectedDeliveryTime ||
    ''
  );
}

function interpretPedidosYaOrder(payload = {}, meta = {}) {
  const serviceType = detectPedidosYaServiceType(payload);
  const serviceLabel = formatServiceLabel(serviceType);
  const total = toNumber(
    payload.price && (
      payload.price.grandTotal ||
      payload.price.collectFromCustomer ||
      payload.price.totalNet
    )
  );
  const paymentStatus = mapPaymentStatus(payload.payment && payload.payment.status);
  const paymentBreakdown = detectPaymentBreakdown(payload, paymentStatus, total);
  const telefono = asString(payload.customer && payload.customer.mobilePhone);
  const numeroPedidoInterno = asString(payload.shortCode || payload.code || payload.token);
  const nroPedido = asString(payload.code || payload.token || payload.shortCode);
  const fecha = asString(payload.createdAt) || new Date().toISOString();
  const pedidoListo = getPedidoListoTimestamp(payload);
  const notas = buildNotas(payload, serviceLabel);
  const productos = extractProductos(payload);
  const cliente = [
    asString(payload.customer && payload.customer.firstName),
    asString(payload.customer && payload.customer.lastName)
  ].filter(Boolean).join(' ').trim();

  return {
    pedido: [cliente, productos].filter(Boolean).join(' - ') || nroPedido || numeroPedidoInterno,
    nroPedido,
    numeroPedidoInterno,
    telefono,
    fecha,
    serviceType,
    serviceLabel,
    cliente,
    productos,
    total,
    totalSinMetodo: 0,
    tarjeta: paymentBreakdown.tarjeta,
    efectivo: paymentBreakdown.efectivo,
    transferencia: paymentBreakdown.transferencia,
    pedidoListo,
    estadoPedido: formatPedidosYaState(payload),
    paymentMethod: paymentBreakdown.paymentMethod,
    paymentStatus,
    notas,
    remoteId: asString(meta.remoteId),
    rawText: JSON.stringify({
      remoteId: meta.remoteId || null,
      code: payload.code || null,
      shortCode: payload.shortCode || null,
      expeditionType: payload.expeditionType || null,
      paymentStatus: payload.payment && payload.payment.status || null,
      paymentType: payload.payment && payload.payment.type || null
    })
  };
}

function mapPedidosYaStatus(status) {
  const normalized = asString(status).toUpperCase();

  if (normalized === 'ORDER_CANCELLED') return 'CANCELADO';
  if (normalized === 'ORDER_PICKED_UP') return 'RETIRADO';
  if (normalized === 'COURIER_ARRIVED_AT_VENDOR') return 'RIDER EN LOCAL';
  if (normalized === 'SHOW_RIDER_WAITING_WARNING') return 'RIDER ESPERANDO';
  if (normalized === 'HIDE_RIDER_WAITING_WARNING') return 'RIDER NO ESPERA';
  if (normalized === 'PRODUCT_ORDER_MODIFICATION_SUCCESSFUL') return 'MODIFICACION OK';
  if (normalized === 'PRODUCT_ORDER_MODIFICATION_FAILED') return 'MODIFICACION ERROR';

  return normalized || '';
}

function interpretPedidosYaStatusUpdate(payload = {}, meta = {}) {
  return {
    nroPedido: asString(meta.remoteOrderId),
    numeroPedidoInterno: '',
    fecha: '',
    estadoPedido: mapPedidosYaStatus(payload.status),
    notas: asString(payload.message),
    paymentStatus: '',
    pedidoListo: '',
    telefono: ''
  };
}

module.exports = {
  interpretPedidosYaOrder,
  interpretPedidosYaStatusUpdate
};
