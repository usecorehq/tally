import { SettingsHeader } from "../_components/settings-parts";
import { BusinessesFailed } from "../_components/businesses-failed";
import { loadSettingsBusinesses, tryApi } from "../_lib/data";
import type { Grant, Usage } from "../_lib/types";
import { revokeGrant } from "../actions";
import { IntegrationsView } from "./integrations-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Integrations · Tally" };

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<{ business?: string }> }) {
  const loaded = await loadSettingsBusinesses((await searchParams).business);
  if (!loaded) return <BusinessesFailed />;
  const { businesses, current } = loaded;
  const isOwner = current.role === "owner";
  const id = encodeURIComponent(current.id);
  const [grants, usage] = isOwner
    ? await Promise.all([tryApi<Grant[]>(`/clients/v1/grants?businessId=${id}`), tryApi<Usage>(`/businesses/${id}/usage?days=30`)])
    : [null, null];
  return (
    <>
      <SettingsHeader businesses={businesses} businessId={current.id} />
      <IntegrationsView businessName={current.name} isOwner={isOwner} grants={grants} usage={usage} revoke={revokeGrant} />
    </>
  );
}
