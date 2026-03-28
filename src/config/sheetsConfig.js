module.exports = {
  spreadsheetId: '1b6thcjNOAbUPKRWSSvqhog2vp6TOk-wbo5GqokPH2hg',
  timeZone: process.env.ORDER_TIMEZONE || 'America/Montevideo',
  counterSheetName: 'Venta Mostrador',
  riderSheets: {
    MAURO: 'Mauro',
    MAURICIO: 'Mauro',
    BRISA: 'Brisa',
    DIOGO: 'Diogo',
    GIAN: 'GIAN',
    LIBRE1: 'LIBRE1',
    LIBRE: 'LIBRE1'
  },
  columns: {
    numeroPedidoInterno: 'B',
    estadoPago: 'C',
    total: 'D',
    tarjeta: 'E',
    efectivo: 'F',
    transferencia: 'G',
    enviosLejanos: 'H',
    propinaWeb: 'I',
    salidaDinero: 'J',
    enCamino: 'K',
    finalizado: 'L',
    numeroPedidoVisible: 'V',
    importeTransferenciaVisible: 'W',
    telefono: 'X',
    fecha: 'Y'
  },
  dataStartRow: 8,
  sheetBounds: {
    startColumn: 'B',
    endColumn: 'Y'
  },
  sheetProfiles: {
    'Venta Mostrador': {
      dataStartRow: 8,
      sheetBounds: {
        startColumn: 'A',
        endColumn: 'Q'
      },
      columns: {
        serviceLabel: 'A',
        numeroPedidoInterno: 'B',
        estadoPago: 'C',
        total: 'D',
        tarjeta: 'E',
        efectivo: 'F',
        transferencia: 'G',
        propinaWeb: 'H',
        pedidoListo: 'I',
        finalizado: 'J',
        anotaciones: 'K',
        numeroPedidoVisible: 'N',
        importeTransferenciaVisible: 'O',
        telefono: 'P',
        fecha: 'Q'
      }
    }
  }
};
