module.exports = {
  spreadsheetId: '1b6thcjNOAbUPKRWSSvqhog2vp6TOk-wbo5GqokPH2hg',
  timeZone: process.env.ORDER_TIMEZONE || 'America/Montevideo',
  riderSheets: {
    MAURO: 'Mauro',
    MAURICIO: 'Mauro',
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
    nroPedido: null,
    telefono: 'X',
    fecha: 'Y'
  },
  dataStartRow: 8,
  sheetBounds: {
    startColumn: 'B',
    endColumn: 'Y'
  }
};
