const path = require('path');

const baseDir = process.env.PEDIDOSYA_PDF_BASE_DIR || 'C:\\Users\\marti\\Desktop\\LECTOR DE VALORES PEDIDO\\PedidosYa lector de pdf';

module.exports = {
  baseDir,
  inboxDir: process.env.PEDIDOSYA_PDF_INBOX_DIR || path.join(baseDir, 'inbox_pdf'),
  processedDir: process.env.PEDIDOSYA_PDF_PROCESSED_DIR || path.join(baseDir, 'processed_pdf'),
  errorDir: process.env.PEDIDOSYA_PDF_ERROR_DIR || path.join(baseDir, 'error_pdf')
};
