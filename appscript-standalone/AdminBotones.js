const TARGET_SPREADSHEET_ID = '1b6thcjNOAbUPKRWSSvqhog2vp6TOk-wbo5GqokPH2hg';
const HOJAS_REPARTIDORES = ['Mauro', 'Brisa', 'Diogo', 'GIAN', 'LIBRE1'];
const HOJAS_COBRO = [...HOJAS_REPARTIDORES, 'Venta Mostrador', 'Lector Pedidosya'];
const HOJAS_ESTADO_AUTOMATICO = [...HOJAS_REPARTIDORES, 'Venta Mostrador'];
const HOJA_CIERRE_CAJA = 'Cierre de caja';
const CELDA_BOTON = 'A5';
const CELDA_BOTON_CIERRE_DIA = 'J5';
const RANGO_LIMPIEZA_CONTROLES_VIEJOS = 'O1:P6';
const TITULO_IMAGEN_COBRO = 'COBROS_BUTTON';
const TITULO_IMAGEN_CIERRE_DIA = 'CIERRE_DIA_BUTTON';
const ANCHO_BOTON_COBRO = 185;
const ALTO_BOTON_COBRO = 55;
const OFFSET_X_BOTON_COBRO = 2;
const OFFSET_Y_BOTON_COBRO = 3;
const FUNCION_BOTON_EN_HOJA = 'abrirPedidosSeleccionados';
const FUNCION_BOTON_CIERRE_DIA = 'procesarCierreDelDia';
const URL_BOTON_COBRO = 'https://raw.githubusercontent.com/Big8888/lector-valores-pedido/main/assets/abrir-cobro-button.png';
const URL_BOTON_CIERRE_DIA = 'https://raw.githubusercontent.com/Big8888/lector-valores-pedido/main/assets/cerrar-dia-button.png';
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
const COLOR_ESTADO_PENDIENTE = '#ea4335';
const COLOR_ESTADO_PAGADO = '#fff2cc';
const COLOR_ESTADO_PARCIAL = '#ea4335';
let BOTON_COBRO_BLOB = null;
let BOTON_ELIMINAR_BLOB = null;

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

  HOJAS_COBRO.forEach((nombreHoja) => {
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

function recrearBotonCierreDelDiaEnHoja() {
  const spreadsheet = SpreadsheetApp.openById(TARGET_SPREADSHEET_ID);
  const hoja = spreadsheet.getSheetByName(HOJA_CIERRE_CAJA);
  if (!hoja) {
    throw new Error('No se encontro la hoja ' + HOJA_CIERRE_CAJA + '.');
  }

  asegurarBotonCierreDelDiaEnHoja_(hoja);

  return {
    ok: true,
    hoja: HOJA_CIERRE_CAJA,
    celda: CELDA_BOTON_CIERRE_DIA
  };
}

function inspeccionarImagenesEnHoja(nombreHoja) {
  const hojaBuscada = String(nombreHoja || '').trim();
  if (!hojaBuscada) {
    throw new Error('Falta indicar el nombre de la hoja.');
  }

  const spreadsheet = SpreadsheetApp.openById(TARGET_SPREADSHEET_ID);
  const hoja = spreadsheet.getSheetByName(hojaBuscada);
  if (!hoja) {
    throw new Error('No se encontro la hoja: ' + hojaBuscada);
  }

  const imagenes = (hoja.getImages ? hoja.getImages() : []).map((image, index) => {
    const anchor = image.getAnchorCell ? image.getAnchorCell() : null;
    const altTitle = image.getAltTextTitle ? image.getAltTextTitle() : '';
    const altDescription = image.getAltTextDescription ? image.getAltTextDescription() : '';
    const width = image.getWidth ? image.getWidth() : null;
    const height = image.getHeight ? image.getHeight() : null;

    return {
      index,
      altTitle,
      altDescription,
      width,
      height,
      row: anchor ? anchor.getRow() : null,
      column: anchor ? anchor.getColumn() : null,
      inVueltasZone: anchor
        ? anchor.getRow() >= FILA_BOTONES_VUELTAS &&
          anchor.getRow() <= FILA_NOMBRES_VUELTAS - 1 &&
          anchor.getColumn() >= COLUMNA_INICIO_VUELTAS &&
          anchor.getColumn() <= COLUMNA_FIN_VUELTAS
        : false
    };
  });

  return {
    ok: true,
    hoja: hojaBuscada,
    cantidad: imagenes.length,
    imagenes
  };
}

function inspeccionarImagenesGian() {
  return inspeccionarImagenesEnHoja('GIAN');
}

function inspeccionarImagenesMauro() {
  return inspeccionarImagenesEnHoja('Mauro');
}

function inspeccionarZonaVueltasMauro() {
  const spreadsheet = SpreadsheetApp.openById(TARGET_SPREADSHEET_ID);
  const hoja = spreadsheet.getSheetByName('Mauro');
  if (!hoja) {
    throw new Error('No se encontro la hoja Mauro.');
  }

  const columnas = [];
  for (let columna = COLUMNA_INICIO_VUELTAS; columna <= COLUMNA_FIN_VUELTAS; columna += 1) {
    columnas.push({
      columna,
      letra: columnToLetter_(columna),
      width: hoja.getColumnWidth(columna),
      row4Height: hoja.getRowHeight(FILA_BOTONES_VUELTAS),
      row6Height: hoja.getRowHeight(FILA_NOMBRES_VUELTAS),
      row7Height: hoja.getRowHeight(FILA_TITULOS_VUELTAS)
    });
  }

  return {
    ok: true,
    hoja: 'Mauro',
    columnas
  };
}

function inspeccionarZonaCobroEnHoja(nombreHoja) {
  const spreadsheet = SpreadsheetApp.openById(TARGET_SPREADSHEET_ID);
  const hoja = spreadsheet.getSheetByName(String(nombreHoja || '').trim());
  if (!hoja) {
    throw new Error('No se encontro la hoja.');
  }

  const merged = hoja.getRange('A1:A8').getMergedRanges().map((rango) => ({
    a1: rango.getA1Notation(),
    row: rango.getRow(),
    column: rango.getColumn(),
    numRows: rango.getNumRows(),
    numColumns: rango.getNumColumns()
  }));

  const rows = [];
  for (let fila = 1; fila <= 8; fila += 1) {
    rows.push({
      fila,
      height: hoja.getRowHeight(fila),
      valueA: hoja.getRange(fila, 1).getDisplayValue()
    });
  }

  return {
    ok: true,
    hoja: hoja.getName(),
    merged,
    rows
  };
}

function inspeccionarZonaCobroMauro() {
  return inspeccionarZonaCobroEnHoja('Mauro');
}

function limpiarBotonesCobroEnTodasLasHojas() {
  const spreadsheet = SpreadsheetApp.openById(TARGET_SPREADSHEET_ID);

  HOJAS_COBRO.forEach((nombreHoja) => {
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

function renombrarHojaMauro1ABrisa() {
  const spreadsheet = SpreadsheetApp.openById(TARGET_SPREADSHEET_ID);
  const hojaBrisa = spreadsheet.getSheetByName('Brisa');
  if (hojaBrisa) {
    return {
      ok: true,
      renamed: false,
      hoja: 'Brisa',
      motivo: 'La hoja Brisa ya existe'
    };
  }

  const hojaAnterior = spreadsheet.getSheetByName('Mauro 1');
  if (!hojaAnterior) {
    throw new Error('No se encontro la hoja Mauro 1.');
  }

  hojaAnterior.setName('Brisa');

  return {
    ok: true,
    renamed: true,
    hojaAnterior: 'Mauro 1',
    hojaNueva: 'Brisa'
  };
}

function alinearBotonesDeGianEnBrisa() {
  const spreadsheet = SpreadsheetApp.openById(TARGET_SPREADSHEET_ID);
  const hojaOrigen = spreadsheet.getSheetByName('GIAN');
  const hojaDestino = spreadsheet.getSheetByName('Brisa');

  if (!hojaOrigen) {
    throw new Error('No se encontro la hoja GIAN.');
  }

  if (!hojaDestino) {
    throw new Error('No se encontro la hoja Brisa.');
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
    destino: 'Brisa'
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

  HOJAS_ESTADO_AUTOMATICO.forEach((nombreHoja) => {
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

function sincronizarNombresHojasEnEncabezados() {
  const spreadsheet = SpreadsheetApp.openById(TARGET_SPREADSHEET_ID);
  const resultado = [];

  HOJAS_REPARTIDORES.forEach((nombreHoja) => {
    const hoja = spreadsheet.getSheetByName(nombreHoja);
    if (!hoja) {
      resultado.push({ hoja: nombreHoja, ok: false, motivo: 'Hoja no encontrada' });
      return;
    }

    hoja.getRange(7, 1).setValue(hoja.getName());
    hoja.getRange(7, 2).setValue(hoja.getName());
    const columnaNombre = detectarColumnaNombreHoja_(hoja, HOJAS_REPARTIDORES);
    hoja.getRange(7, columnaNombre).setValue(hoja.getName());
    resultado.push({ hoja: nombreHoja, ok: true, columna: columnToLetter_(columnaNombre) });
  });

  return {
    ok: true,
    spreadsheetId: TARGET_SPREADSHEET_ID,
    resultado
  };
}

function sincronizarColumnasPedidoYTransferenciaEnTodasLasHojas() {
  const spreadsheet = SpreadsheetApp.openById(TARGET_SPREADSHEET_ID);
  const resultado = [];

  HOJAS_REPARTIDORES.forEach((nombreHoja) => {
    const hoja = spreadsheet.getSheetByName(nombreHoja);
    if (!hoja) {
      resultado.push({ hoja: nombreHoja, ok: false, motivo: 'Hoja no encontrada' });
      return;
    }

    const ultimaFila = hoja.getLastRow();
    if (ultimaFila < FILA_DATOS_ESTADO) {
      resultado.push({ hoja: nombreHoja, ok: true, filas: 0 });
      return;
    }

    const cantidadFilas = ultimaFila - FILA_DATOS_ESTADO + 1;
    const valores = hoja.getRange(FILA_DATOS_ESTADO, 2, cantidadFilas, 6).getValues();
    const datosVW = valores.map((fila) => {
      const numeroPedido = fila[0] || '';
      const transferencia = Number(fila[5]) || 0;

      return [
        numeroPedido,
        transferencia > 0 ? transferencia : ''
      ];
    });

    hoja.getRange(FILA_DATOS_ESTADO, 22, cantidadFilas, 2).setValues(datosVW);
    resultado.push({ hoja: nombreHoja, ok: true, filas: cantidadFilas });
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
        columna === columnasEstado.estadoPago ||
        columna === columnasEstado.enCamino ||
        columna === columnasEstado.pedidoListo ||
        columna === columnasEstado.finalizado;

      return coincideColumnaEstado && fila === FILA_DATOS_ESTADO && filas === ultimaFila - FILA_DATOS_ESTADO + 1;
    });
  });

  if (columnasEstado.estadoPago > 0) {
    const rangoEstadoPago = hoja.getRange(
      FILA_DATOS_ESTADO,
      columnasEstado.estadoPago,
      ultimaFila - FILA_DATOS_ESTADO + 1,
      1
    );
    const letraEstadoPago = columnToLetter_(columnasEstado.estadoPago);

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

  hoja.setConditionalFormatRules(reglasFiltradas);
}

function getColumnasEstadoAutomatico_(hoja) {
  const ultimaColumna = Math.max(hoja.getLastColumn(), 12);
  const encabezados = hoja
    .getRange(FILA_TITULOS_VUELTAS, 1, 1, ultimaColumna)
    .getDisplayValues()[0]
    .map((valor) => normalizeHeaderEstadoAutomatico_(valor));

  return {
    estadoPago: encabezados.findIndex((valor) => valor === 'ESTADO DE PAGO') + 1,
    enCamino: encabezados.findIndex((valor) => valor === 'EN CAMINO') + 1,
    pedidoListo: encabezados.findIndex((valor) => valor === 'PEDIDO LISTO') + 1,
    finalizado: encabezados.findIndex((valor) => valor === 'FINALIZADO') + 1
  };
}

function normalizeHeaderEstadoAutomatico_(valor) {
  return String(valor || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function detectarColumnaNombreHoja_(hoja, nombresValidos) {
  const valores = hoja.getRange(7, 1, 1, 4).getDisplayValues()[0];
  const indice = valores.findIndex((valor) => {
    const texto = String(valor || '').trim();
    return nombresValidos.includes(texto);
  });

  return indice >= 0 ? indice + 1 : 2;
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

  limpiarBotonesCobro_(hoja);
  const celdaBoton = hoja.getRange(CELDA_BOTON);
  colocarBotonCobroEnHoja_(hoja, celdaBoton);
}

function limpiarBotonesCobro_(hoja) {
  getBotonesCobro_(hoja).forEach((image) => image.remove());
}

function limpiarBotonesCierreDelDia_(hoja) {
  getBotonesCierreDelDia_(hoja).forEach((image) => image.remove());
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
    if (isBotonCobroEnZona_(image)) return true;
    const altTitle = image.getAltTextTitle ? image.getAltTextTitle() : '';
    return altTitle === TITULO_IMAGEN_COBRO;
  });
}

function getBotonesCierreDelDia_(hoja) {
  if (!hoja.getImages) return [];

  return hoja.getImages().filter((image) => {
    if (isBotonCierreDelDiaEnZona_(image)) return true;
    const altTitle = image.getAltTextTitle ? image.getAltTextTitle() : '';
    return altTitle === TITULO_IMAGEN_CIERRE_DIA;
  });
}

function colocarBotonCobroEnHoja_(hoja, celdaBoton) {
  const image = hoja.insertImage(
    getBotonCobroBlob_(),
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

function asegurarBotonCierreDelDiaEnHoja_(hoja) {
  limpiarBotonesCierreDelDia_(hoja);

  const celdaBoton = hoja.getRange(CELDA_BOTON_CIERRE_DIA);
  const image = hoja.insertImage(
    URL_BOTON_CIERRE_DIA,
    celdaBoton.getColumn(),
    celdaBoton.getRow(),
    OFFSET_X_BOTON_COBRO,
    OFFSET_Y_BOTON_COBRO
  );

  image.assignScript(FUNCION_BOTON_CIERRE_DIA);
  image.setAltTextTitle(TITULO_IMAGEN_CIERRE_DIA);
  image.setAltTextDescription('Procesa el cierre del dia y limpia las hojas operativas');
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
      getBotonEliminarBlob_(),
      celda.getColumn(),
      celda.getRow(),
      OFFSET_X_BOTON_ELIMINAR,
      OFFSET_Y_BOTON_ELIMINAR
    );

    image.assignScript(scriptName);
    image.setAltTextTitle(titulo);
    image.setAltTextDescription('Elimina la vuelta y corre las siguientes a la izquierda');
    ajustarBotonEliminarACelda_(hoja, image, FILA_BOTONES_VUELTAS, columna);
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

function ajustarBotonEliminarACelda_(hoja, image, fila, columna) {
  const anchoCelda = hoja.getColumnWidth(columna);
  const altoCelda = hoja.getRowHeight(fila);
  const ancho = Math.max(20, anchoCelda - (OFFSET_X_BOTON_ELIMINAR * 2));
  const alto = Math.max(18, altoCelda - (OFFSET_Y_BOTON_ELIMINAR * 2));

  image.setWidth(ancho);
  image.setHeight(alto);
}

function getBotonCobroBlob_() {
  if (!BOTON_COBRO_BLOB) {
    BOTON_COBRO_BLOB = UrlFetchApp.fetch(URL_BOTON_COBRO).getBlob().setName('abrir-cobro-button.png');
  }

  return BOTON_COBRO_BLOB.copyBlob();
}

function getBotonEliminarBlob_() {
  if (!BOTON_ELIMINAR_BLOB) {
    BOTON_ELIMINAR_BLOB = UrlFetchApp.fetch(URL_BOTON_ELIMINAR).getBlob().setName('limpiar-button.png');
  }

  return BOTON_ELIMINAR_BLOB.copyBlob();
}

function isBotonCobroEnZona_(image) {
  if (!image || !image.getAnchorCell) return false;

  const anchor = image.getAnchorCell();
  if (!anchor) return false;

  return anchor.getColumn() <= 2 && anchor.getRow() >= 5 && anchor.getRow() <= 7;
}

function isBotonCierreDelDiaEnZona_(image) {
  if (!image || !image.getAnchorCell) return false;

  const anchor = image.getAnchorCell();
  if (!anchor) return false;

  return anchor.getColumn() === 10 && anchor.getRow() === 5;
}
