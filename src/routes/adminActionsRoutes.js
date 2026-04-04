const express = require('express');
const {
  confirmarCobrosOperativos,
  quitarCobrosOperativos,
  procesarCierreDelDiaOperativo
} = require('../services/operationalActionsService');

const router = express.Router();

function getReceivedSecret(req) {
  const authHeader = req.header('authorization') || req.header('Authorization') || '';
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);

  return (
    req.header('x-admin-secret') ||
    req.header('X-Admin-Secret') ||
    req.header('x-webhook-secret') ||
    req.header('X-Webhook-Secret') ||
    (bearerMatch ? bearerMatch[1].trim() : authHeader.trim()) ||
    req.query.secret ||
    ''
  );
}

function validateAdminSecret(receivedSecret) {
  const expectedSecret = String(
    process.env.ADMIN_ACTION_SECRET || process.env.WEBHOOK_SECRET || ''
  ).trim();

  if (!expectedSecret) {
    return { ok: false, reason: 'disabled' };
  }

  if (!receivedSecret) {
    return { ok: false, reason: 'missing' };
  }

  if (receivedSecret !== expectedSecret) {
    return { ok: false, reason: 'invalid' };
  }

  return { ok: true, reason: 'matched' };
}

router.use((req, res, next) => {
  const receivedSecret = getReceivedSecret(req);
  const secretCheck = validateAdminSecret(receivedSecret);

  if (!secretCheck.ok) {
    const error = new Error(
      secretCheck.reason === 'disabled'
        ? 'Falta configurar el secret de acciones administrativas.'
        : secretCheck.reason === 'missing'
          ? 'Falta el secret de acciones administrativas.'
          : 'Secret de acciones administrativas invalido.'
    );

    error.statusCode = secretCheck.reason === 'disabled' ? 503 : 401;
    return next(error);
  }

  return next();
});

router.get('/', (req, res) => {
  res.status(200).json({
    ok: true,
    provider: 'admin-actions',
    message: 'Acciones administrativas activas.'
  });
});

router.post('/cobro/confirmar', async (req, res, next) => {
  try {
    const result = await confirmarCobrosOperativos(req.body || {});
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/cobro/quitar', async (req, res, next) => {
  try {
    const result = await quitarCobrosOperativos(req.body || {});
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/cierre-dia', async (req, res, next) => {
  try {
    const result = await procesarCierreDelDiaOperativo();
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
