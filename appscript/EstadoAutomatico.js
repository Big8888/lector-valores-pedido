const HOJAS_ESTADO_AUTOMATICO = ['Mauro', 'Mauro 1', 'Diogo', 'GIAN', 'LIBRE1'];
const FILA_ENCABEZADOS_ESTADO = 7;
const FILA_DATOS_ESTADO = 8;
const COLOR_EN_CAMINO = '#93c47d';
const COLOR_FINALIZADO = '#6fa8dc';

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
        columna === columnasEstado.enCamino || columna === columnasEstado.finalizado;

      return coincideColumnaEstado && fila === FILA_DATOS_ESTADO && filas === ultimaFila - FILA_DATOS_ESTADO + 1;
    });
  });

  if (columnasEstado.enCamino > 0) {
    reglasFiltradas.push(
      SpreadsheetApp.newConditionalFormatRule()
        .whenCellNotEmpty()
        .setBackground(COLOR_EN_CAMINO)
        .setRanges([hoja.getRange(FILA_DATOS_ESTADO, columnasEstado.enCamino, ultimaFila - FILA_DATOS_ESTADO + 1, 1)])
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

  hoja.setConditionalFormatRules(reglasFiltradas);
}

function getColumnasEstadoAutomatico_(hoja) {
  const ultimaColumna = Math.max(hoja.getLastColumn(), 12);
  const encabezados = hoja
    .getRange(FILA_ENCABEZADOS_ESTADO, 1, 1, ultimaColumna)
    .getDisplayValues()[0]
    .map((valor) => normalizeHeaderEstadoAutomatico_(valor));

  return {
    enCamino: encabezados.findIndex((valor) => valor === 'EN CAMINO') + 1,
    finalizado: encabezados.findIndex((valor) => valor === 'FINALIZADO') + 1
  };
}

function normalizeHeaderEstadoAutomatico_(valor) {
  return String(valor || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}
