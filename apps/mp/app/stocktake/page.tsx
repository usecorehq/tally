import { BusinessesLoadFailed } from "./load-failed";
import { loadBusinesses } from "./businesses";
import { StocktakeFlow } from "./stocktake-flow";

export const dynamic = "force-dynamic";

// The shell (AppShell, wide) comes from stocktake/layout.tsx.
export default async function StocktakePage({ searchParams }: { searchParams: Promise<{ business?: string }> }) {
  const { business } = await searchParams;
  const loaded = await loadBusinesses(business);
  // A failed read is an error with a retry, never an empty list.
  if (!loaded) return <BusinessesLoadFailed />;
  return <StocktakeFlow businesses={loaded.businesses} initialBusinessId={loaded.current.id} />;
}
