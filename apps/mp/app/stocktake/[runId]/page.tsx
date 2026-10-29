import { pollStocktake } from "../actions";
import { loadBusinesses } from "../businesses";
import { BusinessesLoadFailed } from "../load-failed";
import { RunSession, SessionLoadFailed } from "../session";

export const dynamic = "force-dynamic";

/** One stock-take run; a refresh restores it from the server (and the photo from this browser). */
export default async function RunPage({ params, searchParams }: { params: Promise<{ runId: string }>; searchParams: Promise<{ business?: string }> }) {
  const [{ runId }, { business }] = await Promise.all([params, searchParams]);
  const loaded = await loadBusinesses(business);
  if (!loaded) return <BusinessesLoadFailed />;
  const res = await pollStocktake(loaded.current.id, runId);
  if (!res.ok) return <SessionLoadFailed businessId={loaded.current.id} status={res.status} error={res.error} />;
  // Keyed so opening another run starts fresh state.
  return <RunSession key={runId} business={loaded.current} initial={res.data} />;
}
