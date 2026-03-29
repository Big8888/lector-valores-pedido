const { google } = require('googleapis');
const path = require('path');
const sheetsConfig = require('../config/sheetsConfig');

let sheetsClientPromise = null;

function getGoogleAuth() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);

      if (!credentials.client_email || !credentials.private_key) {
        throw new Error('Faltan client_email o private_key.');
      }

      return new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });
    } catch (error) {
      console.error('[GOOGLE AUTH] GOOGLE_SERVICE_ACCOUNT_JSON invalido:', error.message);
      throw new Error('La variable GOOGLE_SERVICE_ACCOUNT_JSON no contiene un JSON valido de service account.');
    }
  }

  return new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, '../../credentials/google-service-account.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
}

async function getSheetsClient() {
  if (!sheetsClientPromise) {
    sheetsClientPromise = (async () => {
      const auth = getGoogleAuth();
      const client = await auth.getClient();

      return google.sheets({
        version: 'v4',
        auth: client
      });
    })().catch((error) => {
      sheetsClientPromise = null;
      throw error;
    });
  }

  return sheetsClientPromise;
}

function getUniqueSheetNames() {
  return [
    ...new Set([
      ...Object.values(sheetsConfig.riderSheets || {}),
      ...Object.keys(sheetsConfig.sheetProfiles || {})
    ])
  ];
}

function getRiderSheetNames() {
  return [...new Set(Object.values(sheetsConfig.riderSheets || {}))];
}

function getSheetProfile(sheetName) {
  const profile = sheetsConfig.sheetProfiles && sheetsConfig.sheetProfiles[sheetName]
    ? sheetsConfig.sheetProfiles[sheetName]
    : null;

  return {
    dataStartRow: profile && profile.dataStartRow ? profile.dataStartRow : sheetsConfig.dataStartRow,
    sheetBounds: profile && profile.sheetBounds ? profile.sheetBounds : sheetsConfig.sheetBounds,
    columns: profile && profile.columns ? profile.columns : sheetsConfig.columns
  };
}

function normalizeCell(value) {
  return String(value || '').trim().replace(/^'/, '');
}

function normalizePhone(value) {
  return String(value || '').replace(/[^\d+]/g, '').trim();
}

function toNumber(value) {
  const normalized = normalizeCell(value).replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getManagedColumns() {
  return Object.values(sheetsConfig.columns).filter(Boolean);
}

function getManagedColumnsForSheet(sheetName) {
  const profile = getSheetProfile(sheetName);
  return Object.values(profile.columns).filter(Boolean);
}

function getColumnRange(sheetName, column, startRow) {
  return `${sheetName}!${column}${startRow}:${column}`;
}

function buildDayKey(value) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const normalizedText = normalizeCell(value);
    const match = normalizedText.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (match) {
      return `${match[3]}-${match[2]}-${match[1]}`;
    }

    return '';
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: sheetsConfig.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  return formatter.format(date);
}

function parseSheetDayKey(value) {
  const normalized = normalizeCell(value);
  if (!normalized) return '';

  const localizedMatch = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (localizedMatch) {
    return `${localizedMatch[3]}-${localizedMatch[2]}-${localizedMatch[1]}`;
  }

  const isoDate = new Date(normalized);
  if (!Number.isNaN(isoDate.getTime())) {
    return buildDayKey(isoDate.toISOString());
  }

  return '';
}

function buildOrderLookup(orderOrId) {
  if (!orderOrId) {
    return {
      numeroPedidoInterno: '',
      nroPedido: '',
      dayKey: ''
    };
  }

  if (typeof orderOrId === 'string') {
    return {
      numeroPedidoInterno: normalizeCell(orderOrId),
      nroPedido: normalizeCell(orderOrId),
      dayKey: ''
    };
  }

  return {
    numeroPedidoInterno: normalizeCell(orderOrId.numeroPedidoInterno),
    nroPedido: normalizeCell(orderOrId.nroPedido),
    dayKey: buildDayKey(orderOrId.fecha)
  };
}

function getLookupMatch({ orderLookup, primaryValue, legacyValue, trackingValue, rowDayKey }) {
  if (
    orderLookup.nroPedido &&
    (
      (legacyValue && orderLookup.nroPedido === legacyValue) ||
      (trackingValue && orderLookup.nroPedido === trackingValue)
    )
  ) {
    return true;
  }

  if (!orderLookup.numeroPedidoInterno || !primaryValue) {
    return false;
  }

  if (orderLookup.numeroPedidoInterno !== primaryValue) {
    return false;
  }

  if (!orderLookup.dayKey) {
    return true;
  }

  return orderLookup.dayKey === rowDayKey;
}

async function getNextEmptyRow(sheetName) {
  const sheets = await getSheetsClient();
  const profile = getSheetProfile(sheetName);
  const startRow = profile.dataStartRow;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetsConfig.spreadsheetId,
    range: getColumnRange(sheetName, profile.columns.numeroPedidoInterno, startRow)
  });

  const values = res.data.values || [];

  for (let index = 0; index < values.length; index += 1) {
    const cellValue = normalizeCell(values[index]?.[0]);
    if (!cellValue) {
      const nextRow = startRow + index;

      console.log('[SHEETS] Reutilizando fila vacia detectada', { sheetName, nextRow });
      return nextRow;
    }
  }

  const nextRow = startRow + values.length;

  console.log('[SHEETS] Proxima fila detectada', { sheetName, nextRow });
  return nextRow;
}

async function findOrderRowsInSheet(sheetName, orderOrId) {
  const orderLookup = buildOrderLookup(orderOrId);
  if (!orderLookup.numeroPedidoInterno && !orderLookup.nroPedido) {
    return [];
  }

  const sheets = await getSheetsClient();
  const profile = getSheetProfile(sheetName);
  const ranges = [
    getColumnRange(sheetName, profile.columns.numeroPedidoInterno, profile.dataStartRow),
    getColumnRange(sheetName, profile.columns.fecha, profile.dataStartRow)
  ];

  const hasLegacyColumn = Boolean(profile.columns.numeroPedidoVisible);
  const hasTrackingColumn = Boolean(profile.columns.nroPedidoTracking);
  if (hasLegacyColumn) {
    ranges.push(getColumnRange(sheetName, profile.columns.numeroPedidoVisible, profile.dataStartRow));
  }
  if (hasTrackingColumn) {
    ranges.push(getColumnRange(sheetName, profile.columns.nroPedidoTracking, profile.dataStartRow));
  }

  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: sheetsConfig.spreadsheetId,
    ranges
  });

  const valueRanges = res.data.valueRanges || [];
  const primaryValues = valueRanges[0]?.values || [];
  const fechaValues = valueRanges[1]?.values || [];
  const legacyValues = hasLegacyColumn ? valueRanges[2]?.values || [] : [];
  const trackingValues = hasTrackingColumn
    ? valueRanges[hasLegacyColumn ? 3 : 2]?.values || []
    : [];

  const matchedRows = [];
  const maxLength = Math.max(primaryValues.length, fechaValues.length, legacyValues.length, trackingValues.length);

  for (let index = 0; index < maxLength; index += 1) {
    const primaryValue = normalizeCell(primaryValues[index]?.[0]);
    const fechaValue = normalizeCell(fechaValues[index]?.[0]);
    const legacyValue = normalizeCell(legacyValues[index]?.[0]);
    const trackingValue = normalizeCell(trackingValues[index]?.[0]);
    const rowDayKey = parseSheetDayKey(fechaValue);

    if (getLookupMatch({ orderLookup, primaryValue, legacyValue, trackingValue, rowDayKey })) {
      matchedRows.push({
        sheetName,
        rowNumber: profile.dataStartRow + index
      });
    }
  }

  return matchedRows;
}

async function findOrderAcrossSheets(orderOrId) {
  const uniqueSheets = getUniqueSheetNames();
  return findOrderAcrossSheetNames(orderOrId, uniqueSheets);
}

async function findOrderAcrossSheetNames(orderOrId, sheetNames = []) {
  const uniqueSheets = [...new Set((sheetNames || []).filter(Boolean))];
  const matches = [];

  for (const sheetName of uniqueSheets) {
    const rows = await findOrderRowsInSheet(sheetName, orderOrId);
    matches.push(...rows);
  }

  return matches.sort((left, right) => {
    if (left.sheetName === right.sheetName) {
      return left.rowNumber - right.rowNumber;
    }

    return left.sheetName.localeCompare(right.sheetName);
  });
}

async function findOrderAcrossRiderSheets(orderOrId) {
  const riderSheets = getRiderSheetNames();
  return findOrderAcrossSheetNames(orderOrId, riderSheets);
}

async function findOrderRowsByPhoneAndDayInSheet(sheetName, order = {}) {
  const normalizedPhone = normalizePhone(order.telefono);
  const orderDayKey = buildDayKey(order.fecha);
  const orderTotal = Number(order.total) || 0;

  if (!normalizedPhone || !orderDayKey) {
    return [];
  }

  const sheets = await getSheetsClient();
  const profile = getSheetProfile(sheetName);
  const ranges = [
    getColumnRange(sheetName, profile.columns.telefono, profile.dataStartRow),
    getColumnRange(sheetName, profile.columns.fecha, profile.dataStartRow)
  ];

  if (profile.columns.total) ranges.push(getColumnRange(sheetName, profile.columns.total, profile.dataStartRow));
  if (profile.columns.tarjeta) ranges.push(getColumnRange(sheetName, profile.columns.tarjeta, profile.dataStartRow));
  if (profile.columns.efectivo) ranges.push(getColumnRange(sheetName, profile.columns.efectivo, profile.dataStartRow));
  if (profile.columns.transferencia) ranges.push(getColumnRange(sheetName, profile.columns.transferencia, profile.dataStartRow));

  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: sheetsConfig.spreadsheetId,
    ranges
  });

  const valueRanges = res.data.valueRanges || [];
  const telefonoValues = valueRanges[0]?.values || [];
  const fechaValues = valueRanges[1]?.values || [];
  const totalValues = valueRanges[2]?.values || [];
  const tarjetaValues = valueRanges[3]?.values || [];
  const efectivoValues = valueRanges[4]?.values || [];
  const transferenciaValues = valueRanges[5]?.values || [];

  const matchedRows = [];
  const maxLength = Math.max(
    telefonoValues.length,
    fechaValues.length,
    totalValues.length,
    tarjetaValues.length,
    efectivoValues.length,
    transferenciaValues.length
  );

  for (let index = 0; index < maxLength; index += 1) {
    const rowPhone = normalizePhone(telefonoValues[index]?.[0]);
    const rowDayKey = parseSheetDayKey(fechaValues[index]?.[0]);

    if (!rowPhone || rowPhone !== normalizedPhone || rowDayKey !== orderDayKey) {
      continue;
    }

    const rowTotal =
      toNumber(totalValues[index]?.[0]) +
      toNumber(tarjetaValues[index]?.[0]) +
      toNumber(efectivoValues[index]?.[0]) +
      toNumber(transferenciaValues[index]?.[0]);

    if (orderTotal > 0 && rowTotal > 0 && Math.abs(rowTotal - orderTotal) > 0.01) {
      continue;
    }

    matchedRows.push({
      sheetName,
      rowNumber: profile.dataStartRow + index
    });
  }

  return matchedRows;
}

async function findOrderAcrossRiderSheetsByPhoneAndDay(order) {
  const riderSheets = getRiderSheetNames();
  const matches = [];

  for (const sheetName of riderSheets) {
    const rows = await findOrderRowsByPhoneAndDayInSheet(sheetName, order);
    matches.push(...rows);
  }

  return matches.sort((left, right) => {
    if (left.sheetName === right.sheetName) {
      return left.rowNumber - right.rowNumber;
    }

    return left.sheetName.localeCompare(right.sheetName);
  });
}

async function writeOrderToSheet(sheetName, row, data) {
  const sheets = await getSheetsClient();
  const profile = getSheetProfile(sheetName);

  const updates = Object.entries(profile.columns)
    .filter(([, column]) => Boolean(column))
    .map(([field, column]) => ({
      range: `${sheetName}!${column}${row}`,
      values: [[data[field] ?? '']]
    }));

  console.log('[SHEETS] Escribiendo pedido en hoja', {
    sheetName,
    row,
    fields: Object.keys(data)
  });

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetsConfig.spreadsheetId,
    requestBody: {
      valueInputOption: 'RAW',
      data: updates
    }
  });
}

async function getOrderRowSnapshot(sheetName, row) {
  const sheets = await getSheetsClient();
  const profile = getSheetProfile(sheetName);
  const activeColumns = Object.entries(profile.columns).filter(([, column]) => Boolean(column));
  const ranges = activeColumns.map(([, column]) => `${sheetName}!${column}${row}`);

  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: sheetsConfig.spreadsheetId,
    ranges
  });

  const valueByField = {};
  const valueRanges = res.data.valueRanges || [];

  activeColumns.forEach(([field], index) => {
    valueByField[field] = valueRanges[index]?.values?.[0]?.[0] ?? '';
  });

  return {
    serviceLabel: normalizeCell(valueByField.serviceLabel),
    numeroPedidoInterno: normalizeCell(valueByField.numeroPedidoInterno),
    estadoPago: normalizeCell(valueByField.estadoPago),
    total: toNumber(valueByField.total),
    tarjeta: toNumber(valueByField.tarjeta),
    efectivo: toNumber(valueByField.efectivo),
    transferencia: toNumber(valueByField.transferencia),
    enviosLejanos: toNumber(valueByField.enviosLejanos),
    propinaWeb: toNumber(valueByField.propinaWeb),
    salidaDinero: normalizeCell(valueByField.salidaDinero),
    enCamino: normalizeCell(valueByField.enCamino),
    pedidoListo: normalizeCell(valueByField.pedidoListo),
    finalizado: normalizeCell(valueByField.finalizado),
    estadoPedido: normalizeCell(valueByField.estadoPedido),
    anotaciones: normalizeCell(valueByField.anotaciones),
    datosTransferencia: normalizeCell(valueByField.datosTransferencia),
    numeroPedidoVisible: normalizeCell(valueByField.numeroPedidoVisible),
    nroPedidoTracking: normalizeCell(valueByField.nroPedidoTracking),
    importeTransferenciaVisible: toNumber(valueByField.importeTransferenciaVisible),
    telefono: normalizeCell(valueByField.telefono),
    fecha: normalizeCell(valueByField.fecha)
  };
}

async function clearOrderRow(sheetName, row) {
  const sheets = await getSheetsClient();
  const ranges = getManagedColumnsForSheet(sheetName).map((column) => `${sheetName}!${column}${row}`);

  console.log('[SHEETS] Limpiando fila existente', {
    sheetName,
    row
  });

  await sheets.spreadsheets.values.batchClear({
    spreadsheetId: sheetsConfig.spreadsheetId,
    requestBody: {
      ranges
    }
  });
}

module.exports = {
  getNextEmptyRow,
  writeOrderToSheet,
  findOrderAcrossSheets,
  findOrderAcrossSheetNames,
  findOrderAcrossRiderSheets,
  findOrderAcrossRiderSheetsByPhoneAndDay,
  findOrderRowsInSheet,
  clearOrderRow,
  getOrderRowSnapshot,
  buildDayKey,
  __internals: {
    buildOrderLookup,
    getLookupMatch
  }
};
