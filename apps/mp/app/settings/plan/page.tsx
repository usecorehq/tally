import { SettingsHeader } from "../_components/settings-parts";
import { BusinessesFailed } from "../_components/businesses-failed";
import { loadSettingsBusinesses, tryApi } from "../_lib/data";
import type { Plan, Usage } from "../_lib/types";
import { subscribe } from "../actions";
import { PlanView } from "./plan-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Plan · Tally" };

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ business?: string }> }) {
  const loaded = await loadSettingsBusinesses((await searchParams).business);
  if (!loaded) return <BusinessesFailed />;
  const { businesses, current } = loaded;
  const [usage, plans] = await Promise.all([
    tryApi<Usage>(`/businesses/${encodeURIComponent(current.id)}/usage?days=30`),
    tryApi<Plan[]>("/plans"),
  ]);
  const subscribeHere = subscribe.bind(null, current.id);
  return (
    <>
      <SettingsHeader businesses={businesses} businessId={current.id} />
      <PlanView businessName={current.name} isOwner={current.role === "owner"} usage={usage} plans={plans} subscribe={subscribeHere} />
    </>
  );
}
