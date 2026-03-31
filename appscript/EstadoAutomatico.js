const HOJAS_ESTADO_AUTOMATICO = ['Mauro', 'Brisa', 'Diogo', 'GIAN', 'LIBRE1', 'Venta Mostrador', 'Lector Pedidosya'];
const FILA_ENCABEZADOS_ESTADO = 7;
const FILA_DATOS_ESTADO = 8;
const COLOR_EN_CAMINO = '#93c47d';
const COLOR_FINALIZADO = '#6fa8dc';
const COLOR_ESTADO_PENDIENTE = '#ea4335';
const COLOR_ESTADO_PAGADO = '#fff2cc';
const COLOR_ESTADO_PARCIAL = '#ea4335';
const COLOR_ESTADO_PEDIDO_LOCAL = '#d9ead3';
const COLOR_ESTADO_PEDIDO_DOMICILIO = '#cfe2f3';
const COLOR_FILA_COBRADA = '#d9ead3';
const CONFIG_COBRO_POR_HOJA = {
  Mauro: { marcaCobrado: 29, visibleEndColumn: 27 },
  Brisa: { marcaCobrado: 29, visibleEndColumn: 27 },
  Diogo: { marcaCobrado: 29, visibleEndColumn: 27 },
  GIAN: { marcaCobrado: 29, visibleEndColumn: 27 },
  LIBRE1: { marcaCobrado: 29, visibleEndColumn: 27 },
  'Venta Mostrador': { marcaCobrado: 29, visibleEndColumn: 11 },
  'Lector Pedidosya': { marcaCobrado: 29, visibleEndColumn: 14 }
};

function configurarColoresEstadoAutomaticosEnHojas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  HOJAS_ESTADO_AUTOMATICO.forEach((nombreHoja) => {
    const hoja = ss.getSheetByName(nombreHoja);
    if (!hoja) return;

    configurarColoresEstadoAutomaticosEnHoja_(hoja);
  });
}

function configurarColoresEstadoAutomaticosEnHoja_(hoja) {
  const columnasEstado = getColumnasEstadoAutomatico_(hoja);
  const configCobro = getConfiguracionCobroEstado_(hoja.getName());
  const ultimaFila = Math.max(hoja.getMaxRows(), FILA_DATOS_ESTADO);
  const reglasActuales = hoja.getConditionalFormatRules() || [];

  const reglasFiltradas = reglasActuales.filter((regla) => {
    const rangos = regla.getRanges ? regla.getRanges() : [];

    return !rangos.some((rango) => {
      if (rango.getSheet().getName() !== hoja.getName()) return false;

      const columna = rango.getColumn();
      const fila = rango.getRow();
      const filas = rango.getNumRows();

      const coincideColumnaEstado =
        columna === columnasEstado.estadoPago ||
        columna === columnasEstado.enCamino ||
        columna === columnasEstado.pedidoListo ||
        columna === columnasEstado.finalizado ||
        columna === columnasEstado.estadoPedido;
      const coincideRangoCobro =
        !!configCobro &&
        columna === 1 &&
        fila === FILA_DATOS_ESTADO &&
        filas === ultimaFila - FILA_DATOS_ESTADO + 1 &&
        rango.getNumColumns() === configCobro.visibleEndColumn;

      return (coincideColumnaEstado && fila === FILA_DATOS_ESTADO && filas === ultimaFila - FILA_DATOS_ESTADO + 1)
        || coincideRangoCobro;
    });
  });

  if (configCobro) {
    const letraMarcaCobrado = columnToLetterEstadoAutomatico_(configCobro.marcaCobrado);
    reglasFiltradas.push(
      SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied(`=$${letraMarcaCobrado}${FILA_DATOS_ESTADO}="COBRADO"`)
        .setBackground(COLOR_FILA_COBRADA)
        .setRanges([hoja.getRange(FILA_DATOS_ESTADO, 1, ultimaFila - FILA_DATOS_ESTADO + 1, configCobro.visibleEndColumn)])
        .build()
    );
  }

  if (columnasEstado.estadoPago > 0) {
    const rangoEstadoPago = hoja.getRange(
      FILA_DATOS_ESTADO,
      columnasEstado.estadoPago,
      ultimaFila - FILA_DATOS_ESTADO + 1,
      1
    );
    const letraEstadoPago = columnToLetterEstadoAutomatico_(columnasEstado.estadoPago);

    reglasFiltradas.push(
      SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied(`=UPPER(TRIM(${letraEstadoPago}${FILA_DATOS_ESTADO}))="NO PAGADO"`)
        .setBackground(COLOR_ESTADO_PENDIENTE)
        .setRanges([rangoEstadoPago])
        .build()
    );

    reglasFiltradas.push(
      SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied(`=UPPER(TRIM(${letraEstadoPago}${FILA_DATOS_ESTADO}))="PAGADO"`)
        .setBackground(COLOR_ESTADO_PAGADO)
        .setRanges([rangoEstadoPago])
        .build()
    );

    reglasFiltradas.push(
      SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied(`=UPPER(TRIM(${letraEstadoPago}${FILA_DATOS_ESTADO}))="PARCIAL"`)
        .setBackground(COLOR_ESTADO_PARCIAL)
        .setRanges([rangoEstadoPago])
        .build()
    );
  }

  if (columnasEstado.enCamino > 0) {
    reglasFiltradas.push(
      SpreadsheetApp.newConditionalFormatRule()
        .whenCellNotEmpty()
        .setBackground(COLOR_EN_CAMINO)
        .setRanges([hoja.getRange(FILA_DATOS_ESTADO, columnasEstado.enCamino, ultimaFila - FILA_DATOS_ESTADO + 1, 1)])
        .build()
    );
  }

  if (columnasEstado.pedidoListo > 0) {
    reglasFiltradas.push(
      SpreadsheetApp.newConditionalFormatRule()
        .whenCellNotEmpty()
        .setBackground(COLOR_EN_CAMINO)
        .setRanges([hoja.getRange(FILA_DATOS_ESTADO, columnasEstado.pedidoListo, ultimaFila - FILA_DATOS_ESTADO + 1, 1)])
        .build()
    );
  }

  if (columnasEstado.finalizado > 0) {
    reglasFiltradas.push(
      SpreadsheetApp.newConditionalFormatRule()
        .whenCellNotEmpty()
        .setBackground(COLOR_FINALIZADO)
        .setRanges([hoja.getRange(FILA_DATOS_ESTADO, columnasEstado.finalizado, ultimaFila - FILA_DATOS_ESTADO + 1, 1)])
        .build()
    );
  }

  if (columnasEstado.estadoPedido > 0) {
    const rangoEstadoPedido = hoja.getRange(
      FILA_DATOS_ESTADO,
      columnasEstado.estadoPedido,
      ultimaFila - FILA_DATOS_ESTADO + 1,
      1
    );
    const letraEstadoPedido = columnToLetterEstadoAutomatico_(columnasEstado.estadoPedido);

    reglasFiltradas.push(
      SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied(`=UPPER(TRIM(${letraEstadoPedido}${FILA_DATOS_ESTADO}))="LOCAL"`)
        .setBackground(COLOR_ESTADO_PEDIDO_LOCAL)
        .setRanges([rangoEstadoPedido])
        .build()
    );

    reglasFiltradas.push(
      SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied(`=UPPER(TRIM(${letraEstadoPedido}${FILA_DATOS_ESTADO}))="DOMICILIO"`)
        .setBackground(COLOR_ESTADO_PEDIDO_DOMICILIO)
        .setRanges([rangoEstadoPedido])
        .build()
    );
  }

  hoja.setConditionalFormatRules(reglasFiltradas);
}

function getColumnasEstadoAutomatico_(hoja) {
  const ultimaColumna = Math.max(hoja.getLastColumn(), 12);
  const encabezados = hoja
    .getRange(FILA_ENCABEZADOS_ESTADO, 1, 1, ultimaColumna)
    .getDisplayValues()[0]
    .map((valor) => normalizeHeaderEstadoAutomatico_(valor));

  return {
    estadoPago: encabezados.findIndex((valor) => valor === 'ESTADO DE PAGO') + 1,
    enCamino: encabezados.findIndex((valor) => valor === 'EN CAMINO') + 1,
    pedidoListo: encabezados.findIndex((valor) => valor === 'PEDIDO LISTO') + 1,
    finalizado: encabezados.findIndex((valor) => valor === 'FINALIZADO') + 1,
    estadoPedido: encabezados.findIndex((valor) => valor === 'ESTADO DE PEDIDO') + 1
  };
}

function normalizeHeaderEstadoAutomatico_(valor) {
  return String(valor || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function getConfiguracionCobroEstado_(nombreHoja) {
  return CONFIG_COBRO_POR_HOJA[nombreHoja] || null;
}

function columnToLetterEstadoAutomatico_(column) {
  let current = Number(column);
  let letter = '';

  while (current > 0) {
    const temp = (current - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    current = (current - temp - 1) / 26;
  }

  return letter;
}
