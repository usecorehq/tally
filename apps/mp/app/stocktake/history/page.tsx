import { stocktakeHistory } from "../actions";
import { loadBusinesses } from "../businesses";
import { BusinessesLoadFailed } from "../load-failed";
import { HistoryPage } from "./history-page";

export const dynamic = "force-dynamic";

export default async function StocktakeHistoryPage({ searchParams }: { searchParams: Promise<{ business?: string }> }) {
  const { business } = await searchParams;
  const loaded = await loadBusinesses(business);
  if (!loaded) return <BusinessesLoadFailed />;
  const res = await stocktakeHistory(loaded.current.id);
  return <HistoryPage businesses={loaded.businesses} businessId={loaded.current.id} entries={res.ok ? res.data : null} error={res.ok ? undefined : res.error} />;
}
