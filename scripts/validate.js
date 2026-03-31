const assert = require('assert');

const sheetsConfig = require('../src/config/sheetsConfig');
require('../src/pedidosya-pdf/config/pedidosYaPdfConfig');
require('../src/services/courierAssigner');
const googleSheetsService = require('../src/services/googleSheetsService');
const { interpretOrder } = require('../src/services/orderInterpreter');
const { mapOrderToSheetRow } = require('../src/services/orderToSheetMapper');
require('../src/pedidosya/services/pedidosYaAuth');
require('../src/pedidosya/services/pedidosYaInterpreter');
const pedidosYaPdfParser = require('../src/pedidosya-pdf/services/pedidosYaPdfParser');
require('../src/pedidosya-pdf/services/pedidosYaPdfImporter');
require('../src/services/orderToSheetMapper');
require('../src/pedidosya/routes/pedidosYaWebhookRoutes');
const webhookRoutes = require('../src/routes/webhookRoutes');
require('../src/server');

const { buildOrderLookup, getLookupMatch } = googleSheetsService.__internals;
const {
  getOrderCacheKeys,
  shouldSearchRiderlessUpdate
} = webhookRoutes.__internals;
const { inferSalesChannel } = pedidosYaPdfParser.__internals;

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

const finalizadoPayload = {
  data: {
    public_id: 'UY-VALIDATE-1',
    daily_id: '31',
    total: '468',
    payment_status: 'PAID',
    service_type: 'DELIVERY',
    delivery_status: 'ON_THE_WAY',
    delivery_status_updated_at: '2026-03-28T21:45:00.000Z',
    status: 'DELIVERED',
    status_updated_at: '2026-03-28T22:11:00.000Z'
  }
};

assert.strictEqual(
  interpretOrder(finalizadoPayload).finalizado,
  '2026-03-28T22:11:00.000Z',
  'El finalizado no debe reutilizar el delivery_status_updated_at viejo cuando el estado final llega por otro campo.'
);

assert.deepStrictEqual(
  getOrderCacheKeys({
    numeroPedidoInterno: '66',
    nroPedido: 'UY-4591213326',
    telefono: '+598 99325771',
    fecha: '2026-03-29T02:10:46.000Z'
  }),
  [
    'nro:UY-4591213326',
    'interno:66@2026-03-28',
    'phone:+59899325771@2026-03-28'
  ],
  'Las claves de cache deben incluir tracking, numero interno y telefono por dia.'
);

assert.strictEqual(
  shouldSearchRiderlessUpdate({
    paymentStatus: 'NO PAGADO',
    paymentMethod: 'no_especificado',
    hasExplicitPaymentAmounts: false,
    explicitPaymentsAreCurrentSnapshot: false,
    enCamino: '',
    finalizado: '',
    pedidoListo: ''
  }),
  false,
  'Un update riderless pendiente y sin cambios relevantes no debe disparar barrido completo.'
);

assert.strictEqual(
  shouldSearchRiderlessUpdate({
    paymentStatus: 'UNPAID',
    paymentMethod: 'tarjeta',
    hasExplicitPaymentAmounts: true,
    explicitPaymentsAreCurrentSnapshot: false,
    reportedTotalPaid: 0,
    enCamino: '',
    finalizado: '',
    pedidoListo: ''
  }),
  false,
  'Un update riderless impago con metodo asignado no debe disparar barrido completo por si solo.'
);

assert.strictEqual(
  shouldSearchRiderlessUpdate({
    paymentStatus: 'PAGADO',
    paymentMethod: 'efectivo',
    hasExplicitPaymentAmounts: true,
    explicitPaymentsAreCurrentSnapshot: true,
    reportedTotalPaid: 966,
    enCamino: '',
    finalizado: '',
    pedidoListo: ''
  }),
  true,
  'Un update riderless con pago relevante si debe buscar fila existente.'
);

assert.strictEqual(
  inferSalesChannel(['Pedido', 'PICK UP', 'PICKUP AT']),
  'delivery',
  'En Lector PedidosYa, PICK UP debe traducirse a delivery.'
);

assert.strictEqual(
  inferSalesChannel(['Pedido', 'LOCAL']),
  'local',
  'En Lector PedidosYa, LOCAL debe mantenerse como local.'
);

assert.strictEqual(
  Boolean(sheetsConfig.sheetProfiles['Venta Mostrador'].columns.serviceLabel),
  false,
  'Venta Mostrador no debe escribir datos en la columna A.'
);

const freeOrderPayload = {
  data: {
    public_id: 'UY-FREE-1',
    daily_id: '33',
    payment_status: 'UNPAID',
    subtotal: '109',
    total_discounts: '109',
    total: '0',
    delivery_price: '0',
    service_type: 'DELIVERY'
  }
};

const interpretedFreeOrder = interpretOrder(freeOrderPayload);

assert.strictEqual(
  interpretedFreeOrder.total,
  0,
  'Si OlaClick informa total 0, no debe reemplazarse por subtotal + delivery.'
);

assert.strictEqual(
  mapOrderToSheetRow(interpretedFreeOrder, null, 'GIAN').total,
  0,
  'La fila escrita en repartidores debe respetar total 0 en pedidos bonificados.'
);

console.log('VALIDACION_OK');
