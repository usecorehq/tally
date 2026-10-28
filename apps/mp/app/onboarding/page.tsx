import type { BusinessVertical } from "@tally/catalog-client";
import { FormMessage } from "@tally/ui";
import { api } from "@/lib/api";
import { SetupWizard } from "./_components/setup-wizard";
import { OnboardingShell, StepHeading } from "./_components/onboarding-shell";

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
  return (
    <OnboardingShell step={1} closeHref={closeHref}>
      <StepHeading title="What type of business do you have?" subtitle="Select your industry to get a customized experience" />
      <FormMessage message="We couldn't load business types. Refresh the page to try again." />
    </OnboardingShell>
  );
}
