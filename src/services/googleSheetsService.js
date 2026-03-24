const { google } = require('googleapis');
const path = require('path');
const sheetsConfig = require('../config/sheetsConfig');

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
  const auth = getGoogleAuth();
  const client = await auth.getClient();

  return google.sheets({
    version: 'v4',
    auth: client
  });
}

function getUniqueSheetNames() {
  return [...new Set(Object.values(sheetsConfig.riderSheets || {}))];
}

function normalizeCell(value) {
  return String(value || '').trim().replace(/^'/, '');
}

function getLookupKeys(orderOrId) {
  if (!orderOrId) return [];

  if (typeof orderOrId === 'string') {
    const key = normalizeCell(orderOrId);
    return key ? [key] : [];
  }

  const keys = [
    orderOrId.numeroPedidoInterno,
    orderOrId.nroPedido
  ]
    .map((value) => normalizeCell(value))
    .filter(Boolean);

  return [...new Set(keys)];
}

async function getNextEmptyRow(sheetName) {
  const sheets = await getSheetsClient();
  const startRow = sheetsConfig.dataStartRow;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetsConfig.spreadsheetId,
    range: `${sheetName}!A${startRow}:A`
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
  const lookupKeys = getLookupKeys(orderOrId);
  if (lookupKeys.length === 0) return [];

  const sheets = await getSheetsClient();
  const primaryColumn = sheetsConfig.columns.numeroPedidoInterno;
  const legacyColumn = sheetsConfig.columns.nroPedido;

  const primaryRes = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetsConfig.spreadsheetId,
    range: `${sheetName}!${primaryColumn}${sheetsConfig.dataStartRow}:${primaryColumn}`
  });

  const legacyRes = legacyColumn
    ? await sheets.spreadsheets.values.get({
        spreadsheetId: sheetsConfig.spreadsheetId,
        range: `${sheetName}!${legacyColumn}${sheetsConfig.dataStartRow}:${legacyColumn}`
      })
    : { data: { values: [] } };

  const primaryValues = primaryRes.data.values || [];
  const legacyValues = legacyRes.data.values || [];
  const matchedRows = new Set();

  const maxLength = Math.max(primaryValues.length, legacyValues.length);

  for (let index = 0; index < maxLength; index += 1) {
    const primaryValue = normalizeCell(primaryValues[index]?.[0]);
    const legacyValue = normalizeCell(legacyValues[index]?.[0]);

    if (lookupKeys.includes(primaryValue) || lookupKeys.includes(legacyValue)) {
      matchedRows.add(sheetsConfig.dataStartRow + index);
    }
  }

  return [...matchedRows].map((rowNumber) => ({
    sheetName,
    rowNumber
  }));
}

async function findOrderAcrossSheets(orderOrId) {
  const uniqueSheets = getUniqueSheetNames();
  const matches = [];

  for (const sheetName of uniqueSheets) {
    const rows = await findOrderRowsInSheet(sheetName, orderOrId);
    matches.push(...rows);
  }

  return matches;
}

async function writeOrderToSheet(sheetName, row, data) {
  const sheets = await getSheetsClient();

  const updates = Object.entries(sheetsConfig.columns).map(([field, column]) => ({
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

async function clearOrderRow(sheetName, row) {
  const sheets = await getSheetsClient();
  const startColumn = 'A';
  const endColumn = 'R';

  console.log('[SHEETS] Limpiando fila existente', {
    sheetName,
    row
  });

  await sheets.spreadsheets.values.clear({
    spreadsheetId: sheetsConfig.spreadsheetId,
    range: `${sheetName}!${startColumn}${row}:${endColumn}${row}`
  });
}

module.exports = {
  getNextEmptyRow,
  writeOrderToSheet,
  findOrderAcrossSheets,
  clearOrderRow
};
