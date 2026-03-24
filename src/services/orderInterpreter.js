function asString(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  return '';
}

function normalizeMoney(value) {
  if (value === null || value === undefined || value === '') return '';

  if (typeof value === 'number') {
    return value.toFixed(2).replace('.', ',');
  }

  const sanitized = String(value).replace(/[^\d.,-]/g, '').trim();
  if (!sanitized) return '';

  const normalized = sanitized.includes(',')
    ? sanitized.replace(/\./g, '').replace(',', '.')
    : sanitized;

  const parsed = Number(normalized);
  if (Number.isNaN(parsed)) return sanitized;

  return parsed.toFixed(2).replace('.', ',');
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
  const combos = extractCombos(data);
  return combos.join(' | ');
}

function detectPaymentMethod(data) {
  const payments = Array.isArray(data.payments) ? data.payments : [];

  const joined = payments
    .map((p) =>
      [
        asString(p.method),
        asString(p.type),
        asString(p.payment_method),
        asString(p.provider)
      ].join(' ')
    )
    .join(' ')
    .toLowerCase();

  if (!joined) return '';

  if (joined.includes('transfer')) return 'transferencia';
  if (
    joined.includes('card') ||
    joined.includes('tarjeta') ||
    joined.includes('credito') ||
    joined.includes('debito')
  ) {
    return 'tarjeta';
  }
  if (joined.includes('cash') || joined.includes('efectivo')) return 'efectivo';

  return joined;
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
  const paymentMethod = detectPaymentMethod(data);
  const notas = buildNotas(data);

  const importe = total;
  const transferencia = paymentMethod === 'transferencia' ? total : '';
  const tarjeta = paymentMethod === 'tarjeta' ? total : '';
  const efectivo = paymentMethod === 'efectivo' ? total : '';

  const pedido = [cliente, productos].filter(Boolean).join(' - ') || asString(data.id) || asString(payload.event_id);
  const nroPedido = asString(data.public_id) || asString(data.id) || asString(payload.event_id);
  const fecha = asString(data.created_at) || new Date().toISOString();

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
    telefono,
    importe,
    paymentMethod,
    paymentStatus,
    transferencia,
    tarjeta,
    efectivo,
    enviosLejanos: '',
    propinaWeb: '',
    anotaciones: notas,
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
