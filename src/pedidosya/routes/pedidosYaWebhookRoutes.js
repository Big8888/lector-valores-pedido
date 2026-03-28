const express = require('express');
const sheetsConfig = require('../../config/sheetsConfig');
const { validatePedidosYaJwt } = require('../services/pedidosYaAuth');
const {
  interpretPedidosYaOrder,
  interpretPedidosYaStatusUpdate
} = require('../services/pedidosYaInterpreter');
const { mapOrderToSheetRow } = require('../../services/orderToSheetMapper');
const {
  getNextEmptyRow,
  writeOrderToSheet,
  findOrderAcrossSheets,
  getOrderRowSnapshot
} = require('../../services/googleSheetsService');

const router = express.Router();

function buildRemoteOrderId(order) {
  return String(order.nroPedido || order.numeroPedidoInterno || '').trim();
}

async function upsertPedidosYaOrder(order) {
  const sheetName = sheetsConfig.pedidosYaSheetName;
  const existingOrders = await findOrderAcrossSheets(order);
  const existingInTargetSheet = existingOrders.filter((entry) => entry.sheetName === sheetName);

  let rowNumber;
  let existingSnapshot = null;

  if (existingInTargetSheet.length > 0) {
    rowNumber = existingInTargetSheet[0].rowNumber;
    existingSnapshot = await getOrderRowSnapshot(sheetName, rowNumber);
  } else {
    rowNumber = await getNextEmptyRow(sheetName);
  }

  const mappedRow = mapOrderToSheetRow(order, existingSnapshot, sheetName);
  await writeOrderToSheet(sheetName, rowNumber, mappedRow);

  return {
    sheetName,
    rowNumber,
    mappedRow
  };
}

router.get('/', (req, res) => {
  res.status(200).json({
    ok: true,
    provider: 'PedidosYa',
    message: 'Webhook PedidosYa activo.'
  });
});

router.post('/order/:remoteId', async (req, res, next) => {
  try {
    const authCheck = validatePedidosYaJwt(req);

    if (!authCheck.ok) {
      const error = new Error(`JWT de PedidosYa invalido: ${authCheck.reason}`);
      error.statusCode = 401;
      throw error;
    }

    const order = interpretPedidosYaOrder(req.body || {}, {
      remoteId: req.params.remoteId
    });

    console.log('[PEDIDOSYA] Pedido recibido', {
      remoteId: req.params.remoteId,
      nroPedido: order.nroPedido || null,
      numeroPedidoInterno: order.numeroPedidoInterno || null,
      serviceType: order.serviceType || null,
      paymentStatus: order.paymentStatus || null,
      paymentMethod: order.paymentMethod || null,
      total: order.total || 0
    });

    if (!buildRemoteOrderId(order)) {
      const error = new Error('No se pudo obtener identificador estable del pedido de PedidosYa.');
      error.statusCode = 400;
      throw error;
    }

    const result = await upsertPedidosYaOrder(order);

    console.log('[PEDIDOSYA] Pedido guardado en hoja', {
      sheetName: result.sheetName,
      rowNumber: result.rowNumber,
      nroPedido: order.nroPedido || null,
      numeroPedidoInterno: order.numeroPedidoInterno || null
    });

    res.status(200).json({
      remoteResponse: {
        remoteOrderId: buildRemoteOrderId(order)
      }
    });
  } catch (error) {
    next(error);
  }
});

router.put('/remoteId/:remoteId/remoteOrder/:remoteOrderId/posOrderStatus', async (req, res, next) => {
  try {
    const authCheck = validatePedidosYaJwt(req);

    if (!authCheck.ok) {
      const error = new Error(`JWT de PedidosYa invalido: ${authCheck.reason}`);
      error.statusCode = 401;
      throw error;
    }

    const update = interpretPedidosYaStatusUpdate(req.body || {}, {
      remoteId: req.params.remoteId,
      remoteOrderId: req.params.remoteOrderId
    });

    const result = await upsertPedidosYaOrder(update);

    console.log('[PEDIDOSYA] Estado actualizado', {
      remoteId: req.params.remoteId,
      remoteOrderId: req.params.remoteOrderId,
      estadoPedido: update.estadoPedido || null,
      rowNumber: result.rowNumber
    });

    res.status(200).json({ ok: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
