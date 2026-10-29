"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Button, FormMessage, SolarIcon } from "@tally/ui";
import { BackButton, ContinueButton, OnboardingShell, SavingScreen, StepHeading } from "../../_components/onboarding-shell";
import { PICK_HEADING, StarterDone, StarterList, StarterReview, keptSummary } from "../../_components/starter-items";
import { initialStates, invalidRowKeys, toStarterItem, type StarterResult, type TemplateRow } from "../../_lib/starter";
import { submitStarter } from "./actions";

/** Starter items for an existing business: pick, review, save. */
export function ItemsWizard({ business, rows }: { business: { id: string; name: string }; rows: TemplateRow[] }) {
  const [state, setState] = useState(() => initialStates(rows));
  const [review, setReview] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StarterResult | null>(null);
  const [pending, startTransition] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);

  const invalidKeys = invalidRowKeys(rows, state);

  if (result) {
    return (
      <OnboardingShell step={3} view="done">
        <StarterDone businessName={business.name} result={result} />
      </OnboardingShell>
    );
  }
  if (pending) return <SavingScreen message="Setting up your inventory…" />;

  if (rows.length === 0) {
    return (
      <OnboardingShell step={3}>
        <StepHeading {...PICK_HEADING} />
        <FormMessage variant="info" message="We don't have starter suggestions for this business type yet." />
        <Button asChild size="lg" className="mt-8 max-sm:w-full">
          <Link href="/">Go to dashboard</Link>
        </Button>
      </OnboardingShell>
    );
  }

  if (review) {
    return (
      <OnboardingShell
        step={3}
        view="review"
        footer={
          <>
            <BackButton onClick={() => setReview(false)} />
            <Button
              size="lg"
              className="max-sm:flex-1 sm:min-w-36"
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const res = await submitStarter(
                    business.id,
                    rows.map((r) => toStarterItem(r, state[r.key]!)),
                  );
                  if (res.ok) setResult(res.result);
                  else setError(res.error);
                });
              }}
            >
              Finish setup
              <SolarIcon name="Check-Circle" iconStyle="Bold" size={16} />
            </Button>
          </>
        }
      >
        <StarterReview rows={rows} state={state} businessName={business.name} error={error} />
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell
      step={3}
      view="pick"
      summary={keptSummary(rows, state)}
      footer={
        <>
          <Button variant="quiet" size="lg" className="max-sm:flex-1" asChild>
            <Link href="/">Not now</Link>
          </Button>
          <ContinueButton
            onClick={() => {
              // Qorelly rule: Continue stays enabled; pressing it flags what's missing.
              setAttempted(true);
              if (invalidKeys.length > 0) {
                listRef.current
                  ?.querySelector(`[data-row="${CSS.escape(invalidKeys[0]!)}"]`)
                  ?.scrollIntoView({ behavior: "smooth", block: "center" });
                return;
              }
              setReview(true);
              window.scrollTo({ top: 0 });
            }}
          />
        </>
      }
    >
      <StepHeading {...PICK_HEADING} />
      <StarterList
        rows={rows}
        state={state}
        attempted={attempted}
        invalidCount={invalidKeys.length}
        onChange={(key, patch) => setState((prev) => ({ ...prev, [key]: { ...prev[key]!, ...patch } }))}
        listRef={listRef}
      />
    </OnboardingShell>
  );
}
