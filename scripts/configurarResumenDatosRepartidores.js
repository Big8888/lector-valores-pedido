const path = require('path');

if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = require('fs').readFileSync(
    'C:/Users/marti/Desktop/LECTOR DE VALORES PEDIDO/credentials/google-service-account.json',
    'utf8'
  );
}

const { syncDatosRiderSummaries } = require(path.join(__dirname, '../src/services/googleSheetsService'));

syncDatosRiderSummaries()
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((error) => {
    console.error('[DATOS] No se pudo sincronizar el resumen de repartidores:', error.message);
    process.exit(1);
  });
