"use client";

import { Button, FormMessage } from "@tally/ui";
import { OnboardingShell, StepHeading } from "../../_components/onboarding-shell";

// A failed read shows an error with a retry, never an empty template.
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <OnboardingShell step={3}>
      <StepHeading title="Pick your starter items" subtitle="Products shops like yours usually stock." />
      <FormMessage message="We couldn't load suggested products. Check your connection and try again." />
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </OnboardingShell>
  );
}
