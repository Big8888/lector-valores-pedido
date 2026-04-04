module.exports = {
  spreadsheetId: '1b6thcjNOAbUPKRWSSvqhog2vp6TOk-wbo5GqokPH2hg',
  timeZone: process.env.ORDER_TIMEZONE || 'America/Montevideo',
  counterSheetName: 'Venta Mostrador',
  pedidosYaSheetName: 'Pedidos Ya',
  pedidosYaPdfSheetName: 'Lector Pedidosya',
  transferLog: {
    sheetName: 'Datos',
    headerRow: 66,
    dataStartRow: 67,
    dataEndRow: 212,
    columns: {
      mes: 'AV',
      fecha: 'AW',
      numeroPedido: 'AX',
      cliente: 'AY',
      importe: 'AZ',
      telefono: 'BA',
      anotaciones: 'BB',
      repartidor: 'BC',
      propinaTransferencia: 'BD'
    }
  },
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
    fecha: 'Y',
    nroPedidoTracking: 'AD'
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
        startColumn: 'B',
        endColumn: 'Q'
      },
      columns: {
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
        fecha: 'Q',
        nroPedidoTracking: 'AD'
      }
    },
    'Pedidos Ya': {
      dataStartRow: 8,
      sheetBounds: {
        startColumn: 'A',
        endColumn: 'N'
      },
      columns: {
        numeroPedidoInterno: 'B',
        estadoPago: 'C',
        tarjeta: 'D',
        efectivo: 'E',
        pedidoListo: 'F',
        estadoPedido: 'G',
        anotaciones: 'H',
        datosTransferencia: 'J',
        numeroPedidoVisible: 'K',
        importeTransferenciaVisible: 'L',
        telefono: 'M',
        fecha: 'N',
        nroPedidoTracking: 'AD'
      }
    },
    'Lector Pedidosya': {
      dataStartRow: 8,
      sheetBounds: {
        startColumn: 'A',
        endColumn: 'N'
      },
      columns: {
        numeroPedidoInterno: 'B',
        estadoPago: 'C',
        tarjeta: 'D',
        efectivo: 'E',
        pedidoListo: 'F',
        estadoPedido: 'G',
        anotaciones: 'H',
        datosTransferencia: 'J',
        numeroPedidoVisible: 'K',
        importeTransferenciaVisible: 'L',
        telefono: 'M',
        fecha: 'N',
        nroPedidoTracking: 'AD'
      }
    }
  }
};
