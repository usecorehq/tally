import { getScan } from "../../actions";
import { loadBusinesses } from "../../businesses";
import { BusinessesLoadFailed } from "../../load-failed";
import { ScanSession, SessionLoadFailed } from "../../session";

export const dynamic = "force-dynamic";

/** One quick scan; open until every line is confirmed, then read-only. */
export default async function ScanPage({ params, searchParams }: { params: Promise<{ scanId: string }>; searchParams: Promise<{ business?: string }> }) {
  const [{ scanId }, { business }] = await Promise.all([params, searchParams]);
  const loaded = await loadBusinesses(business);
  if (!loaded) return <BusinessesLoadFailed />;
  const res = await getScan(loaded.current.id, scanId);
  if (!res.ok) return <SessionLoadFailed businessId={loaded.current.id} status={res.status} error={res.error} />;
  return <ScanSession key={scanId} business={loaded.current} scan={res.data} />;
}
