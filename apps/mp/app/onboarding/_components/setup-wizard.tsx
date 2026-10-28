"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { BusinessVertical } from "@tally/catalog-client";
import { Button, Card, FormMessage, Input, Label, NativeSelect, SolarIcon, cn } from "@tally/ui";
import { finishSetup, loadStarterRows, type FinishInput } from "../actions";
import { initialStates, invalidRowKeys, toStarterItem, type RowState, type StarterResult, type TemplateRow } from "../_lib/starter";
import { verticalIcon } from "../_lib/vertical-icons";
import { BackButton, OnboardingShell, SavingScreen, StepHeading } from "./onboarding-shell";
import { PICK_HEADING, StartFreshCard, StarterDone, StarterList, StarterLoading, StarterReview } from "./starter-items";

type Starter =
  | { subtypeCode: string; status: "loading" }
  | { subtypeCode: string; status: "error"; error: string }
  | { subtypeCode: string; status: "ready"; rows: TemplateRow[] };

/**
 * Port of Qorelly's /setup wizard (RestaurantSetupPage): business type → details → starter items.
 * Business types come from Qore Catalog; nothing is saved until "Finish setup" or "Skip & finish".
 */
export function SetupWizard({ verticals, closeHref }: { verticals: BusinessVertical[]; closeHref?: string }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [verticalCode, setVerticalCode] = useState("");
  const [subtypeCode, setSubtypeCode] = useState("");
  const [name, setName] = useState("");
  const [tried, setTried] = useState({ type: false, details: false, items: false });

  const [starter, setStarter] = useState<Starter | null>(null);
  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  const [review, setReview] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const loadingCode = useRef<string | null>(null);

  // Set once the business exists but its starter items failed: a retry only resends the items.
  const [businessId, setBusinessId] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StarterResult | null>(null);
  const [saving, startSaving] = useTransition();

  const vertical = verticals.find((v) => v.code === verticalCode);
  const subtype = vertical?.subtypes.find((s) => s.code === subtypeCode);
  const missingType = !subtype;
  const missingName = name.trim().length === 0;
  const rows = starter?.status === "ready" ? starter.rows : [];
  const invalidKeys = invalidRowKeys(rows, rowState);

  // Qorelly's nudge: after a blocked Continue, bring the first flagged field into view.
  const [nudge, setNudge] = useState(0);
  useEffect(() => {
    if (!nudge) return;
    const el = document.querySelector<HTMLElement>("main [aria-invalid='true']");
    // The industry list is taller than the screen: show its top, where the message is.
    el?.scrollIntoView({ behavior: "smooth", block: el.role === "radiogroup" ? "start" : "center" });
    el?.focus({ preventScroll: true });
  }, [nudge]);

  function goTo(next: 1 | 2 | 3) {
    setError(null);
    setStep(next);
    window.scrollTo({ top: 0 });
  }

  async function loadStarter(code: string) {
    loadingCode.current = code;
    setStarter({ subtypeCode: code, status: "loading" });
    setTried((t) => ({ ...t, items: false }));
    setReview(false);
    const res = await loadStarterRows(code);
    if (loadingCode.current !== code) return; // the merchant changed sub-type meanwhile
    if (!res.ok) return setStarter({ subtypeCode: code, status: "error", error: res.error });
    setRowState(initialStates(res.rows));
    setStarter({ subtypeCode: code, status: "ready", rows: res.rows });
  }

  function finish(items: FinishInput["items"]) {
    setError(null);
    startSaving(async () => {
      const res = await finishSetup({ businessId, name, subtypeCode, items });
      if (res.ok) {
        setResult(res.result);
        return;
      }
      if (res.businessId) setBusinessId(res.businessId);
      setError(res.error);
      window.scrollTo({ top: 0 });
    });
  }

  if (result) {
    return (
      <OnboardingShell step={3}>
        <StarterDone businessName={name.trim()} result={result} />
      </OnboardingShell>
    );
  }
  if (saving) return <SavingScreen message="Setting up your business…" />;

  if (step === 1) {
    return (
      <OnboardingShell
        step={1}
        closeHref={closeHref}
        footer={
          <>
            <span />
            <ContinueButton
              onClick={() => {
                // Qorelly rule: Continue stays enabled; pressing it flags what's missing.
                setTried((t) => ({ ...t, type: true }));
                if (missingType) return setNudge((n) => n + 1);
                goTo(2);
              }}
            />
          </>
        }
      >
        <StepHeading title="What type of business do you have?" subtitle="Select your industry to get a customized experience" />

        {tried.type && !vertical && <FormMessage message="Choose your industry." className="mb-4" />}
        <div
          role="radiogroup"
          aria-label="Industry"
          aria-invalid={tried.type && !vertical}
          className="flex scroll-mt-40 flex-col gap-2"
        >
          {verticals.map((v) => {
            const selected = v.code === verticalCode;
            return (
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                key={v.code}
                onClick={() => {
                  if (selected) return;
                  setVerticalCode(v.code);
                  setSubtypeCode(v.subtypes.length === 1 ? v.subtypes[0]!.code : "");
                }}
                className={cn(
                  "flex w-full items-center gap-4 rounded-card border px-4 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  selected ? "border-primary bg-primary/5" : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50",
                )}
              >
                <span
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors",
                    selected ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-500",
                  )}
                >
                  <SolarIcon name={verticalIcon(v.code)} iconStyle={selected ? "Bold" : "Outline"} size={22} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-sm font-semibold leading-tight", selected ? "text-primary" : "text-gray-900")}>
                    {v.label}
                  </span>
                  {v.description && <span className="mt-0.5 block text-xs leading-snug text-gray-500">{v.description}</span>}
                </span>
                {selected && <SolarIcon name="Check-Circle" iconStyle="Bold" size={20} className="shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>

        {/* Qorelly shows a sub-type picker for hospitality only; Tally needs one for every vertical. */}
        {vertical && (
          <Card className="mt-6 p-5">
            <label htmlFor="subtypeCode" className="mb-1 block text-sm font-semibold text-gray-900">
              What kind of business is it?
            </label>
            <p className="mb-3 text-xs text-gray-500">We use this to suggest the products shops like yours stock.</p>
            <NativeSelect
              id="subtypeCode"
              value={subtypeCode}
              onChange={(e) => setSubtypeCode(e.target.value)}
              aria-invalid={tried.type && missingType}
            >
              <option value="" disabled>
                Choose one
              </option>
              {vertical.subtypes.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.label}
                </option>
              ))}
            </NativeSelect>
          </Card>
        )}
        {tried.type && vertical && missingType && (
          <p className="mt-3 text-sm text-destructive">Choose what kind of business it is.</p>
        )}
      </OnboardingShell>
    );
  }

  if (step === 2) {
    return (
      <OnboardingShell
        step={2}
        closeHref={closeHref}
        footer={
          <>
            <BackButton onClick={() => goTo(1)} />
            <ContinueButton
              onClick={() => {
                setTried((t) => ({ ...t, details: true }));
                if (missingName) return setNudge((n) => n + 1);
                if (starter?.subtypeCode !== subtypeCode) void loadStarter(subtypeCode);
                goTo(3);
              }}
            />
          </>
        }
      >
        <StepHeading title="Set up your business" subtitle="Enter your business details to get started" />

        {/* Business type summary card */}
        <div className="mb-8 flex items-start gap-4 rounded-card border border-gray-100 bg-gray-50 px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white">
            <SolarIcon name={verticalIcon(vertical?.code)} iconStyle="Outline" size={20} className="text-gray-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-sm font-semibold text-gray-900">{vertical?.label}</p>
            <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-xs font-medium text-gray-600">
              <SolarIcon name="Check-Circle" iconStyle="Bold" size={11} className="text-primary" />
              {subtype?.label}
            </span>
          </div>
          <Button type="button" variant="link" size="sm" className="h-auto shrink-0 p-0" onClick={() => goTo(1)}>
            Change
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">
            Business name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault();
            }}
            placeholder="e.g., My Business"
            maxLength={120}
            autoComplete="organization"
            aria-invalid={tried.details && missingName}
          />
          {tried.details && missingName && <p className="text-sm text-destructive">Enter your business name.</p>}
        </div>
      </OnboardingShell>
    );
  }

  // Step 3: starter items, then a review before anything is saved.
  const ready = starter?.status === "ready" && rows.length > 0;
  // Once the business exists, the type and name are fixed: only the items can still change.
  const back = review ? () => (setReview(false), setError(null)) : businessId ? undefined : () => goTo(2);

  return (
    <OnboardingShell
      step={3}
      closeHref={businessId ? undefined : closeHref}
      footer={
        <>
          {back ? <BackButton onClick={back} /> : <span />}
          {review || !ready ? (
            <Button
              size="cta"
              disabled={starter?.status === "loading"}
              onClick={() => finish(ready ? rows.map((r) => toStarterItem(r, rowState[r.key]!)) : [])}
            >
              Finish setup
              <SolarIcon name="Check-Circle" iconStyle="Bold" size={16} />
            </Button>
          ) : (
            <ContinueButton
              onClick={() => {
                setTried((t) => ({ ...t, items: true }));
                if (invalidKeys.length > 0) {
                  listRef.current
                    ?.querySelector(`[data-row="${CSS.escape(invalidKeys[0]!)}"]`)
                    ?.scrollIntoView({ behavior: "smooth", block: "center" });
                  return;
                }
                setError(null);
                setReview(true);
                window.scrollTo({ top: 0 });
              }}
            />
          )}
        </>
      }
    >
      {review && ready ? (
        <StarterReview rows={rows} state={rowState} businessName={name.trim()} error={error} />
      ) : (
        <>
          <StepHeading {...PICK_HEADING} />
          <FormMessage message={error} className="mb-6" />
          {starter?.status === "loading" && <StarterLoading />}
          {starter?.status === "error" && (
            // A failed read shows an error with a retry, never an empty template.
            <div>
              <FormMessage message={`We couldn't load suggested products. ${starter.error}`} />
              <Button className="mt-4" variant="outline" onClick={() => void loadStarter(subtypeCode)}>
                <SolarIcon name="Refresh" iconStyle="Outline" size={16} />
                Try again
              </Button>
            </div>
          )}
          {starter?.status === "ready" && rows.length === 0 && (
            <FormMessage
              variant="info"
              message={`We don't have starter suggestions for ${subtype?.label.toLowerCase() ?? "this business type"} yet. Finish setup and add your products from your inventory.`}
            />
          )}
          {ready && (
            <StarterList
              rows={rows}
              state={rowState}
              attempted={tried.items}
              invalidCount={invalidKeys.length}
              onChange={(key, patch) => setRowState((prev) => ({ ...prev, [key]: { ...prev[key]!, ...patch } }))}
              listRef={listRef}
            />
          )}
          {ready && <StartFreshCard onSkip={() => finish([])} />}
        </>
      )}
    </OnboardingShell>
  );
}

function ContinueButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" size="cta" onClick={onClick}>
      Continue
      <SolarIcon name="Alt-Arrow-Right" iconStyle="Bold" size={16} />
    </Button>
  );
}
