import { SettingsHeader } from "../_components/settings-parts";
import { BusinessesFailed } from "../_components/businesses-failed";
import { loadCurrentBusiness, tryApi } from "../_lib/data";
import type { Grant, Usage } from "../_lib/types";
import { revokeGrant } from "../actions";
import { IntegrationsView } from "./integrations-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Integrations · Tally" };

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<{ business?: string }> }) {
  const current = await loadCurrentBusiness((await searchParams).business);
  if (!current) return <BusinessesFailed />;
  const isOwner = current.role === "owner";
  const id = encodeURIComponent(current.id);
  const [grants, usage] = isOwner
    ? await Promise.all([tryApi<Grant[]>(`/clients/v1/grants?businessId=${id}`), tryApi<Usage>(`/businesses/${id}/usage?days=30`)])
    : [null, null];
  return (
    <>
      <SettingsHeader />
      <IntegrationsView businessName={current.name} isOwner={isOwner} grants={grants} usage={usage} revoke={revokeGrant} />
    </>
  );
}
