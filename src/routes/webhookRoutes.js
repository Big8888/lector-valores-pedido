const express = require('express');
const { interpretOrder } = require('../services/orderInterpreter');
const { assignCourier } = require('../services/courierAssigner');
const { mapOrderToSheetRow } = require('../services/orderToSheetMapper');
const {
  getNextEmptyRow,
  writeOrderToSheet,
  findOrderAcrossSheets,
  clearOrderRow
} = require('../services/googleSheetsService');

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
      nroPedido: order.nroPedido || null,
      total: order.total || 0,
      enviosLejanos: order.enviosLejanos || 0,
      telefono: order.telefono || null,
      repartidor: order.repartidor || null
    });

    if (!order.nroPedido) {
      const error = new Error('No se pudo obtener nroPedido para identificar el pedido.');
      error.statusCode = 400;
      throw error;
    }

    if (!hasAssignedRider(order)) {
      console.log('[WEBHOOK] Pedido omitido por no tener repartidor asignado aun', {
        nroPedido: order.nroPedido
      });

      return res.status(202).json({
        ok: true,
        skipped: true,
        reason: 'Pedido sin repartidor asignado aun.'
      });
    }

    const assignment = assignCourier(order);
    const mappedRow = mapOrderToSheetRow(order, assignment);

    console.log('[WEBHOOK] Courier asignado', {
      courier: assignment.courier,
      sheetName: assignment.sheetName
    });

    const existingOrder = await findOrderAcrossSheets(order.nroPedido);

    let rowNumber;

    if (existingOrder && existingOrder.sheetName === assignment.sheetName) {
      rowNumber = existingOrder.rowNumber;

      console.log('[WEBHOOK] Pedido ya existe en la misma hoja, se actualiza', {
        nroPedido: order.nroPedido,
        sheetName: assignment.sheetName,
        rowNumber
      });

      await writeOrderToSheet(assignment.sheetName, rowNumber, mappedRow);
    } else {
      if (existingOrder && existingOrder.sheetName !== assignment.sheetName) {
        console.log('[WEBHOOK] Pedido cambia de hoja, se limpia fila anterior', {
          nroPedido: order.nroPedido,
          fromSheet: existingOrder.sheetName,
          fromRow: existingOrder.rowNumber,
          toSheet: assignment.sheetName
        });

        await clearOrderRow(existingOrder.sheetName, existingOrder.rowNumber);
      }

      rowNumber = await getNextEmptyRow(assignment.sheetName);
      await writeOrderToSheet(assignment.sheetName, rowNumber, mappedRow);
    }

    const durationMs = Date.now() - startedAt;

    console.log('[WEBHOOK] Pedido guardado correctamente', {
      nroPedido: order.nroPedido,
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
