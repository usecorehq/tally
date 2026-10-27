import { QorellyLoader, Skeleton } from "@tally/ui";
import { OnboardingShell, StepHeading } from "../../_components/onboarding-shell";

export default function Loading() {
  return (
    <OnboardingShell step={2}>
      <StepHeading title="Pick your starter items" subtitle="Finding products shops like yours stock…" />
      <div className="mb-6 flex items-center gap-3 text-sm text-gray-500">
        <QorellyLoader className="h-5 w-5" />
        This takes a few seconds the first time.
      </div>
      <div className="space-y-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-none" />
        ))}
      </div>
    </OnboardingShell>
  );
}
