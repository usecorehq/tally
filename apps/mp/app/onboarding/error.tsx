"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoadFailed, OnboardingShell, StepHeading, TYPE_HEADING } from "./_components/onboarding-shell";

// Anything page.tsx doesn't already catch: an error with a retry that refetches, never a blank page.
export default function Error({ reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const [retrying, startRetry] = useTransition();
  return (
    <OnboardingShell step={1}>
      <StepHeading {...TYPE_HEADING} />
      <LoadFailed
        title="We couldn't open setup"
        body="Check your connection and try again."
        retrying={retrying}
        onRetry={() =>
          startRetry(() => {
            router.refresh();
            reset();
          })
        }
      />
    </OnboardingShell>
  );
}
