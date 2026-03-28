const { importPedidosYaPdfs } = require('../src/pedidosya-pdf/services/pedidosYaPdfImporter');

function parseArgs(argv) {
  const args = {
    dryRun: false,
    limit: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--dry-run') {
      args.dryRun = true;
      continue;
    }

    if (arg === '--limit') {
      const value = argv[index + 1];
      if (value !== undefined) {
        args.limit = Number(value);
        index += 1;
      }
    }
  }

  return args;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = await importPedidosYaPdfs(options);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error('[PEDIDOSYA PDF] Error fatal:', error);
  process.exit(1);
});
