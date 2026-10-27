"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  Checkbox,
  FormMessage,
  Input,
  Label,
  NativeSelect,
  QorellyLoader,
  SolarIcon,
  cn,
} from "@tally/ui";
import { OnboardingShell, StepHeading } from "../../_components/onboarding-shell";
import { submitStarter, type StarterItemInput, type StarterResult } from "./actions";

export type Candidate = {
  qid: string;
  name: string;
  variantLabel: string | null;
  sizeValue: number | null;
  sizeUnit: string | null;
  packQty: number;
  categoryPath: string;
  score: number;
  priceMedian: number | null;
};

export type TemplateRow = {
  key: string;
  groupLabel: string;
  templateName: string;
  candidates: Candidate[];
};

type RowState = { keep: boolean; choice: string; ownName: string; price: string; opening: string };

const OWN = "own";
const NAIRA = /^\d{1,10}(\.\d{1,2})?$/;
const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });

function initialState(row: TemplateRow): RowState {
  const first = row.candidates[0];
  return {
    // Suggested items start kept; items with nothing to suggest start off (they need a name and price).
    keep: Boolean(first),
    choice: first ? first.qid : OWN,
    ownName: "",
    price: first?.priceMedian != null ? String(first.priceMedian) : "",
    opening: "",
  };
}

function rowProblems(row: TemplateRow, s: RowState) {
  if (!s.keep) return { name: false, price: false, opening: false };
  const opening = s.opening.trim();
  return {
    name: s.choice === OWN && s.ownName.trim().length === 0,
    price: !NAIRA.test(s.price.trim()),
    opening: opening !== "" && !(Number(opening) >= 0 && /^\d+(\.\d{1,3})?$/.test(opening)),
  };
}

function toStarterItem(row: TemplateRow, s: RowState): StarterItemInput {
  const suggested = row.candidates[0];
  const base = { clientRef: row.key, templateItemName: row.templateName };
  if (!s.keep) return { ...base, outcome: "removed", ...(suggested && { suggestedQid: suggested.qid }) };

  const price = s.price.trim();
  const openingQuantity = s.opening.trim() === "" ? undefined : Number(s.opening);
  if (s.choice === OWN) {
    return {
      ...base,
      outcome: "new_item",
      ...(suggested && { suggestedQid: suggested.qid, suggestedScore: Math.min(1, suggested.score) }),
      name: s.ownName.trim(),
      price,
      openingQuantity,
    };
  }
  const picked = row.candidates.find((c) => c.qid === s.choice)!;
  const accepted = picked.qid === suggested?.qid;
  return {
    ...base,
    outcome: accepted ? "accepted" : "corrected",
    suggestedQid: suggested!.qid,
    ...(suggested!.score > 0 && { suggestedScore: Math.min(1, suggested!.score) }),
    ...(!accepted && { qid: picked.qid }),
    name: picked.name,
    variantLabel: picked.variantLabel ?? undefined,
    sizeValue: picked.sizeValue ?? undefined,
    sizeUnit: picked.sizeUnit ?? undefined,
    packQty: picked.packQty,
    categoryPath: picked.categoryPath,
    price,
    openingQuantity,
  };
}

export function ItemsWizard({ business, rows }: { business: { id: string; name: string }; rows: TemplateRow[] }) {
  const [state, setState] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(rows.map((r) => [r.key, initialState(r)])),
  );
  const [step, setStep] = useState<2 | 3>(2);
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StarterResult | null>(null);
  const [pending, startTransition] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => {
    const map = new Map<string, TemplateRow[]>();
    for (const r of rows) map.set(r.groupLabel, [...(map.get(r.groupLabel) ?? []), r]);
    return [...map.entries()];
  }, [rows]);

  const kept = rows.filter((r) => state[r.key]!.keep);
  const invalidKeys = rows.filter((r) => Object.values(rowProblems(r, state[r.key]!)).some(Boolean)).map((r) => r.key);
  const update = (key: string, patch: Partial<RowState>) =>
    setState((prev) => ({ ...prev, [key]: { ...prev[key]!, ...patch } }));

  if (result) return <Done business={business} result={result} />;

  if (pending) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white">
        <QorellyLoader className="h-8 w-8" />
        <p className="text-sm text-gray-500">Setting up your inventory…</p>
      </div>
    );
  }

  if (step === 3) {
    return (
      <OnboardingShell
        step={3}
        footer={
          <>
            <Button variant="secondary" size="cta" onClick={() => setStep(2)}>
              <SolarIcon name="Alt-Arrow-Left" iconStyle="Outline" size={18} />
              Back
            </Button>
            <Button
              size="cta"
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
              <SolarIcon name="Alt-Arrow-Right" iconStyle="Outline" size={18} />
            </Button>
          </>
        }
      >
        <StepHeading
          title="Confirm your starter inventory"
          subtitle={`${kept.length} item${kept.length === 1 ? "" : "s"} for ${business.name}. You can change prices and stock any time.`}
        />
        <FormMessage message={error} className="mb-6" />
        {kept.length === 0 ? (
          <FormMessage
            variant="info"
            message="You haven't kept any items. You can add products later, or go back and pick some."
          />
        ) : (
          <ul className="divide-y divide-gray-100 border border-gray-200">
            {kept.map((r) => {
              const s = state[r.key]!;
              const name = s.choice === OWN ? s.ownName.trim() : r.candidates.find((c) => c.qid === s.choice)?.name;
              return (
                <li key={r.key} className="flex items-center gap-4 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-gray-900">{name}</p>
                    <p className="text-[13px] text-gray-500">{r.templateName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[15px] font-medium tabular-nums">{naira.format(Number(s.price))}</p>
                    <p className="text-[13px] tabular-nums text-gray-500">
                      {s.opening.trim() ? `${s.opening} in stock` : "No opening stock"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-4 text-[13px] text-gray-500">
          {rows.length - kept.length} item{rows.length - kept.length === 1 ? "" : "s"} skipped. Your choices help
          improve product suggestions for shops like yours.
        </p>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell
      step={2}
      footer={
        <>
          <Button variant="secondary" size="cta" asChild>
            <Link href="/onboarding">
              <SolarIcon name="Alt-Arrow-Left" iconStyle="Outline" size={18} />
              Back
            </Link>
          </Button>
          <Button
            size="cta"
            onClick={() => {
              // Qorelly rule: Continue stays enabled; pressing it flags what's missing.
              setAttempted(true);
              if (invalidKeys.length > 0) {
                listRef.current
                  ?.querySelector(`[data-row="${CSS.escape(invalidKeys[0]!)}"]`)
                  ?.scrollIntoView({ behavior: "smooth", block: "center" });
                return;
              }
              setStep(3);
              window.scrollTo({ top: 0 });
            }}
          >
            Continue
            <SolarIcon name="Alt-Arrow-Right" iconStyle="Outline" size={18} />
          </Button>
        </>
      }
    >
      <StepHeading
        title="Pick your starter items"
        subtitle="Products shops like yours usually stock, with typical Nigerian prices. Keep what you sell and set your own price."
      />
      {attempted && invalidKeys.length > 0 && (
        <FormMessage
          message={`${invalidKeys.length} item${invalidKeys.length === 1 ? " needs" : "s need"} a price or name.`}
          className="mb-6"
        />
      )}
      <p className="mb-6 text-[13px] text-gray-500">
        {kept.length} of {rows.length} kept
      </p>

      <div ref={listRef} className="space-y-8">
        {groups.map(([label, groupRows]) => (
          <section key={label}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">{label}</h2>
            <div className="divide-y divide-gray-100 border border-gray-200">
              {groupRows.map((r) => (
                <ItemRow
                  key={r.key}
                  row={r}
                  state={state[r.key]!}
                  problems={attempted ? rowProblems(r, state[r.key]!) : { name: false, price: false, opening: false }}
                  onChange={(patch) => update(r.key, patch)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </OnboardingShell>
  );
}

function ItemRow({
  row,
  state,
  problems,
  onChange,
}: {
  row: TemplateRow;
  state: RowState;
  problems: { name: boolean; price: boolean; opening: boolean };
  onChange: (patch: Partial<RowState>) => void;
}) {
  const id = row.key.replace(/[^a-z0-9]/gi, "-");
  const suggested = row.candidates[0];
  return (
    <div data-row={row.key} className={cn("px-4 py-4", !state.keep && "bg-gray-50")}>
      <div className="flex items-start gap-3">
        <Checkbox
          id={`${id}-keep`}
          checked={state.keep}
          onCheckedChange={(v) => onChange({ keep: v === true })}
          className="mt-0.5"
        />
        <div className="min-w-0 flex-1">
          <Label htmlFor={`${id}-keep`} className={cn("text-[15px]", !state.keep && "text-gray-500")}>
            {row.templateName}
          </Label>
          {!state.keep && suggested && <p className="mt-1 truncate text-[13px] text-gray-400">e.g. {suggested.name}</p>}
        </div>
        {state.keep && state.choice !== OWN && state.choice === suggested?.qid && (
          <Badge variant="secondary">Suggested</Badge>
        )}
      </div>

      {state.keep && (
        <div className="mt-3 grid grid-cols-1 gap-3 pl-8 sm:grid-cols-[minmax(0,1fr)_8rem_6rem]">
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-product`} className="text-xs text-gray-500">
              Product
            </Label>
            <NativeSelect
              id={`${id}-product`}
              value={state.choice}
              onChange={(e) => {
                const next = row.candidates.find((c) => c.qid === e.target.value);
                onChange({
                  choice: e.target.value,
                  ...(next?.priceMedian != null && { price: String(next.priceMedian) }),
                });
              }}
            >
              {row.candidates.map((c) => (
                <option key={c.qid} value={c.qid}>
                  {c.name}
                  {c.priceMedian != null ? ` · ~${naira.format(c.priceMedian)}` : ""}
                </option>
              ))}
              <option value={OWN}>My own product…</option>
            </NativeSelect>
            {state.choice === OWN && (
              <Input
                aria-label="Product name"
                placeholder={`Name, e.g. ${row.templateName}`}
                value={state.ownName}
                onChange={(e) => onChange({ ownName: e.target.value })}
                maxLength={200}
                aria-invalid={problems.name}
              />
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-price`} className="text-xs text-gray-500">
              Your price (₦)
            </Label>
            <Input
              id={`${id}-price`}
              inputMode="decimal"
              value={state.price}
              onChange={(e) => onChange({ price: e.target.value.replace(/[^\d.]/g, "") })}
              aria-invalid={problems.price}
              className="tabular-nums"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-stock`} className="text-xs text-gray-500">
              In stock
            </Label>
            <Input
              id={`${id}-stock`}
              inputMode="decimal"
              placeholder="0"
              value={state.opening}
              onChange={(e) => onChange({ opening: e.target.value.replace(/[^\d.]/g, "") })}
              aria-invalid={problems.opening}
              className="tabular-nums"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Done({ business, result }: { business: { name: string }; result: StarterResult }) {
  const added = result.created + result.skipped;
  return (
    <OnboardingShell step={3}>
      <div className="flex flex-col items-center py-10 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-light text-primary">
          <SolarIcon name="Check-Circle" iconStyle="Bold" size={30} />
        </span>
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">{business.name} is ready</h1>
        <p className="mt-2 text-base text-gray-500">
          {added} product{added === 1 ? "" : "s"} in your inventory
          {result.skipped > 0 ? ` (${result.skipped} already there)` : ""}.
        </p>
        {result.invalid.length > 0 && (
          <FormMessage
            variant="warning"
            className="mt-6 text-left"
            message={`${result.invalid.length} item${result.invalid.length === 1 ? " wasn't" : "s weren't"} added. You can add ${result.invalid.length === 1 ? "it" : "them"} from your inventory.`}
          />
        )}
        <Button asChild size="cta" className="mt-8">
          <Link href="/">Go to dashboard</Link>
        </Button>
      </div>
    </OnboardingShell>
  );
}
