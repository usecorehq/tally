import type { BusinessVertical } from "@tally/catalog-client";
import { api } from "@/lib/api";
import { SetupLoadFailed, SetupWizard } from "./_components/setup-wizard";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const [verticals, businesses] = await Promise.all([
    api<BusinessVertical[]>("/catalog/verticals").catch(() => null),
    api<{ id: string }[]>("/businesses").catch(() => null),
  ]);
  // "Add a business": a merchant who already has one can close setup and go back.
  const closeHref = businesses?.length ? "/" : undefined;

  if (verticals) return <SetupWizard verticals={verticals} closeHref={closeHref} />;
  // A failed read is an error, never an empty list.
  return <SetupLoadFailed closeHref={closeHref} />;
}
