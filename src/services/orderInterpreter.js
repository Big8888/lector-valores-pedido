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
  if (status === 'PARTIAL' || status === 'PARTIALLY_PAID') return 'PARCIAL';

  return status;
}

function normalizePaymentMethodText(value) {
  const normalized = asString(value).toLowerCase();

  if (!normalized) return '';
  if (normalized.includes('transf')) return 'transferencia';
  if (normalized.includes('efect')) return 'efectivo';
  if (normalized.includes('cash')) return 'efectivo';
  if (normalized.includes('card')) return 'tarjeta';
  if (normalized.includes('tarjeta')) return 'tarjeta';
  if (normalized.includes('debito')) return 'tarjeta';
  if (normalized.includes('credito')) return 'tarjeta';

  return '';
}

function normalizeServiceTypeText(value) {
  const normalized = asString(value)
    .toLowerCase()
    .replace(/[_-]/g, ' ')
    .trim();

  if (!normalized) return '';

  if (
    normalized.includes('delivery') ||
    normalized.includes('envio') ||
    normalized.includes('domicilio')
  ) {
    return 'delivery';
  }

  if (
    normalized.includes('pickup') ||
    normalized.includes('pick up') ||
    normalized.includes('take away') ||
    normalized.includes('takeaway') ||
    normalized.includes('take out') ||
    normalized.includes('takeout') ||
    normalized.includes('retiro') ||
    normalized.includes('retirar') ||
    normalized.includes('para retirar')
  ) {
    return 'pickup';
  }

  if (
    normalized.includes('dine in') ||
    normalized.includes('dinein') ||
    normalized.includes('on premise') ||
    normalized.includes('on premises') ||
    normalized.includes('in store') ||
    normalized.includes('en el local') ||
    normalized === 'local' ||
    normalized.includes('salon') ||
    normalized.includes('salón')
  ) {
    return 'local';
  }

  return '';
}

function prioritizeServiceTypes(types) {
  const normalizedTypes = Array.from(new Set((types || []).filter(Boolean)));

  if (normalizedTypes.includes('pickup')) return 'pickup';
  if (normalizedTypes.includes('local')) return 'local';
  if (normalizedTypes.includes('delivery')) return 'delivery';
  return '';
}

function detectServiceType(data, payload) {
  const candidatePaths = [
    ['service_type'],
    ['serviceType'],
    ['service'],
    ['service_name'],
    ['service_mode'],
    ['order_type'],
    ['orderType'],
    ['order_mode'],
    ['meta_data', 'service_type'],
    ['meta_data', 'service'],
    ['meta_data', 'order_type'],
    ['meta_data', 'service_name'],
    ['meta_data', 'service_mode'],
    ['order_fulfillment_type'],
    ['fulfillment_type'],
    ['fulfillment'],
    ['channel'],
    ['sales_channel']
  ];
  const directMatches = [];

  for (const path of candidatePaths) {
    const normalized = normalizeServiceTypeText(getNestedValue(data, path));
    if (normalized) directMatches.push(normalized);
  }

  if (payload !== data) {
    for (const path of candidatePaths) {
      const normalized = normalizeServiceTypeText(getNestedValue(payload, path));
      if (normalized) directMatches.push(normalized);
    }
  }

  const directWinner = prioritizeServiceTypes(directMatches);
  if (directWinner) return directWinner;

  const flattenedTexts = getAllPayloadTexts(data, payload);
  const textMatches = [];
  for (const text of flattenedTexts) {
    const normalized = normalizeServiceTypeText(text);
    if (normalized) textMatches.push(normalized);
  }

  const textWinner = prioritizeServiceTypes(textMatches);
  if (textWinner) return textWinner;

  const hasDeliveryStatus = hasValue(data.delivery_status) || hasValue(payload && payload.delivery_status);
  const hasRider = hasValue(data.rider && data.rider.name) || hasValue(payload && payload.rider && payload.rider.name);
  const hasAddress = hasValue(data.address && data.address.address) || hasValue(data.address && data.address.street);

  if (hasDeliveryStatus || hasRider || hasAddress) {
    return 'delivery';
  }

  return 'local';
}

function formatServiceLabel(serviceType) {
  if (serviceType === 'pickup') return 'PARA RETIRAR';
  if (serviceType === 'local') return 'EN EL LOCAL';
  return 'DELIVERY';
}

function collectPaymentEntries(data, payload) {
  const dataPaymentArrays = [
    data.payments,
    data.payment_splits,
    data.split_payments,
    data.meta_data && data.meta_data.payments,
    data.meta_data && data.meta_data.split_payments
  ].filter(Array.isArray);

  const payloadPaymentArrays = payload !== data ? [
    payload.payments,
    payload.payment_splits,
    payload.split_payments
  ].filter(Array.isArray) : [];

  const arrayEntries = [...dataPaymentArrays, ...payloadPaymentArrays].flat();
  if (arrayEntries.length > 0) {
    return arrayEntries.filter((entry) => entry && typeof entry === 'object');
  }

  const singularEntries = [
    data.payment,
    data.meta_data && data.meta_data.assigned_payment,
    payload !== data ? payload.payment : null
  ].filter((entry) => entry && typeof entry === 'object');

  return singularEntries;
}

function getPaymentEntryMethod(entry) {
  const methodPaths = [
    ['payment_method'],
    ['payment_method_name'],
    ['method'],
    ['name'],
    ['type'],
    ['payment_type'],
    ['payment_channel']
  ];

  for (const path of methodPaths) {
    const method = normalizePaymentMethodText(getNestedValue(entry, path));
    if (method) return method;
  }

  const flattenedValues = flattenScalarValues(entry);
  for (const value of flattenedValues) {
    const method = normalizePaymentMethodText(value);
    if (method) return method;
  }

  return '';
}

function isCanceledPaymentEntry(entry) {
  if (!entry || typeof entry !== 'object') return false;

  const statusPaths = [
    ['status'],
    ['payment_status'],
    ['state'],
    ['status_name'],
    ['cancellation_status']
  ];

  for (const path of statusPaths) {
    const value = asString(getNestedValue(entry, path)).toLowerCase();
    if (!value) continue;

    if (
      value.includes('anulad') ||
      value.includes('cancel') ||
      value.includes('annul') ||
      value.includes('void') ||
      value.includes('revers')
    ) {
      return true;
    }
  }

  const cancellationMarkers = [
    ['canceled_at'],
    ['cancelled_at'],
    ['annulled_at'],
    ['voided_at'],
    ['deleted_at']
  ];

  return cancellationMarkers.some((path) => hasValue(getNestedValue(entry, path)));
}

function getPaymentEntryAmount(entry, method = '') {
  const billAmount = toNumber(getNestedValue(entry, ['bill_amount']));
  const receivedAmount = toNumber(getNestedValue(entry, ['received_amount']));
  const paidAmount = toNumber(getNestedValue(entry, ['paid_amount']));
  const directAmount = toNumber(getNestedValue(entry, ['amount']));
  const totalAmount = toNumber(getNestedValue(entry, ['total']));
  const valueAmount = toNumber(getNestedValue(entry, ['value']));
  const priceAmount = toNumber(getNestedValue(entry, ['price']));

  if (method === 'efectivo') {
    if (billAmount > 0) return billAmount;
    if (paidAmount > 0) return paidAmount;
    if (receivedAmount > 0) return receivedAmount;
  }

  const amountCandidates = [
    directAmount,
    paidAmount,
    billAmount,
    receivedAmount,
    totalAmount,
    valueAmount,
    priceAmount
  ];

  return amountCandidates.find((amount) => amount > 0) || 0;
}

function findPaymentAmountFromText(data, payload) {
  const textCandidates = [
    ...flattenScalarValues(data.payment),
    ...flattenScalarValues(data.payments),
    ...flattenScalarValues(data.meta_data && data.meta_data.assigned_payment),
    ...getAllPayloadTexts(data, payload)
  ];

  const paymentPattern = /(?:tarjeta|efectivo|cash|transferencia|transfer|card)[^0-9]{0,20}([0-9]+(?:[.,][0-9]+)?)/i;

  for (const text of textCandidates) {
    const match = asString(text).match(paymentPattern);
    if (!match) continue;

    const amount = toNumber(match[1]);
    if (amount > 0) return amount;
  }

  return 0;
}

function detectPaymentBreakdown(data, payload, paymentStatus) {
  const breakdown = {
    tarjeta: 0,
    efectivo: 0,
    transferencia: 0,
    hasExplicitAmounts: false,
    detectedMethods: [],
    explicitAmountTotal: 0
  };

  const entries = collectPaymentEntries(data, payload);

  for (const entry of entries) {
    if (isCanceledPaymentEntry(entry)) continue;

    const method = getPaymentEntryMethod(entry);
    const amount = getPaymentEntryAmount(entry, method);

    if (!method || amount <= 0) continue;

    breakdown[method] += amount;
    breakdown.explicitAmountTotal += amount;
    breakdown.hasExplicitAmounts = true;

    if (!breakdown.detectedMethods.includes(method)) {
      breakdown.detectedMethods.push(method);
    }
  }

  if (breakdown.hasExplicitAmounts) {
    return breakdown;
  }

  if (entries.length > 0) {
    return breakdown;
  }

  const fallbackMethod = detectPaymentMethod(data, payload);
  const isPaidEvent = ['PAGADO', 'PARCIAL', 'PARTIAL', 'PAID', 'PARTIALLY_PAID'].includes(asString(paymentStatus).toUpperCase());

  if (!fallbackMethod || fallbackMethod === 'no_especificado' || !isPaidEvent) {
    return breakdown;
  }

  const fallbackAmount = [
    ['meta_data', 'assigned_payment', 'amount'],
    ['meta_data', 'assigned_payment', 'value'],
    ['payment', 'amount'],
    ['payment', 'value'],
    ['payments', 0, 'amount'],
    ['payments', 0, 'value'],
    ['amount']
  ]
    .map((path) => toNumber(getNestedValue(data, path)))
    .find((amount) => amount > 0) || findPaymentAmountFromText(data, payload);

  if (fallbackAmount > 0) {
    breakdown[fallbackMethod] = fallbackAmount;
    breakdown.hasExplicitAmounts = true;
    breakdown.detectedMethods.push(fallbackMethod);
  }

  return breakdown;
}

function detectPaymentMethod(data, payload) {
  const paymentEntries = collectPaymentEntries(data, payload);
  if (paymentEntries.length > 0) {
    const activeEntries = paymentEntries.filter((entry) => !isCanceledPaymentEntry(entry));

    for (const entry of activeEntries) {
      const method = getPaymentEntryMethod(entry);
      if (method) return method;
    }

    if (activeEntries.length === 0) {
      return 'no_especificado';
    }
  }

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
    .map((value) => normalizePaymentMethodText(value))
    .find(Boolean) || '';

  if (!normalized) {
    return 'no_especificado';
  }

  return normalized;
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
    ['picked_up_at'],
    ['on_the_way_at'],
    ['status_updated_at'],
    ['updated_at'],
    ['meta_data', 'delivery_status_updated_at'],
    ['meta_data', 'status_updated_at'],
    ['meta_data', 'updated_at']
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

function detectPedidoListoTimestamp(data, payload) {
  const candidateSources = [data, payload];
  const directTimestampPaths = [
    ['ready_at'],
    ['ready_for_pickup_at'],
    ['ready_to_pickup_at'],
    ['prepared_at'],
    ['preparation_completed_at'],
    ['meta_data', 'ready_at'],
    ['meta_data', 'ready_for_pickup_at'],
    ['meta_data', 'prepared_at']
  ];
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
  const fallbackTimestampPaths = [
    ['status_updated_at'],
    ['updated_at'],
    ['delivery_status_updated_at'],
    ['meta_data', 'status_updated_at'],
    ['meta_data', 'updated_at'],
    ['meta_data', 'delivery_status_updated_at']
  ];

  for (const source of candidateSources) {
    for (const path of directTimestampPaths) {
      const value = getNestedValue(source, path);
      if (hasValue(value)) return value;
    }
  }

  const listoStatuses = [
    'ready',
    'ready for pickup',
    'ready_for_pickup',
    'ready to pickup',
    'ready_to_pickup',
    'listo'
  ];

  for (const source of candidateSources) {
    const status = statusPaths
      .map((path) => normalizeStatusText(getNestedValue(source, path)))
      .find((value) => value && listoStatuses.some((keyword) => value.includes(keyword)));

    if (!status) continue;

    for (const path of fallbackTimestampPaths) {
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
    ['fulfilled_at'],
    ['served_at'],
    ['closed_at'],
    ['status_updated_at'],
    ['updated_at'],
    ['meta_data', 'delivery_status_updated_at'],
    ['meta_data', 'completed_at'],
    ['meta_data', 'finished_at'],
    ['meta_data', 'delivered_at'],
    ['meta_data', 'fulfilled_at'],
    ['meta_data', 'served_at'],
    ['meta_data', 'closed_at']
  ];

  const finalizadoStatuses = [
    'completed',
    'complete',
    'finalized',
    'finalizado',
    'finished',
    'finish',
    'delivered',
    'deliver',
    'entregado',
    'fulfilled',
    'serve',
    'served',
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
  const reportedTotalPaid = toNumber(findFirstPresent(data, [
    ['total_paid'],
    ['paid_amount'],
    ['payment', 'paid_amount'],
    ['payment', 'amount']
  ]));
  const paymentStatus = detectPaymentStatus(data);
  const paymentBreakdown = detectPaymentBreakdown(data, payload, paymentStatus);
  const paymentMethod = paymentBreakdown.detectedMethods.length > 1
    ? 'multiple'
    : paymentBreakdown.detectedMethods[0] || detectPaymentMethod(data, payload);
  const notas = buildNotas(data);

  const pedido = [cliente, productos].filter(Boolean).join(' - ') || asString(data.id) || asString(payload.event_id);
  const nroPedido = asString(findFirstPresent(data, [['public_id'], ['id']])) || asString(payload.event_id);
  const fecha = asString(findFirstPresent(data, [['created_at'], ['updated_at']])) || new Date().toISOString();
  const numeroPedidoInterno = asString(data.daily_id ?? '');
  const riderCancelled = detectRiderCancelled(data, payload, repartidor);
  const serviceType = detectServiceType(data, payload);
  const serviceLabel = formatServiceLabel(serviceType);

  const enviosLejanos = delivery;
  const propinaWeb = detectPropinaWeb(data, payload);
  const enCamino = detectEnCaminoTimestamp(data, payload);
  const pedidoListo = detectPedidoListoTimestamp(data, payload);
  const finalizado = detectFinalizadoTimestamp(data, payload);
  const importe = toNumber(findFirstPresent(data, [
    ['amount'],
    ['meta_data', 'assigned_payment', 'amount'],
    ['total']
  ]));
  const isPartialPayment = ['PARCIAL', 'PARTIAL', 'PARTIALLY_PAID'].includes(asString(paymentStatus).toUpperCase());
  const explicitPaymentsAreCurrentSnapshot =
    paymentBreakdown.hasExplicitAmounts &&
    reportedTotalPaid > 0 &&
    Math.abs(paymentBreakdown.explicitAmountTotal - reportedTotalPaid) < 0.01;
  const canApplyFullTotalToSingleMethod =
    !paymentBreakdown.hasExplicitAmounts &&
    !isPartialPayment &&
    paymentMethod !== 'no_especificado' &&
    paymentMethod !== 'multiple';
  const totalSinMetodo = paymentBreakdown.hasExplicitAmounts || canApplyFullTotalToSingleMethod ? 0 : total;
  const tarjeta = paymentBreakdown.hasExplicitAmounts ? paymentBreakdown.tarjeta : canApplyFullTotalToSingleMethod && paymentMethod === 'tarjeta' ? total : 0;
  const efectivo = paymentBreakdown.hasExplicitAmounts ? paymentBreakdown.efectivo : canApplyFullTotalToSingleMethod && paymentMethod === 'efectivo' ? total : 0;
  const transferencia = paymentBreakdown.hasExplicitAmounts ? paymentBreakdown.transferencia : canApplyFullTotalToSingleMethod && paymentMethod === 'transferencia' ? total : 0;
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
    serviceType,
    serviceLabel,
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
    pedidoListo,
    finalizado,
    paymentMethod,
    hasExplicitPaymentAmounts: paymentBreakdown.hasExplicitAmounts,
    explicitPaymentTotal: paymentBreakdown.explicitAmountTotal,
    reportedTotalPaid,
    explicitPaymentsAreCurrentSnapshot,
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
