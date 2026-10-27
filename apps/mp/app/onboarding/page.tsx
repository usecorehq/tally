import type { BusinessVertical } from "@tally/catalog-client";
import { FormMessage } from "@tally/ui";
import { api } from "@/lib/api";
import { BusinessStep } from "./_components/business-step";
import { OnboardingShell, StepHeading } from "./_components/onboarding-shell";

const HEADING = { title: "What type of business do you have?", subtitle: "We'll suggest the products shops like yours usually stock." };

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  let verticals: BusinessVertical[] | null = null;
  try {
    verticals = await api<BusinessVertical[]>("/catalog/verticals");
  } catch {
    verticals = null;
  }

  if (verticals) return <BusinessStep verticals={verticals} heading={HEADING} />;
  // A failed read is an error, never an empty list.
  return (
    <OnboardingShell step={1}>
      <StepHeading {...HEADING} />
      <FormMessage message="We couldn't load business types. Refresh the page to try again." />
    </OnboardingShell>
  );
}
