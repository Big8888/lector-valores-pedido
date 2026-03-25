function asString(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  return '';
}

function toNumber(value) {
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

function getNestedValue(source, path) {
  return path.reduce((current, key) => {
    if (current && typeof current === 'object' && key in current) {
      return current[key];
    }

    return undefined;
  }, source);
}

function findFirstValue(source, paths) {
  for (const path of paths) {
    const value = getNestedValue(source, path);
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }

  return undefined;
}

function flattenStringValues(value, result = []) {
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
    for (const item of value) {
      flattenStringValues(item, result);
    }

    return result;
  }

  if (typeof value === 'object') {
    for (const nestedValue of Object.values(value)) {
      flattenStringValues(nestedValue, result);
    }
  }

  return result;
}

function getAllPayloadTexts(data, payload) {
  return [
    ...flattenStringValues(data),
    ...flattenStringValues(payload)
  ]
    .map((value) => asString(value))
    .filter(Boolean);
}

function collectPaymentDebugFields(value, path = [], result = []) {
  if (value === null || value === undefined) {
    return result;
  }

  const currentPath = path.join('.');
  const matcher = /payment|pay|tip|propina|amount|total|subtotal|delivery|cash|card|transf|transfer|method|checkout/i;

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const textValue = asString(value);
    if (textValue && (matcher.test(currentPath) || matcher.test(textValue))) {
      result.push({
        path: currentPath || '(root)',
        value: textValue
      });
    }

    return result;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => collectPaymentDebugFields(item, [...path, String(index)], result));
    return result;
  }

  if (typeof value === 'object') {
    Object.entries(value).forEach(([key, nestedValue]) => {
      collectPaymentDebugFields(nestedValue, [...path, key], result);
    });
  }

  return result;
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

function detectPaymentMethod(data, payload) {
  const rawCandidates = [
    findFirstValue(data, [['payment_method']]),
    findFirstValue(data, [['payment_method_name']]),
    findFirstValue(data, [['payment_type']]),
    findFirstValue(data, [['payment', 'method']]),
    findFirstValue(data, [['payment', 'name']]),
    findFirstValue(data, [['checkout', 'payment_method']]),
    findFirstValue(data, [['checkout', 'payment_method_name']]),
    findFirstValue(data, [['payments', 0, 'method']]),
    findFirstValue(data, [['payments', 0, 'name']]),
    findFirstValue(data, [['payments', 0, 'type']]),
    findFirstValue(data, [['last_payment_method']]),
    findFirstValue(data, [['payment_option']]),
    findFirstValue(data, [['payment_channel']])
  ];

  const allCandidates = [
    ...rawCandidates.map((value) => asString(value)),
    ...getAllPayloadTexts(data, payload),
    ...flattenStringValues(data.payment),
    ...flattenStringValues(data.payments)
  ];

  const normalized = allCandidates
    .map((value) => asString(value).toLowerCase())
    .find((value) =>
      value &&
      (
        value.includes('transf') ||
        value.includes('efect') ||
        value.includes('cash') ||
        value.includes('card') ||
        value.includes('tarjeta') ||
        value.includes('debito') ||
        value.includes('credito')
      )
    ) || '';

  if (!normalized) {
    return 'no_especificado';
  }

  if (normalized.includes('transf')) return 'transferencia';
  if (normalized.includes('efect')) return 'efectivo';
  if (normalized.includes('cash')) return 'efectivo';
  if (normalized.includes('card')) return 'tarjeta';
  if (normalized.includes('tarjeta')) return 'tarjeta';
  if (normalized.includes('debito')) return 'tarjeta';
  if (normalized.includes('credito')) return 'tarjeta';

  return 'no_especificado';
}

function detectPropinaWeb(data, payload) {
  const directValue = findFirstValue(data, [
    ['total_tips'],
    ['tip'],
    ['tips'],
    ['meta_data', 'assigned_payment', 'tip_value'],
    ['meta_data', 'assigned_payment', 'tip'],
    ['assigned_payment', 'tip_value'],
    ['assigned_payment', 'tip'],
    ['payment', 'tip'],
    ['payment', 'tips'],
    ['payments', 0, 'tip'],
    ['payments', 0, 'tips']
  ]);

  const directAmount = toNumber(directValue);
  if (directAmount > 0) {
    return directAmount;
  }

  const baseTotalCandidates = [];

  const explicitTotal = toNumber(data.total);
  if (explicitTotal > 0) {
    baseTotalCandidates.push(explicitTotal);
  }

  const combosPrice = toNumber(data.combos_price);
  const subtotal = toNumber(data.subtotal);
  const deliveryPrice = toNumber(data.delivery_price ?? data.delivery_cost ?? 0);

  if (combosPrice > 0) {
    baseTotalCandidates.push(combosPrice + deliveryPrice);
  }

  if (subtotal > 0) {
    baseTotalCandidates.push(subtotal + deliveryPrice);
  }

  const baseTotal = baseTotalCandidates.length > 0 ? Math.max(...baseTotalCandidates) : 0;

  const paidAmountCandidates = [
    findFirstValue(data, [['amount']]),
    findFirstValue(data, [['paid_amount']]),
    findFirstValue(data, [['total_paid']]),
    findFirstValue(data, [['payment', 'amount']]),
    findFirstValue(data, [['payment', 'total']]),
    findFirstValue(data, [['payment', 'paid_amount']]),
    findFirstValue(data, [['payments', 0, 'amount']]),
    findFirstValue(data, [['payments', 0, 'total']]),
    findFirstValue(data, [['payments', 0, 'paid_amount']]),
    findFirstValue(data, [['checkout', 'amount']])
  ]
    .map((value) => toNumber(value))
    .filter((amount) => amount > 0);

  if (baseTotal > 0 && paidAmountCandidates.length > 0) {
    const maxPaidAmount = Math.max(...paidAmountCandidates);
    const inferredTipFromAmounts = Number((maxPaidAmount - baseTotal).toFixed(2));

    if (inferredTipFromAmounts > 0) {
      return inferredTipFromAmounts;
    }
  }

  const textCandidates = [
    asString(findFirstValue(data, [['payment_method_name']])),
    asString(findFirstValue(data, [['payment_description']])),
    asString(findFirstValue(data, [['payment', 'description']])),
    asString(findFirstValue(data, [['payments', 0, 'description']])),
    asString(findFirstValue(data, [['payments', 0, 'name']])),
    asString(findFirstValue(data, [['payments', 0, 'detail']])),
    ...getAllPayloadTexts(data, payload),
    ...flattenStringValues(data.payment),
    ...flattenStringValues(data.payments)
  ].filter(Boolean);

  for (const text of textCandidates) {
    const explicitPatterns = [
      /propina\s*[:+]?\s*\$?\s*([0-9.,]+)/i,
      /tip\s*[:+]?\s*\$?\s*([0-9.,]+)/i
    ];

    for (const pattern of explicitPatterns) {
      const match = text.match(pattern);
      if (!match) continue;

      const amount = toNumber(match[1]);
      if (amount > 0) {
        return amount;
      }
    }

    const normalizedText = text.toLowerCase();
    const mentionsPaymentMethod =
      normalizedText.includes('transf') ||
      normalizedText.includes('transferencia') ||
      normalizedText.includes('tarjeta') ||
      normalizedText.includes('efectivo');

    if (!mentionsPaymentMethod) {
      continue;
    }

    const amounts = [...text.matchAll(/([0-9]+(?:[.,][0-9]{1,2})?)/g)]
      .map((match) => toNumber(match[1]))
      .filter((amount) => amount > 0);

    const orderTotal = baseTotal || toNumber(data.total);
    if (orderTotal <= 0 || amounts.length === 0) {
      continue;
    }

    const paidAmount = Math.max(...amounts);
    const inferredTip = Number((paidAmount - orderTotal).toFixed(2));

    if (inferredTip > 0) {
      return inferredTip;
    }
  }

  return 0;
}

function detectRiderCancelled(data, payload, repartidor) {
  const statusTexts = [
    asString(data.rider_status),
    asString(data.status),
    asString(payload.event),
    asString(payload.type),
    asString(payload.action),
    asString(payload.event_type),
    asString(payload.topic)
  ]
    .map((value) => value.toLowerCase())
    .filter(Boolean);

  const cancellationKeywords = [
    'cancel',
    'unassign',
    'remove_rider',
    'rider_removed',
    'rider_cancelled',
    'rider_canceled'
  ];

  if (statusTexts.some((value) => cancellationKeywords.some((keyword) => value.includes(keyword)))) {
    return true;
  }

  return !repartidor && statusTexts.some((value) => value.includes('rider'));
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
  const subtotal = toNumber(data.combos_price ?? data.subtotal ?? 0);
  const delivery = toNumber(data.delivery_price ?? data.delivery_cost ?? 0);
  const total = toNumber(data.total ?? (subtotal + delivery));
  const paymentStatus = detectPaymentStatus(data);
  const paymentMethod = detectPaymentMethod(data, payload);
  const notas = buildNotas(data);

  const pedido = [cliente, productos].filter(Boolean).join(' - ') || asString(data.id) || asString(payload.event_id);
  const nroPedido = asString(data.public_id) || asString(data.id) || asString(payload.event_id);
  const fecha = asString(data.created_at) || new Date().toISOString();
  const numeroPedidoInterno = asString(data.daily_id ?? '');
  const riderCancelled = detectRiderCancelled(data, payload, repartidor);

  const enviosLejanos = delivery > 0 ? delivery : 0;
  const propinaWeb = detectPropinaWeb(data, payload);
  const importe = toNumber(data.amount ?? data.total ?? 0);
  const totalSinMetodo = paymentMethod === 'no_especificado' ? total : 0;
  const tarjeta = paymentMethod === 'tarjeta' ? total : 0;
  const efectivo = paymentMethod === 'efectivo' ? total : 0;
  const transferencia = paymentMethod === 'transferencia' ? total : 0;
  const paymentDebugTexts = getAllPayloadTexts(data, payload)
    .filter((value) => /transf|efect|cash|card|tarjeta|debito|credito|propina|tip/i.test(value))
    .slice(0, 20);
  const paymentDebugFields = collectPaymentDebugFields(payload).slice(0, 80);

  const rawText = [
    `Cliente: ${cliente}`,
    `Teléfono: ${telefono}`,
    `Dirección: ${direccion}`,
    `Repartidor: ${repartidor}`,
    `Productos: ${productos}`,
    `Subtotal: ${subtotal}`,
    `Delivery: ${delivery}`,
    `Total: ${total}`,
    `Metodo: ${paymentMethod}`,
    `Pago: ${paymentStatus}`,
    notas ? `Notas: ${notas}` : ''
  ].filter(Boolean).join(' | ');

  return {
    pedido,
    nroPedido,
    numeroPedidoInterno,
    telefono,
    fecha,
    repartidor,
    riderCancelled,
    riderHint: repartidor,
    cliente,
    direccion,
    productos,
    subtotal,
    delivery,
    total,
    totalSinMetodo,
    tarjeta,
    efectivo,
    transferencia,
    importe,
    enviosLejanos,
    propinaWeb,
    paymentMethod,
    paymentStatus,
    paymentDebugTexts,
    paymentDebugFields,
    notas,
    rawText,
    originalPayload: payload,
    orderData: data
  };
}

module.exports = {
  interpretOrder
};
