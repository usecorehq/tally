// Review one shelf scan or stock-take run from the database: per line, what Muse Spark read, the catalogue
// candidates (with their names), what the agent concluded, and what the merchant decided. Read-only.
// Use it to see whether a wrong item came from the catalogue's ranking, the agent, or the merchant keeping a default.
//   pnpm turbo run build --filter=@tally/db --filter=@tally/catalog-client
//   node --env-file=apps/api/.env apps/api/scripts/vision-review.mjs <runId or scanId>
//   node --env-file=apps/api/.env apps/api/scripts/vision-review.mjs --business "Superbox"   (its latest run)
// Needs SUPABASE_DB_URL; QORE_CATALOG_BASE_URL + QORE_CATALOG_API_KEY to name candidates (else Qore IDs only).
// Prints merchant shelf data to the terminal only. Never prints a key.
import { createRequire } from "node:module";
import { parseArgs } from "node:util";

const require = createRequire(import.meta.url);
const { buildTallyDb, sql } = require("@tally/db");
const { CatalogClient } = require("@tally/catalog-client");

const { values: opts, positionals } = parseArgs({ allowPositionals: true, options: { business: { type: "string" } } });
const { SUPABASE_DB_URL, QORE_CATALOG_BASE_URL, QORE_CATALOG_API_KEY } = process.env;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!SUPABASE_DB_URL || (!opts.business && !UUID.test(positionals[0] ?? ""))) {
  console.error("Usage: node --env-file=apps/api/.env apps/api/scripts/vision-review.mjs <runId or scanId>");
  console.error('       node --env-file=apps/api/.env apps/api/scripts/vision-review.mjs --business "<name>"');
  process.exit(1);
}

const db = buildTallyDb(SUPABASE_DB_URL, { max: 1 });
const catalog = QORE_CATALOG_BASE_URL && QORE_CATALOG_API_KEY ? new CatalogClient(QORE_CATALOG_BASE_URL, QORE_CATALOG_API_KEY) : null;

const rows = (r) => (Array.isArray(r) ? r : (r.rows ?? []));

async function findScan() {
  if (opts.business) {
    const [r] = rows(
      await db.execute(sql`
        select r.id as run_id, r.scan_id, b.name as business from tally.vision_agent_runs r
        join tally.businesses b on b.id = r.business_id
        where b.name = ${opts.business} and r.scan_id is not null order by r.started_at desc limit 1`),
    );
    if (!r) throw new Error(`No finished stock-take run for a business named "${opts.business}"`);
    return r;
  }
  const id = positionals[0];
  const [r] = rows(
    await db.execute(sql`
      select r.id as run_id, s.id as scan_id, b.name as business from tally.vision_scans s
      join tally.businesses b on b.id = s.business_id
      left join tally.vision_agent_runs r on r.scan_id = s.id
      where s.id = ${id} or r.id = ${id} limit 1`),
  );
  if (!r) throw new Error(`No scan or run with id ${id}`);
  return r;
}

// Names for Qore IDs, best-effort: a lookup failure leaves the bare ID.
const names = new Map();
async function nameOf(qid) {
  if (!catalog || !qid) return qid ?? "";
  if (!names.has(qid)) {
    names.set(
      qid,
      catalog
        .getProduct(qid)
        .then((p) => (p.status === "merged" ? `${qid} (merged into ${p.mergedInto})` : p.name))
        .catch(() => qid),
    );
  }
  return names.get(qid);
}

const pad = (s, n) => String(s ?? "").slice(0, n).padEnd(n);

try {
  const found = await findScan();
  const [run] = found.run_id
    ? rows(await db.execute(sql`select status, model, turns, input_tokens, output_tokens, started_at, finished_at, error from tally.vision_agent_runs where id = ${found.run_id}`))
    : [];
  const [scan] = rows(await db.execute(sql`select status, image_bytes, read_model, created_at from tally.vision_scans where id = ${found.scan_id}`));
  const lines = rows(
    await db.execute(sql`
      select d.position, d.brand, d.name, d.pack, d.confidence, d.count, d.count_source, d.candidates,
        d.inventory_match, d.action, d.outcome, d.confirmed_qid, i.name as item_name, d.evidence
      from tally.vision_detections d left join tally.inventory_items i on i.id = d.item_id
      where d.scan_id = ${found.scan_id} order by d.position`),
  );
  const unresolved = found.run_id
    ? rows(
        await db.execute(sql`
          select args from tally.vision_agent_steps
          where run_id = ${found.run_id} and tool = 'record_line' and args ? 'unresolved_reason' order by created_at`),
      )
    : [];
  // The last unresolved record per line wins, as in the run.
  const verdict = new Map(unresolved.map((s) => [Number(s.args.line), `unresolved: ${s.args.unresolved_reason}`]));

  console.log(`${found.business} · scan ${found.scan_id} (${scan.status}, ${Math.round(scan.image_bytes / 1024)} KB, ${new Date(scan.created_at).toISOString()})`);
  if (run) {
    const secs = run.finished_at ? Math.round((new Date(run.finished_at) - new Date(run.started_at)) / 1000) : "?";
    console.log(`run ${found.run_id}: ${run.status}, ${run.model}, ${run.turns} turns, ${secs} s, ${run.input_tokens}/${run.output_tokens} tokens${run.error ? `, error: ${run.error}` : ""}`);
  } else {
    console.log("quick scan (no agent run)");
  }

  for (const d of lines) {
    const read = [d.brand, d.name, d.pack].filter(Boolean).join(" · ") || "(nothing legible)";
    const agent = verdict.get(d.position) ?? (d.evidence ? "recorded" : found.run_id ? "not reviewed by the agent" : "-");
    console.log(`\n#${d.position} ${read}  [${d.confidence}, count ${d.count} by ${d.count_source}${d.brand ? "" : ", no brand"}]`);
    console.log(`   agent:    ${agent}`);
    if (d.inventory_match) console.log(`   in store: by ${d.inventory_match}`);
    for (const [i, c] of (d.candidates ?? []).entries()) {
      const mark = c.qid === d.confirmed_qid ? "✓" : " ";
      console.log(`   ${mark} ${i + 1}. ${pad(c.score?.toFixed(2), 4)}  ${c.qid}  ${await nameOf(c.qid)}`);
    }
    if (!d.candidates?.length) console.log("     (no catalogue candidates)");
    const decision = d.action
      ? `${d.action} → ${d.outcome}${d.item_name ? ` → item "${d.item_name}"` : ""}${d.outcome === "accepted" ? " (kept the top pick)" : ""}`
      : "undecided";
    console.log(`   merchant: ${decision}`);
  }
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await db.$client?.end?.({ timeout: 5 });
}
