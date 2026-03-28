const crypto = require('crypto');

function asString(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function toBase64Url(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function decodeBase64Url(segment) {
  const normalized = String(segment || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(normalized + padding, 'base64').toString('utf8');
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

function getPedidosYaJwtSecret() {
  return asString(
    process.env.PEDIDOSYA_JWT_SECRET ||
    process.env.PEDIDOSYA_PLUGIN_SECRET ||
    ''
  );
}

function getBearerToken(req) {
  const authorization = asString(req.header('Authorization') || req.header('authorization'));
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : authorization;
}

function validatePedidosYaJwt(req) {
  const expectedSecret = getPedidosYaJwtSecret();
  const token = getBearerToken(req);

  if (!expectedSecret) {
    return {
      ok: true,
      reason: 'disabled',
      payload: null
    };
  }

  if (!token) {
    return {
      ok: false,
      reason: 'missing'
    };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return {
      ok: false,
      reason: 'malformed'
    };
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = parseJson(decodeBase64Url(encodedHeader));
  const payload = parseJson(decodeBase64Url(encodedPayload));

  if (!header || !payload) {
    return {
      ok: false,
      reason: 'invalid_json'
    };
  }

  if (header.alg !== 'HS512') {
    return {
      ok: false,
      reason: 'invalid_alg'
    };
  }

  const expectedSignature = toBase64Url(
    crypto
      .createHmac('sha512', expectedSecret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest()
  );

  const receivedSignatureBuffer = Buffer.from(encodedSignature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);

  if (
    receivedSignatureBuffer.length !== expectedSignatureBuffer.length ||
    !crypto.timingSafeEqual(receivedSignatureBuffer, expectedSignatureBuffer)
  ) {
    return {
      ok: false,
      reason: 'invalid_signature'
    };
  }

  if (payload.service !== 'middleware') {
    return {
      ok: false,
      reason: 'invalid_claim'
    };
  }

  return {
    ok: true,
    reason: 'matched',
    payload
  };
}

module.exports = {
  validatePedidosYaJwt
};
