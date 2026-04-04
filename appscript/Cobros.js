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
const PREFIJO_CACHE_FONDOS_COBRO = 'COBROS_FONDOS_';
const BACKEND_OPERATIVO_BASE_URL_DEFAULT = 'https://lector-valores-pedido-final.onrender.com';
const BACKEND_OPERATIVO_SECRET_PROPERTY = 'BACKEND_OPERATIVO_SECRET';
const BACKEND_OPERATIVO_BASE_URL_PROPERTY = 'BACKEND_OPERATIVO_BASE_URL';
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
    legacyRegistroCobro: 13, // M
    anotaciones: 27, // AA
    backupAnotacion: 28, // AB
    marcaCobrado: 29, // AC
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
    legacyRegistroCobro: 11, // K
    anotaciones: 11, // K
    registroCobro: 18, // R
    backupAnotacion: 28, // AB
    marcaCobrado: 29, // AC
    visibleEndColumn: 18
  },
  'Lector Pedidosya': {
    accion: 1, // A
    numeroPedidoInterno: 2, // B
    estadoPago: 3, // C
    total: null,
    tarjeta: 4, // D
    efectivo: 5, // E
    transferencia: 12, // L
    legacyRegistroCobro: 8, // H
    anotaciones: 8, // H
    backupAnotacion: 28, // AB
    marcaCobrado: 29, // AC
    visibleEndColumn: 14
  }
};

function getPerfilCobro_(sheetName) {
  return PERFILES_COBRO[sheetName] || PERFILES_COBRO.default;
}

function getColumnaRegistroCobro_(perfil) {
  return perfil.registroCobro || perfil.anotaciones;
}

function getColumnaRegistroCobroLegacy_(perfil) {
  return perfil.legacyRegistroCobro || getColumnaRegistroCobro_(perfil);
}

function crearMenuCobros() {
  SpreadsheetApp.getUi()
    .createMenu('COBROS')
    .addItem('Abrir calculadora de cobro', 'abrirVentanaCobro')
    .addItem('Recrear boton en hojas', 'crearBotonCobrosEnHojas')
    .addItem('Configurar secret backend', 'configurarSecretBackendOperativo')
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
  const filas = getFilasCobroDesdePayload_(payload);
  const response = llamarBackendOperativo_('/admin/actions/cobro/confirmar', {
    sheetName: hoja.getName(),
    filas,
    montoPago: toNumberCobro_(payload && payload.montoPago),
    totalEfectivo: toNumberCobro_(payload && payload.totalEfectivo),
    vuelto: toNumberCobro_(payload && payload.vuelto)
  });

  actualizarFilasCobroSeleccionadas_(hoja, filas, false);

  return response || {
    ok: true,
    mensaje: 'Cobro registrado correctamente.'
  };
}

function quitarCobro(payload) {
  const hoja = getHojaCobroDesdePayload_(payload);
  const filas = getFilasCobroDesdePayload_(payload);
  const response = llamarBackendOperativo_('/admin/actions/cobro/quitar', {
    sheetName: hoja.getName(),
    filas
  });
  actualizarFilasCobroSeleccionadas_(hoja, filas, false);

  return response || {
    ok: true,
    mensaje: 'Cobro quitado correctamente.'
  };
}

function configurarSecretBackendOperativo() {
  const ui = SpreadsheetApp.getUi();
  const actual = PropertiesService.getDocumentProperties().getProperty(BACKEND_OPERATIVO_SECRET_PROPERTY) || '';
  const respuesta = ui.prompt(
    'Configurar secret backend',
    actual
      ? 'Pegá el secret del backend. Si querés reemplazar el actual, escribilo abajo.'
      : 'Pegá el mismo secret que usas en Render como ADMIN_ACTION_SECRET o WEBHOOK_SECRET.',
    ui.ButtonSet.OK_CANCEL
  );

  if (respuesta.getSelectedButton() !== ui.Button.OK) {
    return;
  }

  const nuevoSecret = String(respuesta.getResponseText() || '').trim();
  if (!nuevoSecret) {
    throw new Error('No se ingreso ningun secret.');
  }

  const props = PropertiesService.getDocumentProperties();
  props.setProperty(BACKEND_OPERATIVO_SECRET_PROPERTY, nuevoSecret);
  props.setProperty(BACKEND_OPERATIVO_BASE_URL_PROPERTY, BACKEND_OPERATIVO_BASE_URL_DEFAULT);
  SpreadsheetApp.getActiveSpreadsheet().toast('Secret backend guardado.', 'COBROS', 4);
}

function getBackendOperativoBaseUrl_() {
  const configured = PropertiesService.getDocumentProperties().getProperty(BACKEND_OPERATIVO_BASE_URL_PROPERTY);
  return String(configured || BACKEND_OPERATIVO_BASE_URL_DEFAULT || '').trim().replace(/\/+$/, '');
}

function getBackendOperativoSecret_() {
  const secret = PropertiesService.getDocumentProperties().getProperty(BACKEND_OPERATIVO_SECRET_PROPERTY);
  const normalized = String(secret || '').trim();
  if (!normalized) {
    throw new Error('Falta configurar el secret backend. Usa COBROS > Configurar secret backend.');
  }

  return normalized;
}

function llamarBackendOperativo_(path, payload) {
  const baseUrl = getBackendOperativoBaseUrl_();
  const secret = getBackendOperativoSecret_();
  const response = UrlFetchApp.fetch(baseUrl + path, {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: {
      'x-admin-secret': secret
    },
    payload: JSON.stringify(payload || {})
  });

  const bodyText = response.getContentText() || '';
  let body = {};
  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch (error) {
    throw new Error('El backend devolvio una respuesta invalida.');
  }

  if (response.getResponseCode() >= 400) {
    throw new Error(body && body.error ? body.error : 'No se pudo completar la accion en el backend.');
  }

  return body;
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
  const columnaRegistroCobro = getColumnaRegistroCobro_(perfil);
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
    .getRange(filaMinima, columnaRegistroCobro, cantidadFilas, 1)
    .getValues();
  const legacyAnotaciones = (getColumnaRegistroCobroLegacy_(perfil) !== columnaRegistroCobro)
    ? hoja.getRange(filaMinima, getColumnaRegistroCobroLegacy_(perfil), cantidadFilas, 1).getValues()
    : [];
  const marcasCobrado = hoja
    .getRange(filaMinima, perfil.marcaCobrado, cantidadFilas, 1)
    .getValues();

  filasOrdenadas.forEach((fila) => {
    const indice = fila - filaMinima;
    const filaValores = valoresBase[indice] || [];
    const anotacionFila = String((anotaciones[indice] && anotaciones[indice][0]) || '').trim();
    const legacyAnotacionFila = legacyAnotaciones.length
      ? String((legacyAnotaciones[indice] && legacyAnotaciones[indice][0]) || '').trim()
      : '';
    const marcaCobradoFila = String((marcasCobrado[indice] && marcasCobrado[indice][0]) || '').trim();

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
      cobrado:
        marcaCobradoFila === 'COBRADO' ||
        /COBRADO/i.test(anotacionFila) ||
        /COBRADO/i.test(legacyAnotacionFila)
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
    perfil.transferencia || 1,
    perfil.marcaCobrado || 1
  );
}

function getValorCobroEnColumna_(filaValores, columna) {
  if (!Number.isFinite(columna) || columna < 1) {
    return '';
  }

  return filaValores[columna - 1];
}

function isFilaCobrada_(hoja, fila, perfil, opciones) {
  const registroActual = typeof opciones === 'string'
    ? String(opciones || '').trim()
    : String((opciones && opciones.registroActual) || '').trim();
  const legacyActual = typeof opciones === 'object'
    ? String((opciones && opciones.legacyActual) || '').trim()
    : '';
  const marcaCobrado = String(hoja.getRange(fila, perfil.marcaCobrado).getValue() || '').trim();
  if (marcaCobrado === 'COBRADO') return true;
  if (/COBRADO/i.test(registroActual)) return true;
  return /COBRADO/i.test(legacyActual);
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

function obtenerFondosTemplate_(hoja, filaObjetivo, filasExcluidas, perfil) {
  const excluidas = new Set((filasExcluidas || []).map((fila) => Number(fila)));
  const lastRow = hoja.getLastRow();
  const filaBase = Math.max(FILA_INICIO_PEDIDOS, Number(filaObjetivo) || FILA_INICIO_PEDIDOS);
  const maxDistancia = Math.max(filaBase - FILA_INICIO_PEDIDOS, lastRow - filaBase);

  for (let distancia = 0; distancia <= maxDistancia; distancia += 1) {
    const candidatas = distancia === 0
      ? [filaBase]
      : [filaBase - distancia, filaBase + distancia];

    for (let i = 0; i < candidatas.length; i += 1) {
      const fila = candidatas[i];
      if (fila < FILA_INICIO_PEDIDOS || fila > lastRow) continue;
      if (excluidas.has(fila)) continue;
      if (isFilaCobrada_(hoja, fila, perfil)) continue;
      if (!isFilaLibreParaTemplate_(hoja, fila, perfil)) continue;

      return hoja.getRange(fila, 1, 1, perfil.visibleEndColumn).getBackgrounds()[0];
    }
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

function guardarFondosFilaAntesDeCobro_(hoja, fila, perfil) {
  const key = getKeyFondosCobro_(hoja.getName(), fila);
  const props = PropertiesService.getDocumentProperties();

  if (props.getProperty(key)) {
    return;
  }

  const fondos = hoja.getRange(fila, 1, 1, perfil.visibleEndColumn).getBackgrounds()[0];
  props.setProperty(key, JSON.stringify(fondos));
}

function restaurarFondosFilaLuegoDeQuitar_(hoja, fila, perfil, filasQuitadas) {
  const key = getKeyFondosCobro_(hoja.getName(), fila);
  const props = PropertiesService.getDocumentProperties();
  const fondosTemplate = obtenerFondosTemplate_(hoja, fila, filasQuitadas, perfil);

  if (Array.isArray(fondosTemplate) && fondosTemplate.length > 0) {
    hoja.getRange(fila, 1, 1, perfil.visibleEndColumn).setBackgrounds([fondosTemplate]);
  }

  props.deleteProperty(key);
}

function isFilaLibreParaTemplate_(hoja, fila, perfil) {
  const rangos = getRangosFilaPedidoParaLimpiar_(hoja.getName(), fila, perfil);

  return rangos.every((a1) => {
    const valores = hoja.getRange(a1).getDisplayValues();
    return valores.every((row) => row.every((cell) => String(cell || '').trim() === ''));
  });
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

function getKeyFondosCobro_(sheetName, fila) {
  return (
    PREFIJO_CACHE_FONDOS_COBRO +
    String(sheetName || '').trim().toUpperCase() +
    '_' +
    String(Number(fila) || '')
  );
}

function sincronizarEstadoPagoCobro_(hoja, fila, perfil) {
  if (hoja.getName() !== 'Lector Pedidosya') {
    return;
  }

  const columnaEstadoPago = perfil.estadoPago;
  const columnaEfectivo = perfil.efectivo;
  if (!columnaEstadoPago || !columnaEfectivo) {
    return;
  }

  const estadoPagoCelda = hoja.getRange(fila, columnaEstadoPago);
  const efectivo = toNumberCobro_(hoja.getRange(fila, columnaEfectivo).getValue());
  const estadoActual = String(estadoPagoCelda.getValue() || '').trim().toUpperCase();

  if (efectivo > 0 && isEstadoPendienteCobro_(estadoActual)) {
    estadoPagoCelda.setValue('PAGADO');
  }
}

function normalizarEstadosPagoCobradosEnLectorPedidosya_(hoja) {
  if (!hoja || hoja.getName() !== 'Lector Pedidosya') {
    return;
  }

  const perfil = getPerfilCobro_(hoja.getName());
  const lastRow = hoja.getLastRow();
  if (lastRow < FILA_INICIO_PEDIDOS) {
    return;
  }

  const totalRows = lastRow - FILA_INICIO_PEDIDOS + 1;
  const columnaRegistroCobro = getColumnaRegistroCobro_(perfil);
  const columnaRegistroCobroLegacy = getColumnaRegistroCobroLegacy_(perfil);
  const efectivoValues = hoja.getRange(FILA_INICIO_PEDIDOS, perfil.efectivo, totalRows, 1).getValues();
  const estadoValues = hoja.getRange(FILA_INICIO_PEDIDOS, perfil.estadoPago, totalRows, 1).getValues();
  const registroValues = hoja.getRange(FILA_INICIO_PEDIDOS, columnaRegistroCobro, totalRows, 1).getValues();
  const legacyValues = columnaRegistroCobroLegacy !== columnaRegistroCobro
    ? hoja.getRange(FILA_INICIO_PEDIDOS, columnaRegistroCobroLegacy, totalRows, 1).getValues()
    : [];
  const marcaValues = hoja.getRange(FILA_INICIO_PEDIDOS, perfil.marcaCobrado, totalRows, 1).getValues();

  let touched = false;
  for (let index = 0; index < totalRows; index += 1) {
    const fila = FILA_INICIO_PEDIDOS + index;
    const efectivo = toNumberCobro_(efectivoValues[index] && efectivoValues[index][0]);
    const estadoActual = String((estadoValues[index] && estadoValues[index][0]) || '').trim().toUpperCase();
    const registroActual = String((registroValues[index] && registroValues[index][0]) || '').trim();
    const legacyActual = legacyValues.length
      ? String((legacyValues[index] && legacyValues[index][0]) || '').trim()
      : '';
    const marcaActual = String((marcaValues[index] && marcaValues[index][0]) || '').trim();

    const estaCobrado =
      marcaActual === 'COBRADO' ||
      /COBRADO/i.test(registroActual) ||
      /COBRADO/i.test(legacyActual);

    if (efectivo > 0 && estaCobrado && isEstadoPendienteCobro_(estadoActual)) {
      estadoValues[index][0] = 'PAGADO';
      touched = true;
    }
  }

  if (touched) {
    hoja.getRange(FILA_INICIO_PEDIDOS, perfil.estadoPago, totalRows, 1).setValues(estadoValues);
  }
}

function isEstadoPendienteCobro_(estado) {
  return ['NO PAGADO', 'UNPAID', 'PENDIENTE', 'PENDING', ''].includes(String(estado || '').trim().toUpperCase());
}

function limpiarDatosFilaLuegoDeQuitar_(hoja, fila, perfil) {
  const rangos = getRangosFilaPedidoParaLimpiar_(hoja.getName(), fila, perfil);
  rangos.forEach((a1) => hoja.getRange(a1).clearContent());
}

function getRangosFilaPedidoParaLimpiar_(sheetName, fila, perfil) {
  if (sheetName === 'Venta Mostrador') {
    return [
      `${sheetName}!B${fila}:R${fila}`,
      `${sheetName}!AB${fila}:AD${fila}`
    ];
  }

  if (sheetName === 'Lector Pedidosya') {
    return [
      `${sheetName}!B${fila}:N${fila}`,
      `${sheetName}!AB${fila}:AD${fila}`
    ];
  }

  return [
    `${sheetName}!B${fila}:M${fila}`,
    `${sheetName}!V${fila}:Y${fila}`,
    `${sheetName}!AA${fila}:AD${fila}`
  ];
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
