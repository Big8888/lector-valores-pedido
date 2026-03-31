const HOJAS_COBRO = ['Mauro', 'Brisa', 'Diogo', 'GIAN', 'LIBRE1', 'Venta Mostrador', 'Lector Pedidosya'];
const FILA_INICIO_PEDIDOS = 8;
const RANGO_LIMPIEZA_CONTROLES_VIEJOS = 'O1:P6';
const CELDA_BOTON_COBRO = 'A5';
const TITULO_IMAGEN_COBRO = 'COBROS_BUTTON';
const ANCHO_BOTON_COBRO = 185;
const ALTO_BOTON_COBRO = 55;
const OFFSET_X_BOTON_COBRO = 2;
const OFFSET_Y_BOTON_COBRO = 3;
const URL_BOTON_COBRO = 'https://raw.githubusercontent.com/Big8888/lector-valores-pedido/main/assets/abrir-cobro-button.png';
const COLOR_COBRADO = '#d9ead3';
const PREFIJO_CACHE_FILAS_COBRO = 'COBROS_FILAS_';
let BOTON_COBRO_BLOB = null;
const PERFILES_COBRO = {
  default: {
    accion: 1, // A
    numeroPedidoInterno: 2, // B
    estadoPago: 3, // C
    total: 4, // D
    tarjeta: 5, // E
    efectivo: 6, // F
    transferencia: 7, // G
    anotaciones: 27, // AA
    backupAnotacion: 28, // AB
    backupFondos: 29, // AC
    visibleEndColumn: 27
  },
  'Venta Mostrador': {
    accion: 1, // A
    numeroPedidoInterno: 2, // B
    estadoPago: 3, // C
    total: 4, // D
    tarjeta: 5, // E
    efectivo: 6, // F
    transferencia: 7, // G
    anotaciones: 11, // K
    backupAnotacion: 28, // AB
    backupFondos: 29, // AC
    visibleEndColumn: 11
  },
  'Lector Pedidosya': {
    accion: 1, // A
    numeroPedidoInterno: 2, // B
    estadoPago: 3, // C
    total: null,
    tarjeta: 4, // D
    efectivo: 5, // E
    transferencia: 12, // L
    anotaciones: 8, // H
    backupAnotacion: 28, // AB
    backupFondos: 29, // AC
    visibleEndColumn: 14
  }
};

function getPerfilCobro_(sheetName) {
  return PERFILES_COBRO[sheetName] || PERFILES_COBRO.default;
}

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

  limpiarBotonesCobro_(hoja);
  const celdaBoton = hoja.getRange(CELDA_BOTON_COBRO);
  colocarBotonCobroEnHoja_(hoja, celdaBoton);
}

function abrirVentanaCobro() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getActiveSheet();

  if (!HOJAS_COBRO.includes(hoja.getName())) {
    ui.alert('Esta herramienta solo funciona en las hojas Mauro, Brisa, Diogo, GIAN, LIBRE1, Venta Mostrador y Lector Pedidosya.');
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
  const perfil = getPerfilCobro_(hoja.getName());
  const filas = getFilasCobroDesdePayload_(payload);

  const totalEfectivo = toNumberCobro_(payload && payload.totalEfectivo);
  const montoPago = toNumberCobro_(payload && payload.montoPago);
  const vuelto = toNumberCobro_(payload && payload.vuelto);
  const hora = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm:ss');

  filas.forEach((fila) => {
    const anotacionCelda = hoja.getRange(fila, perfil.anotaciones);
    const backupAnotacionCelda = hoja.getRange(fila, perfil.backupAnotacion);
    const backupFondosCelda = hoja.getRange(fila, perfil.backupFondos);
    const anotacionActual = String(anotacionCelda.getValue() || '').trim();
    const yaCobrado = /COBRADO/i.test(anotacionActual);

    if (!yaCobrado) {
      backupAnotacionCelda.setValue(anotacionActual);
      backupFondosCelda.clearContent();
    }

    if (!yaCobrado) {
      const detalleCobro = totalEfectivo > 0
        ? 'COBRADO ' + hora + ' | Efectivo ' + totalEfectivo + ' | Pago ' + montoPago + ' | Vuelto ' + vuelto
        : 'COBRADO ' + hora;
      const nuevaAnotacion = anotacionActual ? anotacionActual + ' | ' + detalleCobro : detalleCobro;
      anotacionCelda.setValue(nuevaAnotacion);
    }

    hoja.getRange(fila, perfil.accion).setValue(false);
  });

  actualizarFilasCobroSeleccionadas_(hoja, filas, false);

  return {
    ok: true,
    mensaje: 'Cobro registrado correctamente.'
  };
}

function quitarCobro(payload) {
  const hoja = getHojaCobroDesdePayload_(payload);
  const perfil = getPerfilCobro_(hoja.getName());
  const filas = getFilasCobroDesdePayload_(payload);

  filas.forEach((fila) => {
    const anotacionCelda = hoja.getRange(fila, perfil.anotaciones);
    const backupAnotacionCelda = hoja.getRange(fila, perfil.backupAnotacion);
    const backupFondosCelda = hoja.getRange(fila, perfil.backupFondos);

    const backupAnotacion = String(backupAnotacionCelda.getValue() || '');
    const anotacionActual = String(anotacionCelda.getValue() || '');

    anotacionCelda.setValue(
      backupAnotacion || limpiarDetalleCobro_(anotacionActual)
    );

    backupAnotacionCelda.clearContent();
    backupFondosCelda.clearContent();
    hoja.getRange(fila, perfil.accion).setValue(false);
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
  const perfil = getPerfilCobro_(hoja.getName());
  const lastRow = hoja.getLastRow();
  if (lastRow < FILA_INICIO_PEDIDOS) {
    return buildCobroVacio_();
  }

  const filasSeleccionadas = obtenerFilasSeleccionadasCobro_(hoja, lastRow, perfil);
  if (filasSeleccionadas.length === 0) {
    return buildCobroVacio_();
  }

  return obtenerCobroSeleccionadoPorFilas_(hoja, filasSeleccionadas, perfil);
}

function obtenerCobroSeleccionadoPorFilas_(hoja, filasSeleccionadas, perfil) {
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
  const ultimaColumnaLectura = getUltimaColumnaLecturaCobro_(perfil);
  const valoresBase = hoja
    .getRange(filaMinima, 1, cantidadFilas, ultimaColumnaLectura)
    .getValues();
  const anotaciones = hoja
    .getRange(filaMinima, perfil.anotaciones, cantidadFilas, 1)
    .getValues();

  filasOrdenadas.forEach((fila) => {
    const indice = fila - filaMinima;
    const filaValores = valoresBase[indice] || [];
    const anotacionFila = String((anotaciones[indice] && anotaciones[indice][0]) || '').trim();

    const numeroPedidoInterno = String(
      getValorCobroEnColumna_(filaValores, perfil.numeroPedidoInterno) || ''
    ).trim();
    const estadoPago = String(
      getValorCobroEnColumna_(filaValores, perfil.estadoPago) || ''
    ).trim();
    const total = toNumberCobro_(getValorCobroEnColumna_(filaValores, perfil.total));
    const tarjeta = toNumberCobro_(getValorCobroEnColumna_(filaValores, perfil.tarjeta));
    const efectivo = toNumberCobro_(getValorCobroEnColumna_(filaValores, perfil.efectivo));
    const transferencia = toNumberCobro_(getValorCobroEnColumna_(filaValores, perfil.transferencia));

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

function getUltimaColumnaLecturaCobro_(perfil) {
  return Math.max(
    1,
    perfil.numeroPedidoInterno || 1,
    perfil.estadoPago || 1,
    perfil.total || 1,
    perfil.tarjeta || 1,
    perfil.efectivo || 1,
    perfil.transferencia || 1
  );
}

function getValorCobroEnColumna_(filaValores, columna) {
  if (!Number.isFinite(columna) || columna < 1) {
    return '';
  }

  return filaValores[columna - 1];
}

function obtenerFilasSeleccionadasCobro_(hoja, lastRow, perfil) {
  const totalRows = lastRow - FILA_INICIO_PEDIDOS + 1;
  const checks = hoja.getRange(FILA_INICIO_PEDIDOS, perfil.accion, totalRows, 1).getValues();
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

function obtenerFondosTemplate_(hoja, filasExcluidas, perfil) {
  const excluidas = new Set((filasExcluidas || []).map((fila) => Number(fila)));
  const lastRow = hoja.getLastRow();

  for (let fila = FILA_INICIO_PEDIDOS; fila <= lastRow; fila += 1) {
    if (excluidas.has(fila)) continue;

    const anotacion = String(hoja.getRange(fila, perfil.anotaciones).getValue() || '').trim();
    if (/COBRADO/i.test(anotacion)) continue;

    return hoja.getRange(fila, 1, 1, perfil.visibleEndColumn).getBackgrounds()[0];
  }

  return null;
}

function parseFondosBackup_(rawValue) {
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue);
    if (Array.isArray(parsed) && parsed.length > 0) {
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

function colocarBotonCobroEnHoja_(hoja, celdaBoton) {
  const image = hoja.insertImage(
    getBotonCobroBlob_(),
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

function getBotonCobroBlob_() {
  if (!BOTON_COBRO_BLOB) {
    BOTON_COBRO_BLOB = UrlFetchApp.fetch(URL_BOTON_COBRO).getBlob().setName('abrir-cobro-button.png');
  }

  return BOTON_COBRO_BLOB.copyBlob();
}

function isBotonCobroEnZona_(image) {
  if (!image || !image.getAnchorCell) return false;

  const anchor = image.getAnchorCell();
  if (!anchor) return false;

  return anchor.getColumn() <= 2 && anchor.getRow() >= 5 && anchor.getRow() <= 7;
}
