const { google } = require('googleapis');
const sheetsConfig = require('../src/config/sheetsConfig');

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: 'C:/Users/marti/Desktop/LECTOR DE VALORES PEDIDO/credentials/google-service-account.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });

  const sheetName = sheetsConfig.counterSheetName;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetsConfig.spreadsheetId,
    range: `${sheetName}!K7:R`
  });

  const rows = res.data.values || [];
  const updates = [
    {
      range: `${sheetName}!R7`,
      values: [['Registro Cobro']]
    }
  ];

  for (let index = 1; index < rows.length; index += 1) {
    const rowNumber = 7 + index;
    const colK = String(rows[index][0] || '').trim();
    const colR = String(rows[index][7] || '').trim();

    if (!/COBRADO/i.test(colK) || colR) {
      continue;
    }

    updates.push({ range: `${sheetName}!R${rowNumber}`, values: [[colK]] });
    updates.push({ range: `${sheetName}!K${rowNumber}`, values: [['']] });
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetsConfig.spreadsheetId,
    requestBody: {
      valueInputOption: 'RAW',
      data: updates
    }
  });

  console.log(JSON.stringify({
    ok: true,
    sheetName,
    movedRows: Math.max(0, (updates.length - 1) / 2)
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
