const HOJAS_VUELTAS_COMPARTIDAS = ['Mauro', 'Brisa', 'Diogo', 'GIAN', 'LIBRE1'];
const FILA_BOTONES_VUELTAS = 4;
const FILA_NOMBRES_VUELTAS = 6;
const FILA_TITULOS_VUELTAS = 7;
const FILA_DATOS_INICIO_VUELTAS = 8;
const FILA_DATOS_FIN_VUELTAS = 98;
const COLUMNA_INICIO_VUELTAS = 15; // O
const COLUMNA_FIN_VUELTAS = 19; // S
const TITULO_BOTON_ELIMINAR_PREFIX = 'DELETE_VUELTA_';
const ANCHO_BOTON_ELIMINAR = 72;
const ALTO_BOTON_ELIMINAR = 24;
const OFFSET_X_BOTON_ELIMINAR = 2;
const OFFSET_Y_BOTON_ELIMINAR = 4;
const URL_BOTON_ELIMINAR = 'https://raw.githubusercontent.com/Big8888/lector-valores-pedido/main/assets/limpiar-button.png';
let BOTON_ELIMINAR_BLOB = null;

function configurarTablaVueltasCompartidas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojaReferencia = ss.getSheetByName('GIAN');
  const nombresRepartidores = HOJAS_VUELTAS_COMPARTIDAS.slice();
  const titulosVueltas = [['VUELTA 1', 'VUELTA 2', 'VUELTA 3', 'VUELTA 4', 'VUELTA 5']];

  HOJAS_VUELTAS_COMPARTIDAS.forEach((nombreHoja) => {
    const hoja = ss.getSheetByName(nombreHoja);
    if (!hoja) return;

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
  });
}

function manejarEdicionTablaVueltasCompartidas_(e) {
  const rango = e.range;
  const hoja = rango.getSheet();
  if (!hoja || !HOJAS_VUELTAS_COMPARTIDAS.includes(hoja.getName())) return;

  const fila = rango.getRow();
  const columna = rango.getColumn();
  const ultimaFila = fila + rango.getNumRows() - 1;
  const ultimaColumna = columna + rango.getNumColumns() - 1;

  const tocaColumnasVueltas =
    columna >= COLUMNA_INICIO_VUELTAS && ultimaColumna <= COLUMNA_FIN_VUELTAS;
  if (!tocaColumnasVueltas) return;

  const esFilaNombres = fila === FILA_NOMBRES_VUELTAS && ultimaFila === FILA_NOMBRES_VUELTAS;
  const esBloqueDatos =
    fila >= FILA_DATOS_INICIO_VUELTAS && ultimaFila <= FILA_DATOS_FIN_VUELTAS;

  if (!esFilaNombres && !esBloqueDatos) return;

  sincronizarRangoVueltasCompartidas_(hoja, rango);
}

function sincronizarRangoVueltasCompartidas_(hojaOrigen, rangoOrigen) {
  const valores = rangoOrigen.getValues();
  const fila = rangoOrigen.getRow();
  const columna = rangoOrigen.getColumn();
  const numFilas = rangoOrigen.getNumRows();
  const numColumnas = rangoOrigen.getNumColumns();
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  HOJAS_VUELTAS_COMPARTIDAS.forEach((nombreHoja) => {
    if (nombreHoja === hojaOrigen.getName()) return;

    const hojaDestino = ss.getSheetByName(nombreHoja);
    if (!hojaDestino) return;

    hojaDestino.getRange(fila, columna, numFilas, numColumnas).setValues(valores);
  });
}

function eliminarVuelta1() {
  eliminarColumnaVueltaCompartida_(1);
}

function eliminarVuelta2() {
  eliminarColumnaVueltaCompartida_(2);
}

function eliminarVuelta3() {
  eliminarColumnaVueltaCompartida_(3);
}

function eliminarVuelta4() {
  eliminarColumnaVueltaCompartida_(4);
}

function eliminarVuelta5() {
  eliminarColumnaVueltaCompartida_(5);
}

function eliminarColumnaVueltaCompartida_(indiceColumna) {
  const offset = Number(indiceColumna) - 1;
  if (offset < 0 || offset > COLUMNA_FIN_VUELTAS - COLUMNA_INICIO_VUELTAS) {
    throw new Error('Indice de vuelta invalido.');
  }

  const columnaObjetivo = COLUMNA_INICIO_VUELTAS + offset;
  const columnaFinal = COLUMNA_FIN_VUELTAS;
  const columnasRestantes = columnaFinal - columnaObjetivo;
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  HOJAS_VUELTAS_COMPARTIDAS.forEach((nombreHoja) => {
    const hoja = ss.getSheetByName(nombreHoja);
    if (!hoja) return;

    if (columnasRestantes > 0) {
      const nombres = hoja
        .getRange(FILA_NOMBRES_VUELTAS, columnaObjetivo + 1, 1, columnasRestantes)
        .getValues();
      hoja.getRange(FILA_NOMBRES_VUELTAS, columnaObjetivo, 1, columnasRestantes).setValues(nombres);
    }

    hoja.getRange(FILA_NOMBRES_VUELTAS, columnaFinal, 1, 1).clearContent();

    if (columnasRestantes > 0) {
      const datos = hoja
        .getRange(
          FILA_DATOS_INICIO_VUELTAS,
          columnaObjetivo + 1,
          FILA_DATOS_FIN_VUELTAS - FILA_DATOS_INICIO_VUELTAS + 1,
          columnasRestantes
        )
        .getValues();
      hoja
        .getRange(
          FILA_DATOS_INICIO_VUELTAS,
          columnaObjetivo,
          FILA_DATOS_FIN_VUELTAS - FILA_DATOS_INICIO_VUELTAS + 1,
          columnasRestantes
        )
        .setValues(datos);
    }

    hoja
      .getRange(
        FILA_DATOS_INICIO_VUELTAS,
        columnaFinal,
        FILA_DATOS_FIN_VUELTAS - FILA_DATOS_INICIO_VUELTAS + 1,
        1
      )
      .clearContent();
  });
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

function getBotonEliminarBlob_() {
  if (!BOTON_ELIMINAR_BLOB) {
    BOTON_ELIMINAR_BLOB = UrlFetchApp.fetch(URL_BOTON_ELIMINAR).getBlob().setName('limpiar-button.png');
  }

  return BOTON_ELIMINAR_BLOB.copyBlob();
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
