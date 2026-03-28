const fs = require('fs');
const path = require('path');
const pdfConfig = require('../config/pedidosYaPdfConfig');
const sheetsConfig = require('../../config/sheetsConfig');
const {
  findOrderRowsInSheet,
  getNextEmptyRow,
  getOrderRowSnapshot,
  writeOrderToSheet
} = require('../../services/googleSheetsService');
const { mapOrderToSheetRow } = require('../../services/orderToSheetMapper');
const { parsePedidosYaPdf } = require('./pedidosYaPdfParser');

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function getPdfFiles(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  return fs.readdirSync(dirPath)
    .filter((name) => name.toLowerCase().endsWith('.pdf'))
    .map((name) => {
      const fullPath = path.join(dirPath, name);
      const stats = fs.statSync(fullPath);
      return {
        name,
        fullPath,
        mtimeMs: stats.mtimeMs
      };
    })
    .sort((left, right) => left.mtimeMs - right.mtimeMs);
}

function buildTargetPath(targetDir, fileName) {
  const parsed = path.parse(fileName);
  let candidate = path.join(targetDir, fileName);

  if (!fs.existsSync(candidate)) {
    return candidate;
  }

  const suffix = new Date().toISOString().replace(/[:.]/g, '-');
  candidate = path.join(targetDir, `${parsed.name}-${suffix}${parsed.ext}`);

  return candidate;
}

function moveFile(sourcePath, targetDir, fileName) {
  ensureDirectory(targetDir);
  const targetPath = buildTargetPath(targetDir, fileName);
  fs.renameSync(sourcePath, targetPath);
  return targetPath;
}

async function importSinglePdf(filePath, options = {}) {
  const targetSheet = options.sheetName || sheetsConfig.pedidosYaPdfSheetName;
  const parsedOrder = await parsePedidosYaPdf(filePath);
  const existingRows = await findOrderRowsInSheet(targetSheet, {
    numeroPedidoInterno: parsedOrder.numeroPedidoInterno,
    nroPedido: parsedOrder.nroPedido,
    fecha: parsedOrder.fecha
  });

  const existingRow = existingRows[0]
    ? await getOrderRowSnapshot(targetSheet, existingRows[0].rowNumber)
    : null;

  const rowNumber = existingRows[0]
    ? existingRows[0].rowNumber
    : await getNextEmptyRow(targetSheet);

  const rowData = mapOrderToSheetRow(parsedOrder, existingRow, targetSheet);

  if (options.dryRun) {
    return {
      dryRun: true,
      rowNumber,
      filePath,
      targetSheet,
      parsedOrder,
      rowData
    };
  }

  await writeOrderToSheet(targetSheet, rowNumber, rowData);

  return {
    dryRun: false,
    rowNumber,
    filePath,
    targetSheet,
    parsedOrder,
    rowData
  };
}

async function importPedidosYaPdfs(options = {}) {
  ensureDirectory(pdfConfig.inboxDir);
  ensureDirectory(pdfConfig.processedDir);
  ensureDirectory(pdfConfig.errorDir);

  const limit = Number.isFinite(Number(options.limit)) ? Number(options.limit) : null;
  const pdfFiles = getPdfFiles(options.inboxDir || pdfConfig.inboxDir);
  const filesToProcess = limit ? pdfFiles.slice(0, limit) : pdfFiles;
  const results = [];

  for (const file of filesToProcess) {
    try {
      const result = await importSinglePdf(file.fullPath, options);

      if (!options.dryRun) {
        moveFile(file.fullPath, pdfConfig.processedDir, file.name);
      }

      results.push({
        ok: true,
        fileName: file.name,
        rowNumber: result.rowNumber,
        numeroPedidoInterno: result.parsedOrder.numeroPedidoInterno,
        nroPedido: result.parsedOrder.nroPedido,
        total: result.parsedOrder.total,
        paymentStatus: result.parsedOrder.paymentStatus
      });
    } catch (error) {
      if (!options.dryRun && fs.existsSync(file.fullPath)) {
        moveFile(file.fullPath, pdfConfig.errorDir, file.name);
      }

      results.push({
        ok: false,
        fileName: file.name,
        error: error.message
      });
    }
  }

  return {
    dryRun: Boolean(options.dryRun),
    targetSheet: options.sheetName || sheetsConfig.pedidosYaPdfSheetName,
    inboxDir: options.inboxDir || pdfConfig.inboxDir,
    processed: results.filter((item) => item.ok).length,
    failed: results.filter((item) => !item.ok).length,
    results
  };
}

module.exports = {
  importSinglePdf,
  importPedidosYaPdfs
};
