"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Badge, Button, Checkbox, FormMessage, Input, Label, NativeSelect, QorellyLoader, Skeleton, SolarIcon, cn } from "@tally/ui";
import { NO_PROBLEMS, OWN, rowProblems, type RowProblems, type RowState, type StarterResult, type TemplateRow } from "../_lib/starter";
import { StepHeading } from "./onboarding-shell";

const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });

export const PICK_HEADING = {
  title: "Pick your starter items",
  subtitle: "Products shops like yours usually stock, with typical Nigerian prices. Keep what you sell and set your own price.",
};

/** The template items, grouped, each with keep / product / price / opening stock. */
export function StarterList({
  rows,
  state,
  attempted,
  invalidCount,
  onChange,
  listRef,
}: {
  rows: TemplateRow[];
  state: Record<string, RowState>;
  attempted: boolean;
  invalidCount: number;
  onChange: (key: string, patch: Partial<RowState>) => void;
  listRef: React.RefObject<HTMLDivElement | null>;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, TemplateRow[]>();
    for (const r of rows) map.set(r.groupLabel, [...(map.get(r.groupLabel) ?? []), r]);
    return [...map.entries()];
  }, [rows]);
  const kept = rows.filter((r) => state[r.key]!.keep).length;

  return (
    <>
      {attempted && invalidCount > 0 && (
        <FormMessage
          message={`${invalidCount} item${invalidCount === 1 ? " needs" : "s need"} a price or name.`}
          className="mb-6"
        />
      )}
      <p className="mb-6 text-[13px] text-gray-500">
        {kept} of {rows.length} kept
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
                  problems={attempted ? rowProblems(r, state[r.key]!) : NO_PROBLEMS}
                  onChange={(patch) => onChange(r.key, patch)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
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
  problems: RowProblems;
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

/** The confirm view: what will be stocked, before anything is saved. */
export function StarterReview({
  rows,
  state,
  businessName,
  error,
}: {
  rows: TemplateRow[];
  state: Record<string, RowState>;
  businessName: string;
  error: string | null;
}) {
  const kept = rows.filter((r) => state[r.key]!.keep);
  const skipped = rows.length - kept.length;
  return (
    <>
      <StepHeading
        title="Confirm your starter inventory"
        subtitle={`${kept.length} item${kept.length === 1 ? "" : "s"} for ${businessName}. You can change prices and stock any time.`}
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
        {skipped} item{skipped === 1 ? "" : "s"} skipped. Your choices help improve product suggestions for shops like
        yours.
      </p>
    </>
  );
}

/** Suggestions are slow the first time per sub-type (~5 s). */
export function StarterLoading() {
  return (
    <>
      <div className="mb-6 flex items-center gap-3 text-sm text-gray-500">
        <QorellyLoader className="h-5 w-5" />
        Finding products shops like yours stock. This takes a few seconds the first time.
      </div>
      <div className="space-y-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-none" />
        ))}
      </div>
    </>
  );
}

/** Qorelly's "Start fresh" card: finish without starter items. */
export function StartFreshCard({ onSkip, disabled }: { onSkip: () => void; disabled?: boolean }) {
  return (
    <div className="mt-8 flex items-center gap-3 rounded-card border border-gray-100 bg-gray-50 p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white">
        <SolarIcon name="Add-Circle" iconStyle="Outline" size={18} className="text-gray-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900">Start fresh</p>
        <p className="text-xs text-gray-400">Skip starter items and add your products manually after setup</p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onSkip} disabled={disabled} className="shrink-0">
        Skip & finish
      </Button>
    </div>
  );
}

export function StarterDone({ businessName, result }: { businessName: string; result: StarterResult }) {
  const added = result.created + result.skipped;
  return (
    <div className="flex flex-col items-center py-10 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-light text-primary">
        <SolarIcon name="Check-Circle" iconStyle="Bold" size={30} />
      </span>
      <h1 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">{businessName} is ready</h1>
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
  );
}
