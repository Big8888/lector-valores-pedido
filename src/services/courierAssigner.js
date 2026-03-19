const sheetsConfig = require('../config/sheetsConfig');

const availableCouriers = Object.keys(sheetsConfig.riderSheets);

function normalizeName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function hashValue(value) {
  let hash = 0;
  const source = String(value || '');

  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function findCourierByHint(hint, rawText) {
  const combined = `${hint || ''} ${rawText || ''}`;
  const normalizedCombined = normalizeName(combined);

  return availableCouriers.find((courier) => normalizedCombined.includes(normalizeName(courier))) || null;
}

function assignCourier(order) {
  const hintedCourier = findCourierByHint(order.riderHint, order.rawText);
  const courier = hintedCourier || availableCouriers[hashValue(order.nroPedido || order.telefono || order.pedido) % availableCouriers.length];

  return {
    courier,
    sheetName: sheetsConfig.riderSheets[courier]
  };
}

module.exports = {
  assignCourier
};
