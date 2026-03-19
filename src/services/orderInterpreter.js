function asString(value) {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return '';
}

function extractText(payload) {
  const candidates = [
    payload.text,
    payload.message,
    payload.orderText,
    payload.body,
    payload.content,
    payload.description,
    payload.order && payload.order.text,
    payload.data && payload.data.text,
    payload.data && payload.data.message
  ];

  for (const candidate of candidates) {
    const text = asString(candidate);
    if (text) {
      return text;
    }
  }

  return '';
}

function extractNumber(text, pattern) {
  const match = text.match(pattern);
  return match ? match[1].trim() : '';
}

function normalizeMoney(value) {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  if (typeof value === 'number') {
    return value.toFixed(2).replace('.', ',');
  }

  const sanitized = String(value).replace(/[^\d.,-]/g, '').trim();
  if (!sanitized) {
    return '';
  }

  const normalized = sanitized.includes(',')
    ? sanitized.replace(/\./g, '').replace(',', '.')
    : sanitized;

  const parsed = Number(normalized);
  if (Number.isNaN(parsed)) {
    return sanitized;
  }

  return parsed.toFixed(2).replace('.', ',');
}

function detectPaymentMethod(payload, rawText) {
  const explicit = asString(payload.paymentMethod || payload.metodoPago || payload.payment);
  if (explicit) {
    return explicit.toLowerCase();
  }

  const lower = rawText.toLowerCase();
  if (lower.includes('transferencia')) {
    return 'transferencia';
  }

  if (lower.includes('tarjeta') || lower.includes('debito') || lower.includes('credito')) {
    return 'tarjeta';
  }

  if (lower.includes('efectivo') || lower.includes('cash')) {
    return 'efectivo';
  }

  return 'efectivo';
}

function detectBoolean(payloadValue, rawText, keywords) {
  if (typeof payloadValue === 'boolean') {
    return payloadValue;
  }

  const value = asString(payloadValue).toLowerCase();
  if (value) {
    return ['si', 'true', '1', 'yes'].includes(value);
  }

  return keywords.some((keyword) => rawText.toLowerCase().includes(keyword));
}

function buildPedido(rawText, payload) {
  const explicit = asString(payload.pedido || payload.orderName || payload.customerName);
  if (explicit) {
    return explicit;
  }

  const compact = rawText.replace(/\s+/g, ' ').trim();
  return compact.slice(0, 120);
}

function interpretOrder(payload = {}) {
  const rawText = extractText(payload);
  const nroPedido = asString(payload.nroPedido || payload.orderNumber || payload.id) || extractNumber(rawText, /(?:pedido|orden|order)\s*#?\s*([A-Z0-9-]+)/i);
  const telefono = asString(payload.telefono || payload.phone || payload.customerPhone) || extractNumber(rawText, /(?:telefono|cel|whatsapp|phone)\s*:?\s*([\d+\s-]{8,})/i);
  const importe = normalizeMoney(payload.importe || payload.total || payload.amount || extractNumber(rawText, /(?:total|importe|monto)\s*:?\s*\$?\s*([\d.,]+)/i));
  const propinaWeb = normalizeMoney(payload.propinaWeb || payload.tip || extractNumber(rawText, /(?:propina)\s*:?\s*\$?\s*([\d.,]+)/i));
  const paymentMethod = detectPaymentMethod(payload, rawText);
  const pedido = buildPedido(rawText, payload);
  const fecha = payload.fecha || payload.createdAt || payload.timestamp || new Date().toISOString();
  const anotaciones = asString(payload.anotaciones || payload.notes || payload.observaciones);
  const riderHint = asString(payload.repartidor || payload.courier || payload.rider);
  const enviosLejanos = detectBoolean(payload.enviosLejanos || payload.farDelivery, rawText, ['envio lejano', 'lejano']);
  const transferencia = paymentMethod === 'transferencia' ? importe : '';
  const tarjeta = paymentMethod === 'tarjeta' ? importe : '';
  const efectivo = paymentMethod === 'efectivo' ? importe : '';

  return {
    pedido,
    nroPedido,
    telefono,
    importe,
    paymentMethod,
    transferencia,
    tarjeta,
    efectivo,
    enviosLejanos,
    propinaWeb,
    anotaciones,
    fecha,
    riderHint,
    rawText,
    originalPayload: payload
  };
}

module.exports = {
  interpretOrder
};
