const { google } = require('googleapis');
const path = require('path');
const sheetsConfig = require('../config/sheetsConfig');

let sheetsClientPromise = null;

function getGoogleAuth() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);

      if (!credentials.client_email || !credentials.private_key) {
        throw new Error('Faltan client_email o private_key.');
      }

      return new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });
    } catch (error) {
      console.error('[GOOGLE AUTH] GOOGLE_SERVICE_ACCOUNT_JSON invalido:', error.message);
      throw new Error('La variable GOOGLE_SERVICE_ACCOUNT_JSON no contiene un JSON valido de service account.');
    }
  }

  return new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, '../../credentials/google-service-account.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
}

async function getSheetsClient() {
  if (!sheetsClientPromise) {
    sheetsClientPromise = (async () => {
      const auth = getGoogleAuth();
      const client = await auth.getClient();

      return google.sheets({
        version: 'v4',
        auth: client
      });
    })().catch((error) => {
      sheetsClientPromise = null;
      throw error;
    });
  }

  return sheetsClientPromise;
}

function getUniqueSheetNames() {
  return [
    ...new Set([
      ...Object.values(sheetsConfig.riderSheets || {}),
      ...Object.keys(sheetsConfig.sheetProfiles || {})
    ])
  ];
}

function getRiderSheetNames() {
  return [...new Set(Object.values(sheetsConfig.riderSheets || {}))];
}

function getSheetProfile(sheetName) {
  const profile = sheetsConfig.sheetProfiles && sheetsConfig.sheetProfiles[sheetName]
    ? sheetsConfig.sheetProfiles[sheetName]
    : null;

  return {
    dataStartRow: profile && profile.dataStartRow ? profile.dataStartRow : sheetsConfig.dataStartRow,
    sheetBounds: profile && profile.sheetBounds ? profile.sheetBounds : sheetsConfig.sheetBounds,
    columns: profile && profile.columns ? profile.columns : sheetsConfig.columns
  };
}

function normalizeCell(value) {
  return String(value || '').trim().replace(/^'/, '');
}

function normalizePhone(value) {
  return String(value || '').replace(/[^\d+]/g, '').trim();
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  let normalized = normalizeCell(value).replace(/\$/g, '').replace(/\s/g, '');

  if (normalized.includes(',') && normalized.includes('.')) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (normalized.includes(',')) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getManagedColumns() {
  return Object.values(sheetsConfig.columns).filter(Boolean);
}

function getManagedColumnsForSheet(sheetName) {
  const profile = getSheetProfile(sheetName);
  return Object.values(profile.columns).filter(Boolean);
}

function columnLetterToNumber(column) {
  return String(column || '')
    .trim()
    .toUpperCase()
    .split('')
    .reduce((acc, char) => (acc * 26) + char.charCodeAt(0) - 64, 0);
}

function getColumnRange(sheetName, column, startRow) {
  return `${sheetName}!${column}${startRow}:${column}`;
}

function getTransferLogConfig() {
  return sheetsConfig.transferLog || {
    sheetName: '',
    headerRow: 0,
    dataStartRow: 0,
    dataEndRow: 0,
    columns: {}
  };
}

function getDatosRiderSummaryConfig() {
  return {
    sheetName: 'Datos',
    blocks: {
      Diogo: {
        titleCell: 'A4',
        title: 'DIOGO',
        dataRange: 'A6:O6'
      },
      Mauro: {
        titleCell: 'S4',
        title: 'Mauro',
        dataRange: 'S6:AG6'
      },
      Brisa: {
        titleCell: 'A27',
        title: 'Brisa',
        dataRange: 'A29:O29'
      },
      GIAN: {
        titleCell: 'S27',
        title: 'GIAN',
        dataRange: 'S29:AG29'
      },
      LIBRE1: {
        titleCell: 'A54',
        title: 'LIBRE1',
        dataRange: 'B55:P55'
      }
    }
  };
}

function getMatrixValue(matrix, rowIndex, columnIndex) {
  return matrix?.[rowIndex]?.[columnIndex] ?? '';
}

function formatDatosDay() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: sheetsConfig.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: 'numeric'
  }).formatToParts(new Date());

  const map = {};
  parts.forEach((part) => {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  });

  if (!map.day || !map.month || !map.year) {
    return '';
  }

  return `${Number(map.day)}/${map.month}/${map.year}`;
}

function formatDatosMoney(value, options = {}) {
  const { blankWhenZero = false } = options;
  const amount = toNumber(value);

  if (!amount && blankWhenZero) {
    return '';
  }

  return `$${Math.trunc(amount)}`;
}

function formatDatosPlainNumber(value) {
  return String(Math.trunc(toNumber(value)));
}

function buildDatosRiderSummaryRow(formattedMatrix = [], rawMatrix = []) {
  const totalPedidos = toNumber(getMatrixValue(rawMatrix, 0, 3));
  if (totalPedidos <= 0) {
    return new Array(15).fill('');
  }

  const totalHoras = toNumber(getMatrixValue(rawMatrix, 0, 10)) + toNumber(getMatrixValue(rawMatrix, 0, 11));

  return [
    formatDatosDay(),
    formatDatosMoney(getMatrixValue(rawMatrix, 0, 6)),
    formatDatosMoney(getMatrixValue(rawMatrix, 0, 8)),
    formatDatosMoney(getMatrixValue(rawMatrix, 0, 9)),
    formatDatosMoney(totalHoras),
    formatDatosMoney(getMatrixValue(rawMatrix, 2, 13)),
    formatDatosMoney(getMatrixValue(rawMatrix, 0, 12), { blankWhenZero: true }),
    formatDatosMoney(getMatrixValue(rawMatrix, 0, 13)),
    formatDatosPlainNumber(getMatrixValue(rawMatrix, 0, 0)),
    formatDatosPlainNumber(getMatrixValue(rawMatrix, 0, 1)),
    formatDatosPlainNumber(getMatrixValue(rawMatrix, 0, 2)),
    formatDatosPlainNumber(getMatrixValue(rawMatrix, 0, 3)),
    '',
    normalizeCell(getMatrixValue(formattedMatrix, 2, 10)),
    normalizeCell(getMatrixValue(formattedMatrix, 2, 11))
  ];
}

function parseDateValue(value) {
  if (!value) return null;

  const normalized = normalizeCell(value);
  const localizedMatch = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (localizedMatch) {
    const [, day, month, year] = localizedMatch;
    return new Date(`${year}-${month}-${day}T00:00:00-03:00`);
  }

  const directDate = new Date(value);
  if (!Number.isNaN(directDate.getTime())) {
    return directDate;
  }

  return null;
}

function getDatePartsInSheetTimeZone(value) {
  const date = parseDateValue(value);
  if (!date) return null;

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: sheetsConfig.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);

  const map = {};
  parts.forEach((part) => {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  });

  if (!map.year || !map.month || !map.day) {
    return null;
  }

  return map;
}

function formatTransferLogMonth(value) {
  const parts = getDatePartsInSheetTimeZone(value);
  if (!parts) return '';

  return String(Number(parts.month));
}

function formatTransferLogDate(value) {
  const parts = getDatePartsInSheetTimeZone(value);
  if (!parts) return '';

  return `${Number(parts.day)}/${parts.month}`;
}

function formatTransferLogPhone(value) {
  return normalizeCell(value);
}

function getTransferLogCourier(sheetName, data = {}) {
  return normalizeCell(data.repartidor || data.riderHint || sheetName);
}

function isRiderSheetName(sheetName) {
  return getRiderSheetNames().includes(sheetName);
}

function getRowCell(row, columnLetter) {
  if (!Array.isArray(row) || !columnLetter) return '';
  return row[columnLetterToNumber(columnLetter) - 1] ?? '';
}

function enrichTransferLogDataFromSheetRow(sheetName, data = {}, row = []) {
  if (!isRiderSheetName(sheetName)) {
    return {
      ...data,
      propinaTransferencia: data.propinaTransferencia ?? ''
    };
  }

  return {
    ...data,
    anotaciones: normalizeCell(getRowCell(row, 'M')) || data.anotaciones || '',
    telefono: normalizeCell(getRowCell(row, 'X')) || data.telefono || '',
    propinaTransferencia: getRowCell(row, 'J') || data.propinaTransferencia || ''
  };
}

function buildTransferLogKey(sheetName, data = {}) {
  const numeroPedido = normalizeCell(data.numeroPedidoVisible || data.numeroPedidoInterno);
  const fecha = formatTransferLogDate(data.fecha);
  const repartidor = getTransferLogCourier(sheetName, data);

  if (!numeroPedido && !fecha && !repartidor) {
    return '';
  }

  return `${numeroPedido}::${fecha}::${repartidor}`;
}

function buildTransferLogEntry(sheetName, data = {}) {
  const amount = toNumber(data.importeTransferenciaVisible || data.transferencia);
  if (amount <= 0) {
    return null;
  }

  return {
    mes: formatTransferLogMonth(data.fecha),
    fecha: formatTransferLogDate(data.fecha),
    numeroPedido: normalizeCell(data.numeroPedidoVisible || data.numeroPedidoInterno),
    cliente: normalizeCell(data.cliente),
    importe: amount,
    telefono: formatTransferLogPhone(data.telefono),
    anotaciones: normalizeCell(data.anotaciones),
    repartidor: getTransferLogCourier(sheetName, data),
    propinaTransferencia: toNumber(data.propinaTransferencia),
    syncKey: buildTransferLogKey(sheetName, data)
  };
}

async function getTransferLogRowState(sheets, transferConfig, syncKey) {
  const { sheetName, dataStartRow, dataEndRow, columns } = transferConfig;
  const totalRows = Math.max((dataEndRow || dataStartRow) - dataStartRow + 1, 1);
  const ranges = [
    `${sheetName}!${columns.numeroPedido}${dataStartRow}:${columns.numeroPedido}${dataEndRow}`,
    `${sheetName}!${columns.fecha}${dataStartRow}:${columns.fecha}${dataEndRow}`,
    `${sheetName}!${columns.repartidor}${dataStartRow}:${columns.repartidor}${dataEndRow}`
  ];

  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: sheetsConfig.spreadsheetId,
    ranges
  });

  const valueRanges = res.data.valueRanges || [];
  const numeroPedidos = valueRanges[0]?.values || [];
  const fechas = valueRanges[1]?.values || [];
  const repartidores = valueRanges[2]?.values || [];
  const maxLength = Math.max(totalRows, numeroPedidos.length, fechas.length, repartidores.length);

  let lastUsedIndex = -1;
  let existingRow = null;

  for (let index = 0; index < maxLength; index += 1) {
    const currentNumero = normalizeCell(numeroPedidos[index]?.[0]);
    const currentFecha = normalizeCell(fechas[index]?.[0]);
    const currentRepartidor = normalizeCell(repartidores[index]?.[0]);
    const currentKey = `${currentNumero}::${currentFecha}::${currentRepartidor}`;

    if (currentNumero || currentFecha || currentRepartidor) {
      lastUsedIndex = index;
    }

    if (syncKey && currentKey === syncKey) {
      existingRow = dataStartRow + index;
    }
  }

  return {
    existingRow,
    nextRow: dataStartRow + lastUsedIndex + 1,
    isFull: dataStartRow + lastUsedIndex + 1 > dataEndRow
  };
}

async function writeTransferLogEntry(sheets, transferConfig, rowNumber, entry) {
  const { sheetName, columns } = transferConfig;

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetsConfig.spreadsheetId,
    requestBody: {
      valueInputOption: 'RAW',
      data: [
        { range: `${sheetName}!${columns.mes}${rowNumber}`, values: [[entry.mes || '']] },
        { range: `${sheetName}!${columns.fecha}${rowNumber}`, values: [[entry.fecha || '']] },
        { range: `${sheetName}!${columns.numeroPedido}${rowNumber}`, values: [[entry.numeroPedido || '']] },
        { range: `${sheetName}!${columns.cliente}${rowNumber}`, values: [[entry.cliente || '']] },
        { range: `${sheetName}!${columns.importe}${rowNumber}`, values: [[entry.importe || '']] },
        { range: `${sheetName}!${columns.telefono}${rowNumber}`, values: [[entry.telefono || '']] },
        { range: `${sheetName}!${columns.anotaciones}${rowNumber}`, values: [[entry.anotaciones || '']] },
        { range: `${sheetName}!${columns.repartidor}${rowNumber}`, values: [[entry.repartidor || '']] },
        { range: `${sheetName}!${columns.propinaTransferencia}${rowNumber}`, values: [[entry.propinaTransferencia || '']] }
      ]
    }
  });
}

async function syncTransferLogEntry(sheetName, data = {}, rowNumber = null) {
  const transferConfig = getTransferLogConfig();
  if (!transferConfig.sheetName || normalizeCell(sheetName) === normalizeCell(transferConfig.sheetName)) {
    return null;
  }

  let sourceData = data;
  if (rowNumber && isRiderSheetName(sheetName)) {
    const sheets = await getSheetsClient();
    const rowRes = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetsConfig.spreadsheetId,
      range: `${sheetName}!A${rowNumber}:AD${rowNumber}`
    });
    const rowValues = rowRes.data.values?.[0] || [];
    sourceData = enrichTransferLogDataFromSheetRow(sheetName, data, rowValues);
    const entry = buildTransferLogEntry(sheetName, sourceData);
    if (!entry) {
      return null;
    }

    const state = await getTransferLogRowState(sheets, transferConfig, entry.syncKey);
    if (!state.existingRow && state.isFull) {
      throw new Error(`La tabla de transferencias ${transferConfig.sheetName}!${transferConfig.columns.mes}${transferConfig.dataStartRow}:${transferConfig.columns.repartidor}${transferConfig.dataEndRow} ya no tiene filas libres.`);
    }
    const targetRowNumber = state.existingRow || state.nextRow;

    await writeTransferLogEntry(sheets, transferConfig, targetRowNumber, entry);

    return {
      sheetName: transferConfig.sheetName,
      rowNumber: targetRowNumber,
      syncKey: entry.syncKey,
      updated: Boolean(state.existingRow)
    };
  }

  const entry = buildTransferLogEntry(sheetName, sourceData);
  if (!entry) {
    return null;
  }

  const sheets = await getSheetsClient();
  const state = await getTransferLogRowState(sheets, transferConfig, entry.syncKey);
  if (!state.existingRow && state.isFull) {
    throw new Error(`La tabla de transferencias ${transferConfig.sheetName}!${transferConfig.columns.mes}${transferConfig.dataStartRow}:${transferConfig.columns.repartidor}${transferConfig.dataEndRow} ya no tiene filas libres.`);
  }
  const targetRowNumber = state.existingRow || state.nextRow;

  await writeTransferLogEntry(sheets, transferConfig, targetRowNumber, entry);

  return {
    sheetName: transferConfig.sheetName,
    rowNumber: targetRowNumber,
    syncKey: entry.syncKey,
    updated: Boolean(state.existingRow)
  };
}

async function syncAllCurrentTransferRowsToDatos() {
  const sheets = await getSheetsClient();
  const sourceSheets = [
    ...getRiderSheetNames(),
    sheetsConfig.counterSheetName,
    sheetsConfig.pedidosYaSheetName,
    sheetsConfig.pedidosYaPdfSheetName
  ].filter(Boolean);
  const uniqueSheetNames = [...new Set(sourceSheets)];
  const results = [];

  for (const sheetName of uniqueSheetNames) {
    if (sheetName === getTransferLogConfig().sheetName) {
      continue;
    }

    const profile = getSheetProfile(sheetName);
    const maxColumn = Math.max(...Object.values(profile.columns).filter(Boolean).map(columnLetterToNumber));
    const endColumnLetter = Object.entries(profile.columns)
      .find(([, letter]) => columnLetterToNumber(letter) === maxColumn)?.[1] || 'A';

    let res;
    try {
      res = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetsConfig.spreadsheetId,
        range: `${sheetName}!A${profile.dataStartRow}:${endColumnLetter}`
      });
    } catch (error) {
      if (/Unable to parse range/i.test(String(error.message || ''))) {
        results.push({ sheetName, synced: 0, skipped: true });
        continue;
      }

      throw error;
    }

    const rows = res.data.values || [];
    let synced = 0;

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const valueByField = {};

      Object.entries(profile.columns).forEach(([field, letter]) => {
        if (!letter) return;
        valueByField[field] = row[columnLetterToNumber(letter) - 1] ?? '';
      });

      const enrichedValueByField = enrichTransferLogDataFromSheetRow(
        sheetName,
        valueByField,
        row
      );
      const entry = buildTransferLogEntry(sheetName, enrichedValueByField);
      if (!entry) continue;

      await syncTransferLogEntry(
        sheetName,
        enrichedValueByField,
        profile.dataStartRow + index
      );
      synced += 1;
    }

    results.push({ sheetName, synced });
  }

  return {
    ok: true,
    results
  };
}

async function syncDatosRiderSummaries() {
  const datosConfig = getDatosRiderSummaryConfig();
  const riderSheets = Object.keys(datosConfig.blocks);
  const sheets = await getSheetsClient();
  const summaryRanges = riderSheets.map((sheetName) => `${sheetName}!A2:N4`);

  const [formattedRes, rawRes] = await Promise.all([
    sheets.spreadsheets.values.batchGet({
      spreadsheetId: sheetsConfig.spreadsheetId,
      ranges: summaryRanges
    }),
    sheets.spreadsheets.values.batchGet({
      spreadsheetId: sheetsConfig.spreadsheetId,
      ranges: summaryRanges,
      valueRenderOption: 'UNFORMATTED_VALUE'
    })
  ]);

  const formattedRanges = formattedRes.data.valueRanges || [];
  const rawRanges = rawRes.data.valueRanges || [];
  const updates = [];

  riderSheets.forEach((sheetName, index) => {
    const block = datosConfig.blocks[sheetName];
    if (!block) return;

    const formattedMatrix = formattedRanges[index]?.values || [];
    const rawMatrix = rawRanges[index]?.values || [];
    const rowValues = buildDatosRiderSummaryRow(formattedMatrix, rawMatrix);

    if (block.titleCell && block.title) {
      updates.push({
        range: `${datosConfig.sheetName}!${block.titleCell}`,
        values: [[block.title]]
      });
    }

    updates.push({
      range: `${datosConfig.sheetName}!${block.dataRange}`,
      values: [rowValues]
    });
  });

  if (!updates.length) {
    return { ok: true, updatedRanges: [] };
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetsConfig.spreadsheetId,
    requestBody: {
      valueInputOption: 'RAW',
      data: updates
    }
  });

  return {
    ok: true,
    updatedRanges: updates.map((update) => update.range)
  };
}

function buildDayKey(value) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const normalizedText = normalizeCell(value);
    const match = normalizedText.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (match) {
      return `${match[3]}-${match[2]}-${match[1]}`;
    }

    return '';
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: sheetsConfig.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  return formatter.format(date);
}

function parseSheetDayKey(value) {
  const normalized = normalizeCell(value);
  if (!normalized) return '';

  const localizedMatch = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (localizedMatch) {
    return `${localizedMatch[3]}-${localizedMatch[2]}-${localizedMatch[1]}`;
  }

  const isoDate = new Date(normalized);
  if (!Number.isNaN(isoDate.getTime())) {
    return buildDayKey(isoDate.toISOString());
  }

  return '';
}

function buildOrderLookup(orderOrId) {
  if (!orderOrId) {
    return {
      numeroPedidoInterno: '',
      nroPedido: '',
      dayKey: ''
    };
  }

  if (typeof orderOrId === 'string') {
    return {
      numeroPedidoInterno: normalizeCell(orderOrId),
      nroPedido: normalizeCell(orderOrId),
      dayKey: ''
    };
  }

  return {
    numeroPedidoInterno: normalizeCell(orderOrId.numeroPedidoInterno),
    nroPedido: normalizeCell(orderOrId.nroPedido),
    dayKey: buildDayKey(orderOrId.fecha)
  };
}

function getLookupMatch({ orderLookup, primaryValue, legacyValue, trackingValue, rowDayKey }) {
  if (
    orderLookup.nroPedido &&
    (
      (legacyValue && orderLookup.nroPedido === legacyValue) ||
      (trackingValue && orderLookup.nroPedido === trackingValue)
    )
  ) {
    return true;
  }

  if (!orderLookup.numeroPedidoInterno || !primaryValue) {
    return false;
  }

  if (orderLookup.numeroPedidoInterno !== primaryValue) {
    return false;
  }

  if (!orderLookup.dayKey) {
    return true;
  }

  return orderLookup.dayKey === rowDayKey;
}

async function getNextEmptyRow(sheetName) {
  const sheets = await getSheetsClient();
  const profile = getSheetProfile(sheetName);
  const startRow = profile.dataStartRow;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetsConfig.spreadsheetId,
    range: getColumnRange(sheetName, profile.columns.numeroPedidoInterno, startRow)
  });

  const values = res.data.values || [];

  for (let index = 0; index < values.length; index += 1) {
    const cellValue = normalizeCell(values[index]?.[0]);
    if (!cellValue) {
      const nextRow = startRow + index;

      console.log('[SHEETS] Reutilizando fila vacia detectada', { sheetName, nextRow });
      return nextRow;
    }
  }

  const nextRow = startRow + values.length;

  console.log('[SHEETS] Proxima fila detectada', { sheetName, nextRow });
  return nextRow;
}

async function findOrderRowsInSheet(sheetName, orderOrId) {
  const orderLookup = buildOrderLookup(orderOrId);
  if (!orderLookup.numeroPedidoInterno && !orderLookup.nroPedido) {
    return [];
  }

  const sheets = await getSheetsClient();
  const profile = getSheetProfile(sheetName);
  const ranges = [
    getColumnRange(sheetName, profile.columns.numeroPedidoInterno, profile.dataStartRow),
    getColumnRange(sheetName, profile.columns.fecha, profile.dataStartRow)
  ];

  const hasLegacyColumn = Boolean(profile.columns.numeroPedidoVisible);
  const hasTrackingColumn = Boolean(profile.columns.nroPedidoTracking);
  if (hasLegacyColumn) {
    ranges.push(getColumnRange(sheetName, profile.columns.numeroPedidoVisible, profile.dataStartRow));
  }
  if (hasTrackingColumn) {
    ranges.push(getColumnRange(sheetName, profile.columns.nroPedidoTracking, profile.dataStartRow));
  }

  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: sheetsConfig.spreadsheetId,
    ranges
  });

  const valueRanges = res.data.valueRanges || [];
  const primaryValues = valueRanges[0]?.values || [];
  const fechaValues = valueRanges[1]?.values || [];
  const legacyValues = hasLegacyColumn ? valueRanges[2]?.values || [] : [];
  const trackingValues = hasTrackingColumn
    ? valueRanges[hasLegacyColumn ? 3 : 2]?.values || []
    : [];

  const matchedRows = [];
  const maxLength = Math.max(primaryValues.length, fechaValues.length, legacyValues.length, trackingValues.length);

  for (let index = 0; index < maxLength; index += 1) {
    const primaryValue = normalizeCell(primaryValues[index]?.[0]);
    const fechaValue = normalizeCell(fechaValues[index]?.[0]);
    const legacyValue = normalizeCell(legacyValues[index]?.[0]);
    const trackingValue = normalizeCell(trackingValues[index]?.[0]);
    const rowDayKey = parseSheetDayKey(fechaValue);

    if (getLookupMatch({ orderLookup, primaryValue, legacyValue, trackingValue, rowDayKey })) {
      matchedRows.push({
        sheetName,
        rowNumber: profile.dataStartRow + index
      });
    }
  }

  return matchedRows;
}

async function findOrderAcrossSheets(orderOrId) {
  const uniqueSheets = getUniqueSheetNames();
  return findOrderAcrossSheetNames(orderOrId, uniqueSheets);
}

async function findOrderAcrossSheetNames(orderOrId, sheetNames = []) {
  const uniqueSheets = [...new Set((sheetNames || []).filter(Boolean))];
  const matches = [];

  for (const sheetName of uniqueSheets) {
    const rows = await findOrderRowsInSheet(sheetName, orderOrId);
    matches.push(...rows);
  }

  return matches.sort((left, right) => {
    if (left.sheetName === right.sheetName) {
      return left.rowNumber - right.rowNumber;
    }

    return left.sheetName.localeCompare(right.sheetName);
  });
}

async function findOrderAcrossRiderSheets(orderOrId) {
  const riderSheets = getRiderSheetNames();
  return findOrderAcrossSheetNames(orderOrId, riderSheets);
}

async function findOrderRowsByPhoneAndDayInSheet(sheetName, order = {}) {
  const normalizedPhone = normalizePhone(order.telefono);
  const orderDayKey = buildDayKey(order.fecha);
  const orderTotal = Number(order.total) || 0;

  if (!normalizedPhone || !orderDayKey) {
    return [];
  }

  const sheets = await getSheetsClient();
  const profile = getSheetProfile(sheetName);
  const ranges = [
    getColumnRange(sheetName, profile.columns.telefono, profile.dataStartRow),
    getColumnRange(sheetName, profile.columns.fecha, profile.dataStartRow)
  ];

  if (profile.columns.total) ranges.push(getColumnRange(sheetName, profile.columns.total, profile.dataStartRow));
  if (profile.columns.tarjeta) ranges.push(getColumnRange(sheetName, profile.columns.tarjeta, profile.dataStartRow));
  if (profile.columns.efectivo) ranges.push(getColumnRange(sheetName, profile.columns.efectivo, profile.dataStartRow));
  if (profile.columns.transferencia) ranges.push(getColumnRange(sheetName, profile.columns.transferencia, profile.dataStartRow));

  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: sheetsConfig.spreadsheetId,
    ranges
  });

  const valueRanges = res.data.valueRanges || [];
  const telefonoValues = valueRanges[0]?.values || [];
  const fechaValues = valueRanges[1]?.values || [];
  const totalValues = valueRanges[2]?.values || [];
  const tarjetaValues = valueRanges[3]?.values || [];
  const efectivoValues = valueRanges[4]?.values || [];
  const transferenciaValues = valueRanges[5]?.values || [];

  const matchedRows = [];
  const maxLength = Math.max(
    telefonoValues.length,
    fechaValues.length,
    totalValues.length,
    tarjetaValues.length,
    efectivoValues.length,
    transferenciaValues.length
  );

  for (let index = 0; index < maxLength; index += 1) {
    const rowPhone = normalizePhone(telefonoValues[index]?.[0]);
    const rowDayKey = parseSheetDayKey(fechaValues[index]?.[0]);

    if (!rowPhone || rowPhone !== normalizedPhone || rowDayKey !== orderDayKey) {
      continue;
    }

    const rowTotal =
      toNumber(totalValues[index]?.[0]) +
      toNumber(tarjetaValues[index]?.[0]) +
      toNumber(efectivoValues[index]?.[0]) +
      toNumber(transferenciaValues[index]?.[0]);

    if (orderTotal > 0 && rowTotal > 0 && Math.abs(rowTotal - orderTotal) > 0.01) {
      continue;
    }

    matchedRows.push({
      sheetName,
      rowNumber: profile.dataStartRow + index
    });
  }

  return matchedRows;
}

async function findOrderAcrossRiderSheetsByPhoneAndDay(order) {
  const riderSheets = getRiderSheetNames();
  const matches = [];

  for (const sheetName of riderSheets) {
    const rows = await findOrderRowsByPhoneAndDayInSheet(sheetName, order);
    matches.push(...rows);
  }

  return matches.sort((left, right) => {
    if (left.sheetName === right.sheetName) {
      return left.rowNumber - right.rowNumber;
    }

    return left.sheetName.localeCompare(right.sheetName);
  });
}

async function writeOrderToSheet(sheetName, row, data) {
  const sheets = await getSheetsClient();
  const profile = getSheetProfile(sheetName);

  const updates = Object.entries(profile.columns)
    .filter(([, column]) => Boolean(column))
    .map(([field, column]) => ({
      range: `${sheetName}!${column}${row}`,
      values: [[data[field] ?? '']]
    }));

  console.log('[SHEETS] Escribiendo pedido en hoja', {
    sheetName,
    row,
    fields: Object.keys(data)
  });

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetsConfig.spreadsheetId,
    requestBody: {
      valueInputOption: 'RAW',
      data: updates
    }
  });

  await syncTransferLogEntry(sheetName, data, row);

  if (getRiderSheetNames().includes(sheetName)) {
    await syncDatosRiderSummaries();
  }
}

async function getOrderRowSnapshot(sheetName, row) {
  const sheets = await getSheetsClient();
  const profile = getSheetProfile(sheetName);
  const activeColumns = Object.entries(profile.columns).filter(([, column]) => Boolean(column));
  const ranges = activeColumns.map(([, column]) => `${sheetName}!${column}${row}`);

  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: sheetsConfig.spreadsheetId,
    ranges
  });

  const valueByField = {};
  const valueRanges = res.data.valueRanges || [];

  activeColumns.forEach(([field], index) => {
    valueByField[field] = valueRanges[index]?.values?.[0]?.[0] ?? '';
  });

  return {
    serviceLabel: normalizeCell(valueByField.serviceLabel),
    numeroPedidoInterno: normalizeCell(valueByField.numeroPedidoInterno),
    estadoPago: normalizeCell(valueByField.estadoPago),
    total: toNumber(valueByField.total),
    tarjeta: toNumber(valueByField.tarjeta),
    efectivo: toNumber(valueByField.efectivo),
    transferencia: toNumber(valueByField.transferencia),
    enviosLejanos: toNumber(valueByField.enviosLejanos),
    propinaWeb: toNumber(valueByField.propinaWeb),
    salidaDinero: normalizeCell(valueByField.salidaDinero),
    enCamino: normalizeCell(valueByField.enCamino),
    pedidoListo: normalizeCell(valueByField.pedidoListo),
    finalizado: normalizeCell(valueByField.finalizado),
    estadoPedido: normalizeCell(valueByField.estadoPedido),
    anotaciones: normalizeCell(valueByField.anotaciones),
    datosTransferencia: normalizeCell(valueByField.datosTransferencia),
    numeroPedidoVisible: normalizeCell(valueByField.numeroPedidoVisible),
    nroPedidoTracking: normalizeCell(valueByField.nroPedidoTracking),
    importeTransferenciaVisible: toNumber(valueByField.importeTransferenciaVisible),
    cliente: normalizeCell(valueByField.cliente),
    repartidor: normalizeCell(valueByField.repartidor),
    telefono: normalizeCell(valueByField.telefono),
    fecha: normalizeCell(valueByField.fecha)
  };
}

async function clearOrderRow(sheetName, row) {
  const sheets = await getSheetsClient();
  const ranges = getManagedColumnsForSheet(sheetName).map((column) => `${sheetName}!${column}${row}`);

  console.log('[SHEETS] Limpiando fila existente', {
    sheetName,
    row
  });

  await sheets.spreadsheets.values.batchClear({
    spreadsheetId: sheetsConfig.spreadsheetId,
    requestBody: {
      ranges
    }
  });
}

module.exports = {
  getSheetsClient,
  getSheetProfile,
  getRiderSheetNames,
  getNextEmptyRow,
  writeOrderToSheet,
  findOrderAcrossSheets,
  findOrderAcrossSheetNames,
  findOrderAcrossRiderSheets,
  findOrderAcrossRiderSheetsByPhoneAndDay,
  findOrderRowsInSheet,
  clearOrderRow,
  getOrderRowSnapshot,
  buildDayKey,
  syncTransferLogEntry,
  syncAllCurrentTransferRowsToDatos,
  syncDatosRiderSummaries,
  __internals: {
    buildOrderLookup,
    getLookupMatch,
    buildTransferLogEntry,
    formatTransferLogDate,
    formatTransferLogMonth,
    formatTransferLogPhone,
    buildTransferLogKey,
    buildDatosRiderSummaryRow,
    formatDatosDay,
    formatDatosMoney
  }
};
