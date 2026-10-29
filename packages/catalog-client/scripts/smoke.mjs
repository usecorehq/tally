// Live smoke test against a deployed Qore Catalog; not part of the build. Never prints the key.
// Usage: docs/architecture/catalog.md.
import { createRequire } from "node:module";

const { catalogClient, CatalogError } = createRequire(import.meta.url)("../dist/index.js");

const baseUrl = process.env.QORE_CATALOG_BASE_URL;
if (!baseUrl || !process.env.QORE_CATALOG_API_KEY) {
  console.error("Set QORE_CATALOG_BASE_URL and QORE_CATALOG_API_KEY.");
  process.exit(1);
}
const client = catalogClient(baseUrl);
console.log(`catalog: ${baseUrl}`);

const steps = [
  ["health", () => client.health(), (r) => `${r.status} db=${r.db}`],
  ["whoAmI", () => client.whoAmI(), (r) => `${r.name} (${r.prefix}…) scopes=${r.scopes.join(",")} expires=${r.expiresAt ?? "never"}`],
  [
    "match",
    () => client.match({ items: [{ brand: "Peak", name: "Full Cream Milk Powder", pack: "400g" }] }),
    (r) => {
      const top = r.items[0]?.candidates[0];
      return top ? `${top.qid} ${top.name} score=${top.score} median=₦${top.price?.median ?? "-"}` : "no candidates";
    },
  ],
  [
    "subtypeTemplates",
    () => client.subtypeTemplates("supermarket", 2),
    (r) => {
      const items = r.templates.flatMap((t) => t.groups.flatMap((g) => g.items));
      const suggested = items.filter((i) => i.suggestions?.length).length;
      return `${r.vertical.code}/${r.subtype.code} matchedBy=${r.matchedBy} templates=${r.templates.length} items=${items.length} withSuggestions=${suggested}`;
    },
  ],
];

let failed = 0;
for (const [name, call, line] of steps) {
  const started = Date.now();
  try {
    const result = await call();
    console.log(`ok   ${name} (${Date.now() - started}ms): ${line(result)}`);
  } catch (err) {
    failed++;
    const status = err instanceof CatalogError ? err.status : "network";
    console.log(`FAIL ${name} (${Date.now() - started}ms): ${status} ${err.message}`);
  }
}
process.exit(failed ? 1 : 0);
