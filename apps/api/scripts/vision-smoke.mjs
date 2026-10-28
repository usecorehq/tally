// Live smoke test of the shelf-scan pipeline: Muse Spark reads each photo,
// Qore Catalog matches the products. Uses the built api code, no database.
// Not part of the build or CI; it spends Meta Model API credit.
//   pnpm --filter @tally/api build
//   node --env-file=apps/api/.env apps/api/scripts/vision-smoke.mjs photo1.jpg photo2.jpg …
// Needs META_MODEL_API_KEY, QORE_CATALOG_BASE_URL, QORE_CATALOG_API_KEY. Never prints a key.
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { MetaModelClient } = require("../dist/modules/vision/meta-model.client.js");
const { shelfRequest, parseShelfProducts, sniffImageType } = require("../dist/modules/vision/shelf-reader.js");
const { matchItems, buildDetections, MATCH_LIMIT } = require("../dist/modules/vision/shelf-scan.js");
const { CatalogClient } = require("@tally/catalog-client");

const { META_MODEL_API_KEY, META_MODEL_BASE_URL = "https://api.meta.ai/v1", QORE_CATALOG_BASE_URL, QORE_CATALOG_API_KEY } = process.env;
const files = process.argv.slice(2);
if (!META_MODEL_API_KEY || !QORE_CATALOG_BASE_URL || !QORE_CATALOG_API_KEY || files.length === 0) {
  console.error("Usage: node --env-file=apps/api/.env apps/api/scripts/vision-smoke.mjs <photo>…");
  console.error("Needs META_MODEL_API_KEY, QORE_CATALOG_BASE_URL and QORE_CATALOG_API_KEY.");
  process.exit(1);
}

const meta = new MetaModelClient(META_MODEL_BASE_URL, META_MODEL_API_KEY);
const catalog = new CatalogClient(QORE_CATALOG_BASE_URL, QORE_CATALOG_API_KEY);
console.log(`model api: ${META_MODEL_BASE_URL}   catalog: ${QORE_CATALOG_BASE_URL}\n`);

let failed = 0;
for (const file of files) {
  const image = readFileSync(file);
  const type = sniffImageType(image);
  if (!type) {
    console.log(`${basename(file)}: not a JPEG/PNG/WebP, skipped`);
    continue;
  }
  try {
    const t0 = Date.now();
    const res = await meta.respond(shelfRequest(image, type), 90_000);
    const products = parseShelfProducts(res.text);
    const readMs = Date.now() - t0;
    const matches = products.length ? (await catalog.match({ items: matchItems(products), limit: MATCH_LIMIT })).items : [];
    const matchMs = Date.now() - t0 - readMs;
    const detections = buildDetections(products, matches, new Map());

    const units = detections.reduce((n, d) => n + d.count, 0);
    console.log(
      `${basename(file)} (${Math.round(image.length / 1024)} KB): ${detections.length} products, ${units} units — ` +
        `read ${readMs} ms, match ${matchMs} ms, status ${res.status}, tokens in ${res.usage?.input_tokens ?? "?"} / out ${res.usage?.output_tokens ?? "?"}`,
    );
    for (const d of detections) {
      const top = d.candidates[0];
      const read = [d.brand, d.name, d.pack].filter(Boolean).join(" · ");
      const match = top ? `${top.qid} ${top.name} (${top.score.toFixed(2)}) ₦${top.price?.median ?? "-"}` : "no catalogue match";
      console.log(`  ×${String(d.count).padEnd(3)} [${d.confidence.padEnd(6)}] ${read.padEnd(48)} → ${match}`);
    }
    console.log();
  } catch (err) {
    failed++;
    console.log(`${basename(file)}: FAILED ${err.name} ${err.status ?? ""} ${err.code ?? ""} ${err.message}\n`);
  }
}
process.exit(failed ? 1 : 0);
