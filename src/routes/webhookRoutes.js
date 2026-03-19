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

function validateWebhookSecret(req) {
  const expectedSecret = process.env.WEBHOOK_SECRET;

  if (!expectedSecret) {
    const error = new Error('WEBHOOK_SECRET no esta configurado en el servidor.');
    error.statusCode = 500;
    throw error;
  }

  const receivedSecret =
    req.header('x-webhook-secret') ||
    req.header('X-Webhook-Secret') ||
    req.query.secret;

  if (!receivedSecret) {
    const error = new Error('Falta el header x-webhook-secret.');
    error.statusCode = 401;
    throw error;
  }

  if (receivedSecret !== expectedSecret) {
    const error = new Error('Webhook secret invalido.');
    error.statusCode = 401;
    throw error;
  }
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
    validateWebhookSecret(req);

    const payload = req.body || {};

    console.log('[WEBHOOK] Pedido recibido', {
      timestamp: new Date().toISOString(),
      hasBody: !!req.body,
      bodyKeys: Object.keys(payload),
      secretReceived: maskSecret(req.header('x-webhook-secret') || req.query.secret || '')
    });

    const order = interpretOrder(payload);

    console.log('[WEBHOOK] Pedido interpretado', {
      pedido: order.pedido || null,
      rawText: order.rawText || null
    });

    if (!order.pedido && !order.rawText) {
      const error = new Error('No se pudo interpretar ningun dato del pedido.');
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