import { getScan, pollStocktake } from "../../actions";
import { loadBusinesses } from "../../businesses";
import { BusinessesLoadFailed } from "../../load-failed";
import { RunSession, ScanSession, SessionLoadFailed } from "../../session";

export const dynamic = "force-dynamic";

/** One stock-take session by id: a run (agent) or, failing that, a quick scan. A refresh restores it. */
export default async function SessionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ business?: string }> }) {
  const [{ id }, { business }] = await Promise.all([params, searchParams]);
  const loaded = await loadBusinesses(business);
  if (!loaded) return <BusinessesLoadFailed />;
  const run = await pollStocktake(loaded.current.id, id);
  // Keyed so opening another session starts fresh state.
  if (run.ok) return <RunSession key={id} business={loaded.current} initial={run.data} />;
  if (run.status !== 404) return <SessionLoadFailed businessId={loaded.current.id} status={run.status} error={run.error} />;
  const scan = await getScan(loaded.current.id, id);
  if (!scan.ok) return <SessionLoadFailed businessId={loaded.current.id} status={scan.status} error={scan.error} />;
  return <ScanSession key={id} business={loaded.current} scan={scan.data} />;
}
