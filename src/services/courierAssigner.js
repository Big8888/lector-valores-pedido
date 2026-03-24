const sheetsConfig = require('../config/sheetsConfig');

const riderSheets = sheetsConfig && sheetsConfig.riderSheets ? sheetsConfig.riderSheets : {};
const availableCouriers = Object.keys(riderSheets);

function normalizeName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function resolveCourierName(order = {}) {
  const candidates = [
    order.repartidor,
    order.riderHint,
    order.orderData && order.orderData.rider && order.orderData.rider.name,
    order.originalPayload && order.originalPayload.data && order.originalPayload.data.rider && order.originalPayload.data.rider.name,
    order.originalPayload && order.originalPayload.datos && order.originalPayload.datos.rider && order.originalPayload.datos.rider.name
  ];

  for (const candidate of candidates) {
    if (candidate && String(candidate).trim()) {
      return String(candidate).trim();
    }
  }

  return '';
}

function assignCourier(order = {}) {
  const riderName = resolveCourierName(order);
  const normalizedRider = normalizeName(riderName);

  for (const courier of availableCouriers) {
    if (normalizeName(courier) === normalizedRider) {
      return {
        courier,
        sheetName: riderSheets[courier]
      };
    }
  }

  return {
    courier: 'GIAN',
    sheetName: riderSheets.GIAN || 'GIAN'
  };
}

module.exports = {
  assignCourier
};
