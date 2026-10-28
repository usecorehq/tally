import { redirect } from "next/navigation";
import { FormMessage, PageHeader } from "@tally/ui";
import { api } from "@/lib/api";
import { AppShell } from "../_components/app-shell";
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
      <AppShell width="wide">
        <PageHeader title="Count a shelf from a photo" />
        {/* A failed read is an error, never an empty list. */}
        <FormMessage className="max-w-[760px]" message="We couldn't load your businesses. Refresh the page to try again." />
      </AppShell>
    );
  }

  const initial = businesses.find((b) => b.id === business)?.id ?? businesses[0]!.id;
  return (
    <AppShell width="wide">
      <StocktakeFlow businesses={businesses.map(({ id, name }) => ({ id, name }))} initialBusinessId={initial} />
    </AppShell>
  );
}
