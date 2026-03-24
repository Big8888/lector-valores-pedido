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

  console.log('[GOOGLE AUTH] Usando archivo local de credenciales.');

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

async function getNextEmptyRow(sheetName) {
  const sheets = await getSheetsClient();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetsConfig.spreadsheetId,
    range: `${sheetName}!A:A`
  });

  const values = res.data.values || [];
  const nextRow = Math.max(values.length + 1, sheetsConfig.dataStartRow);

  console.log('[SHEETS] Proxima fila detectada', {
    sheetName,
    nextRow
  });

  return nextRow;
}

async function writeOrderToSheet(sheetName, row, data) {
  const sheets = await getSheetsClient();

  const updates = Object.entries(sheetsConfig.columns).map(([field, column]) => ({
    range: `${sheetName}!${column}${row}`,
    values: [[data[field] || '']]
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

module.exports = {
  getNextEmptyRow,
  writeOrderToSheet
};
