const fs = require('fs');
const { PDFParse } = require('pdf-parse');

const SPANISH_MONTHS = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  setiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11
};

function compactLines(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line !== '-- 1 of 1 --');
}

function parseMoney(value) {
  const normalized = String(value || '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');

  const amount = Number(normalized);
  if (!Number.isFinite(amount)) {
    return 0;
  }

  return Math.round(amount);
}

function parseStatus(rawStatus) {
  const normalized = String(rawStatus || '').trim().toUpperCase();

  if (normalized === 'PREPAGO' || normalized === 'PAID') {
    return 'PAGADO';
  }

  if (normalized === 'NOT PAID') {
    return 'NO PAGADO';
  }

  return normalized || '';
}

function inferPaymentMethod(rawMethod) {
  const normalized = String(rawMethod || '').trim().toLowerCase();

  if (!normalized) {
    return 'no_especificado';
  }

  if (normalized.includes('efectivo') || normalized.includes('cash')) {
    return 'efectivo';
  }

  if (normalized.includes('transfer')) {
    return 'transferencia';
  }

  return 'tarjeta';
}

function inferSalesChannel(lines) {
  const text = lines.join(' ').toUpperCase();

  if (text.includes('DELIVERY')) {
    return 'Domicilio';
  }

  if (text.includes('PICK UP') || text.includes('PICKUP AT') || text.includes('LOCAL')) {
    return 'Local';
  }

  return '';
}

function parseDateTime(dateText, timeText) {
  const dateMatch = String(dateText || '')
    .trim()
    .toLowerCase()
    .match(/^(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+de\s+(\d{4})$/i);

  if (!dateMatch) {
    return '';
  }

  const day = Number(dateMatch[1]);
  const month = SPANISH_MONTHS[dateMatch[2].normalize('NFD').replace(/[\u0300-\u036f]/g, '')];
  const year = Number(dateMatch[3]);

  if (!Number.isInteger(day) || !Number.isInteger(year) || month === undefined) {
    return '';
  }

  const timeMatch = String(timeText || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  const hours = timeMatch ? Number(timeMatch[1]) : 0;
  const minutes = timeMatch ? Number(timeMatch[2]) : 0;

  const local = new Date(year, month, day, hours, minutes, 0, 0);
  return Number.isNaN(local.getTime()) ? '' : local.toISOString();
}

function extractFieldBlock(lines, startIndex, endIndex) {
  if (startIndex < 0 || endIndex < 0 || endIndex <= startIndex) {
    return [];
  }

  return lines.slice(startIndex, endIndex);
}

function normalizeCustomerBlock(block) {
  if (!block.length) {
    return '';
  }

  const firstLine = block[0].replace(/^#\d+\s*/, '').trim();
  const rest = block.slice(1).map((line) => line.trim()).filter(Boolean);
  return [firstLine, ...rest].filter(Boolean).join(' | ');
}

function extractInlineValue(lines, label) {
  const index = lines.findIndex((line) => line.toUpperCase().startsWith(label.toUpperCase()));
  if (index < 0) {
    return '';
  }

  const line = lines[index];
  const separatorIndex = line.indexOf(':');

  if (separatorIndex >= 0) {
    const inlineValue = line.slice(separatorIndex + 1).trim();
    if (inlineValue) {
      return inlineValue;
    }
  }

  return lines[index + 1] ? lines[index + 1].trim() : '';
}

async function extractPdfText(filePath) {
  const parser = new PDFParse({
    data: fs.readFileSync(filePath)
  });

  try {
    const result = await parser.getText();
    return result.text || '';
  } finally {
    await parser.destroy();
  }
}

async function parsePedidosYaPdf(filePath) {
  const rawText = await extractPdfText(filePath);
  const lines = compactLines(rawText);

  if (!lines.length) {
    throw new Error('El PDF no contiene texto util.');
  }

  const pickupAtIndex = lines.findIndex((line) => line.toUpperCase() === 'PICKUP AT');
  const rawPickupTime = pickupAtIndex >= 0 ? (lines[pickupAtIndex + 1] || '') : '';

  const statusIndex = lines.findIndex((line) => ['PREPAGO', 'NOT PAID', 'PAID'].includes(line.toUpperCase()));
  const rawStatus = statusIndex >= 0 ? lines[statusIndex] : '';

  const paymentMethodIndex = lines.findIndex((line) => line.toUpperCase().startsWith('MEDIO DE PAGO'));
  const totalIndex = lines.reduce((lastIndex, line, index) => (
    /^Total \$\s*/i.test(line) ? index : lastIndex
  ), -1);
  const orderLabelIndex = lines.findIndex((line) => line.toUpperCase() === 'NRO. ORDEN::');
  const storeNameIndex = lines.findIndex((line) => line.toUpperCase() === 'BIG OTTO');

  const customerBlock = extractFieldBlock(lines, statusIndex + 1, paymentMethodIndex);
  const customerInfo = normalizeCustomerBlock(customerBlock);
  const rawPaymentMethod = extractInlineValue(lines, 'Medio de pago');
  const totalRaw = totalIndex >= 0 ? lines[totalIndex].replace(/^Total \$\s*/i, '').trim() : '';
  const dateLine = totalIndex >= 0 ? (lines[totalIndex + 1] || '') : '';
  const orderNumber = orderLabelIndex >= 0 ? (lines[orderLabelIndex + 1] || '').trim() : '';

  let shortCode = '';
  const shortCodeSource = customerBlock[0] || '';
  const shortCodeMatch = shortCodeSource.match(/^#(\d+)/);
  if (shortCodeMatch) {
    shortCode = shortCodeMatch[1];
  }

  const storePhone = storeNameIndex >= 0 ? (lines[storeNameIndex + 3] || '').trim() : '';
  const paymentMethod = inferPaymentMethod(rawPaymentMethod);
  const salesChannel = inferSalesChannel(lines);
  const total = parseMoney(totalRaw);
  const isoFecha = parseDateTime(dateLine, rawPickupTime);
  const status = parseStatus(rawStatus);

  if (!shortCode) {
    throw new Error('No se pudo detectar el numero corto del pedido (#1234).');
  }

  if (!orderNumber) {
    throw new Error('No se pudo detectar el Nro. Orden del PDF.');
  }

  if (!total) {
    throw new Error('No se pudo detectar el total del pedido.');
  }

  const tarjeta = paymentMethod === 'tarjeta' ? total : 0;
  const efectivo = paymentMethod === 'efectivo' ? total : 0;
  const transferencia = paymentMethod === 'transferencia' ? total : 0;

  return {
    rawText,
    numeroPedidoInterno: shortCode,
    nroPedido: orderNumber,
    paymentStatus: status,
    paymentMethod,
    hasExplicitPaymentAmounts: true,
    explicitPaymentsAreCurrentSnapshot: true,
    total,
    tarjeta,
    efectivo,
    transferencia,
    pedidoListo: isoFecha,
    estadoPedido: salesChannel,
    notas: '',
    telefono: '',
    fecha: isoFecha || dateLine
  };
}

module.exports = {
  parsePedidosYaPdf
};
