const assert = require('assert');

require('../src/config/sheetsConfig');
require('../src/pedidosya-pdf/config/pedidosYaPdfConfig');
require('../src/services/courierAssigner');
const googleSheetsService = require('../src/services/googleSheetsService');
require('../src/services/orderInterpreter');
require('../src/pedidosya/services/pedidosYaAuth');
require('../src/pedidosya/services/pedidosYaInterpreter');
require('../src/pedidosya-pdf/services/pedidosYaPdfParser');
require('../src/pedidosya-pdf/services/pedidosYaPdfImporter');
require('../src/services/orderToSheetMapper');
require('../src/pedidosya/routes/pedidosYaWebhookRoutes');
require('../src/routes/webhookRoutes');
require('../src/server');

const { buildOrderLookup, getLookupMatch } = googleSheetsService.__internals;

const orderLookup = buildOrderLookup({
  numeroPedidoInterno: '14',
  nroPedido: 'UY-TEST-123',
  fecha: '2026-03-28T23:15:00.000Z'
});

assert.strictEqual(
  getLookupMatch({
    orderLookup,
    primaryValue: '14',
    legacyValue: '14',
    trackingValue: 'UY-TEST-123',
    rowDayKey: '2026-03-28'
  }),
  true,
  'Debe matchear por tracking aunque la columna visible tenga el numero interno.'
);

assert.strictEqual(
  getLookupMatch({
    orderLookup,
    primaryValue: '14',
    legacyValue: '14',
    trackingValue: '',
    rowDayKey: '2026-03-29'
  }),
  false,
  'Si no hay tracking, el match por numero interno debe respetar el dia.'
);

console.log('VALIDACION_OK');
