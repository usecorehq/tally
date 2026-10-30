import type { BusinessVertical } from "@tally/catalog-client";
import { api } from "@/lib/api";
import { SetupLoadFailed, SetupWizard } from "../../onboarding/_components/setup-wizard";

export const dynamic = "force-dynamic";

/** "Add a business": the setup wizard with a way back to the businesses list. */
export default async function NewBusinessPage() {
  const verticals = await api<BusinessVertical[]>("/catalog/verticals").catch(() => null);
  if (verticals) return <SetupWizard verticals={verticals} closeHref="/" />;
  return <SetupLoadFailed closeHref="/" />;
}
