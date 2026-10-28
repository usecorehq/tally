import { redirect } from "next/navigation";
import { FormMessage } from "@tally/ui";
import { api } from "@/lib/api";
import { StocktakeFlow } from "./stocktake-flow";

export const dynamic = "force-dynamic";

type BusinessSummary = { id: string; name: string; subtypeCode: string; role: string };

export default async function StocktakePage({ searchParams }: { searchParams: Promise<{ business?: string }> }) {
  const { business } = await searchParams;
  let businesses: BusinessSummary[] | null = null;
  try {
    businesses = await api<BusinessSummary[]>("/businesses");
  } catch {
    businesses = null;
  }

  if (businesses && businesses.length === 0) redirect("/onboarding");
  if (businesses === null) {
    return (
      <main className="mx-auto max-w-[680px] px-6 py-10">
        {/* A failed read is an error, never an empty list. */}
        <FormMessage message="We couldn't load your businesses. Refresh the page to try again." />
      </main>
    );
  }

  const initial = businesses.find((b) => b.id === business)?.id ?? businesses[0]!.id;
  return <StocktakeFlow businesses={businesses.map(({ id, name }) => ({ id, name }))} initialBusinessId={initial} />;
}
