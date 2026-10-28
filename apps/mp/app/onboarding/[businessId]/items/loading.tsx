import { OnboardingShell, StepHeading } from "../../_components/onboarding-shell";
import { PICK_HEADING, StarterLoading } from "../../_components/starter-items";

export default function Loading() {
  return (
    <OnboardingShell step={3}>
      <StepHeading {...PICK_HEADING} />
      <StarterLoading />
    </OnboardingShell>
  );
}
