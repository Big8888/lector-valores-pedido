function myFunction() {
}

function onEdit(e) {
  if (!e || !e.range) return;

  const hoja = e.range.getSheet();
  if (!hoja) return;

  const nombreHoja = hoja.getName();
  if (!['Mauro', 'Mauro 1', 'Diogo', 'GIAN', 'LIBRE1'].includes(nombreHoja)) return;

  const fila = e.range.getRow();
  const columna = e.range.getColumn();

  if (fila >= 8 && columna === 1) {
    const checked = e.range.getValue() === true;
    actualizarFilasCobroSeleccionadas_(hoja, [fila], checked);
  }

  manejarColoresHorasEstado_(e);
  manejarEdicionTablaVueltasCompartidas_(e);
}

const COLOR_EN_CAMINO = '#93c47d';
const COLOR_FINALIZADO = '#6fa8dc';
const PREFIJO_COLOR_ESTADO = 'COLOR_ESTADO_';
const FILA_ENCABEZADOS_ESTADO = 7;

function manejarColoresHorasEstado_(e) {
  const rango = e.range;
  const hoja = rango.getSheet();
  const filaInicial = rango.getRow();
  const columnaInicial = rango.getColumn();
  const valores = rango.getValues();
  const columnasEstado = getColumnasEstado_(hoja);

  for (let filaOffset = 0; filaOffset < valores.length; filaOffset += 1) {
    for (let columnaOffset = 0; columnaOffset < valores[filaOffset].length; columnaOffset += 1) {
      const fila = filaInicial + filaOffset;
      const columna = columnaInicial + columnaOffset;

      if (fila < 8) continue;
      if (columna !== columnasEstado.enCamino && columna !== columnasEstado.finalizado) continue;

      const celda = hoja.getRange(fila, columna);
      const valor = valores[filaOffset][columnaOffset];
      const tieneValor = valor !== '' && valor !== null;
      const colorObjetivo = columna === columnasEstado.enCamino ? COLOR_EN_CAMINO : COLOR_FINALIZADO;
      const key = getKeyColorEstado_(hoja.getName(), fila, columna);
      const props = PropertiesService.getDocumentProperties();

      if (tieneValor) {
        if (!props.getProperty(key)) {
          props.setProperty(key, celda.getBackground() || '');
        }
        celda.setBackground(colorObjetivo);
        continue;
      }

      const colorAnterior = props.getProperty(key);
      if (colorAnterior) {
        celda.setBackground(colorAnterior);
        props.deleteProperty(key);
      } else {
        celda.setBackground(null);
      }
    }
  }
}

function getKeyColorEstado_(sheetName, fila, columna) {
  return PREFIJO_COLOR_ESTADO + String(sheetName || '').trim().toUpperCase() + '_' + fila + '_' + columna;
}

function getColumnasEstado_(hoja) {
  const ultimaColumna = Math.max(hoja.getLastColumn(), 12);
  const encabezados = hoja
    .getRange(FILA_ENCABEZADOS_ESTADO, 1, 1, ultimaColumna)
    .getDisplayValues()[0]
    .map((valor) => normalizeHeaderEstado_(valor));

  return {
    enCamino: encabezados.findIndex((valor) => valor === 'EN CAMINO') + 1,
    finalizado: encabezados.findIndex((valor) => valor === 'FINALIZADO') + 1
  };
}

function normalizeHeaderEstado_(valor) {
  return String(valor || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}
