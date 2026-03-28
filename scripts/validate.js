require('../src/config/sheetsConfig');
require('../src/services/courierAssigner');
require('../src/services/googleSheetsService');
require('../src/services/orderInterpreter');
require('../src/services/pedidosYaAuth');
require('../src/services/pedidosYaInterpreter');
require('../src/services/orderToSheetMapper');
require('../src/routes/pedidosYaWebhookRoutes');
require('../src/routes/webhookRoutes');
require('../src/server');

console.log('VALIDACION_OK');
