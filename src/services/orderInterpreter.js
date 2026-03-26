function asString(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  return '';
}

function hasValue(value) {
  return value !== undefined && value !== null && value !== '';
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const sanitized = String(value).replace(/[^\d.,-]/g, '').trim();
  if (!sanitized) return 0;

  const normalized = sanitized.includes(',')
    ? sanitized.replace(/\./g, '').replace(',', '.')
    : sanitized;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getNestedValue(source, path) {
  return path.reduce((current, key) => {
    if (current && typeof current === 'object' && key in current) {
      return current[key];
    }

    return undefined;
  }, source);
}

function findFirstPresent(source, paths) {
  for (const path of paths) {
    const value = getNestedValue(source, path);
    if (hasValue(value)) {
      return value;
    }
  }

  return undefined;
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
    for (const item of value) {
      flattenScalarValues(item, result);
    }
    return result;
  }

  if (typeof value === 'object') {
    for (const nestedValue of Object.values(value)) {
      flattenScalarValues(nestedValue, result);
    }
  }

  return result;
}

function getAllPayloadTexts(data, payload) {
  return [
    ...flattenScalarValues(data),
    ...flattenScalarValues(payload)
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
    const quantity = toNumber(combo.quantity) || 1;
    const baseName =
      asString(combo.product_name) ||
      asString(combo.variant_name) ||
      'Producto';

    const modifiers = Array.isArray(combo.modifiers)
      ? combo.modifiers
          .map((modifier) => {
            const modifierQuantity = toNumber(modifier.quantity) || 1;
            const modifierName = asString(modifier.name);
            if (!modifierName) return '';
            return `${modifierQuantity} x ${modifierName}`;
          })
          .filter(Boolean)
      : [];

    const comment = asString(combo.comment);

    let line = `${quantity} x ${baseName}`;

    if (modifiers.length > 0) {
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
  const explicitCandidates = [
    findFirstPresent(data, [['meta_data', 'assigned_payment', 'payment_method']]),
    findFirstPresent(data, [['meta_data', 'assigned_payment', 'method']]),
    findFirstPresent(data, [['meta_data', 'assigned_payment', 'payment_method_name']]),
    findFirstPresent(data, [['meta_data', 'assigned_payment', 'name']]),
    findFirstPresent(data, [['payment_method']]),
    findFirstPresent(data, [['payment_method_name']]),
    findFirstPresent(data, [['payment_type']]),
    findFirstPresent(data, [['payment', 'method']]),
    findFirstPresent(data, [['payment', 'name']]),
    findFirstPresent(data, [['checkout', 'payment_method']]),
    findFirstPresent(data, [['checkout', 'payment_method_name']]),
    findFirstPresent(data, [['payments', 0, 'method']]),
    findFirstPresent(data, [['payments', 0, 'name']]),
    findFirstPresent(data, [['payments', 0, 'type']]),
    findFirstPresent(data, [['last_payment_method']]),
    findFirstPresent(data, [['payment_option']]),
    findFirstPresent(data, [['payment_channel']])
  ]
    .map((value) => asString(value))
    .filter(Boolean);

  const metadataCandidates = [
    ...flattenScalarValues(data.meta_data && data.meta_data.assigned_payment),
    ...flattenScalarValues(data.payment),
    ...flattenScalarValues(data.payments)
  ];

  const textCandidates = [...explicitCandidates, ...metadataCandidates, ...getAllPayloadTexts(data, payload)];

  const normalized = textCandidates
    .map((value) => value.toLowerCase())
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
  const priorityPaths = [
    ['meta_data', 'assigned_payment', 'tip_value'],
    ['meta_data', 'assigned_payment', 'tip'],
    ['assigned_payment', 'tip_value'],
    ['assigned_payment', 'tip'],
    ['payment', 'tip'],
    ['payment', 'tips'],
    ['payments', 0, 'tip'],
    ['payments', 0, 'tips']
  ];

  for (const path of priorityPaths) {
    const amount = toNumber(getNestedValue(data, path));
    if (amount > 0) return amount;
  }

  const payloadPriorityPaths = [
    ['meta_data', 'assigned_payment', 'tip_value'],
    ['meta_data', 'assigned_payment', 'tip'],
    ['data', 'meta_data', 'assigned_payment', 'tip_value'],
    ['data', 'meta_data', 'assigned_payment', 'tip'],
    ['datos', 'meta_data', 'assigned_payment', 'tip_value'],
    ['datos', 'meta_data', 'assigned_payment', 'tip']
  ];

  for (const path of payloadPriorityPaths) {
    const amount = toNumber(getNestedValue(payload, path));
    if (amount > 0) return amount;
  }

  const fallbackPaths = [
    ['total_tips'],
    ['tip'],
    ['tips']
  ];

  for (const path of fallbackPaths) {
    const amount = toNumber(getNestedValue(data, path));
    if (amount > 0) return amount;
  }

  const subtotal = toNumber(findFirstPresent(data, [['combos_price'], ['subtotal']]));
  const delivery = toNumber(findFirstPresent(data, [['delivery_price'], ['delivery_cost']]));
  const total = toNumber(findFirstPresent(data, [['total']]));
  const baseOrderTotal = subtotal + delivery || total;

  const paidAmountCandidates = [
    ['meta_data', 'assigned_payment', 'amount'],
    ['meta_data', 'assigned_payment', 'paid_amount'],
    ['meta_data', 'assigned_payment', 'total'],
    ['amount'],
    ['paid_amount'],
    ['total_paid'],
    ['payment', 'amount'],
    ['payment', 'total'],
    ['payment', 'paid_amount'],
    ['payments', 0, 'amount'],
    ['payments', 0, 'total'],
    ['payments', 0, 'paid_amount'],
    ['checkout', 'amount']
  ]
    .map((path) => toNumber(getNestedValue(data, path)))
    .filter((amount) => amount > 0);

  if (baseOrderTotal > 0 && paidAmountCandidates.length > 0) {
    const maxPaidAmount = Math.max(...paidAmountCandidates);
    const inferredTip = Number((maxPaidAmount - baseOrderTotal).toFixed(2));

    if (inferredTip > 0) {
      return inferredTip;
    }
  }

  const textCandidates = [
    ...flattenScalarValues(data.meta_data && data.meta_data.assigned_payment),
    ...flattenScalarValues(data.payment),
    ...flattenScalarValues(data.payments),
    ...getAllPayloadTexts(data, payload)
  ].filter(Boolean);

  for (const text of textCandidates) {
    const explicitPatterns = [
      /propina\s*[:+]?[\s$U]*\s*([0-9.,]+)/i,
      /tip\s*[:+]?[\s$U]*\s*([0-9.,]+)/i
    ];

    for (const pattern of explicitPatterns) {
      const match = text.match(pattern);
      if (!match) continue;

      const amount = toNumber(match[1]);
      if (amount > 0) {
        return amount;
      }
    }
  }

  return 0;
}

function detectRiderCancelled(data, payload, repartidor) {
  const statusTexts = [
    asString(data.rider_status),
    asString(data.status),
    asString(data.delivery_status),
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

function normalizeStatusText(value) {
  return asString(value).toLowerCase().trim();
}

function detectEnCaminoTimestamp(data, payload) {
  const candidateSources = [data, payload];
  const statusPaths = [
    ['delivery_status'],
    ['status'],
    ['order_status'],
    ['rider_status'],
    ['state'],
    ['event'],
    ['type'],
    ['action'],
    ['event_type'],
    ['topic'],
    ['meta_data', 'delivery_status'],
    ['meta_data', 'status'],
    ['meta_data', 'order_status']
  ];
  const timestampPaths = [
    ['delivery_status_updated_at'],
    ['status_updated_at'],
    ['updated_at'],
    ['meta_data', 'delivery_status_updated_at']
  ];

  const enCaminoStatuses = [
    'on_the_way',
    'on the way',
    'in_route',
    'in route',
    'picked_up',
    'picked up',
    'shipped',
    'en camino',
    'encamino'
  ];

  for (const source of candidateSources) {
    const status = statusPaths
      .map((path) => normalizeStatusText(getNestedValue(source, path)))
      .find((value) => value && enCaminoStatuses.some((keyword) => value.includes(keyword)));

    if (!status) continue;

    for (const path of timestampPaths) {
      const value = getNestedValue(source, path);
      if (hasValue(value)) return value;
    }

    return new Date().toISOString();
  }

  return '';
}

function detectFinalizadoTimestamp(data, payload) {
  const candidateSources = [data, payload];
  const statusPaths = [
    ['delivery_status'],
    ['status'],
    ['order_status'],
    ['rider_status'],
    ['state'],
    ['event'],
    ['type'],
    ['action'],
    ['event_type'],
    ['topic'],
    ['meta_data', 'delivery_status'],
    ['meta_data', 'status'],
    ['meta_data', 'order_status']
  ];
  const timestampPaths = [
    ['delivery_status_updated_at'],
    ['completed_at'],
    ['finished_at'],
    ['delivered_at'],
    ['closed_at'],
    ['status_updated_at'],
    ['updated_at'],
    ['meta_data', 'delivery_status_updated_at']
  ];

  const finalizadoStatuses = [
    'delivered',
    'completed',
    'complete',
    'finalized',
    'finalizado',
    'entregado',
    'closed',
    'done'
  ];

  for (const source of candidateSources) {
    const status = statusPaths
      .map((path) => normalizeStatusText(getNestedValue(source, path)))
      .find((value) => value && finalizadoStatuses.some((keyword) => value.includes(keyword)));

    if (!status) continue;

    for (const path of timestampPaths) {
      const value = getNestedValue(source, path);
      if (hasValue(value)) return value;
    }

    return new Date().toISOString();
  }

  return '';
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
  const subtotal = toNumber(findFirstPresent(data, [['combos_price'], ['subtotal']]));
  const delivery = toNumber(findFirstPresent(data, [['delivery_price'], ['delivery_cost']]));
  const total = toNumber(findFirstPresent(data, [['total']])) || subtotal + delivery;
  const paymentStatus = detectPaymentStatus(data);
  const paymentMethod = detectPaymentMethod(data, payload);
  const notas = buildNotas(data);

  const pedido = [cliente, productos].filter(Boolean).join(' - ') || asString(data.id) || asString(payload.event_id);
  const nroPedido = asString(findFirstPresent(data, [['public_id'], ['id']])) || asString(payload.event_id);
  const fecha = asString(findFirstPresent(data, [['created_at'], ['updated_at']])) || new Date().toISOString();
  const numeroPedidoInterno = asString(data.daily_id ?? '');
  const riderCancelled = detectRiderCancelled(data, payload, repartidor);

  const enviosLejanos = delivery;
  const propinaWeb = detectPropinaWeb(data, payload);
  const enCamino = detectEnCaminoTimestamp(data, payload);
  const finalizado = detectFinalizadoTimestamp(data, payload);
  const importe = toNumber(findFirstPresent(data, [
    ['amount'],
    ['meta_data', 'assigned_payment', 'amount'],
    ['total']
  ]));
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
    `Telefono: ${telefono}`,
    `Direccion: ${direccion}`,
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
    enCamino,
    finalizado,
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
