import { notFound } from "next/navigation";
import type { SubtypeTemplates } from "@tally/catalog-client";
import { api, ApiError } from "@/lib/api";
import { ItemsWizard, type TemplateRow } from "./items-wizard";

export const dynamic = "force-dynamic";

type Business = { id: string; name: string; subtypeCode: string };

export default async function StarterItemsPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;

  let business: Business;
  try {
    business = await api<Business>(`/businesses/${businessId}`);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 403 || err.status === 400)) notFound();
    throw err; // error.tsx shows a retry
  }

  // First call per sub-type takes ~5 s (catalogue suggestions); loading.tsx covers it.
  const templates = await api<SubtypeTemplates>(
    `/catalog/subtypes/${encodeURIComponent(business.subtypeCode)}/templates?suggestions=2`,
    { timeoutMs: 30_000 },
  );

  return <ItemsWizard business={business} rows={toRows(templates)} />;
}

/** Flatten template groups into one row per item, with the catalogue's candidates deduped. */
function toRows(templates: SubtypeTemplates): TemplateRow[] {
  return templates.templates.flatMap((t) =>
    t.groups.flatMap((g) =>
      g.items.map((item, i) => {
        const seen = new Set<string>();
        // Ranked suggestions (with prices) first, then the template's own product if it isn't among them.
        const pool = [
          ...(item.suggestions ?? []),
          ...(item.product ? [{ ...item.product, score: 0, price: null }] : []),
        ];
        const candidates = pool.filter((c) => !seen.has(c.qid) && seen.add(c.qid));
        return {
          key: `${t.code}:${g.code}:${i}`,
          groupLabel: g.label,
          templateName: item.name,
          candidates: candidates.map((c) => ({
            qid: c.qid,
            name: c.name,
            variantLabel: c.variantLabel,
            sizeValue: c.size?.value ?? null,
            sizeUnit: c.size?.unit ?? null,
            packQty: c.packQty,
            categoryPath: c.category.path,
            score: c.score,
            priceMedian: c.price?.median ?? null,
          })),
        };
      }),
    ),
  );
}
