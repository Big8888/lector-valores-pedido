function ocultarColumnasAuxiliares() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojasPermitidas = ['Mauro', 'Brisa', 'Diogo', 'GIAN', 'LIBRE1', 'Venta Mostrador', 'Lector Pedidosya'];

  hojasPermitidas.forEach((nombreHoja) => {
    const hoja = ss.getSheetByName(nombreHoja);
    if (!hoja) return;

    hoja.hideColumns(28, 3); // AB y AC para respaldos internos, AD para tracking tecnico
  });
}

const HOJAS_COBRO_PROTEGIDAS = ['Mauro', 'Brisa', 'Diogo', 'GIAN', 'LIBRE1', 'Venta Mostrador', 'Lector Pedidosya'];
const RANGO_TICKS_COBRO_A1 = 'A8:A';
const CONFIGURACION_PROTECCIONES_COBRO = {
  Mauro: [
    'A8:A',
    'G2',
    'K4:L4',
    'M2',
    'J8:J187',
    'M8:M76',
    'O6:S6',
    'O8:S98',
    'AA:AC'
  ],
  Brisa: [
    'A8:A',
    'G2',
    'K4:L4',
    'M2',
    'J8:J187',
    'M8:M76',
    'O6:S6',
    'O8:S98',
    'AA:AC'
  ],
  Diogo: [
    'A8:A',
    'G2',
    'K4:L4',
    'M2',
    'J8:J187',
    'M8:M76',
    'O6:S6',
    'O8:S98',
    'AA:AC'
  ],
  GIAN: [
    'A8:A',
    'G2',
    'K4:L4',
    'M2',
    'J8:J187',
    'M8:M76',
    'O6:S6',
    'O8:S98',
    'AA:AC'
  ],
  LIBRE1: [
    'A8:A',
    'G2',
    'K4:L4',
    'M2',
    'J8:J187',
    'M8:M76',
    'O6:S6',
    'O8:S98',
    'AA:AC'
  ],
  'Venta Mostrador': [
    'A8:A',
    'K8:K',
    'AB:AC'
  ],
  'Lector Pedidosya': [
    'A8:A',
    'H8:H',
    'AB:AC'
  ]
};

function sincronizarNumeroPedidoVisibleEnVentaMostrador() {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Venta Mostrador');
  if (!hoja) return;

  const ultimaFila = hoja.getLastRow();
  if (ultimaFila < 8) return;

  const cantidadFilas = ultimaFila - 7;
  const valoresNumeroPedido = hoja.getRange(8, 2, cantidadFilas, 1).getValues();
  hoja.getRange(8, 14, cantidadFilas, 1).setValues(valoresNumeroPedido);
}

function sincronizarSalidaDineroAZEnHojasRepartidores() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojasRepartidores = ['Mauro', 'Brisa', 'Diogo', 'GIAN', 'LIBRE1'];

  hojasRepartidores.forEach((nombreHoja) => {
    const hoja = ss.getSheetByName(nombreHoja);
    if (!hoja) return;

    const ultimaFila = hoja.getLastRow();
    if (ultimaFila < 8) return;

    const cantidadFilas = ultimaFila - 7;
    const valoresSalidaDinero = hoja.getRange(8, 10, cantidadFilas, 1).getValues();
    hoja.getRange(8, 26, cantidadFilas, 1).setValues(valoresSalidaDinero);
  });
}

function sincronizarMarcaCobroEnHojas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configuracion = {
    Mauro: { principal: 27, legacy: 13 },
    Brisa: { principal: 27, legacy: 13 },
    Diogo: { principal: 27, legacy: 13 },
    GIAN: { principal: 27, legacy: 13 },
    LIBRE1: { principal: 27, legacy: 13 },
    'Venta Mostrador': { principal: 18, legacy: 11 },
    'Lector Pedidosya': { principal: 8, legacy: 8 }
  };

  const resultado = [];

  Object.keys(configuracion).forEach((nombreHoja) => {
    const hoja = ss.getSheetByName(nombreHoja);
    if (!hoja) {
      resultado.push({ hoja: nombreHoja, ok: false, motivo: 'Hoja no encontrada' });
      return;
    }

    const ultimaFila = hoja.getLastRow();
    if (ultimaFila < 8) {
      resultado.push({ hoja: nombreHoja, ok: true, actualizadas: 0 });
      return;
    }

    const cantidadFilas = ultimaFila - 7;
    const configHoja = configuracion[nombreHoja];
    const anotacionesPrincipal = hoja.getRange(8, configHoja.principal, cantidadFilas, 1).getDisplayValues();
    const anotacionesLegacy = configHoja.legacy !== configHoja.principal
      ? hoja.getRange(8, configHoja.legacy, cantidadFilas, 1).getDisplayValues()
      : [];
    const marcas = anotacionesPrincipal.map((fila, index) => {
      const principal = String(fila[0] || '').trim();
      const legacy = anotacionesLegacy.length ? String((anotacionesLegacy[index] && anotacionesLegacy[index][0]) || '').trim() : '';
      return [(/COBRADO/i.test(principal) || /COBRADO/i.test(legacy)) ? 'COBRADO' : ''];
    });

    hoja.getRange(8, 29, cantidadFilas, 1).setValues(marcas);
    resultado.push({
      hoja: nombreHoja,
      ok: true,
      actualizadas: marcas.filter((fila) => fila[0] === 'COBRADO').length
    });
  });

  return {
    ok: true,
    resultado
  };
}

function inspeccionarProteccionesTicksCobro() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const resultado = [];

  HOJAS_COBRO_PROTEGIDAS.forEach((nombreHoja) => {
    const hoja = ss.getSheetByName(nombreHoja);
    if (!hoja) {
      resultado.push({ hoja: nombreHoja, ok: false, motivo: 'Hoja no encontrada' });
      return;
    }

    const rangoTick = hoja.getRange(RANGO_TICKS_COBRO_A1);
    const proteccionesHoja = hoja.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    const proteccionesRango = hoja.getProtections(SpreadsheetApp.ProtectionType.RANGE);

    resultado.push({
      hoja: nombreHoja,
      ok: true,
      sheetProtections: proteccionesHoja.length,
      sheetProtectionsConTickLibre: proteccionesHoja.filter((protection) => {
        return (protection.getUnprotectedRanges() || []).some((rango) => rangesIntersect_(rango, rangoTick));
      }).length,
      rangeProtectionsQueCruzanTick: proteccionesRango
        .filter((protection) => rangesIntersect_(protection.getRange(), rangoTick))
        .map((protection) => ({
          description: protection.getDescription() || '',
          warningOnly: protection.isWarningOnly(),
          a1: protection.getRange().getA1Notation()
        }))
    });
  });

  return {
    ok: true,
    rangoTick: RANGO_TICKS_COBRO_A1,
    resultado
  };
}

function habilitarTicksCobroEnHojasProtegidas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const resultado = [];

  HOJAS_COBRO_PROTEGIDAS.forEach((nombreHoja) => {
    const hoja = ss.getSheetByName(nombreHoja);
    if (!hoja) {
      resultado.push({ hoja: nombreHoja, ok: false, motivo: 'Hoja no encontrada' });
      return;
    }

    const rangoTick = hoja.getRange(RANGO_TICKS_COBRO_A1);
    const proteccionesHoja = hoja.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    const proteccionesRango = hoja.getProtections(SpreadsheetApp.ProtectionType.RANGE);
    let actualizadas = 0;

    proteccionesHoja.forEach((protection) => {
      const actuales = protection.getUnprotectedRanges() || [];
      const yaIncluido = actuales.some((rango) => rangesIntersect_(rango, rangoTick));
      if (yaIncluido) return;

      protection.setUnprotectedRanges([...actuales, rangoTick]);
      actualizadas += 1;
    });

    resultado.push({
      hoja: nombreHoja,
      ok: true,
      proteccionesHoja: proteccionesHoja.length,
      proteccionesHojaActualizadas: actualizadas,
      rangeProtectionsQueSiguenBloqueando: proteccionesRango
        .filter((protection) => !protection.isWarningOnly() && rangesIntersect_(protection.getRange(), rangoTick))
        .map((protection) => ({
          description: protection.getDescription() || '',
          a1: protection.getRange().getA1Notation()
        }))
    });
  });

  return {
    ok: true,
    rangoTick: RANGO_TICKS_COBRO_A1,
    resultado
  };
}

function aplicarProteccionEnHojasRepartidores() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const resultado = [];

  Object.keys(CONFIGURACION_PROTECCIONES_COBRO).forEach((nombreHoja) => {
    const hoja = ss.getSheetByName(nombreHoja);
    if (!hoja) {
      resultado.push({ hoja: nombreHoja, ok: false, motivo: 'Hoja no encontrada' });
      return;
    }

    const protecciones = hoja.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    const protection = protecciones[0] || hoja.protect();
    const rangosEditablesA1 = CONFIGURACION_PROTECCIONES_COBRO[nombreHoja];
    const rangosEditables = rangosEditablesA1.map((a1) => hoja.getRange(a1));

    protection.setUnprotectedRanges(rangosEditables);

    resultado.push({
      hoja: nombreHoja,
      ok: true,
      proteccionesHoja: protecciones.length || 1,
      rangosEditables: rangosEditablesA1
    });
  });

  return {
    ok: true,
    resultado
  };
}

function rangesIntersect_(left, right) {
  if (!left || !right) return false;
  if (left.getSheet().getSheetId() !== right.getSheet().getSheetId()) return false;

  const leftRowStart = left.getRow();
  const leftRowEnd = leftRowStart + left.getNumRows() - 1;
  const rightRowStart = right.getRow();
  const rightRowEnd = rightRowStart + right.getNumRows() - 1;
  const leftColumnStart = left.getColumn();
  const leftColumnEnd = leftColumnStart + left.getNumColumns() - 1;
  const rightColumnStart = right.getColumn();
  const rightColumnEnd = rightColumnStart + right.getNumColumns() - 1;

  const rowsOverlap = leftRowStart <= rightRowEnd && rightRowStart <= leftRowEnd;
  const columnsOverlap = leftColumnStart <= rightColumnEnd && rightColumnStart <= leftColumnEnd;

  return rowsOverlap && columnsOverlap;
}
