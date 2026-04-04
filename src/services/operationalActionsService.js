const sheetsConfig = require('../config/sheetsConfig');
const {
  getSheetsClient,
  getRiderSheetNames,
  syncDatosRiderSummaries
} = require('./googleSheetsService');

const SHEET_ALLOWED_FOR_COBRO = new Set([
  ...getRiderSheetNames(),
  sheetsConfig.counterSheetName,
  sheetsConfig.pedidosYaPdfSheetName
].filter(Boolean));

const COBRO_PROFILES = {
  default: {
    accion: 'A',
    numeroPedidoInterno: 'B',
    estadoPago: 'C',
    total: 'D',
    tarjeta: 'E',
    efectivo: 'F',
    transferencia: 'G',
    registroCobro: 'AA',
    registroCobroLegacy: 'M',
    marcaCobrado: 'AC',
    clearRanges: (row) => [
      `B${row}:M${row}`,
      `V${row}:Y${row}`,
      `AA${row}:AD${row}`
    ]
  },
  'Venta Mostrador': {
    accion: 'A',
    numeroPedidoInterno: 'B',
    estadoPago: 'C',
    total: 'D',
    tarjeta: 'E',
    efectivo: 'F',
    transferencia: 'G',
    registroCobro: 'R',
    registroCobroLegacy: 'K',
    marcaCobrado: 'AC',
    clearRanges: (row) => [
      `B${row}:R${row}`,
      `AB${row}:AD${row}`
    ]
  },
  'Lector Pedidosya': {
    accion: 'A',
    numeroPedidoInterno: 'B',
    estadoPago: 'C',
    tarjeta: 'D',
    efectivo: 'E',
    transferencia: 'L',
    registroCobro: 'H',
    registroCobroLegacy: 'H',
    marcaCobrado: 'AC',
    clearRanges: (row) => [
      `B${row}:N${row}`,
      `AB${row}:AD${row}`
    ]
  }
};

const CIERRE_DEL_DIA_CONFIG = {
  hojaDatos: 'Datos',
  hojaCierre: 'Cierre de caja',
  resumenFuente: 'B2:AT2',
  resumenDestino: {
    startRow: 2,
    endRow: 65,
    startColumn: 'AU',
    endColumn: 'CM'
  },
  hojasRepartidores: getRiderSheetNames(),
  hojasCobro: [
    ...getRiderSheetNames(),
    sheetsConfig.counterSheetName,
    sheetsConfig.pedidosYaPdfSheetName
  ].filter(Boolean)
};

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeRows(rows = []) {
  return [...new Set(
    (Array.isArray(rows) ? rows : [rows])
      .map((row) => Number(row))
      .filter((row) => Number.isInteger(row) && row >= 8)
  )].sort((a, b) => a - b);
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  let normalized = normalizeText(value).replace(/\$/g, '').replace(/\s/g, '');
  if (normalized.includes(',') && normalized.includes('.')) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (normalized.includes(',')) {
    normalized = normalized.replace(',', '.');
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isNumericLike(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return false;
  }

  return /\d/.test(normalized) && /^[$\d\s.,-]+$/.test(normalized);
}

function normalizeDatosArchiveCell(value, index) {
  if (index === 0) {
    return value;
  }

  if (typeof value === 'number') {
    return value;
  }

  if (isNumericLike(value)) {
    return toNumber(value);
  }

  return value;
}

function normalizeDatosArchiveRow(row = []) {
  return (Array.isArray(row) ? row : []).map((value, index) => normalizeDatosArchiveCell(value, index));
}

function formatHoraActual() {
  return new Intl.DateTimeFormat('es-UY', {
    timeZone: sheetsConfig.timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(new Date());
}

function getCobroProfile(sheetName) {
  if (!SHEET_ALLOWED_FOR_COBRO.has(sheetName)) {
    throw new Error(`La hoja ${sheetName} no esta habilitada para cobros.`);
  }

  return COBRO_PROFILES[sheetName] || COBRO_PROFILES.default;
}

function getA1(sheetName, column, row) {
  return `${sheetName}!${column}${row}`;
}

function getRangeA1(sheetName, range) {
  return `${sheetName}!${range}`;
}

function buildCobroDetalle(totalEfectivo, montoPago, vuelto) {
  const hora = formatHoraActual();
  if (toNumber(totalEfectivo) > 0) {
    return `COBRADO ${hora} | Efectivo ${toNumber(totalEfectivo)} | Pago ${toNumber(montoPago)} | Vuelto ${toNumber(vuelto)}`;
  }

  return `COBRADO ${hora}`;
}

function isFilaCobrada({ marcaCobrado, registroActual, legacyActual }) {
  if (normalizeText(marcaCobrado).toUpperCase() === 'COBRADO') return true;
  if (/COBRADO/i.test(normalizeText(registroActual))) return true;
  return /COBRADO/i.test(normalizeText(legacyActual));
}

function isEstadoPendienteCobro(estado) {
  return ['NO PAGADO', 'UNPAID', 'PENDIENTE', 'PENDING', ''].includes(
    normalizeText(estado).toUpperCase()
  );
}

function limpiarDetalleCobro(texto) {
  if (!texto) return '';

  const partes = String(texto)
    .split('|')
    .map((parte) => parte.trim())
    .filter(Boolean);

  const partesLimpias = partes.filter((parte) => {
    if (/^COBRADO\b/i.test(parte)) return false;
    if (/^Efectivo\b/i.test(parte)) return false;
    if (/^Pago\b/i.test(parte)) return false;
    if (/^Vuelto\b/i.test(parte)) return false;
    return true;
  });

  return partesLimpias.join(' | ');
}

function parseFechaLocal(value) {
  const normalized = normalizeText(value);
  if (!normalized) return null;

  const localizedMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (localizedMatch) {
    const [, day, month, year] = localizedMatch;
    const parsed = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00-03:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getSortKeyFecha(value) {
  const date = parseFechaLocal(value);
  return date ? date.getTime() : Number.MAX_SAFE_INTEGER;
}

async function getSingleCellValues(sheets, sheetName, row, profile) {
  const ranges = [
    getA1(sheetName, profile.estadoPago, row),
    getA1(sheetName, profile.efectivo, row),
    getA1(sheetName, profile.tarjeta, row),
    getA1(sheetName, profile.transferencia, row),
    getA1(sheetName, profile.registroCobro, row),
    getA1(sheetName, profile.registroCobroLegacy, row),
    getA1(sheetName, profile.marcaCobrado, row)
  ];

  const response = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: sheetsConfig.spreadsheetId,
    ranges
  });

  const valueRanges = response.data.valueRanges || [];
  return {
    estadoPago: valueRanges[0]?.values?.[0]?.[0] ?? '',
    efectivo: valueRanges[1]?.values?.[0]?.[0] ?? '',
    tarjeta: valueRanges[2]?.values?.[0]?.[0] ?? '',
    transferencia: valueRanges[3]?.values?.[0]?.[0] ?? '',
    registroActual: valueRanges[4]?.values?.[0]?.[0] ?? '',
    legacyActual: valueRanges[5]?.values?.[0]?.[0] ?? '',
    marcaCobrado: valueRanges[6]?.values?.[0]?.[0] ?? ''
  };
}

async function confirmarCobrosOperativos(payload = {}) {
  const sheetName = normalizeText(payload.sheetName);
  const rows = normalizeRows(payload.filas);
  const totalEfectivo = toNumber(payload.totalEfectivo);
  const montoPago = toNumber(payload.montoPago);
  const vuelto = toNumber(payload.vuelto);

  if (!sheetName) {
    throw new Error('Falta la hoja del cobro.');
  }

  if (rows.length === 0) {
    throw new Error('No se recibieron filas validas para cobrar.');
  }

  const profile = getCobroProfile(sheetName);
  const sheets = await getSheetsClient();
  const detalleCobro = buildCobroDetalle(totalEfectivo, montoPago, vuelto);
  const updates = [];

  for (const row of rows) {
    const current = await getSingleCellValues(sheets, sheetName, row, profile);
    const alreadyCobrado = isFilaCobrada(current);

    if (!alreadyCobrado) {
      const registroActual = normalizeText(current.registroActual);
      const nuevoRegistro = registroActual ? `${registroActual} | ${detalleCobro}` : detalleCobro;
      updates.push({
        range: getA1(sheetName, profile.registroCobro, row),
        values: [[nuevoRegistro]]
      });
    }

    if (normalizeText(current.marcaCobrado).toUpperCase() !== 'COBRADO') {
      updates.push({
        range: getA1(sheetName, profile.marcaCobrado, row),
        values: [['COBRADO']]
      });
    }

    updates.push({
      range: getA1(sheetName, profile.accion, row),
      values: [[false]]
    });

    if (
      sheetName === 'Lector Pedidosya' &&
      toNumber(current.efectivo) > 0 &&
      isEstadoPendienteCobro(current.estadoPago)
    ) {
      updates.push({
        range: getA1(sheetName, profile.estadoPago, row),
        values: [['PAGADO']]
      });
    }
  }

  if (updates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetsConfig.spreadsheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data: updates
      }
    });
  }

  if (getRiderSheetNames().includes(sheetName)) {
    await syncDatosRiderSummaries([sheetName]);
  }

  return {
    ok: true,
    updatedRows: rows
  };
}

async function quitarCobrosOperativos(payload = {}) {
  const sheetName = normalizeText(payload.sheetName);
  const rows = normalizeRows(payload.filas);

  if (!sheetName) {
    throw new Error('Falta la hoja del cobro.');
  }

  if (rows.length === 0) {
    throw new Error('No se recibieron filas validas para quitar.');
  }

  const profile = getCobroProfile(sheetName);
  const sheets = await getSheetsClient();
  const updates = [];

  for (const row of rows) {
    const current = await getSingleCellValues(sheets, sheetName, row, profile);
    const registroLimpio = limpiarDetalleCobro(current.registroActual);
    const legacyLimpio = limpiarDetalleCobro(current.legacyActual);

    updates.push(
      {
        range: getA1(sheetName, profile.registroCobro, row),
        values: [[registroLimpio]]
      },
      {
        range: getA1(sheetName, profile.marcaCobrado, row),
        values: [['']]
      },
      {
        range: getA1(sheetName, profile.accion, row),
        values: [[false]]
      }
    );

    if (profile.registroCobroLegacy && profile.registroCobroLegacy !== profile.registroCobro) {
      updates.push({
        range: getA1(sheetName, profile.registroCobroLegacy, row),
        values: [[legacyLimpio]]
      });
    }

    if (
      sheetName === sheetsConfig.pedidosYaPdfSheetName &&
      toNumber(current.efectivo) > 0 &&
      toNumber(current.tarjeta) <= 0 &&
      toNumber(current.transferencia) <= 0
    ) {
      updates.push({
        range: getA1(sheetName, profile.estadoPago, row),
        values: [['NO PAGADO']]
      });
    }
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetsConfig.spreadsheetId,
    requestBody: {
      valueInputOption: 'RAW',
      data: updates
    }
  });

  if (getRiderSheetNames().includes(sheetName)) {
    await syncDatosRiderSummaries([sheetName]);
  }

  return {
    ok: true,
    clearedRows: rows
  };
}

async function archivarResumenDatosCierre(sheets) {
  const hojaDatos = CIERRE_DEL_DIA_CONFIG.hojaDatos;
  const sourceRange = getRangeA1(hojaDatos, CIERRE_DEL_DIA_CONFIG.resumenFuente);
  const targetRangeA1 = `${CIERRE_DEL_DIA_CONFIG.resumenDestino.startColumn}${CIERRE_DEL_DIA_CONFIG.resumenDestino.startRow}:${CIERRE_DEL_DIA_CONFIG.resumenDestino.endColumn}${CIERRE_DEL_DIA_CONFIG.resumenDestino.endRow}`;

  const [sourceRes, targetRes] = await Promise.all([
    sheets.spreadsheets.values.get({
      spreadsheetId: sheetsConfig.spreadsheetId,
      range: sourceRange
    }),
    sheets.spreadsheets.values.get({
      spreadsheetId: sheetsConfig.spreadsheetId,
      range: getRangeA1(hojaDatos, targetRangeA1)
    })
  ]);

  const sourceRow = sourceRes.data.values?.[0] || [];
  if (sourceRow.every((cell) => normalizeText(cell) === '')) {
    return {
      archived: false,
      reason: 'Sin datos en B2:AT2'
    };
  }

  const normalizedSourceRow = normalizeDatosArchiveRow(sourceRow);

  const existingRows = (targetRes.data.values || []).filter((row) =>
    row.some((cell) => normalizeText(cell) !== '')
  );
  const width = sourceRow.length;
  const fingerprint = JSON.stringify(normalizedSourceRow);
  const alreadyExists = existingRows.some((row) => JSON.stringify(normalizeDatosArchiveRow(row.slice(0, width))) === fingerprint);

  const registros = alreadyExists
    ? existingRows.slice()
    : [...existingRows, normalizedSourceRow.slice(0, width)];

  if (registros.length > (CIERRE_DEL_DIA_CONFIG.resumenDestino.endRow - CIERRE_DEL_DIA_CONFIG.resumenDestino.startRow + 1)) {
    throw new Error(`No hay lugar libre en Datos!${targetRangeA1} para guardar otro cierre.`);
  }

  registros.sort((left, right) => getSortKeyFecha(left[0]) - getSortKeyFecha(right[0]));

  const writeRange = `${CIERRE_DEL_DIA_CONFIG.resumenDestino.startColumn}${CIERRE_DEL_DIA_CONFIG.resumenDestino.startRow}:${CIERRE_DEL_DIA_CONFIG.resumenDestino.endColumn}${CIERRE_DEL_DIA_CONFIG.resumenDestino.startRow + registros.length - 1}`;
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetsConfig.spreadsheetId,
    range: getRangeA1(hojaDatos, writeRange),
    valueInputOption: 'RAW',
    requestBody: {
      values: registros
    }
  });

  const remainingRows = (CIERRE_DEL_DIA_CONFIG.resumenDestino.endRow - CIERRE_DEL_DIA_CONFIG.resumenDestino.startRow + 1) - registros.length;
  if (remainingRows > 0) {
    const clearStart = CIERRE_DEL_DIA_CONFIG.resumenDestino.startRow + registros.length;
    const clearRange = `${CIERRE_DEL_DIA_CONFIG.resumenDestino.startColumn}${clearStart}:${CIERRE_DEL_DIA_CONFIG.resumenDestino.endColumn}${CIERRE_DEL_DIA_CONFIG.resumenDestino.endRow}`;
    await sheets.spreadsheets.values.clear({
      spreadsheetId: sheetsConfig.spreadsheetId,
      range: getRangeA1(hojaDatos, clearRange)
    });
  }

  return {
    archived: !alreadyExists,
    duplicateSkipped: alreadyExists,
    rowCount: registros.length
  };
}

async function copiarValoresCierreCaja(sheets) {
  const ranges = [
    getRangeA1(CIERRE_DEL_DIA_CONFIG.hojaCierre, 'G22:G27'),
    getRangeA1(CIERRE_DEL_DIA_CONFIG.hojaCierre, 'G29:G33')
  ];

  const response = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: sheetsConfig.spreadsheetId,
    ranges
  });

  const bloqueUno = response.data.valueRanges?.[0]?.values || Array.from({ length: 6 }, () => ['']);
  const bloqueDos = response.data.valueRanges?.[1]?.values || Array.from({ length: 5 }, () => ['']);

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetsConfig.spreadsheetId,
    requestBody: {
      valueInputOption: 'RAW',
      data: [
        { range: getRangeA1(CIERRE_DEL_DIA_CONFIG.hojaCierre, 'B22:B27'), values: bloqueUno },
        { range: getRangeA1(CIERRE_DEL_DIA_CONFIG.hojaCierre, 'B29:B33'), values: bloqueDos }
      ]
    }
  });
}

async function limpiarCobrosOperativosCierre(sheets) {
  const clearRanges = [];
  const checkboxUpdates = [];

  CIERRE_DEL_DIA_CONFIG.hojasCobro.forEach((sheetName) => {
    clearRanges.push(
      getRangeA1(sheetName, 'AB8:AC114')
    );
    checkboxUpdates.push({
      range: getRangeA1(sheetName, 'A8:A114'),
      values: Array.from({ length: 107 }, () => [false])
    });
  });

  if (clearRanges.length > 0) {
    await sheets.spreadsheets.values.batchClear({
      spreadsheetId: sheetsConfig.spreadsheetId,
      requestBody: { ranges: clearRanges }
    });
  }

  if (checkboxUpdates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetsConfig.spreadsheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data: checkboxUpdates
      }
    });
  }
}

async function limpiarHojasOperativasDelDia(sheets) {
  const clearRanges = [];

  CIERRE_DEL_DIA_CONFIG.hojasRepartidores.forEach((sheetName) => {
    ['B8:AA114', 'F2:G2', 'K4:L4', 'M2'].forEach((range) => {
      clearRanges.push(getRangeA1(sheetName, range));
    });
  });

  if (sheetsConfig.counterSheetName) {
    ['B8:AA114', 'K2'].forEach((range) => {
      clearRanges.push(getRangeA1(sheetsConfig.counterSheetName, range));
    });
  }

  if (sheetsConfig.pedidosYaPdfSheetName) {
    clearRanges.push(getRangeA1(sheetsConfig.pedidosYaPdfSheetName, 'B8:AA114'));
  }

  [
    'B11:B15',
    'D11:D15',
    'G6',
    'G9',
    'G12',
    'G15',
    'G39:G45',
    'G47:G51'
  ].forEach((range) => {
    clearRanges.push(getRangeA1(CIERRE_DEL_DIA_CONFIG.hojaCierre, range));
  });

  await sheets.spreadsheets.values.batchClear({
    spreadsheetId: sheetsConfig.spreadsheetId,
    requestBody: { ranges: clearRanges }
  });
}

async function procesarCierreDelDiaOperativo() {
  const sheets = await getSheetsClient();
  const archivo = await archivarResumenDatosCierre(sheets);
  await copiarValoresCierreCaja(sheets);
  await limpiarCobrosOperativosCierre(sheets);
  await limpiarHojasOperativasDelDia(sheets);
  await syncDatosRiderSummaries();

  return {
    ok: true,
    archivo
  };
}

module.exports = {
  confirmarCobrosOperativos,
  quitarCobrosOperativos,
  procesarCierreDelDiaOperativo,
  __internals: {
    getCobroProfile,
    buildCobroDetalle,
    isEstadoPendienteCobro
  }
};
