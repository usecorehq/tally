import { ChoiceListSkeleton, OnboardingShell, StepHeading, TYPE_HEADING } from "./_components/onboarding-shell";

// Business types come from Qore Catalog: hold step 1's shape while they load.
export default function Loading() {
  return (
    <OnboardingShell step={1}>
      <StepHeading {...TYPE_HEADING} />
      <ChoiceListSkeleton />
    </OnboardingShell>
  );
}
