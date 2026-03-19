function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;

  const normalized = String(value)
    .replace(/\$/g, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');

  const number = Number(normalized);
  return Number.isNaN(number) ? null : number;
}

function pickFirst(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return null;
}

function extractTextFromPayload(payload) {
  const candidates = [
    payload?.mensaje,
    payload?.message,
    payload?.text,
    payload?.notes,
    payload?.description,
    payload?.order?.notes,
    payload?.order?.description,
    payload?.pedido?.observaciones
  ].filter(Boolean);

  return candidates.join(' | ');
}

function interpretOrder(payload = {}) {
  const orderId = pickFirst(
    payload?.pedido,
    payload?.pedidoId,
    payload?.orderId,
    payload?.id,
    payload?.order?.id,
    payload?.order?.number
  );

  const total = pickFirst(
    toNumber(payload?.total),
    toNumber(payload?.order?.total),
    toNumber(payload?.amount),
    toNumber(payload?.subtotal)
  );

  const customerName = pickFirst(
    payload?.cliente,
    payload?.customerName,
    payload?.customer?.name,
    payload?.order?.customer?.name
  );

  const customerPhone = pickFirst(
    payload?.telefono,
    payload?.phone,
    payload?.customerPhone,
    payload?.customer?.phone,
    payload?.order?.customer?.phone
  );

  const rawText = extractTextFromPayload(payload);

  return {
    pedido: orderId,
    total,
    cliente: customerName,
    telefono: customerPhone,
    rawText,
    originalPayload: payload
  };
}

module.exports = {
  interpretOrder
};