import Link from "next/link";
import { Button, QorellyLoader, SolarIcon, cn } from "@tally/ui";

export const ONBOARDING_STEPS = ["Business type", "Details", "Starter items"] as const;

/** Qorelly /setup wizard shell: step header + segmented progress, centred column, sticky footer. */
export function OnboardingShell({
  step,
  children,
  footer,
  closeHref,
}: {
  step: 1 | 2 | 3;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Shown when the merchant already has a business ("Add a business"), so they can leave setup. */
  closeHref?: string;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[680px] items-center gap-4 px-6 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-primary text-sm font-bold text-white" aria-hidden>
            T
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-gray-500">
              Step {step} of {ONBOARDING_STEPS.length} · <span className="font-medium text-gray-900">{ONBOARDING_STEPS[step - 1]}</span>
            </p>
            <div className="mt-2 flex max-w-xs gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={3} aria-valuenow={step}>
              {ONBOARDING_STEPS.map((label, i) => (
                <span key={label} className={cn("h-1 flex-1 rounded-full transition-colors duration-300", i < step ? "bg-primary" : "bg-gray-200")} />
              ))}
            </div>
          </div>
          {closeHref && (
            <Button asChild variant="ghost" size="icon" className="text-gray-500">
              <Link href={closeHref} aria-label="Close setup">
                <SolarIcon name="Close-Circle" iconStyle="Outline" size={22} />
              </Link>
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-[680px] flex-1 px-6 pb-32 pt-8">{children}</main>

      {footer && (
        <footer className="sticky bottom-0 border-t border-gray-100 bg-white/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-[680px] items-center justify-between gap-3 px-6 py-4">{footer}</div>
        </footer>
      )}
    </div>
  );
}

export function StepHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">{title}</h1>
      <p className="mt-2 text-base text-gray-500">{subtitle}</p>
    </div>
  );
}

/** Qorelly's full-screen hold while setup saves. */
export function SavingScreen({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white">
      <QorellyLoader className="h-8 w-8 text-primary" />
      <p className="text-sm text-gray-600">{message}</p>
    </div>
  );
}

/** Back in the sticky footer: a quiet text button, as in Qorelly V1. */
export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="cta" className="text-gray-500 hover:text-gray-700" onClick={onClick}>
      <SolarIcon name="Alt-Arrow-Left" iconStyle="Outline" size={16} className="text-gray-400" />
      Back
    </Button>
  );
}
