import { notFound } from "next/navigation";
import type { SubtypeTemplates } from "@tally/catalog-client";
import { api, ApiError } from "@/lib/api";
import { toRows } from "../../_lib/starter";
import { ItemsWizard } from "./items-wizard";

export const dynamic = "force-dynamic";

type Business = { id: string; name: string; subtypeCode: string };

// Starter items for a business that already exists (the setup wizard creates the business at the end).
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
