"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BusinessVertical } from "@tally/catalog-client";
import { Button, ChoiceCard, FieldLabel, FormMessage, IconTile, Input, SolarIcon, StepSection, cn } from "@tally/ui";
import { finishSetup, loadStarterRows, type FinishInput } from "../actions";
import { initialStates, invalidRowKeys, toStarterItem, type RowState, type StarterResult, type TemplateRow } from "../_lib/starter";
import { verticalIcon } from "../_lib/vertical-icons";
import { BackButton, ContinueButton, FooterSpacer, LoadFailed, OnboardingShell, SavingScreen, StepHeading } from "./onboarding-shell";
import { PICK_HEADING, StartFreshCard, StarterDone, StarterList, StarterLoading, StarterReview, keptSummary } from "./starter-items";

type Starter =
  | { subtypeCode: string; status: "loading" }
  | { subtypeCode: string; status: "error"; error: string }
  | { subtypeCode: string; status: "ready"; rows: TemplateRow[] };

/** The server actions the wizard calls. Swappable so /design/onboarding can preview it with fixtures. */
export type SetupActions = { loadStarterRows: typeof loadStarterRows; finishSetup: typeof finishSetup };
const SERVER_ACTIONS: SetupActions = { loadStarterRows, finishSetup };

const TYPE_HEADING = { title: "What type of business do you have?", subtitle: "Pick your industry so Tally can suggest the right products." };

/**
 * Port of Qorelly's /setup wizard (RestaurantSetupPage): business type → details → starter items.
 * Business types come from Qore Catalog; nothing is saved until "Finish setup" or "Skip & finish".
 */
export function SetupWizard({
  verticals,
  closeHref,
  actions = SERVER_ACTIONS,
}: {
  verticals: BusinessVertical[];
  closeHref?: string;
  actions?: SetupActions;
}) {
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
    const res = await actions.loadStarterRows(code);
    if (loadingCode.current !== code) return; // the merchant changed sub-type meanwhile
    if (!res.ok) return setStarter({ subtypeCode: code, status: "error", error: res.error });
    setRowState(initialStates(res.rows));
    setStarter({ subtypeCode: code, status: "ready", rows: res.rows });
  }

  function finish(items: FinishInput["items"]) {
    setError(null);
    startSaving(async () => {
      const res = await actions.finishSetup({ businessId, name, subtypeCode, items });
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
      <OnboardingShell step={3} view="done">
        <StarterDone businessName={name.trim()} result={result} />
      </OnboardingShell>
    );
  }
  if (saving) return <SavingScreen message="Setting up your business…" />;

  if (step === 1) {
    const typeMissing = tried.type && !vertical;
    const subtypeMissing = tried.type && Boolean(vertical) && missingType;
    return (
      <OnboardingShell
        step={1}
        closeHref={closeHref}
        footer={
          <>
            <FooterSpacer />
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
        <StepHeading {...TYPE_HEADING} />

        <div
          role="radiogroup"
          aria-label="Industry"
          aria-invalid={typeMissing}
          tabIndex={-1}
          className="scroll-mt-24 outline-none"
        >
          {typeMissing && <FormMessage message="Choose your industry." className="mb-3" />}
          <div className="q-stagger flex flex-col gap-2">
            {verticals.map((v) => {
              const selected = v.code === verticalCode;
              return (
                <ChoiceCard
                  key={v.code}
                  selected={selected}
                  onClick={() => {
                    if (selected) return;
                    setVerticalCode(v.code);
                    setSubtypeCode(v.subtypes.length === 1 ? v.subtypes[0]!.code : "");
                  }}
                  media={<IconTile icon={verticalIcon(v.code)} active={selected} />}
                  title={v.label}
                  description={v.description ?? undefined}
                  className={cn("min-h-[68px]", typeMissing && "border-red-200")}
                />
              );
            })}
          </div>
        </div>

        {/* Qorelly shows a sub-type picker for hospitality only; Tally needs one for every vertical. */}
        {vertical && (
          <div key={vertical.code} className="q-rise mt-8">
            <StepSection title="What kind of business is it?">
              <p className="-mt-1 mb-3 text-[13px] text-gray-500">We use this to suggest the products shops like yours stock.</p>
              <div
                role="radiogroup"
                aria-label="Kind of business"
                aria-invalid={subtypeMissing}
                tabIndex={-1}
                className="scroll-mt-24 outline-none"
              >
                {subtypeMissing && <FormMessage message="Choose what kind of business it is." className="mb-3" />}
                <div className="grid gap-2 sm:grid-cols-2">
                  {vertical.subtypes.map((s) => {
                    const selected = s.code === subtypeCode;
                    return (
                      <ChoiceCard
                        key={s.code}
                        selected={selected}
                        onClick={() => setSubtypeCode(s.code)}
                        media={<IconTile icon={verticalIcon(vertical.code)} active={selected} className="h-9 w-9 [&_svg]:size-[18px]" />}
                        title={s.label}
                        className={cn("min-h-14", subtypeMissing && "border-red-200")}
                      />
                    );
                  })}
                </div>
              </div>
            </StepSection>
          </div>
        )}
      </OnboardingShell>
    );
  }

  if (step === 2) {
    const nameMissing = tried.details && missingName;
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
        <StepHeading title="What's your business called?" subtitle="This is the name you'll see across Tally." />

        {/* The type picked on step 1, with a way back to it. */}
        <div className="mb-8 flex items-center gap-3 rounded-[18px] bg-gray-100 p-3 pr-2">
          <IconTile icon={verticalIcon(vertical?.code)} active />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-medium text-gray-900">{subtype?.label}</p>
            <p className="truncate text-[13px] text-gray-500">{vertical?.label}</p>
          </div>
          <Button type="button" variant="quiet" size="lg" onClick={() => goTo(1)}>
            Change
          </Button>
        </div>

        <FieldLabel htmlFor="name">Business name</FieldLabel>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
          placeholder="e.g. Mama Nkechi Supermarket"
          maxLength={120}
          autoComplete="organization"
          aria-invalid={nameMissing}
          aria-describedby={nameMissing ? "name-error" : undefined}
        />
        {nameMissing && (
          <p id="name-error" role="alert" className="mt-2 text-[13px] text-red-600">
            Enter your business name.
          </p>
        )}
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
      view={review && ready ? "review" : "pick"}
      closeHref={businessId ? undefined : closeHref}
      summary={ready && !review ? keptSummary(rows, rowState) : undefined}
      footer={
        <>
          {back ? <BackButton onClick={back} /> : <FooterSpacer />}
          {review || !ready ? (
            <Button
              size="lg"
              className="max-sm:flex-1 sm:min-w-36"
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
            <LoadFailed
              title="We couldn't load suggested products"
              body={starter.error}
              onRetry={() => void loadStarter(subtypeCode)}
            />
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

/** /onboarding when the business types couldn't be read: an error with a retry, never an empty list. */
export function SetupLoadFailed({ closeHref }: { closeHref?: string }) {
  const router = useRouter();
  const [retrying, startRetry] = useTransition();
  return (
    <OnboardingShell step={1} closeHref={closeHref}>
      <StepHeading {...TYPE_HEADING} />
      <LoadFailed
        title="We couldn't load business types"
        body="Check your connection and try again."
        retrying={retrying}
        onRetry={() => startRetry(() => router.refresh())}
      />
    </OnboardingShell>
  );
}
