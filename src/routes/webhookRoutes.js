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

async function clearExistingOrders(order) {
  const existingOrders = await findOrderAcrossSheets(order);

  for (const duplicate of existingOrders) {
    console.log('[WEBHOOK] Se elimina pedido existente de Sheets', {
      numeroPedidoInterno: order.numeroPedidoInterno || null,
      nroPedido: order.nroPedido || null,
      sheetName: duplicate.sheetName,
      rowNumber: duplicate.rowNumber
    });

    await clearOrderRow(duplicate.sheetName, duplicate.rowNumber);
  }

  return existingOrders.length;
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
      totalSinMetodo: order.totalSinMetodo || 0,
      tarjeta: order.tarjeta || 0,
      efectivo: order.efectivo || 0,
      transferencia: order.transferencia || 0,
      enviosLejanos: order.enviosLejanos || 0,
      propinaWeb: order.propinaWeb || 0,
      paymentMethod: order.paymentMethod || null,
      paymentDebugTexts: order.paymentDebugTexts || [],
      telefono: order.telefono || null,
      repartidor: order.repartidor || null
    });

    if (!order.numeroPedidoInterno && !order.nroPedido) {
      const error = new Error('No se pudo obtener un identificador para el pedido.');
      error.statusCode = 400;
      throw error;
    }

    if (order.riderCancelled) {
      const clearedRows = await clearExistingOrders(order);

      console.log('[WEBHOOK] Rider cancelado, pedido eliminado de Sheets', {
        numeroPedidoInterno: order.numeroPedidoInterno || null,
        nroPedido: order.nroPedido || null,
        clearedRows
      });

      return res.status(200).json({
        ok: true,
        removed: true,
        clearedRows,
        reason: 'Rider cancelado. Pedido eliminado de Google Sheets.'
      });
    }

    if (!hasAssignedRider(order)) {
      const clearedRows = await clearExistingOrders(order);

      console.log('[WEBHOOK] Pedido omitido por no tener repartidor asignado aun', {
        numeroPedidoInterno: order.numeroPedidoInterno || null,
        nroPedido: order.nroPedido,
        clearedRows
      });

      return res.status(202).json({
        ok: true,
        skipped: true,
        clearedRows,
        reason: 'Pedido sin repartidor asignado aun.'
      });
    }

    const assignment = assignCourier(order);
    if (!assignment.sheetName) {
      console.log('[WEBHOOK] Pedido omitido por rider no mapeado', {
        nroPedido: order.nroPedido,
        rider: order.repartidor || order.riderHint || null
      });

      return res.status(202).json({
        ok: true,
        skipped: true,
        reason: 'Pedido con rider asignado pero no mapeado a una hoja.'
      });
    }

    const mappedRow = mapOrderToSheetRow(order, assignment);

    console.log('[WEBHOOK] Courier asignado', {
      courier: assignment.courier,
      sheetName: assignment.sheetName
    });

    const existingOrders = await findOrderAcrossSheets(order);
    const existingInTargetSheet = existingOrders.filter(
      (entry) => entry.sheetName === assignment.sheetName
    );
    const existingInOtherSheets = existingOrders.filter(
      (entry) => entry.sheetName !== assignment.sheetName
    );

    let rowNumber;

    for (const duplicate of existingInOtherSheets) {
      console.log('[WEBHOOK] Pedido encontrado en otra hoja, se limpia fila anterior', {
        nroPedido: order.nroPedido,
        fromSheet: duplicate.sheetName,
        fromRow: duplicate.rowNumber,
        toSheet: assignment.sheetName
      });

      await clearOrderRow(duplicate.sheetName, duplicate.rowNumber);
    }

    if (existingInTargetSheet.length > 0) {
      rowNumber = existingInTargetSheet[0].rowNumber;

      console.log('[WEBHOOK] Pedido ya existe en la misma hoja, se actualiza', {
        nroPedido: order.nroPedido,
        sheetName: assignment.sheetName,
        rowNumber
      });

      for (const duplicate of existingInTargetSheet.slice(1)) {
        console.log('[WEBHOOK] Duplicado extra encontrado en misma hoja, se limpia', {
          nroPedido: order.nroPedido,
          sheetName: duplicate.sheetName,
          rowNumber: duplicate.rowNumber
        });

        await clearOrderRow(duplicate.sheetName, duplicate.rowNumber);
      }

      await writeOrderToSheet(assignment.sheetName, rowNumber, mappedRow);
    } else {
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
