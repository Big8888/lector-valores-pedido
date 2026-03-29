const express = require('express');
const { interpretOrder } = require('../services/orderInterpreter');
const { assignCourier, isCounterSale } = require('../services/courierAssigner');
const { mapOrderToSheetRow } = require('../services/orderToSheetMapper');
const {
  getNextEmptyRow,
  writeOrderToSheet,
  findOrderAcrossSheets,
  findOrderAcrossRiderSheetsByPhoneAndDay,
  clearOrderRow,
  getOrderRowSnapshot
} = require('../services/googleSheetsService');

const router = express.Router();

function maskSecret(secret) {
  if (!secret) return '(vacio)';
  if (secret.length <= 6) return '***';
  return `${secret.slice(0, 3)}***${secret.slice(-3)}`;
}

function getReceivedSecret(req) {
  const authHeader =
    req.header('Authorization') ||
    req.header('authorization') ||
    '';

  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const authorizationSecret = bearerMatch ? bearerMatch[1].trim() : authHeader.trim();

  return (
    req.header('x-webhook-secret') ||
    req.header('X-Webhook-Secret') ||
    authorizationSecret ||
    req.query.secret ||
    ''
  );
}

function validateWebhookSecret(receivedSecret) {
  const expectedSecret = String(process.env.WEBHOOK_SECRET || '').trim();

  if (!expectedSecret) {
    return { ok: true, reason: 'disabled' };
  }

  if (!receivedSecret) {
    return { ok: false, reason: 'missing' };
  }

  if (receivedSecret !== expectedSecret) {
    return { ok: false, reason: 'invalid' };
  }

  return { ok: true, reason: 'matched' };
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

async function clearExistingOrders(order, existingOrders = null) {
  const rowsToClear = existingOrders || await findOrderAcrossSheets(order);

  for (const duplicate of rowsToClear) {
    console.log('[WEBHOOK] Se elimina pedido existente de Sheets', {
      numeroPedidoInterno: order.numeroPedidoInterno || null,
      nroPedido: order.nroPedido || null,
      sheetName: duplicate.sheetName,
      rowNumber: duplicate.rowNumber
    });

    await clearOrderRow(duplicate.sheetName, duplicate.rowNumber);
  }

  return rowsToClear.length;
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
    const receivedSecret = getReceivedSecret(req);
    const secretCheck = validateWebhookSecret(receivedSecret);

    console.log('[WEBHOOK] Pedido recibido', {
      requestId: req.headers['x-request-id'] || null,
      timestamp: new Date().toISOString(),
      hasBody: !!req.body,
      bodyKeys: Object.keys(payload),
      secretReceived: maskSecret(receivedSecret),
      secretPresent: !!receivedSecret
    });

    if (!secretCheck.ok) {
      const error = new Error(
        secretCheck.reason === 'missing'
          ? 'Falta el webhook secret.'
          : 'Webhook secret invalido.'
      );
      error.statusCode = 401;
      throw error;
    }

    const order = interpretOrder(payload);

    console.log('[WEBHOOK] Pedido interpretado', {
      numeroPedidoInterno: order.numeroPedidoInterno || null,
      nroPedido: order.nroPedido || null,
      serviceType: order.serviceType || null,
      serviceLabel: order.serviceLabel || null,
      total: order.total || 0,
      totalSinMetodo: order.totalSinMetodo || 0,
      tarjeta: order.tarjeta || 0,
      efectivo: order.efectivo || 0,
      transferencia: order.transferencia || 0,
      enviosLejanos: order.enviosLejanos || 0,
      propinaWeb: order.propinaWeb || 0,
      paymentMethod: order.paymentMethod || null,
      paymentDebugTexts: order.paymentDebugTexts || [],
      paymentDebugFields: order.paymentDebugFields || [],
      telefono: order.telefono || null,
      repartidor: order.repartidor || null
    });

    if (!order.numeroPedidoInterno && !order.nroPedido) {
      const error = new Error('No se pudo obtener un identificador para el pedido.');
      error.statusCode = 400;
      throw error;
    }

    let existingOrders = await findOrderAcrossSheets(order);

    if (order.riderCancelled) {
      const clearedRows = await clearExistingOrders(order, existingOrders);

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

    const hasRider = hasAssignedRider(order);
    const counterSale = isCounterSale(order);
    let assignment = null;

    if (existingOrders.length === 0 && !counterSale && !hasRider && order.telefono) {
      const fallbackMatches = await findOrderAcrossRiderSheetsByPhoneAndDay(order);

      if (fallbackMatches.length === 1) {
        existingOrders = fallbackMatches;

        console.log('[WEBHOOK] Fallback por telefono y dia encontro fila existente', {
          numeroPedidoInterno: order.numeroPedidoInterno || null,
          nroPedido: order.nroPedido || null,
          telefono: order.telefono || null,
          sheetName: fallbackMatches[0].sheetName,
          rowNumber: fallbackMatches[0].rowNumber
        });
      } else if (fallbackMatches.length > 1) {
        console.log('[WEBHOOK] Fallback por telefono y dia ambiguo, no se usa', {
          numeroPedidoInterno: order.numeroPedidoInterno || null,
          nroPedido: order.nroPedido || null,
          telefono: order.telefono || null,
          candidates: fallbackMatches
        });
      }
    }

    if (counterSale) {
      assignment = assignCourier(order);

      console.log('[WEBHOOK] Pedido de mostrador detectado, se envia a hoja fija', {
        numeroPedidoInterno: order.numeroPedidoInterno || null,
        nroPedido: order.nroPedido || null,
        serviceType: order.serviceType || null,
        sheetName: assignment.sheetName
      });
    } else if (!hasRider) {
      if (existingOrders.length === 0) {
        console.log('[WEBHOOK] Pedido omitido por no tener repartidor asignado aun', {
          numeroPedidoInterno: order.numeroPedidoInterno || null,
          nroPedido: order.nroPedido || null,
          existingRows: 0
        });

        return res.status(202).json({
          ok: true,
          skipped: true,
          clearedRows: 0,
          reason: 'Pedido sin repartidor asignado aun.'
        });
      }

      assignment = {
        courier: null,
        sheetName: existingOrders[0].sheetName
      };

      console.log('[WEBHOOK] Update sin rider, se reutiliza hoja existente', {
        numeroPedidoInterno: order.numeroPedidoInterno || null,
        nroPedido: order.nroPedido || null,
        sheetName: assignment.sheetName
      });
    } else {
      assignment = assignCourier(order);
    }

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

    console.log('[WEBHOOK] Courier asignado', {
      courier: assignment.courier,
      sheetName: assignment.sheetName
    });

    const existingInTargetSheet = existingOrders.filter(
      (entry) => entry.sheetName === assignment.sheetName
    );
    const existingInOtherSheets = existingOrders.filter(
      (entry) => entry.sheetName !== assignment.sheetName
    );

    let rowNumber;
    let existingSnapshot = null;
    let mappedRow;

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
      existingSnapshot = await getOrderRowSnapshot(assignment.sheetName, rowNumber);

      console.log('[WEBHOOK] Pedido ya existe en la misma hoja, se actualiza', {
        nroPedido: order.nroPedido,
        sheetName: assignment.sheetName,
        rowNumber,
        existingSnapshot
      });

      for (const duplicate of existingInTargetSheet.slice(1)) {
        console.log('[WEBHOOK] Duplicado extra encontrado en misma hoja, se limpia', {
          nroPedido: order.nroPedido,
          sheetName: duplicate.sheetName,
          rowNumber: duplicate.rowNumber
        });

        await clearOrderRow(duplicate.sheetName, duplicate.rowNumber);
      }

      mappedRow = mapOrderToSheetRow(order, existingSnapshot, assignment.sheetName);
      await writeOrderToSheet(assignment.sheetName, rowNumber, mappedRow);
    } else {
      rowNumber = await getNextEmptyRow(assignment.sheetName);
      mappedRow = mapOrderToSheetRow(order, null, assignment.sheetName);
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
