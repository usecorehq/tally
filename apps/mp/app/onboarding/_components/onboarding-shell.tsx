import Link from "next/link";
import { Button, QorellyLoader, SolarIcon, StepFooter, cn } from "@tally/ui";
import { TallyMark } from "../../_components/tally-mark";

export const ONBOARDING_STEPS = ["Business type", "Details", "Starter items"] as const;

/**
 * V2 full-screen flow: slim top bar (mark, step pill + trail, close), a 680px column on white,
 * and the actions on a grey well pinned to the bottom.
 */
export function OnboardingShell({
  step,
  children,
  footer,
  summary,
  closeHref,
  view,
}: {
  step: 1 | 2 | 3;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** A line above the footer actions, e.g. "12 of 20 kept". */
  summary?: React.ReactNode;
  /** Shown when the merchant already has a business ("Add a business"), so they can leave setup. */
  closeHref?: string;
  /** Changing it replays the enter motion (e.g. pick → review inside step 3). */
  view?: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-[680px] items-center gap-3 px-4 sm:px-6">
          <TallyMark className="h-8 w-8" />
          <span
            className="shrink-0 rounded-full bg-primary-light px-3 py-1.5 text-xs font-semibold text-primary"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={ONBOARDING_STEPS.length}
            aria-valuenow={step}
            aria-valuetext={`Step ${step} of ${ONBOARDING_STEPS.length}: ${ONBOARDING_STEPS[step - 1]}`}
          >
            Step {step} of {ONBOARDING_STEPS.length}
          </span>
          <ol className="flex min-w-0 items-center gap-1.5 text-xs max-sm:hidden" aria-hidden>
            {ONBOARDING_STEPS.map((label, i) => (
              <li key={label} className="flex shrink-0 items-center gap-1.5">
                {i > 0 && <span className="text-gray-300">→</span>}
                <span className={cn(i + 1 === step ? "font-medium text-gray-900" : i + 1 < step ? "text-gray-500" : "text-gray-400")}>
                  {label}
                </span>
              </li>
            ))}
          </ol>
          <span className="truncate text-xs font-medium text-gray-900 sm:hidden">{ONBOARDING_STEPS[step - 1]}</span>
          {closeHref && (
            <Button asChild variant="ghost" size="icon" className="-mr-2 ml-auto h-11 w-11 text-gray-500">
              <Link href={closeHref} aria-label="Close setup" title="Close setup">
                <SolarIcon name="Close-Circle" iconStyle="Outline" size={22} />
              </Link>
            </Button>
          )}
        </div>
        <div className="flex h-0.5 bg-gray-100" aria-hidden>
          <span
            className="bg-primary transition-[width] duration-300 ease-out"
            style={{ width: `${(step / ONBOARDING_STEPS.length) * 100}%` }}
          />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[680px] flex-1 px-4 pb-16 pt-8 sm:px-6 sm:pt-10">
        <div key={`${step}:${view ?? ""}`} className="q-step-fwd">
          {children}
        </div>
      </main>

      {footer && (
        <footer className="sticky bottom-0 z-10">
          <StepFooter summary={summary != null ? <div className="mx-auto max-w-[680px] sm:px-6">{summary}</div> : undefined}>
            <div className="mx-auto flex w-full max-w-[680px] items-center justify-between gap-2 sm:px-6">{footer}</div>
          </StepFooter>
        </footer>
      )}
    </div>
  );
}

/** The question for a step, with StepHeader's type. */
export function StepHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-[24px] font-medium leading-tight tracking-tight text-gray-900 sm:text-[28px]">{title}</h1>
      <p className="mt-1.5 text-[14px] leading-5 text-gray-500">{subtitle}</p>
    </div>
  );
}

/** Qorelly's full-screen hold while setup saves. */
export function SavingScreen({ message }: { message: string }) {
  return (
    <div className="q-fade-in flex min-h-dvh flex-col items-center justify-center gap-4 bg-white px-6 text-center">
      <QorellyLoader className="h-8 w-8 text-primary" />
      <div>
        <p className="text-[15px] font-medium text-gray-900">{message}</p>
        <p className="mt-1 text-[13px] text-gray-500">This takes a few seconds. Keep this page open.</p>
      </div>
    </div>
  );
}

/** Back in the footer well: quiet, always before the primary. */
export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="quiet" size="lg" className="max-sm:flex-1" onClick={onClick}>
      <SolarIcon name="Alt-Arrow-Left" iconStyle="Outline" size={16} className="text-gray-500" />
      Back
    </Button>
  );
}

/** Continue stays enabled: pressing it with something missing points at what to fix. */
export function ContinueButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" size="lg" className="max-sm:flex-1 sm:min-w-36" onClick={onClick}>
      Continue
      <SolarIcon name="Alt-Arrow-Right" iconStyle="Outline" size={16} />
    </Button>
  );
}

/** Keeps the primary on the right when a step has no Back. */
export function FooterSpacer() {
  return <span className="max-sm:hidden" />;
}

/** A failed read: what didn't load, why, and a retry. Never an empty list. */
export function LoadFailed({
  title,
  body,
  onRetry,
  retrying = false,
}: {
  title: string;
  body: string;
  onRetry: () => void;
  retrying?: boolean;
}) {
  return (
    <div className="rounded-[18px] bg-gray-100 p-1">
      <div role="alert" className="flex flex-col items-center gap-2 rounded-[14px] bg-white px-6 py-12 text-center ring-1 ring-black/[0.04]">
        <span className="mb-1 flex size-10 items-center justify-center rounded-full bg-red-50 text-red-600">
          <SolarIcon name="Danger-Circle" iconStyle="Outline" size={20} />
        </span>
        <p className="font-medium tracking-tight text-gray-900">{title}</p>
        <p className="max-w-sm break-words text-sm text-gray-500">{body}</p>
        <Button type="button" className="mt-2" variant="quiet" size="lg" disabled={retrying} onClick={onRetry}>
          <SolarIcon name="Refresh" iconStyle="Outline" size={16} />
          {retrying ? "Trying again…" : "Try again"}
        </Button>
      </div>
    </div>
  );
}
