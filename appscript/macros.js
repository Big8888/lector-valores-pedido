function BORRARDATOSPLANILLAS() { 
  var spreadsheet = SpreadsheetApp.getActive();
  
  // Borrar celdas en las hojas existentes
  spreadsheet.getRange('G18').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true}); 
  spreadsheet.getRange('B18').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true}); 
  spreadsheet.getRange('B11:E15').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true}); 
  spreadsheet.getRange('G9').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true}); 
  spreadsheet.getRange('G6').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});

  // Hoja 'Venta Mostrador'
  spreadsheet.setActiveSheet(spreadsheet.getSheetByName('Venta Mostrador'), true); 
  spreadsheet.getRange('A3:H53').activate(); 
  spreadsheet.setCurrentCell(spreadsheet.getRange('H53')); 
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true}); 
  spreadsheet.getRange('M8:M22').activate(); 
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true}); 
  spreadsheet.getRange('M8:M58').activate(); 
  spreadsheet.setCurrentCell(spreadsheet.getRange('M58')); 
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true}); 
  spreadsheet.getRange('H3:H55').activate(); 
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});

  // Hoja 'Pedidos YA' (modificación: borrar A3:D80)
  spreadsheet.setActiveSheet(spreadsheet.getSheetByName('Pedidos YA'), true); 
  spreadsheet.getRange('A3:D80').activate();  // Cambio solicitado
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});

  // Hoja '4to'
  spreadsheet.setActiveSheet(spreadsheet.getSheetByName('4to'), true); 
  spreadsheet.getRange('A5').activate(); 
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true}); 
  spreadsheet.getRange('K2').activate(); 
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true}); 
  spreadsheet.getRange('O4').activate(); 
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true}); 
  spreadsheet.getRange('Q4').activate(); 
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true}); 
  spreadsheet.getRange('Q2').activate(); 
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true}); 
  spreadsheet.getRange('A8:K88').activate(); 
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true}); 
  spreadsheet.getRange('P8:P88').activate(); 
  spreadsheet.setCurrentCell(spreadsheet.getRange('P88')); 
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});

  // Hoja 'Joaquin'
  spreadsheet.setActiveSheet(spreadsheet.getSheetByName('Joaquin'), true); 
  spreadsheet.getRange('A5').activate(); 
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true}); 
  spreadsheet.getRange('K2').activate(); 
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true}); 
  spreadsheet.getRange('O4').activate(); 
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true}); 
  spreadsheet.getRange('Q4').activate(); 
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true}); 
  spreadsheet.getRange('Q2').activate(); 
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true}); 
  spreadsheet.getRange('A8:K88').activate(); 
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true}); 
  spreadsheet.getRange('P8:P88').activate(); 
  spreadsheet.setCurrentCell(spreadsheet.getRange('P88')); 
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});

  // Hoja 'Gonzalo'
  spreadsheet.setActiveSheet(spreadsheet.getSheetByName('Gonzalo'), true); 
  spreadsheet.getRange('A5').activate(); 
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true}); 
  spreadsheet.getRange('K2').activate(); 
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true}); 
  spreadsheet.getRange('O4').activate(); 
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true}); 
  spreadsheet.getRange('Q2').activate(); 
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true}); 
  spreadsheet.getRange('Q4').activate(); 
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true}); 
  spreadsheet.getRange('A8:K88').activate(); 
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true}); 
  spreadsheet.getRange('P8:P88').activate(); 
  spreadsheet.setCurrentCell(spreadsheet.getRange('P88')); 
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});

  // Hoja 'Dario'
  spreadsheet.setActiveSheet(spreadsheet.getSheetByName('Dario'), true); 
  spreadsheet.getRange('A5').activate(); 
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true}); 
  spreadsheet.getRange('K2').activate(); 
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true}); 
  spreadsheet.getRange('O4').activate(); 
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true}); 
  spreadsheet.getRange('Q2').activate(); 
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true}); 
  spreadsheet.getRange('A8:K44').activate(); 
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true}); 
  spreadsheet.getRange('P8:P88').activate(); 
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true}); 
  spreadsheet.getRange('A5').activate(); 
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true}); 
  spreadsheet.getRange('K2').activate(); 
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true}); 
  spreadsheet.getRange('O4').activate(); 
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true}); 
  spreadsheet.getRange('Q2').activate(); 
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true}); 
  spreadsheet.getRange('Q4').activate(); 
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true}); 
};


function BORRARPRUEBA() {
  var spreadsheet = SpreadsheetApp.getActive();
  spreadsheet.getRange('A5').activate();
  spreadsheet.setActiveSheet(spreadsheet.getSheetByName('Cierre de caja'), true);
  spreadsheet.getRange('B18').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.getRange('G18').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.getRange('B11:E15').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.getRange('G9').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.getRange('G6').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.setActiveSheet(spreadsheet.getSheetByName('Venta Mostrador'), true);
  spreadsheet.getRange('A3:H44').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.getRange('M8:M58').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.setActiveSheet(spreadsheet.getSheetByName('Pedidos YA'), true);
  spreadsheet.getRange('A3:C50').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.setActiveSheet(spreadsheet.getSheetByName('4to'), true);
  spreadsheet.getRange('A8:K88').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.getRange('P8:P88').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.getRange('A5').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.getRange('K2').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.getRange('O4').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.getRange('Q4').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.getRange('Q2').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
};





function BorrarCeldas() {
  var spreadsheet = SpreadsheetApp.getActive();
  spreadsheet.getRange('G18').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.getRange('B11:E14').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.getRange('B15:E15').activate();
  spreadsheet.setCurrentCell(spreadsheet.getRange('E15'));
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.getRange('B18').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.getRange('G9').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.getRange('G6').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.setActiveSheet(spreadsheet.getSheetByName('Venta Mostrador'), true);
  spreadsheet.getRange('A3:H50').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.getRange('M8:M58').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true})
  .clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.setActiveSheet(spreadsheet.getSheetByName('Pedidos YA'), true);
  spreadsheet.getRange('A3:C60').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.getRange('D3:D60').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.setActiveSheet(spreadsheet.getSheetByName('4to'), true);
  spreadsheet.getRange('A5').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.getRange('K2').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.getRange('O4').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.getRange('Q2').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.getRange('Q4').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.getRange('A8:K88').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.getRange('P8:P88').activate();
  spreadsheet.setCurrentCell(spreadsheet.getRange('P88'));
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.setActiveSheet(spreadsheet.getSheetByName('Joaquin'), true);
  spreadsheet.getRange('A5').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.getRange('K2').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.getRange('O4').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.getRange('Q2').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.getRange('Q4').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.getRange('A8:K88').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.getRange('P8:P88').activate();
  spreadsheet.setCurrentCell(spreadsheet.getRange('P88'));
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.setActiveSheet(spreadsheet.getSheetByName('Gonzalo'), true);
  spreadsheet.getRange('A5').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.getRange('K2').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.getRange('O4').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.getRange('Q2').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.getRange('Q4').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.getRange('P8:P88').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.getRange('A8:K88').activate();
  spreadsheet.setCurrentCell(spreadsheet.getRange('A88'));
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.setActiveSheet(spreadsheet.getSheetByName('Dario'), true);
  spreadsheet.getRange('A5').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.getRange('K2').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.getRange('O4').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.getRange('Q4').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.getRange('Q2').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.getRange('A8:K88').activate();
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
  spreadsheet.getRange('P8:P88').activate();
  spreadsheet.setCurrentCell(spreadsheet.getRange('P88'));
  spreadsheet.getActiveRangeList().clear({contentsOnly: true, skipFilteredRows: true});
};