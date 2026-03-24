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

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function getSource(payload = {}) {
  return payload?.datos || payload?.data || payload?.order || payload;
}

function extractTextFromPayload(payload, source) {
  const candidates = [
    payload?.mensaje,
    payload?.message,
    payload?.text,
    payload?.notes,
    payload?.description,
    payload?.observaciones,
    payload?.comments,

    source?.notes,
    source?.note,
    source?.description,
    source?.observaciones,
    source?.comments,
    source?.instructions,
    source?.special_instructions,
    source?.customer_notes,
    source?.delivery_notes
  ].filter(Boolean);

  return candidates.join(' | ');
}

function extractItems(source) {
  const rawItems = [
    ...safeArray(source?.items),
    ...safeArray(source?.products),
    ...safeArray(source?.productos),
    ...safeArray(source?.details),
    ...safeArray(source?.detalle),
    ...safeArray(source?.order_items),
    ...safeArray(source?.line_items)
  ];

  return rawItems.map((item, index) => {
    const nombre = pickFirst(
      item?.name,
      item?.nombre,
      item?.productName,
      item?.product_name,
      item?.title,
      item?.descripcion,
      `ITEM_${index + 1}`
    );

    const cantidad = pickFirst(
      toNumber(item?.quantity),
      toNumber(item?.cantidad),
      toNumber(item?.qty),
      1
    );

    const notas = pickFirst(
      item?.notes,
      item?.note,
      item?.observaciones,
      item?.comments,
      item?.instructions,
      ''
    );

    const reemplazo = pickFirst(
      item?.replacement,
      item?.reemplazo,
      item?.substitution,
      ''
    );

    return {
      nombre: String(nombre),
      cantidad: cantidad || 1,
      notas: notas ? String(notas) : '',
      reemplazo: reemplazo ? String(reemplazo) : ''
    };
  });
}

function buildItemsText(items) {
  if (!items.length) return '';

  return items
    .map((item) => {
      const extras = [];

      if (item.notas) extras.push(`notas: ${item.notas}`);
      if (item.reemplazo) extras.push(`reemplazo: ${item.reemplazo}`);

      return extras.length
        ? `${item.cantidad}x ${item.nombre} (${extras.join(' | ')})`
        : `${item.cantidad}x ${item.nombre}`;
    })
    .join(' ; ');
}

function detectFlags(rawText, items) {
  const text = `${rawText} ${buildItemsText(items)}`.toLowerCase();

  return {
    hasReplacement:
      text.includes('reemplazo') ||
      text.includes('sin ') ||
      text.includes('cambiar') ||
      items.some((item) => item.reemplazo),
    hasNotes:
      text.includes('nota') ||
      text.includes('observ') ||
      items.some((item) => item.notas),
    hasFries:
      text.includes('papas') ||
      text.includes('fritas'),
    hasMeat:
      text.includes('medallon') ||
      text.includes('medallón') ||
      text.includes('carne') ||
      text.includes('burger') ||
      text.includes('hamburguesa')
  };
}

function countKeywordUnits(items, keywords) {
  return items.reduce((total, item) => {
    const name = item.nombre.toLowerCase();
    const matched = keywords.some((keyword) => name.includes(keyword));
    return matched ? total + (item.cantidad || 0) : total;
  }, 0);
}

function interpretOrder(payload = {}) {
  const source = getSource(payload);

  const orderId = pickFirst(
    source?.pedido,
    source?.pedido_id,
    source?.pedidoId,
    source?.order_id,
    source?.orderId,
    source?.id,
    source?.number,
    source?.order_number,
    source?.codigo,
    source?.code
  );

  const total = pickFirst(
    toNumber(source?.total),
    toNumber(source?.amount),
    toNumber(source?.subtotal),
    toNumber(source?.total_amount),
    toNumber(source?.order_total),
    toNumber(source?.importe_total)
  );

  const customerName = pickFirst(
    source?.cliente,
    source?.customer,
    source?.customer_name,
    source?.customerName,
    source?.nombre_cliente,
    source?.name,
    source?.full_name,
    source?.client_name
  );

  const customerPhone = pickFirst(
    source?.telefono,
    source?.phone,
    source?.customer_phone,
    source?.customerPhone,
    source?.telefono_cliente,
    source?.mobile,
    source?.celular
  );

  const rawText = extractTextFromPayload(payload, source);
  const items = extractItems(source);
  const itemsText = buildItemsText(items);
  const flags = detectFlags(rawText, items);

  const papasCount = countKeywordUnits(items, ['papas', 'fritas']);
  const meatCount = countKeywordUnits(items, ['burger', 'hamburguesa', 'medallon', 'medallón', 'carne']);

  return {
    pedido: orderId,
    total,
    cliente: customerName,
    telefono: customerPhone,
    rawText,
    items,
    itemsText,
    flags,
    kitchenCounts: {
      papas: papasCount,
      medallones: meatCount
    },
    originalPayload: payload
  };
}

module.exports = {
  interpretOrder
};
