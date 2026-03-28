const pdfConfig = require('../src/pedidosya-pdf/config/pedidosYaPdfConfig');
const { importPedidosYaPdfs } = require('../src/pedidosya-pdf/services/pedidosYaPdfImporter');

const intervalMs = Math.max(Number(process.env.PEDIDOSYA_PDF_WATCH_INTERVAL_MS) || 5000, 2000);
let isRunning = false;

async function runCycle() {
  if (isRunning) {
    return;
  }

  isRunning = true;

  try {
    const result = await importPedidosYaPdfs({ limit: 1 });
    const processed = result.results || [];

    processed.forEach((item) => {
      if (item.ok) {
        console.log(
          `[PEDIDOSYA PDF WATCH] OK ${item.fileName} -> fila ${item.rowNumber} pedido ${item.numeroPedidoInterno} total ${item.total}`
        );
      } else {
        console.error(
          `[PEDIDOSYA PDF WATCH] ERROR ${item.fileName}: ${item.error}`
        );
      }
    });
  } catch (error) {
    console.error('[PEDIDOSYA PDF WATCH] Error fatal en ciclo:', error);
  } finally {
    isRunning = false;
  }
}

async function main() {
  console.log('[PEDIDOSYA PDF WATCH] Escuchando carpeta:', pdfConfig.inboxDir);
  console.log('[PEDIDOSYA PDF WATCH] Intervalo ms:', intervalMs);

  await runCycle();
  setInterval(runCycle, intervalMs);
}

main().catch((error) => {
  console.error('[PEDIDOSYA PDF WATCH] Error fatal al iniciar:', error);
  process.exit(1);
});
