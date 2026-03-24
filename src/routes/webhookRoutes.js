const express = require('express');
const { interpretOrder } = require('../services/orderInterpreter');
const { assignCourier } = require('../services/courierAssigner');
const { mapOrderToSheetRow } = require('../services/orderToSheetMapper');
const { getNextEmptyRow, writeOrderToSheet } = require('../services/googleSheetsService');

const router = express.Router();

function maskSecret(secret) {
  if (!secret) return '(vacio)';
  if (secret.length <= 6) return '***';
  return `${secret.slice(0, 3)}***${secret.slice(-3)}`;
}

function hasAssignedRider(order = {}) {
  const candidates = [
    order.repartidor,
    order.riderHint,
    order.orderData && order.orderData.rider && order.orderData.rider.name,
    order.originalPayload && order.originalPayload.data && order.originalPayload.data.rider && order.originalPayload.data.rider.name,
    order.originalPayload && order.originalPayload.datos && order.originalPayload.datos.rider && order.originalPayload.datos.rider.name
  ];

  return candidates.some((value) => value && String(value).trim());
}

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
    const receivedSecret =
      req.header('x-webhook-secret') ||
      req.header('X-Webhook-Secret') ||
      req.query.secret ||
      '';

    console.log('[WEBHOOK] Pedido recibido', {
      timestamp: new Date().toISOString(),
      hasBody: !!req.body,
      bodyKeys: Object.keys(payload),
      secretReceived: maskSecret(receivedSecret),
      secretPresent: !!receivedSecret
    });

    const order = interpretOrder(payload);

    console.log('[WEBHOOK] Pedido interpretado', {
      numeroPedidoInterno: order.numeroPedidoInterno || null,
      total: order.total || 0,
      enviosLejanos: order.enviosLejanos || 0,
      telefono: order.telefono || null,
      repartidor: order.repartidor || null
    });

    if (!hasAssignedRider(order)) {
      console.log('[WEBHOOK] Pedido omitido por no tener repartidor asignado aun', {
        nroPedido: order.nroPedido || null,
        pedido: order.pedido || null
      });

      return res.status(202).json({
        ok: true,
        skipped: true,
        reason: 'Pedido sin repartidor asignado aun.'
      });
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
