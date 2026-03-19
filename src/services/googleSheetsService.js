const { google } = require('googleapis');
const path = require('path');
const sheetsConfig = require('../config/sheetsConfig');

const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, '../../credentials/google-service-account.json'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

async function getSheetsClient() {
  const client = await auth.getClient();
  return google.sheets({ version: 'v4', auth: client });
}

async function getNextEmptyRow(sheetName) {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetsConfig.spreadsheetId,
    range: `${sheetName}!A:A`
  });

  const values = res.data.values || [];
  return Math.max(values.length + 1, sheetsConfig.dataStartRow);
}

async function writeOrderToSheet(sheetName, row, data) {
  const sheets = await getSheetsClient();
  const updates = Object.entries(sheetsConfig.columns).map(([field, column]) => ({
    range: `${sheetName}!${column}${row}`,
    values: [[data[field] || '']]
  }));

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetsConfig.spreadsheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: updates
    }
  });
}

module.exports = {
  getNextEmptyRow,
  writeOrderToSheet
};
