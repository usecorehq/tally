"use client";

import { startTransition } from "react";
import { useRouter } from "next/navigation";
import { LoadFailed, OnboardingShell, StepHeading } from "../../_components/onboarding-shell";
import { PICK_HEADING } from "../../_components/starter-items";

// A failed read shows an error with a retry, never an empty template.
export default function Error({ reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <OnboardingShell step={3}>
      <StepHeading {...PICK_HEADING} />
      <LoadFailed
        title="We couldn't load suggested products"
        body="Check your connection and try again."
        // reset() alone re-renders the same failed result; refresh refetches on the server first.
        onRetry={() =>
          startTransition(() => {
            router.refresh();
            reset();
          })
        }
      />
    </OnboardingShell>
  );
}
