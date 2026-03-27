const TARGET_SPREADSHEET_ID = '1b6thcjNOAbUPKRWSSvqhog2vp6TOk-wbo5GqokPH2hg';
const HOJAS_REPARTIDORES = ['Mauro', 'Mauro 1', 'Diogo', 'GIAN', 'LIBRE1'];
const CELDA_BOTON = 'A7';
const RANGO_LIMPIEZA_CONTROLES_VIEJOS = 'O1:P6';
const TITULO_IMAGEN_COBRO = 'COBROS_BUTTON';
const ANCHO_BOTON_COBRO = 185;
const ALTO_BOTON_COBRO = 55;
const OFFSET_X_BOTON_COBRO = 2;
const OFFSET_Y_BOTON_COBRO = 3;
const FUNCION_BOTON_EN_HOJA = 'abrirPedidosSeleccionados';
const URL_BOTON_COBRO = 'https://raw.githubusercontent.com/Big8888/lector-valores-pedido/main/assets/abrir-cobro-button.png';
const FILA_BOTONES_VUELTAS = 4;
const FILA_NOMBRES_VUELTAS = 6;
const FILA_TITULOS_VUELTAS = 7;
const FILA_DATOS_ESTADO = 8;
const COLUMNA_INICIO_VUELTAS = 15; // O
const COLUMNA_FIN_VUELTAS = 19; // S
const TITULO_BOTON_ELIMINAR_PREFIX = 'DELETE_VUELTA_';
const ANCHO_BOTON_ELIMINAR = 72;
const ALTO_BOTON_ELIMINAR = 24;
const OFFSET_X_BOTON_ELIMINAR = 2;
const OFFSET_Y_BOTON_ELIMINAR = 4;
const URL_BOTON_ELIMINAR = 'https://raw.githubusercontent.com/Big8888/lector-valores-pedido/main/assets/limpiar-button.png';
const COLOR_EN_CAMINO = '#93c47d';
const COLOR_FINALIZADO = '#6fa8dc';

function codexPing() {
  return {
    ok: true,
    scriptId: ScriptApp.getScriptId(),
    spreadsheetId: TARGET_SPREADSHEET_ID
  };
}

function recrearBotonesCobrosEnTodasLasHojas() {
  const spreadsheet = SpreadsheetApp.openById(TARGET_SPREADSHEET_ID);
  const resultado = [];

  HOJAS_REPARTIDORES.forEach((nombreHoja) => {
    const hoja = spreadsheet.getSheetByName(nombreHoja);
    if (!hoja) {
      resultado.push({ hoja: nombreHoja, ok: false, motivo: 'Hoja no encontrada' });
      return;
    }

    asegurarBotonCobroEnHoja_(hoja);
    resultado.push({ hoja: nombreHoja, ok: true });
  });

  return {
    ok: true,
    spreadsheetId: TARGET_SPREADSHEET_ID,
    resultado
  };
}

function recrearBotonCobroEnHoja(nombreHoja) {
  const hojaBuscada = String(nombreHoja || '').trim();
  if (!hojaBuscada) {
    throw new Error('Falta indicar el nombre de la hoja.');
  }

  const spreadsheet = SpreadsheetApp.openById(TARGET_SPREADSHEET_ID);
  const hoja = spreadsheet.getSheetByName(hojaBuscada);
  if (!hoja) {
    throw new Error('No se encontro la hoja: ' + hojaBuscada);
  }

  asegurarBotonCobroEnHoja_(hoja);

  return {
    ok: true,
    hoja: hojaBuscada
  };
}

function limpiarBotonesCobroEnTodasLasHojas() {
  const spreadsheet = SpreadsheetApp.openById(TARGET_SPREADSHEET_ID);

  HOJAS_REPARTIDORES.forEach((nombreHoja) => {
    const hoja = spreadsheet.getSheetByName(nombreHoja);
    if (!hoja) return;

    limpiarBotonesCobro_(hoja);
    hoja.getRange(RANGO_LIMPIEZA_CONTROLES_VIEJOS)
      .clearContent()
      .clearDataValidations()
      .clearNote()
      .setBackground(null);
  });

  return { ok: true };
}

function configurarTablaVueltasCompartidasEnTodasLasHojas() {
  const spreadsheet = SpreadsheetApp.openById(TARGET_SPREADSHEET_ID);
  const hojaReferencia = spreadsheet.getSheetByName('GIAN');
  const nombresRepartidores = HOJAS_REPARTIDORES.slice();
  const titulosVueltas = [['VUELTA 1', 'VUELTA 2', 'VUELTA 3', 'VUELTA 4', 'VUELTA 5']];
  const resultado = [];

  HOJAS_REPARTIDORES.forEach((nombreHoja) => {
    const hoja = spreadsheet.getSheetByName(nombreHoja);
    if (!hoja) {
      resultado.push({ hoja: nombreHoja, ok: false, motivo: 'Hoja no encontrada' });
      return;
    }

    sincronizarLayoutVueltasDesdeReferencia_(hojaReferencia, hoja);

    const regla = SpreadsheetApp.newDataValidation()
      .requireValueInList(nombresRepartidores, true)
      .setAllowInvalid(false)
      .build();

    hoja
      .getRange(
        FILA_NOMBRES_VUELTAS,
        COLUMNA_INICIO_VUELTAS,
        1,
        COLUMNA_FIN_VUELTAS - COLUMNA_INICIO_VUELTAS + 1
      )
      .setDataValidation(regla);

    hoja
      .getRange(
        FILA_TITULOS_VUELTAS,
        COLUMNA_INICIO_VUELTAS,
        1,
        COLUMNA_FIN_VUELTAS - COLUMNA_INICIO_VUELTAS + 1
      )
      .setValues(titulosVueltas);

    limpiarBotonesEliminarVueltas_(hoja);
    asegurarBotonesEliminarVueltasEnHoja_(hoja);
    resultado.push({ hoja: nombreHoja, ok: true });
  });

  return {
    ok: true,
    spreadsheetId: TARGET_SPREADSHEET_ID,
    resultado
  };
}

function alinearBotonesDeGianEnMauro1() {
  const spreadsheet = SpreadsheetApp.openById(TARGET_SPREADSHEET_ID);
  const hojaOrigen = spreadsheet.getSheetByName('GIAN');
  const hojaDestino = spreadsheet.getSheetByName('Mauro 1');

  if (!hojaOrigen) {
    throw new Error('No se encontro la hoja GIAN.');
  }

  if (!hojaDestino) {
    throw new Error('No se encontro la hoja Mauro 1.');
  }

  for (let columna = 1; columna <= COLUMNA_FIN_VUELTAS; columna += 1) {
    hojaDestino.setColumnWidth(columna, hojaOrigen.getColumnWidth(columna));
  }

  for (let fila = 1; fila <= FILA_TITULOS_VUELTAS; fila += 1) {
    hojaDestino.setRowHeight(fila, hojaOrigen.getRowHeight(fila));
  }

  limpiarBotonesCobroEnPosicion_(hojaDestino, hojaDestino.getRange(CELDA_BOTON).getRow(), hojaDestino.getRange(CELDA_BOTON).getColumn());
  colocarBotonCobroEnHoja_(hojaDestino, hojaDestino.getRange(CELDA_BOTON));

  limpiarBotonesEliminarVueltas_(hojaDestino);
  asegurarBotonesEliminarVueltasEnHoja_(hojaDestino);

  return {
    ok: true,
    origen: 'GIAN',
    destino: 'Mauro 1'
  };
}

function inspeccionarEncabezadosEstado(nombreHoja) {
  const spreadsheet = SpreadsheetApp.openById(TARGET_SPREADSHEET_ID);
  const hoja = spreadsheet.getSheetByName(String(nombreHoja || '').trim());
  if (!hoja) {
    throw new Error('No se encontro la hoja.');
  }

  const ultimaColumna = Math.max(hoja.getLastColumn(), 20);
  const valores = hoja.getRange(7, 1, 1, ultimaColumna).getDisplayValues()[0];

  return valores.map((valor, index) => ({
    columna: index + 1,
    letra: columnToLetter_(index + 1),
    valor
  }));
}

function configurarColoresEstadoAutomaticosEnTodasLasHojas() {
  const spreadsheet = SpreadsheetApp.openById(TARGET_SPREADSHEET_ID);
  const resultado = [];

  HOJAS_REPARTIDORES.forEach((nombreHoja) => {
    const hoja = spreadsheet.getSheetByName(nombreHoja);
    if (!hoja) {
      resultado.push({ hoja: nombreHoja, ok: false, motivo: 'Hoja no encontrada' });
      return;
    }

    configurarColoresEstadoAutomaticosEnHoja_(hoja);
    resultado.push({ hoja: nombreHoja, ok: true });
  });

  return {
    ok: true,
    spreadsheetId: TARGET_SPREADSHEET_ID,
    resultado
  };
}

function limpiarColumnaVEnTodasLasHojas() {
  const spreadsheet = SpreadsheetApp.openById(TARGET_SPREADSHEET_ID);
  const resultado = [];

  HOJAS_REPARTIDORES.forEach((nombreHoja) => {
    const hoja = spreadsheet.getSheetByName(nombreHoja);
    if (!hoja) {
      resultado.push({ hoja: nombreHoja, ok: false, motivo: 'Hoja no encontrada' });
      return;
    }

    hoja.getRange('V8:V').clearContent();
    resultado.push({ hoja: nombreHoja, ok: true });
  });

  return {
    ok: true,
    spreadsheetId: TARGET_SPREADSHEET_ID,
    resultado
  };
}

function columnToLetter_(column) {
  let current = Number(column);
  let letter = '';
  while (current > 0) {
    const temp = (current - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    current = (current - temp - 1) / 26;
  }
  return letter;
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
    .getRange(FILA_TITULOS_VUELTAS, 1, 1, ultimaColumna)
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

function sincronizarLayoutVueltasDesdeReferencia_(hojaReferencia, hojaDestino) {
  if (!hojaReferencia || !hojaDestino || hojaReferencia.getName() === hojaDestino.getName()) return;

  for (let columna = COLUMNA_INICIO_VUELTAS; columna <= COLUMNA_FIN_VUELTAS; columna += 1) {
    hojaDestino.setColumnWidth(columna, hojaReferencia.getColumnWidth(columna));
  }

  for (let fila = FILA_BOTONES_VUELTAS; fila <= FILA_TITULOS_VUELTAS; fila += 1) {
    hojaDestino.setRowHeight(fila, hojaReferencia.getRowHeight(fila));
  }
}

function asegurarBotonCobroEnHoja_(hoja) {
  hoja.getRange(RANGO_LIMPIEZA_CONTROLES_VIEJOS)
    .clearContent()
    .clearDataValidations()
    .clearNote()
    .setBackground(null);

  const celdaBoton = hoja.getRange(CELDA_BOTON);
  limpiarBotonesCobroEnPosicion_(hoja, celdaBoton.getRow(), celdaBoton.getColumn());
  colocarBotonCobroEnHoja_(hoja, celdaBoton);
}

function limpiarBotonesCobro_(hoja) {
  getBotonesCobro_(hoja).forEach((image) => image.remove());
}

function limpiarBotonesCobroEnPosicion_(hoja, fila, columna) {
  if (!hoja.getImages) return;

  hoja.getImages().forEach((image) => {
    if (!image.getAnchorCell) return;
    const anchor = image.getAnchorCell();
    if (anchor && anchor.getRow() === fila && anchor.getColumn() === columna) {
      image.remove();
    }
  });
}

function getBotonesCobro_(hoja) {
  if (!hoja.getImages) return [];

  return hoja.getImages().filter((image) => {
    const altTitle = image.getAltTextTitle ? image.getAltTextTitle() : '';
    return altTitle === TITULO_IMAGEN_COBRO;
  });
}

function colocarBotonCobroEnHoja_(hoja, celdaBoton) {
  const image = hoja.insertImage(
    URL_BOTON_COBRO,
    celdaBoton.getColumn(),
    celdaBoton.getRow(),
    OFFSET_X_BOTON_COBRO,
    OFFSET_Y_BOTON_COBRO
  );

  image.assignScript(FUNCION_BOTON_EN_HOJA);
  image.setAltTextTitle(TITULO_IMAGEN_COBRO);
  image.setAltTextDescription('Abre la calculadora de cobro de esta hoja');
  image.setWidth(ANCHO_BOTON_COBRO);
  image.setHeight(ALTO_BOTON_COBRO);
}

function asegurarBotonesEliminarVueltasEnHoja_(hoja) {
  for (let columna = COLUMNA_INICIO_VUELTAS; columna <= COLUMNA_FIN_VUELTAS; columna += 1) {
    const indice = columna - COLUMNA_INICIO_VUELTAS + 1;
    const titulo = TITULO_BOTON_ELIMINAR_PREFIX + indice;
    const scriptName = 'eliminarVuelta' + indice;
    const celda = hoja.getRange(FILA_BOTONES_VUELTAS, columna);

    const existe = getBotonesEliminarVueltas_(hoja).some((image) => {
      if (!image.getAnchorCell) return false;
      const anchor = image.getAnchorCell();
      const altTitle = image.getAltTextTitle ? image.getAltTextTitle() : '';
      return altTitle === titulo && anchor && anchor.getRow() === FILA_BOTONES_VUELTAS && anchor.getColumn() === columna;
    });

    if (existe) continue;

    limpiarBotonEliminarVuelta_(hoja, titulo);

    const image = hoja.insertImage(
      URL_BOTON_ELIMINAR,
      celda.getColumn(),
      celda.getRow(),
      OFFSET_X_BOTON_ELIMINAR,
      OFFSET_Y_BOTON_ELIMINAR
    );

    image.assignScript(scriptName);
    image.setAltTextTitle(titulo);
    image.setAltTextDescription('Elimina la vuelta y corre las siguientes a la izquierda');
    image.setWidth(ANCHO_BOTON_ELIMINAR);
    image.setHeight(ALTO_BOTON_ELIMINAR);
  }
}

function getBotonesEliminarVueltas_(hoja) {
  if (!hoja.getImages) return [];

  return hoja.getImages().filter((image) => {
    if (isBotonEliminarEnZonaVueltas_(image)) return true;
    const altTitle = image.getAltTextTitle ? image.getAltTextTitle() : '';
    return altTitle.indexOf(TITULO_BOTON_ELIMINAR_PREFIX) === 0;
  });
}

function limpiarBotonEliminarVuelta_(hoja, titulo) {
  getBotonesEliminarVueltas_(hoja)
    .filter((image) => {
      const altTitle = image.getAltTextTitle ? image.getAltTextTitle() : '';
      return altTitle === titulo;
    })
    .forEach((image) => image.remove());
}

function limpiarBotonesEliminarVueltas_(hoja) {
  getBotonesEliminarVueltas_(hoja).forEach((image) => image.remove());
}

function isBotonEliminarEnZonaVueltas_(image) {
  if (!image || !image.getAnchorCell) return false;

  const anchor = image.getAnchorCell();
  if (!anchor) return false;

  const fila = anchor.getRow();
  const columna = anchor.getColumn();

  return (
    fila >= FILA_BOTONES_VUELTAS &&
    fila <= FILA_NOMBRES_VUELTAS - 1 &&
    columna >= COLUMNA_INICIO_VUELTAS &&
    columna <= COLUMNA_FIN_VUELTAS
  );
}
