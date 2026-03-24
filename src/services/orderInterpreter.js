function asString(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  return '';
}

function normalizeMoney(value) {
  if (value === null || value === undefined || value === '') return 0;

  if (typeof value === 'number') {
    return value;
  }

  const sanitized = String(value).replace(/[^\d.,-]/g, '').trim();
  if (!sanitized) return 0;

  const normalized = sanitized.includes(',')
    ? sanitized.replace(/\./g, '').replace(',', '.')
    : sanitized;

  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getOrderData(payload = {}) {
  if (payload && typeof payload.data === 'object' && payload.data !== null) {
    return payload.data;
  }

  if (payload && typeof payload.datos === 'object' && payload.datos !== null) {
    return payload.datos;
  }

  return payload || {};
}

function extractCombos(data) {
  if (!Array.isArray(data.combos)) return [];

  return data.combos.map((combo) => {
    const quantity = combo.quantity || 1;
    const baseName =
      asString(combo.product_name) ||
      asString(combo.variant_name) ||
      'Producto';

    const modifiers = Array.isArray(combo.modifiers)
      ? combo.modifiers
          .map((m) => {
            const qty = m.quantity || 1;
            const name = asString(m.name);
            if (!name) return '';
            return `${qty} x ${name}`;
          })
          .filter(Boolean)
      : [];

    const comment = asString(combo.comment);

    let line = `${quantity} x ${baseName}`;

    if (modifiers.length) {
      line += ` (${modifiers.join(', ')})`;
    }

    if (comment) {
      line += ` [${comment}]`;
    }

    return line;
  });
}

function extractProductos(data) {
  return extractCombos(data).join(' | ');
}

function detectPaymentStatus(data) {
  const status = asString(data.payment_status).toUpperCase();

  if (!status) return '';
  if (status === 'UNPAID') return 'NO PAGADO';
  if (status === 'PAID') return 'PAGADO';
  if (status === 'PENDING') return 'PENDIENTE';

  return status;
}

function buildNotas(data) {
  const notes = [];

  const generalComment = asString(data.comment);
  const deliveryComment = asString(data.delivery_comment);
  const reference = asString(data.address && data.address.reference);
  const complement = asString(data.address && data.address.complement);

  if (generalComment) notes.push(`Pedido: ${generalComment}`);
  if (deliveryComment) notes.push(`Delivery: ${deliveryComment}`);
  if (reference) notes.push(`Referencia: ${reference}`);
  if (complement) notes.push(`Complemento: ${complement}`);

  return notes.join(' | ');
}

function interpretOrder(payload = {}) {
  const data = getOrderData(payload);

  const cliente = asString(data.client && data.client.name);
  const countryCode = asString(data.client && data.client.country_calling_code);
  const phoneNumber = asString(data.client && data.client.phone_number);
  const telefono = countryCode && phoneNumber ? `+${countryCode} ${phoneNumber}` : phoneNumber;

  const direccion = asString(data.address && data.address.address);
  const repartidor = asString(data.rider && data.rider.name);

  const productos = extractProductos(data);
  const subtotal = normalizeMoney(data.combos_price ?? data.subtotal ?? '');
  const delivery = normalizeMoney(data.delivery_price ?? data.delivery_cost ?? '');
  const total = normalizeMoney(data.total);
  const paymentStatus = detectPaymentStatus(data);
  const notas = buildNotas(data);

  const pedido = [cliente, productos].filter(Boolean).join(' - ') || asString(data.id) || asString(payload.event_id);
  const nroPedido = asString(data.public_id) || asString(data.id) || asString(payload.event_id);
  const fecha = asString(data.created_at) || new Date().toISOString();
  const numeroPedidoInterno = data.daily_id ?? '';

  const rawText = [
    `Cliente: ${cliente}`,
    `Teléfono: ${telefono}`,
    `Dirección: ${direccion}`,
    `Repartidor: ${repartidor}`,
    `Productos: ${productos}`,
    `Subtotal: ${subtotal}`,
    `Delivery: ${delivery}`,
    `Total: ${total}`,
    `Pago: ${paymentStatus}`,
    notas ? `Notas: ${notas}` : ''
  ].filter(Boolean).join(' | ');

  return {
    pedido,
    nroPedido,
    numeroPedidoInterno,
    telefono,
    importe: total,
    paymentStatus,
    enviosLejanos: 0,
    propinaWeb: 0,
    fecha,
    riderHint: repartidor,
    cliente,
    direccion,
    repartidor,
    productos,
    subtotal,
    delivery,
    total,
    notas,
    rawText,
    originalPayload: payload,
    orderData: data
  };
}

module.exports = {
  interpretOrder
};
