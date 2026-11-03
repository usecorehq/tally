import { redirect } from "next/navigation";
import type { BusinessVertical } from "@tally/catalog-client";
import { api } from "@/lib/api";
import { SetupLoadFailed, SetupWizard } from "./_components/setup-wizard";

export const dynamic = "force-dynamic";

/** First-time setup only: a merchant who already has a business adds another at /businesses/new. */
export default async function OnboardingPage() {
  const [verticals, businesses] = await Promise.all([
    api<BusinessVertical[]>("/catalog/verticals").catch(() => null),
    api<{ id: string }[]>("/businesses").catch(() => null),
  ]);
  if (businesses?.length) redirect("/");

  if (verticals) return <SetupWizard verticals={verticals} />;
  // A failed read is an error, never an empty list.
  return <SetupLoadFailed />;
}
