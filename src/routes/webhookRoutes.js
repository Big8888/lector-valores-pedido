const express = require('express');
const { interpretOrder } = require('../services/orderInterpreter');
const { assignCourier } = require('../services/courierAssigner');
const { mapOrderToSheetRow } = require('../services/orderToSheetMapper');
const { getNextEmptyRow, writeOrderToSheet } = require('../services/googleSheetsService');

const router = express.Router();

router.get('/', (req, res) => {
  res.status(200).json({
    ok: true,
    message: 'Webhook activo. Esta ruta recibe solicitudes POST.',
    methodAllowed: 'POST'
  });
});

router.post('/', async (req, res, next) => {
  const startedAt = Date.now();

  try {
    const payload = req.body || {};
    const rawOrder = payload.datos || payload.data || null;

    console.log('[WEBHOOK] Pedido recibido', {
      timestamp: new Date().toISOString(),
      hasBody: !!req.body,
      bodyKeys: Object.keys(payload)
    });

    if (rawOrder) {
      console.log('[WEBHOOK] rawOrder = ' + JSON.stringify(rawOrder));
    }

    const order = interpretOrder(payload);

    console.log('[WEBHOOK] Pedido interpretado', {
      pedido: order.pedido || null,
      rawText: order.rawText || null,
      itemsCount: Array.isArray(order.items) ? order.items.length : 0,
      papas: order.kitchenCounts?.papas || 0,
      medallones: order.kitchenCounts?.medallones || 0
    });

    if (!order.pedido && !order.rawText && (!order.items || !order.items.length)) {
      const error = new Error('No se pudo interpretar ningun dato util del pedido.');
      error.statusCode = 400;
      throw error;
    }

    const assignment = assignCourier(order);

    console.log('[WEBHOOK] Courier asignado', {
      courier: assignment.courier,
      sheetName: assignment.sheetName
    });

    const mappedRow = mapOrderToSheetRow(order, assignment);
    const rowNumber = await getNextEmptyRow(assignment.sheetName);

    await writeOrderToSheet(assignment.sheetName, rowNumber, mappedRow);

    const durationMs = Date.now() - startedAt;

    console.log('[WEBHOOK] Pedido guardado correctamente', {
      sheetName: assignment.sheetName,
      rowNumber,
      durationMs
    });

    res.status(201).json({
      ok: true,
      message: 'Pedido procesado correctamente.',
      result: {
        courier: assignment.courier,
        sheetName: assignment.sheetName,
        rowNumber,
        order: mappedRow
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
