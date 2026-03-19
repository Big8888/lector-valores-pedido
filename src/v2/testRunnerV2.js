const fs = require("fs");
const path = require("path");
const { interpretOlaClickPayload } = require("./services/olaclickInterpreterV2");

const samplePath = path.join(__dirname, "..", "..", "samples", "order_created_v2.json");

function run() {
  const raw = fs.readFileSync(samplePath, "utf8");
  const payload = JSON.parse(raw);

  const result = interpretOlaClickPayload(payload);

  console.log("===== PEDIDO =====");
  console.log(JSON.stringify(result.pedidoRow, null, 2));

  console.log("");
  console.log("===== DETALLE =====");
  console.log(JSON.stringify(result.detailRows, null, 2));
}

run();
