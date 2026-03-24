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

async function getNextEmptyRow(sheetName) {
  const sheets = await getSheetsClient();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetsConfig.spreadsheetId,
    range: `${sheetName}!A:A`
  });

  const values = res.data.values || [];
  const nextRow = Math.max(values.length + 1, sheetsConfig.dataStartRow);

  console.log('[SHEETS] Proxima fila detectada', { sheetName, nextRow });
  return nextRow;
}

async function findOrderRowInSheet(sheetName, nroPedido) {
  const cleanOrderId = normalizeCell(nroPedido);
  if (!cleanOrderId) return null;

  const sheets = await getSheetsClient();
  const orderColumn = sheetsConfig.columns.nroPedido;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetsConfig.spreadsheetId,
    range: `${sheetName}!${orderColumn}${sheetsConfig.dataStartRow}:${orderColumn}`
  });

  const values = res.data.values || [];

  for (let index = 0; index < values.length; index += 1) {
    const cellValue = normalizeCell(values[index]?.[0]);
    if (cellValue && cellValue === cleanOrderId) {
      return sheetsConfig.dataStartRow + index;
    }
  }

  return null;
}

async function findOrderAcrossSheets(nroPedido) {
  const uniqueSheets = getUniqueSheetNames();

  for (const sheetName of uniqueSheets) {
    const rowNumber = await findOrderRowInSheet(sheetName, nroPedido);
    if (rowNumber) {
      return { sheetName, rowNumber };
    }
  }

  return null;
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
