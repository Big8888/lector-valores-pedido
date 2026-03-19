const express = require('express');
const { interpretOrder } = require('../services/orderInterpreter');
const { assignCourier } = require('../services/courierAssigner');
const { mapOrderToSheetRow } = require('../services/orderToSheetMapper');
const { getNextEmptyRow, writeOrderToSheet } = require('../services/googleSheetsService');

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const payload = req.body || {};
    const order = interpretOrder(payload);

    if (!order.pedido && !order.rawText) {
      const error = new Error('No se pudo interpretar ningun dato del pedido.');
      error.statusCode = 400;
      throw error;
    }

    const assignment = assignCourier(order);
    const mappedRow = mapOrderToSheetRow(order, assignment);
    const rowNumber = await getNextEmptyRow(assignment.sheetName);

    await writeOrderToSheet(assignment.sheetName, rowNumber, mappedRow);

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
