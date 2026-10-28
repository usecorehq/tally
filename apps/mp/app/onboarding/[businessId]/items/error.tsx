"use client";

import { LoadFailed, OnboardingShell, StepHeading } from "../../_components/onboarding-shell";
import { PICK_HEADING } from "../../_components/starter-items";

// A failed read shows an error with a retry, never an empty template.
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <OnboardingShell step={3}>
      <StepHeading {...PICK_HEADING} />
      <LoadFailed
        title="We couldn't load suggested products"
        body="Check your connection and try again."
        onRetry={reset}
      />
    </OnboardingShell>
  );
}
