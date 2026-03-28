require('../src/config/sheetsConfig');
require('../src/pedidosya-pdf/config/pedidosYaPdfConfig');
require('../src/services/courierAssigner');
require('../src/services/googleSheetsService');
require('../src/services/orderInterpreter');
require('../src/pedidosya/services/pedidosYaAuth');
require('../src/pedidosya/services/pedidosYaInterpreter');
require('../src/pedidosya-pdf/services/pedidosYaPdfParser');
require('../src/pedidosya-pdf/services/pedidosYaPdfImporter');
require('../src/services/orderToSheetMapper');
require('../src/pedidosya/routes/pedidosYaWebhookRoutes');
require('../src/routes/webhookRoutes');
require('../src/server');

console.log('VALIDACION_OK');
