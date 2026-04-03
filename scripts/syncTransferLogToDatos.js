const { syncAllCurrentTransferRowsToDatos } = require('../src/services/googleSheetsService');

(async () => {
  const result = await syncAllCurrentTransferRowsToDatos();
  console.log(JSON.stringify(result, null, 2));
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
