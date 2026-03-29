const express = require('express');
const { interpretOrder } = require('../services/orderInterpreter');
const { assignCourier, isCounterSale } = require('../services/courierAssigner');
const { mapOrderToSheetRow } = require('../services/orderToSheetMapper');
const {
  getNextEmptyRow,
  writeOrderToSheet,
  findOrderAcrossSheets,
  findOrderRowsInSheet,
  findOrderAcrossRiderSheetsByPhoneAndDay,
  clearOrderRow,
  getOrderRowSnapshot,
  buildDayKey
} = require('../services/googleSheetsService');

const router = express.Router();
const processedEventIds = new Map();
const inFlightEventIds = new Set();
const lockChains = new Map();
const orderSheetHints = new Map();
const PROCESSED_EVENT_TTL_MS = 30 * 60 * 1000;
const ORDER_SHEET_HINT_TTL_MS = 12 * 60 * 60 * 1000;

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizePhone(value) {
  return String(value || '').replace(/[^\d+]/g, '').trim();
}

function pruneTimedMap(map, now = Date.now()) {
  for (const [key, entry] of map.entries()) {
    if (!entry || !entry.expiresAt || entry.expiresAt <= now) {
      map.delete(key);
    }
  }
}

function isDuplicateEvent(eventId) {
  if (!eventId) return false;

  const now = Date.now();
  pruneTimedMap(processedEventIds, now);
  return inFlightEventIds.has(eventId) || processedEventIds.has(eventId);
}

function startTrackingEvent(eventId) {
  if (!eventId) return;
  inFlightEventIds.add(eventId);
}

function finishTrackingEvent(eventId, markProcessed = false) {
  if (!eventId) return;

  inFlightEventIds.delete(eventId);

  if (markProcessed) {
    processedEventIds.set(eventId, {
      expiresAt: Date.now() + PROCESSED_EVENT_TTL_MS
    });
  }
}

async function withLock(lockKey, task) {
  const previous = lockChains.get(lockKey) || Promise.resolve();
  let releaseCurrent;
  const current = new Promise((resolve) => {
    releaseCurrent = resolve;
  });
  const chained = previous.catch(() => {}).then(() => current);

  lockChains.set(lockKey, chained);
  await previous.catch(() => {});

  try {
    return await task();
  } finally {
    releaseCurrent();
    if (lockChains.get(lockKey) === chained) {
      lockChains.delete(lockKey);
    }
  }
}

function getOrderCacheKeys(order = {}) {
  const keys = [];
  const nroPedido = normalizeText(order.nroPedido);
  const numeroPedidoInterno = normalizeText(order.numeroPedidoInterno);
  const phone = normalizePhone(order.telefono);
  const dayKey = buildDayKey(order.fecha);

  if (nroPedido) {
    keys.push(`nro:${nroPedido}`);
  }

  if (numeroPedidoInterno && dayKey) {
    keys.push(`interno:${numeroPedidoInterno}@${dayKey}`);
  }

  if (phone && dayKey) {
    keys.push(`phone:${phone}@${dayKey}`);
  }

  return [...new Set(keys)];
}

function getOrderLockKey(order = {}) {
  const cacheKeys = getOrderCacheKeys(order);
  if (cacheKeys.length > 0) {
    return `order:${cacheKeys[0]}`;
  }

  return `order:fallback:${normalizeText(order.numeroPedidoInterno || order.nroPedido || order.telefono || 'unknown')}`;
}

function getCachedSheetName(order = {}) {
  pruneTimedMap(orderSheetHints);

  const sheetNames = new Set();
  for (const key of getOrderCacheKeys(order)) {
    const hint = orderSheetHints.get(key);
    if (hint && hint.sheetName) {
      sheetNames.add(hint.sheetName);
    }
  }

  return sheetNames.size === 1 ? [...sheetNames][0] : '';
}

function setCachedSheetName(order = {}, sheetName = '') {
  if (!sheetName) return;

  const cacheKeys = getOrderCacheKeys(order);
  if (cacheKeys.length === 0) return;

  const expiresAt = Date.now() + ORDER_SHEET_HINT_TTL_MS;
  for (const key of cacheKeys) {
    orderSheetHints.set(key, {
      sheetName,
      expiresAt
    });
  }
}

function clearCachedSheetName(order = {}) {
  for (const key of getOrderCacheKeys(order)) {
    orderSheetHints.delete(key);
  }
}

function shouldSearchRiderlessUpdate(order = {}) {
  if (order.finalizado || order.enCamino || order.pedidoListo) {
    return true;
  }

  if (order.hasExplicitPaymentAmounts || order.explicitPaymentsAreCurrentSnapshot) {
    return true;
  }

  if (['PAGADO', 'PARCIAL', 'PENDIENTE'].includes(normalizeText(order.paymentStatus).toUpperCase())) {
    return true;
  }

  if (order.paymentMethod && order.paymentMethod !== 'no_especificado') {
    return true;
  }

  return false;
}

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
  let trackedEventId = '';
  let markProcessedEvent = false;

  try {
    const payload = req.body || {};
    const receivedSecret = getReceivedSecret(req);
    const secretCheck = validateWebhookSecret(receivedSecret);
    const eventId = normalizeText(payload.event_id);

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

    if (isDuplicateEvent(eventId)) {
      console.log('[WEBHOOK] Evento duplicado detectado, se omite', {
        eventId: eventId || null
      });

      return res.status(202).json({
        ok: true,
        skipped: true,
        reason: 'Evento duplicado recibido.'
      });
    }

    trackedEventId = eventId;
    startTrackingEvent(trackedEventId);

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

    const response = await withLock(getOrderLockKey(order), async () => {
      if (order.riderCancelled) {
        const existingOrders = await findOrderAcrossSheets(order);
        const clearedRows = await clearExistingOrders(order, existingOrders);

        clearCachedSheetName(order);

        console.log('[WEBHOOK] Rider cancelado, pedido eliminado de Sheets', {
          numeroPedidoInterno: order.numeroPedidoInterno || null,
          nroPedido: order.nroPedido || null,
          clearedRows
        });

        return {
          statusCode: 200,
          body: {
            ok: true,
            removed: true,
            clearedRows,
            reason: 'Rider cancelado. Pedido eliminado de Google Sheets.'
          }
        };
      }

      const hasRider = hasAssignedRider(order);
      const counterSale = isCounterSale(order);
      const cachedSheetName = getCachedSheetName(order);
      let assignment = null;
      let existingOrders = [];

      if (counterSale) {
        assignment = assignCourier(order);
        existingOrders = await findOrderRowsInSheet(assignment.sheetName, order);

        if (existingOrders.length === 0) {
          existingOrders = await findOrderAcrossSheets(order);
        }

        console.log('[WEBHOOK] Pedido de mostrador detectado, se envia a hoja fija', {
          numeroPedidoInterno: order.numeroPedidoInterno || null,
          nroPedido: order.nroPedido || null,
          serviceType: order.serviceType || null,
          sheetName: assignment.sheetName
        });
      } else if (hasRider) {
        assignment = assignCourier(order);

        if (!assignment.sheetName) {
          console.log('[WEBHOOK] Pedido omitido por rider no mapeado', {
            nroPedido: order.nroPedido,
            rider: order.repartidor || order.riderHint || null
          });

          return {
            statusCode: 202,
            body: {
              ok: true,
              skipped: true,
              reason: 'Pedido con rider asignado pero no mapeado a una hoja.'
            }
          };
        }

        existingOrders = await findOrderRowsInSheet(assignment.sheetName, order);

        if (existingOrders.length === 0 && cachedSheetName && cachedSheetName !== assignment.sheetName) {
          existingOrders = await findOrderRowsInSheet(cachedSheetName, order);
        }

        if (existingOrders.length === 0) {
          existingOrders = await findOrderAcrossSheets(order);
        }
      } else {
        if (cachedSheetName) {
          existingOrders = await findOrderRowsInSheet(cachedSheetName, order);

          if (existingOrders.length > 0) {
            console.log('[WEBHOOK] Update sin rider reutiliza hoja cacheada', {
              numeroPedidoInterno: order.numeroPedidoInterno || null,
              nroPedido: order.nroPedido || null,
              sheetName: cachedSheetName
            });
          }
        }

        if (existingOrders.length === 0 && !shouldSearchRiderlessUpdate(order)) {
          console.log('[WEBHOOK] Update sin rider y sin cambios relevantes, se omite sin escanear hojas', {
            numeroPedidoInterno: order.numeroPedidoInterno || null,
            nroPedido: order.nroPedido || null,
            paymentStatus: order.paymentStatus || null
          });

          return {
            statusCode: 202,
            body: {
              ok: true,
              skipped: true,
              clearedRows: 0,
              reason: 'Pedido sin repartidor y sin cambios relevantes.'
            }
          };
        }

        if (existingOrders.length === 0 && order.telefono) {
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

        if (existingOrders.length === 0) {
          existingOrders = await findOrderAcrossSheets(order);
        }

        if (existingOrders.length === 0) {
          console.log('[WEBHOOK] Pedido omitido por no tener repartidor asignado aun', {
            numeroPedidoInterno: order.numeroPedidoInterno || null,
            nroPedido: order.nroPedido || null,
            existingRows: 0
          });

          return {
            statusCode: 202,
            body: {
              ok: true,
              skipped: true,
              clearedRows: 0,
              reason: 'Pedido sin repartidor asignado aun.'
            }
          };
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

      for (const duplicate of existingInOtherSheets) {
        console.log('[WEBHOOK] Pedido encontrado en otra hoja, se limpia fila anterior', {
          nroPedido: order.nroPedido,
          fromSheet: duplicate.sheetName,
          fromRow: duplicate.rowNumber,
          toSheet: assignment.sheetName
        });

        await clearOrderRow(duplicate.sheetName, duplicate.rowNumber);
      }

      const saveResult = await withLock(`sheet:${assignment.sheetName}`, async () => {
        let rowNumber;
        let existingSnapshot = null;
        let mappedRow;

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

        return {
          rowNumber,
          mappedRow
        };
      });

      setCachedSheetName(order, assignment.sheetName);

      const durationMs = Date.now() - startedAt;

      console.log('[WEBHOOK] Pedido guardado correctamente', {
        nroPedido: order.nroPedido,
        sheetName: assignment.sheetName,
        rowNumber: saveResult.rowNumber,
        durationMs
      });

      return {
        statusCode: 201,
        body: {
          ok: true,
          message: 'Pedido procesado correctamente.',
          result: {
            courier: assignment.courier,
            sheetName: assignment.sheetName,
            rowNumber: saveResult.rowNumber,
            order: saveResult.mappedRow
          }
        }
      };
    });

    markProcessedEvent = true;
    res.status(response.statusCode).json(response.body);
  } catch (error) {
    next(error);
  } finally {
    finishTrackingEvent(trackedEventId, markProcessedEvent);
  }
});

module.exports = router;
module.exports.__internals = {
  getOrderCacheKeys,
  getOrderLockKey,
  shouldSearchRiderlessUpdate
};
