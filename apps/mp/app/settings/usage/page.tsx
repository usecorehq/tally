import { SettingsHeader } from "../_components/settings-parts";
import { BusinessesFailed } from "../_components/businesses-failed";
import { loadCurrentBusiness, tryApi } from "../_lib/data";
import type { Usage } from "../_lib/types";
import { UsageView } from "./usage-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Usage · Tally" };

export default async function UsagePage({ searchParams }: { searchParams: Promise<{ business?: string }> }) {
  const current = await loadCurrentBusiness((await searchParams).business);
  if (!current) return <BusinessesFailed />;
  const usage = await tryApi<Usage>(`/businesses/${encodeURIComponent(current.id)}/usage?days=30`);
  return (
    <>
      <SettingsHeader />
      <UsageView usage={usage} />
    </>
  );
}
