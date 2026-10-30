import { SettingsHeader } from "../_components/settings-parts";
import { BusinessesFailed } from "../_components/businesses-failed";
import { loadSettingsBusinesses, tryApi } from "../_lib/data";
import type { Usage } from "../_lib/types";
import { UsageView } from "./usage-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Usage · Tally" };

export default async function UsagePage({ searchParams }: { searchParams: Promise<{ business?: string }> }) {
  const loaded = await loadSettingsBusinesses((await searchParams).business);
  if (!loaded) return <BusinessesFailed />;
  const usage = await tryApi<Usage>(`/businesses/${encodeURIComponent(loaded.current.id)}/usage?days=30`);
  return (
    <>
      <SettingsHeader businesses={loaded.businesses} businessId={loaded.current.id} />
      <UsageView usage={usage} />
    </>
  );
}
