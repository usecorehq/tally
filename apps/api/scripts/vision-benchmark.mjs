// Benchmarks the quick scan against the stock-take agent on shelf photos with hand-counted ground truth.
// No database; spends Meta Model API credit. Usage: apps/api/README.md#vision-benchmark.
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { MetaModelClient } = require("../dist/modules/vision/meta-model.client.js");
const { shelfRequest, parseShelfProducts, sniffImageType } = require("../dist/modules/vision/shelf-reader.js");
const { matchItems, buildDetections, plausible, MATCH_LIMIT } = require("../dist/modules/vision/shelf-scan.js");
const { samRequest, parseSamInstances, distinctLooks, assignInstances } = require("../dist/modules/vision/sam-counter.js");
const { indexInventory } = require("../dist/modules/vision/inventory-match.js");
const { makeCrops } = require("../dist/modules/vision/crops.js");
const { runStocktakeAgent } = require("../dist/modules/vision/stocktake/stocktake-agent.js");
const { StocktakeSession } = require("../dist/modules/vision/stocktake/stocktake-session.js");
const { scorePhoto, totals, cost, COUNT_TOLERANCE } = require("../dist/modules/vision/benchmark-score.js");
const { CatalogClient } = require("@tally/catalog-client");

// The service's SAM timeout; the shelf read gets the smoke script's 90 s so a slow read is timed, not lost.
const SHELF_TIMEOUT_MS = 90_000;
const SAM_TIMEOUT_MS = 20_000;
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: { out: { type: "string" }, template: { type: "string" }, force: { type: "boolean", default: false } },
});
const { META_MODEL_API_KEY, META_MODEL_BASE_URL = "https://api.meta.ai/v1", QORE_CATALOG_BASE_URL, QORE_CATALOG_API_KEY } = process.env;
if (!META_MODEL_API_KEY || !QORE_CATALOG_BASE_URL || !QORE_CATALOG_API_KEY || (!opts.template && positionals.length === 0)) {
  console.error("Usage: node --env-file=apps/api/.env apps/api/scripts/vision-benchmark.mjs <folder or photos>… [--out results.json]");
  console.error("       node --env-file=apps/api/.env apps/api/scripts/vision-benchmark.mjs --template <photo> [--force]");
  console.error("Needs META_MODEL_API_KEY, QORE_CATALOG_BASE_URL and QORE_CATALOG_API_KEY.");
  process.exit(1);
}

const outPath = resolve(opts.out ?? join(tmpdir(), `tally-vision-benchmark-${new Date().toISOString().replace(/[:.]/g, "-")}.json`));
if (outPath === REPO_ROOT || outPath.startsWith(REPO_ROOT + sep)) {
  console.error(`--out must be outside the repo (results hold merchant shelf data): ${outPath}`);
  process.exit(1);
}

const meta = new MetaModelClient(META_MODEL_BASE_URL, META_MODEL_API_KEY);
const catalog = new CatalogClient(QORE_CATALOG_BASE_URL, QORE_CATALOG_API_KEY);
const noInventory = indexInventory([], []);

/** VisionService.analyse without the database: read, then SAM counts and catalogue match in parallel. */
async function firstPass(image, type) {
  const t0 = Date.now();
  const res = await meta.respond(shelfRequest(image, type), SHELF_TIMEOUT_MS);
  const products = parseShelfProducts(res.text);
  const readMs = Date.now() - t0;

  const byLook = new Map();
  const looks = distinctLooks(products);
  const [, match] = await Promise.all([
    Promise.all(
      looks.map(async (look) => {
        try {
          byLook.set(look, parseSamInstances((await meta.respond(samRequest(image, type, look), SAM_TIMEOUT_MS)).text));
        } catch (err) {
          console.error(`  SAM skipped for one look (${err.status ?? "?"} ${err.code ?? ""})`);
        }
      }),
    ),
    products.length
      ? catalog
          .match({ items: matchItems(products), limit: MATCH_LIMIT })
          .then((r) => ({ matches: r.items, available: true }))
          .catch((err) => (console.error(`  catalogue match failed (${err.status ?? err.name})`), { matches: [], available: false }))
      : { matches: [], available: true },
  ]);
  return {
    products,
    matches: match.matches,
    catalogueAvailable: match.available,
    samBoxes: assignInstances(products, byLook),
    // Every look is one SAM request on the whole photo, failed or not.
    usage: { input: res.usage?.input_tokens ?? 0, output: res.usage?.output_tokens ?? 0, samImages: looks.length },
    ms: Date.now() - t0,
  };
}

/** VisionService.runStocktake's agent, with the same deps, from the given first pass. */
async function agent(image, type, a) {
  let samImages = 0;
  const steps = [];
  const session = new StocktakeSession(a.products, a.matches, a.samBoxes, noInventory, {
    searchCatalogue: async (reading) => {
      const res = await catalog.match({ items: [{ ref: "0", ...(reading.brand && { brand: reading.brand }), name: reading.name, ...(reading.pack && { pack: reading.pack }) }], limit: MATCH_LIMIT });
      return (res.items[0]?.candidates ?? []).filter((c) => plausible(reading, c));
    },
    countUnits: async (look, line) => {
      samImages++;
      const res = await meta.respond(samRequest(image, type, look), SAM_TIMEOUT_MS);
      const products = session.lines.map((l, i) => (i === line ? { ...l.product, look } : l.product));
      return assignInstances(products, new Map([[look, parseSamInstances(res.text)]])).get(line) ?? [];
    },
    zoom: async (box) => {
      const [crop] = await makeCrops(image, [box], { minSide: 48, enlarge: true });
      return crop ? `data:image/webp;base64,${crop.toString("base64")}` : null;
    },
  });

  const t0 = Date.now();
  try {
    const outcome = await runStocktakeAgent({
      client: meta,
      session,
      photo: `data:${type};base64,${image.toString("base64")}`,
      onStep: async (s) => void steps.push(s),
    });
    return { detections: session.detections(), end: outcome.end, turns: outcome.turns, usage: { ...outcome.usage, samImages }, ms: Date.now() - t0, steps, error: null };
  } catch (err) {
    // The service falls back to the quick scan; score that, and say so.
    const detections = buildDetections(a.products, a.matches, noInventory, a.samBoxes);
    return { detections, end: "fallback", turns: 0, usage: { input: 0, output: 0, samImages }, ms: Date.now() - t0, steps, error: `${err.name} ${err.status ?? ""} ${err.message}` };
  }
}

const scored = (detections) => detections.map((d) => ({ brand: d.brand, name: d.name, pack: d.pack, count: d.count, qid: d.candidates[0]?.qid ?? null }));

function readImage(file) {
  const image = readFileSync(file);
  const type = sniffImageType(image);
  if (!type) throw new Error(`${basename(file)} is not a JPEG/PNG/WebP`);
  return { image, type };
}

const stem = (file) => join(dirname(file), basename(file, extname(file)));

// ── --template: a starter truth file from the quick scan, for a person to correct ──

if (opts.template) {
  const file = opts.template;
  const target = `${stem(file)}.truth.json`;
  if (existsSync(target) && !opts.force) {
    console.error(`${target} exists; pass --force to overwrite it.`);
    process.exit(1);
  }
  const { image, type } = readImage(file);
  const a = await firstPass(image, type);
  const detections = buildDetections(a.products, a.matches, noInventory, a.samBoxes);
  const truth = {
    note: "Starter from the quick scan. Correct brand/name/pack as printed, count every unit by hand, set qid to the right Qore ID (null if the catalogue lacks it), add missed products, delete false ones, then remove this note.",
    products: detections.map((d) => ({ brand: d.brand, name: d.name, pack: d.pack, count: d.count, qid: d.candidates[0]?.qid ?? null })),
  };
  writeFileSync(target, `${JSON.stringify(truth, null, 2)}\n`);
  console.log(`Wrote ${target}: ${truth.products.length} products from the quick scan (${a.ms} ms). Correct it before benchmarking.`);
  process.exit(0);
}

// ── Benchmark ──

const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;
const missing = positionals.filter((p) => !existsSync(p));
if (missing.length) {
  console.error(`Not found: ${missing.join(", ")}`);
  process.exit(1);
}
const photos = positionals.flatMap((p) =>
  statSync(p).isDirectory()
    ? readdirSync(p)
        .filter((f) => IMAGE_EXT.test(f))
        .sort()
        .map((f) => join(p, f))
    : [p],
);

function loadTruth(photo) {
  const path = [`${stem(photo)}.truth.json`, `${photo}.truth.json`].find(existsSync);
  if (!path) return null;
  const raw = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(raw?.products)) throw new Error(`${path}: no products array`);
  return raw.products.map((p, i) => {
    if (typeof p?.name !== "string" || !p.name.trim() || !Number.isFinite(p.count) || p.count < 0) {
      throw new Error(`${path}: product ${i} needs a name and a count >= 0`);
    }
    return { brand: p.brand ?? "", name: p.name, pack: p.pack ?? "", count: p.count, qid: p.qid || null };
  });
}

console.error(`model api: ${META_MODEL_BASE_URL}   catalog: ${QORE_CATALOG_BASE_URL}`);
const results = [];
for (const photo of photos) {
  const name = basename(photo);
  let truth;
  try {
    truth = loadTruth(photo);
  } catch (err) {
    console.error(`${name}: ${err.message}; skipped`);
    continue;
  }
  if (!truth) {
    console.error(`${name}: no truth file (make one with --template); skipped`);
    continue;
  }
  try {
    const { image, type } = readImage(photo);
    console.error(`${name}: quick scan…`);
    const a = await firstPass(image, type);
    const quickDetections = buildDetections(a.products, a.matches, noInventory, a.samBoxes);
    console.error(`${name}: ${a.products.length} products in ${a.ms} ms; agent…`);
    const g = await agent(image, type, a);
    console.error(`${name}: agent ${g.end} after ${g.turns} turns, ${g.ms} ms${g.error ? ` (${g.error})` : ""}`);

    const quick = { detections: scored(quickDetections), usage: a.usage, ms: a.ms };
    // The agent's time and cost include the first pass it starts from.
    const agentRun = {
      detections: scored(g.detections),
      usage: { input: a.usage.input + g.usage.input, output: a.usage.output + g.usage.output, samImages: a.usage.samImages + g.usage.samImages },
      ms: a.ms + g.ms,
      end: g.end,
      turns: g.turns,
      error: g.error,
      steps: g.steps,
    };
    for (const run of [quick, agentRun]) {
      run.score = scorePhoto(truth, run.detections);
      run.cost = cost(run.usage);
    }
    results.push({ photo: name, truth, catalogueAvailable: a.catalogueAvailable, quick, agent: agentRun });
  } catch (err) {
    console.error(`${name}: FAILED ${err.name} ${err.status ?? ""} ${err.code ?? ""} ${err.message}`);
    results.push({ photo: name, error: `${err.name} ${err.message}` });
  }
}

// ── Report ──

const done = results.filter((r) => !r.error);
const pct = (a, b) => (b ? `${a}/${b} (${Math.round((100 * a) / b)}%)` : "–");
const ratio = (x) => (x === null ? "–" : `${Math.round(100 * x)}%`);
const sec = (ms) => `${(ms / 1000).toFixed(1)} s`;
const usd = (x) => `$${x.toFixed(4)}`;
const row = (cells) => `| ${cells.join(" | ")} |`;
const HEAD = ["Recall", "Precision", "Brand ok", "Name ok", "Qore ID right / wrong / missing", "Count MAE", `Count ±${COUNT_TOLERANCE * 100}%`, "Time", "Tokens in / out", "SAM images", "Est. $"];

function cells(t, run) {
  return [
    `${ratio(t.recall)} (${t.matched}/${t.truthProducts})`,
    `${ratio(t.precision)} (${t.matched}/${t.detections})`,
    pct(t.brandOk, t.matched),
    pct(t.nameOk, t.matched),
    `${t.qid.right} / ${t.qid.wrong} / ${t.qid.missing}`,
    t.countMae === null ? "–" : t.countMae.toFixed(1),
    pct(t.countWithin, t.matched),
    sec(run.ms),
    `${run.usage.input.toLocaleString("en")} / ${run.usage.output.toLocaleString("en")}`,
    String(run.usage.samImages),
    usd(run.cost),
  ];
}

const out = [];
out.push(`# Vision benchmark — ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`, "");
out.push(`${done.length} photo(s) scored${results.length > done.length ? `, ${results.length - done.length} failed` : ""}. Agent time, tokens and $ include the first pass it starts from.`, "");

out.push("## Per photo", "");
out.push(row(["Photo", "Method", ...HEAD, "Agent end"]), row(Array(HEAD.length + 3).fill("---")));
for (const r of results) {
  if (r.error) {
    out.push(row([r.photo, "FAILED", r.error, ...Array(HEAD.length).fill("")]));
    continue;
  }
  out.push(row([r.photo, "quick", ...cells(totals([r.quick.score]), r.quick), ""]));
  out.push(row(["", "agent", ...cells(totals([r.agent.score]), r.agent), `${r.agent.end}, ${r.agent.turns} turns`]));
}

out.push("", "## Totals", "");
const sum = (runs) => ({
  ms: runs.reduce((n, x) => n + x.ms, 0),
  usage: { input: runs.reduce((n, x) => n + x.usage.input, 0), output: runs.reduce((n, x) => n + x.usage.output, 0), samImages: runs.reduce((n, x) => n + x.usage.samImages, 0) },
  cost: runs.reduce((n, x) => n + x.cost, 0),
});
const totalsByMethod = {};
out.push(row(["Method", ...HEAD, "Mean time / photo"]), row(Array(HEAD.length + 2).fill("---")));
for (const method of ["quick", "agent"]) {
  const runs = done.map((r) => r[method]);
  const t = totals(runs.map((x) => x.score));
  const s = sum(runs);
  totalsByMethod[method] = { ...t, ...s };
  out.push(row([method, ...cells(t, s), runs.length ? sec(s.ms / runs.length) : "–"]));
}

out.push("", "## Products", "");
out.push("Truth vs what each method read. ✓ / ✗ = brand+name read right / wrong; Qore ID: right, wrong, missing or – (no truth ID).", "");
const cell = (run, ti) => {
  const p = run.score.pairs.find((x) => x.truth === ti);
  if (!p) return "not found";
  const d = run.detections[p.detection];
  return `${p.brandOk && p.nameOk ? "✓" : "✗"} ${[d.brand, d.name, d.pack].filter(Boolean).join(" · ")} — ${d.count} — ${p.qid ?? "–"}`;
};
for (const r of done) {
  out.push(`### ${r.photo}`, "", row(["Truth", "Count", "Quick", "Agent"]), row(["---", "---", "---", "---"]));
  r.truth.forEach((t, i) => out.push(row([[t.brand, t.name, t.pack].filter(Boolean).join(" · "), String(t.count), cell(r.quick, i), cell(r.agent, i)])));
  for (const method of ["quick", "agent"]) {
    const extra = r[method].score.extra.map((i) => r[method].detections[i]);
    if (extra.length) out.push("", `${method} also reported (not in truth): ${extra.map((d) => `${[d.brand, d.name].filter(Boolean).join(" ")} ×${d.count}`).join("; ")}`);
  }
  out.push("");
}

console.log(out.join("\n"));
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify({ at: new Date().toISOString(), metaBaseUrl: META_MODEL_BASE_URL, catalogBaseUrl: QORE_CATALOG_BASE_URL, totals: totalsByMethod, photos: results }, null, 2)}\n`);
console.error(`JSON: ${outPath}`);
process.exit(results.some((r) => r.error) ? 1 : 0);
