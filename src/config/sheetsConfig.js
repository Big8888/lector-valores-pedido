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
    numeroPedidoInterno: 'A',
    estadoPago: 'B',
    total: 'C',
    tarjeta: 'D',
    efectivo: 'E',
    transferencia: 'F',
    enviosLejanos: 'G',
    propinaWeb: 'H',
    salidaDinero: 'I',
    enCamino: 'J',
    finalizado: 'K',
    nroPedido: 'U',
    telefono: 'W',
    fecha: 'X'
  },
  dataStartRow: 8,
  sheetBounds: {
    startColumn: 'A',
    endColumn: 'X'
  }
};
