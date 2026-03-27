const HOJAS_COBRO = ['Mauro', 'Mauro 1', 'Diogo', 'GIAN', 'LIBRE1'];
const FILA_INICIO_PEDIDOS = 8;
const RANGO_LIMPIEZA_CONTROLES_VIEJOS = 'O1:P6';
const CELDA_BOTON_COBRO = 'A7';
const TITULO_IMAGEN_COBRO = 'COBROS_BUTTON';
const ANCHO_BOTON_COBRO = 126;
const ALTO_BOTON_COBRO = 26;
const OFFSET_X_BOTON_COBRO = 2;
const OFFSET_Y_BOTON_COBRO = 3;
const COLOR_COBRADO = '#d9ead3';
const PREFIJO_CACHE_FILAS_COBRO = 'COBROS_FILAS_';
const COLUMNAS_COBRO = {
  accion: 1, // A
  numeroPedidoInterno: 2, // B
  estadoPago: 3, // C
  total: 4, // D
  tarjeta: 5, // E
  efectivo: 6, // F
  transferencia: 7, // G
  enviosLejanos: 8, // H
  propinaWeb: 9, // I
  salidaDinero: 10, // J
  enCamino: 11, // K
  finalizado: 12, // L
  anotaciones: 27, // AA
  backupAnotacion: 28, // AB
  backupFondos: 29 // AC
};

function crearMenuCobros() {
  SpreadsheetApp.getUi()
    .createMenu('COBROS')
    .addItem('Abrir calculadora de cobro', 'abrirVentanaCobro')
    .addItem('Recrear boton en hojas', 'crearBotonCobrosEnHojas')
    .addToUi();
}

function abrirPedidosSeleccionados() {
  abrirVentanaCobro();
}

function limpiarBotonesCobroEnHojas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  HOJAS_COBRO.forEach((nombreHoja) => {
    const hoja = ss.getSheetByName(nombreHoja);
    if (!hoja) return;

    limpiarBotonesCobro_(hoja);
    hoja.getRange(RANGO_LIMPIEZA_CONTROLES_VIEJOS)
      .clearContent()
      .clearDataValidations()
      .clearNote()
      .setBackground(null);
  });
}

function crearBotonCobrosEnHojas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  HOJAS_COBRO.forEach((nombreHoja) => {
    const hoja = ss.getSheetByName(nombreHoja);
    if (!hoja) return;

    asegurarBotonCobroEnHoja_(hoja);
  });
}

function asegurarBotonCobroEnHojaActual_() {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  if (!hoja || !HOJAS_COBRO.includes(hoja.getName())) return;

  asegurarBotonCobroEnHoja_(hoja);
}

function asegurarBotonCobroEnHoja_(hoja) {
  hoja.getRange(RANGO_LIMPIEZA_CONTROLES_VIEJOS)
    .clearContent()
    .clearDataValidations()
    .clearNote()
    .setBackground(null);

  const celdaBoton = hoja.getRange(CELDA_BOTON_COBRO);
  const botonFila = celdaBoton.getRow();
  const botonColumna = celdaBoton.getColumn();

  const botones = getBotonesCobro_(hoja);
  const botonEnPosicion = botones.some((image) => {
    if (!image.getAnchorCell) return false;
    const anchor = image.getAnchorCell();
    return anchor && anchor.getRow() === botonFila && anchor.getColumn() === botonColumna;
  });

  if (botones.length === 1 && botonEnPosicion) {
    return;
  }

  limpiarBotonesCobro_(hoja);
  colocarBotonCobroEnHoja_(hoja, celdaBoton);
}

function abrirVentanaCobro() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getActiveSheet();

  if (!HOJAS_COBRO.includes(hoja.getName())) {
    ui.alert('Esta herramienta solo funciona en las hojas Mauro, Mauro 1, Diogo, GIAN y LIBRE1.');
    return;
  }

  const template = HtmlService.createTemplateFromFile('CobroModal');
  template.sheetName = hoja.getName();

  const html = template.evaluate()
    .setWidth(620)
    .setHeight(680);

  ui.showModalDialog(html, 'Cobro de pedidos seleccionados');
}

function obtenerDatosCobroModal(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName(String(sheetName || '').trim());

  if (!hoja) {
    throw new Error('No se encontro la hoja del cobro.');
  }

  const datos = obtenerPedidosSeleccionados_(hoja);
  if (datos.items.length === 0) {
    throw new Error('Marca en A los pedidos que queres cobrar y despues toca ABRIR COBROS.');
  }

  return {
    sheetName: hoja.getName(),
    items: datos.items,
    totalTarjeta: datos.totalTarjeta,
    totalEfectivo: datos.totalEfectivo,
    totalTransferencia: datos.totalTransferencia,
    totalGeneral: datos.totalGeneral
  };
}

function confirmarCobro(payload) {
  const hoja = getHojaCobroDesdePayload_(payload);
  const filas = getFilasCobroDesdePayload_(payload);

  const totalEfectivo = toNumberCobro_(payload && payload.totalEfectivo);
  const montoPago = toNumberCobro_(payload && payload.montoPago);
  const vuelto = toNumberCobro_(payload && payload.vuelto);
  const hora = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm:ss');

  filas.forEach((fila) => {
    const rangoVisible = hoja.getRange(fila, 1, 1, COLUMNAS_COBRO.anotaciones);
    const anotacionCelda = hoja.getRange(fila, COLUMNAS_COBRO.anotaciones);
    const backupAnotacionCelda = hoja.getRange(fila, COLUMNAS_COBRO.backupAnotacion);
    const backupFondosCelda = hoja.getRange(fila, COLUMNAS_COBRO.backupFondos);
    const anotacionActual = String(anotacionCelda.getValue() || '').trim();
    const yaCobrado = /COBRADO/i.test(anotacionActual);

    if (!yaCobrado) {
      backupAnotacionCelda.setValue(anotacionActual);
      backupFondosCelda.setValue(JSON.stringify(rangoVisible.getBackgrounds()[0]));
    }

    rangoVisible.setBackground(COLOR_COBRADO);

    if (!yaCobrado) {
      const detalleCobro = totalEfectivo > 0
        ? 'COBRADO ' + hora + ' | Efectivo ' + totalEfectivo + ' | Pago ' + montoPago + ' | Vuelto ' + vuelto
        : 'COBRADO ' + hora;
      const nuevaAnotacion = anotacionActual ? anotacionActual + ' | ' + detalleCobro : detalleCobro;
      anotacionCelda.setValue(nuevaAnotacion);
    }

    hoja.getRange(fila, COLUMNAS_COBRO.accion).setValue(false);
  });

  actualizarFilasCobroSeleccionadas_(hoja, filas, false);

  return {
    ok: true,
    mensaje: 'Cobro registrado correctamente.'
  };
}

function quitarCobro(payload) {
  const hoja = getHojaCobroDesdePayload_(payload);
  const filas = getFilasCobroDesdePayload_(payload);
  const fondosTemplate = obtenerFondosTemplate_(hoja, filas);

  filas.forEach((fila) => {
    const rangoVisible = hoja.getRange(fila, 1, 1, COLUMNAS_COBRO.anotaciones);
    const anotacionCelda = hoja.getRange(fila, COLUMNAS_COBRO.anotaciones);
    const backupAnotacionCelda = hoja.getRange(fila, COLUMNAS_COBRO.backupAnotacion);
    const backupFondosCelda = hoja.getRange(fila, COLUMNAS_COBRO.backupFondos);

    const backupAnotacion = String(backupAnotacionCelda.getValue() || '');
    const backupFondosRaw = String(backupFondosCelda.getValue() || '').trim();
    const anotacionActual = String(anotacionCelda.getValue() || '');

    const fondos = parseFondosBackup_(backupFondosRaw) || fondosTemplate;
    if (fondos) {
      rangoVisible.setBackgrounds([fondos]);
    }

    anotacionCelda.setValue(
      backupAnotacion || limpiarDetalleCobro_(anotacionActual)
    );

    backupAnotacionCelda.clearContent();
    backupFondosCelda.clearContent();
    hoja.getRange(fila, COLUMNAS_COBRO.accion).setValue(false);
  });

  actualizarFilasCobroSeleccionadas_(hoja, filas, false);

  return {
    ok: true,
    mensaje: 'Cobro quitado correctamente.'
  };
}

function getHojaCobroDesdePayload_(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = String((payload && payload.sheetName) || '').trim();
  const hoja = ss.getSheetByName(sheetName);

  if (!hoja) {
    throw new Error('No se encontro la hoja del cobro.');
  }

  return hoja;
}

function getFilasCobroDesdePayload_(payload) {
  const filas = Array.isArray(payload && payload.filas)
    ? payload.filas
        .map((fila) => Number(fila))
        .filter((fila) => Number.isFinite(fila) && fila >= FILA_INICIO_PEDIDOS)
    : [];

  if (filas.length === 0) {
    throw new Error('No se recibieron filas validas para cobrar.');
  }

  return filas;
}

function obtenerPedidosSeleccionados_(hoja) {
  const lastRow = hoja.getLastRow();
  if (lastRow < FILA_INICIO_PEDIDOS) {
    return buildCobroVacio_();
  }

  const filasSeleccionadas = obtenerFilasSeleccionadasCobro_(hoja, lastRow);
  if (filasSeleccionadas.length === 0) {
    return buildCobroVacio_();
  }

  return obtenerCobroSeleccionadoPorFilas_(hoja, filasSeleccionadas);
}

function obtenerCobroSeleccionadoPorFilas_(hoja, filasSeleccionadas) {
  const resultado = buildCobroVacio_();
  const filasOrdenadas = Array.from(
    new Set(
      (filasSeleccionadas || [])
        .map((fila) => Number(fila))
        .filter((fila) => Number.isFinite(fila) && fila >= FILA_INICIO_PEDIDOS)
    )
  ).sort((a, b) => a - b);

  if (filasOrdenadas.length === 0) {
    return resultado;
  }

  const filaMinima = filasOrdenadas[0];
  const filaMaxima = filasOrdenadas[filasOrdenadas.length - 1];
  const cantidadFilas = filaMaxima - filaMinima + 1;
  const valoresBase = hoja
    .getRange(filaMinima, 1, cantidadFilas, COLUMNAS_COBRO.transferencia)
    .getValues();
  const anotaciones = hoja
    .getRange(filaMinima, COLUMNAS_COBRO.anotaciones, cantidadFilas, 1)
    .getValues();

  filasOrdenadas.forEach((fila) => {
    const indice = fila - filaMinima;
    const filaValores = valoresBase[indice] || [];
    const anotacionFila = String((anotaciones[indice] && anotaciones[indice][0]) || '').trim();

    const numeroPedidoInterno = String(
      filaValores[COLUMNAS_COBRO.numeroPedidoInterno - 1] || ''
    ).trim();
    const estadoPago = String(
      filaValores[COLUMNAS_COBRO.estadoPago - 1] || ''
    ).trim();
    const total = toNumberCobro_(filaValores[COLUMNAS_COBRO.total - 1]);
    const tarjeta = toNumberCobro_(filaValores[COLUMNAS_COBRO.tarjeta - 1]);
    const efectivo = toNumberCobro_(filaValores[COLUMNAS_COBRO.efectivo - 1]);
    const transferencia = toNumberCobro_(filaValores[COLUMNAS_COBRO.transferencia - 1]);

    if (!numeroPedidoInterno && total <= 0 && tarjeta <= 0 && efectivo <= 0 && transferencia <= 0) {
      return;
    }

    const totalFila = total + tarjeta + efectivo + transferencia;

    resultado.totalTarjeta += tarjeta;
    resultado.totalEfectivo += efectivo;
    resultado.totalTransferencia += transferencia;
    resultado.totalGeneral += totalFila;

    resultado.items.push({
      fila,
      numeroPedidoInterno,
      estadoPago,
      tarjeta,
      efectivo,
      transferencia,
      totalFila,
      cobrado: /COBRADO/i.test(anotacionFila)
    });
  });

  return resultado;
}

function obtenerFilasSeleccionadasCobro_(hoja, lastRow) {
  const filasCacheadas = getFilasCobroSeleccionadasCache_(hoja.getName())
    .filter((fila) => fila >= FILA_INICIO_PEDIDOS && fila <= lastRow);

  if (filasCacheadas.length > 0) {
    return filasCacheadas;
  }

  const totalRows = lastRow - FILA_INICIO_PEDIDOS + 1;
  const checks = hoja.getRange(FILA_INICIO_PEDIDOS, COLUMNAS_COBRO.accion, totalRows, 1).getValues();
  const filasDetectadas = [];

  checks.forEach((filaValor, index) => {
    if (filaValor[0] === true) {
      filasDetectadas.push(FILA_INICIO_PEDIDOS + index);
    }
  });

  setFilasCobroSeleccionadasCache_(hoja.getName(), filasDetectadas);
  return filasDetectadas;
}

function buildCobroVacio_() {
  return {
    items: [],
    totalTarjeta: 0,
    totalEfectivo: 0,
    totalTransferencia: 0,
    totalGeneral: 0
  };
}

function obtenerFondosTemplate_(hoja, filasExcluidas) {
  const excluidas = new Set((filasExcluidas || []).map((fila) => Number(fila)));
  const lastRow = hoja.getLastRow();

  for (let fila = FILA_INICIO_PEDIDOS; fila <= lastRow; fila += 1) {
    if (excluidas.has(fila)) continue;

    const anotacion = String(hoja.getRange(fila, COLUMNAS_COBRO.anotaciones).getValue() || '').trim();
    if (/COBRADO/i.test(anotacion)) continue;

    return hoja.getRange(fila, 1, 1, COLUMNAS_COBRO.anotaciones).getBackgrounds()[0];
  }

  return null;
}

function parseFondosBackup_(rawValue) {
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue);
    if (Array.isArray(parsed) && parsed.length >= COLUMNAS_COBRO.anotaciones) {
      return parsed;
    }
  } catch (error) {
    return null;
  }

  return null;
}

function actualizarFilasCobroSeleccionadas_(hoja, filas, checked) {
  const filasActuales = getFilasCobroSeleccionadasCache_(hoja.getName());
  const objetivo = new Set(filasActuales);

  (Array.isArray(filas) ? filas : [filas]).forEach((fila) => {
    const numeroFila = Number(fila);
    if (!Number.isFinite(numeroFila) || numeroFila < FILA_INICIO_PEDIDOS) return;

    if (checked) {
      objetivo.add(numeroFila);
    } else {
      objetivo.delete(numeroFila);
    }
  });

  setFilasCobroSeleccionadasCache_(hoja.getName(), Array.from(objetivo).sort((a, b) => a - b));
}

function getFilasCobroSeleccionadasCache_(sheetName) {
  const raw = PropertiesService
    .getDocumentProperties()
    .getProperty(getKeyFilasCobro_(sheetName));

  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((fila) => Number(fila))
      .filter((fila) => Number.isFinite(fila) && fila >= FILA_INICIO_PEDIDOS)
      .sort((a, b) => a - b);
  } catch (error) {
    return [];
  }
}

function setFilasCobroSeleccionadasCache_(sheetName, filas) {
  const props = PropertiesService.getDocumentProperties();
  const key = getKeyFilasCobro_(sheetName);
  const normalizadas = Array.isArray(filas)
    ? filas
        .map((fila) => Number(fila))
        .filter((fila) => Number.isFinite(fila) && fila >= FILA_INICIO_PEDIDOS)
        .sort((a, b) => a - b)
    : [];

  if (normalizadas.length === 0) {
    props.deleteProperty(key);
    return;
  }

  props.setProperty(key, JSON.stringify(normalizadas));
}

function getKeyFilasCobro_(sheetName) {
  return PREFIJO_CACHE_FILAS_COBRO + String(sheetName || '').trim().toUpperCase();
}

function limpiarDetalleCobro_(texto) {
  if (!texto) return '';

  const partes = String(texto)
    .split('|')
    .map((parte) => parte.trim())
    .filter(Boolean);

  const partesLimpias = partes.filter((parte) => {
    if (/^COBRADO\b/i.test(parte)) return false;
    if (/^Efectivo\b/i.test(parte)) return false;
    if (/^Pago\b/i.test(parte)) return false;
    if (/^Vuelto\b/i.test(parte)) return false;
    return true;
  });

  return partesLimpias.join(' | ');
}

function toNumberCobro_(value) {
  if (value === null || value === undefined || value === '') return 0;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const normalized = String(value).replace(/[^\d.,-]/g, '').trim();
  if (!normalized) return 0;

  const parsed = Number(
    normalized.includes(',')
      ? normalized.replace(/\./g, '').replace(',', '.')
      : normalized
  );

  return Number.isFinite(parsed) ? parsed : 0;
}

function limpiarBotonesCobro_(hoja) {
  getBotonesCobro_(hoja).forEach((image) => image.remove());
}

function getBotonesCobro_(hoja) {
  if (!hoja.getImages) return [];

  return hoja.getImages().filter((image) => {
    const altTitle = image.getAltTextTitle ? image.getAltTextTitle() : '';
    return altTitle === TITULO_IMAGEN_COBRO;
  });
}

function colocarBotonCobroEnHoja_(hoja, celdaBoton) {
  const boton = crearImagenBotonCobros_();
  const image = hoja.insertImage(
    boton.copyBlob(),
    celdaBoton.getColumn(),
    celdaBoton.getRow(),
    OFFSET_X_BOTON_COBRO,
    OFFSET_Y_BOTON_COBRO
  );

  image.assignScript('abrirPedidosSeleccionados');
  image.setAltTextTitle(TITULO_IMAGEN_COBRO);
  image.setAltTextDescription('Abre la calculadora de cobro de esta hoja');
  image.setWidth(ANCHO_BOTON_COBRO);
  image.setHeight(ALTO_BOTON_COBRO);
}

function crearImagenBotonCobros_() {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="252" height="52" viewBox="0 0 252 52">',
    '<rect x="2" y="2" width="248" height="48" rx="14" fill="#34a853" stroke="#1f6f37" stroke-width="4"/>',
    '<text x="126" y="33" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#ffffff">ABRIR COBROS</text>',
    '</svg>'
  ].join('');

  return Utilities.newBlob(svg, 'image/svg+xml', 'cobros-button.svg');
}
