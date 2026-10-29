import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import { BusinessesLoadFailed } from "./load-failed";
import { StocktakeFlow } from "./stocktake-flow";

export const dynamic = "force-dynamic";

type BusinessSummary = { id: string; name: string; subtypeCode: string; role: string };

// The shell (AppShell, wide) comes from stocktake/layout.tsx.
export default async function StocktakePage({ searchParams }: { searchParams: Promise<{ business?: string }> }) {
  const { business } = await searchParams;
  let businesses: BusinessSummary[] | null = null;
  try {
    businesses = await api<BusinessSummary[]>("/businesses");
  } catch {
    businesses = null;
  }

  if (businesses && businesses.length === 0) redirect("/onboarding");
  // A failed read is an error with a retry, never an empty list.
  if (businesses === null) return <BusinessesLoadFailed />;

  const initial = businesses.find((b) => b.id === business)?.id ?? businesses[0]!.id;
  return <StocktakeFlow businesses={businesses.map(({ id, name }) => ({ id, name }))} initialBusinessId={initial} />;
}
