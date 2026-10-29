"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Button, Checkbox, FormMessage, IconTile, Input, NativeSelect, Pill, QorellyLoader, SheetTable, Skeleton, SolarIcon, cn } from "@tally/ui";
import { NO_PROBLEMS, OWN, rowProblems, type RowProblems, type RowState, type StarterResult, type TemplateRow } from "../_lib/starter";
import { StepHeading } from "./onboarding-shell";

const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });
// Field labels show above each field on phones; on wider screens one column header per group carries them.
const SMALL_LABEL = "mb-1.5 block text-xs text-gray-500 sm:sr-only";
// The row's fields, and the group's column header above them, share one grid so they line up.
const FIELD_GRID = "grid grid-cols-2 gap-x-3 gap-y-2 pl-8 sm:grid-cols-[minmax(0,1fr)_8.5rem_6.5rem]";
const COMPACT_FIELD = "h-10 text-[14px]";

export const PICK_HEADING = {
  title: "Pick your starter items",
  subtitle: "Products shops like yours usually stock, with typical Nigerian prices. Keep what you stock and set your own price.",
};

/** The footer line while picking: how many rows are kept. */
export function keptSummary(rows: TemplateRow[], state: Record<string, RowState>) {
  const kept = rows.filter((r) => state[r.key]?.keep).length;
  return (
    <span>
      <span className="font-medium tabular-nums text-gray-900">{kept}</span> of <span className="tabular-nums">{rows.length}</span> items kept
    </span>
  );
}

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

  return (
    <>
      {attempted && invalidCount > 0 && (
        <FormMessage
          message={`${invalidCount} item${invalidCount === 1 ? " needs" : "s need"} a price or name. They're marked in red below.`}
          className="mb-6"
        />
      )}

      <div ref={listRef} className="q-stagger space-y-4">
        {groups.map(([label, groupRows]) => {
          const kept = groupRows.filter((r) => state[r.key]!.keep).length;
          return (
            <SheetTable key={label} title={label} caption={`${kept} of ${groupRows.length} kept`}>
              {/* Column header for the fields (wider screens); each field keeps its own label for screen readers. */}
              <div aria-hidden className={cn(FIELD_GRID, "px-4 pb-2 pl-12 pt-3 text-[13px] text-gray-500 max-sm:hidden")}>
                <span>Product</span>
                <span>Your price</span>
                <span>In stock</span>
              </div>
              <div className="sm:border-t sm:border-gray-100">
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
            </SheetTable>
          );
        })}
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
  const problemText = [
    problems.name && "Enter a product name.",
    problems.price && (state.price.trim() ? "Enter a price like 1500." : "Enter a price."),
    problems.opening && "Enter stock as a number.",
  ]
    .filter(Boolean)
    .join(" ");
  const describedBy = problemText ? `${id}-problem` : undefined;
  return (
    <div
      data-row={row.key}
      className={cn("border-t border-gray-100 px-4 first:border-t-0", state.keep ? "pb-3 pt-0.5" : "bg-gray-50/70 py-0.5")}
    >
      <div className="flex min-h-11 items-center gap-3 py-1">
        {/* The whole name is the hit area for the checkbox. */}
        <label htmlFor={`${id}-keep`} className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3">
          <Checkbox
            id={`${id}-keep`}
            checked={state.keep}
            onCheckedChange={(v) => onChange({ keep: v === true })}
            className="dark:border-gray-400"
          />
          <span className="min-w-0 flex-1">
            <span className={cn("block break-words text-[15px] font-medium leading-5", state.keep ? "text-gray-900" : "text-gray-500")}>
              {row.templateName}
            </span>
            {!state.keep && suggested && <span className="block break-words text-[13px] text-gray-500">e.g. {suggested.name}</span>}
            {!state.keep && !suggested && <span className="block text-[13px] text-gray-500">Tick to add your own product</span>}
          </span>
        </label>
        {state.keep && state.choice !== OWN && state.choice === suggested?.qid && (
          <Pill tone="violet" dot={false} className="max-sm:hidden">
            Suggested
          </Pill>
        )}
      </div>

      {state.keep && (
        <div className={FIELD_GRID}>
          <div className="col-span-2 min-w-0 space-y-2 sm:col-span-1">
            {/* The select shows a product name, so the label is for screen readers only. */}
            <label htmlFor={`${id}-product`} className="sr-only">
              Product
            </label>
            <NativeSelect
              id={`${id}-product`}
              value={state.choice}
              className={COMPACT_FIELD}
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
                aria-describedby={problems.name ? describedBy : undefined}
                className={COMPACT_FIELD}
              />
            )}
          </div>
          <div className="min-w-0">
            <label htmlFor={`${id}-price`} className={SMALL_LABEL}>
              Your price
            </label>
            <div className="relative">
              <span aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] text-gray-500">
                ₦
              </span>
              <Input
                id={`${id}-price`}
                inputMode="decimal"
                placeholder="0"
                value={state.price}
                onChange={(e) => onChange({ price: e.target.value.replace(/[^\d.]/g, "") })}
                aria-invalid={problems.price}
                aria-describedby={problems.price ? describedBy : undefined}
                className={cn(COMPACT_FIELD, "pl-8 tabular-nums")}
              />
            </div>
          </div>
          <div className="min-w-0">
            <label htmlFor={`${id}-stock`} className={SMALL_LABEL}>
              In stock
            </label>
            <Input
              id={`${id}-stock`}
              inputMode="decimal"
              placeholder="0"
              value={state.opening}
              onChange={(e) => onChange({ opening: e.target.value.replace(/[^\d.]/g, "") })}
              aria-invalid={problems.opening}
              aria-describedby={problems.opening ? describedBy : undefined}
              className={cn(COMPACT_FIELD, "tabular-nums")}
            />
          </div>
        </div>
      )}
      {state.keep && problemText && (
        <p id={describedBy} className="mt-2 pl-8 text-[13px] text-red-600">
          {problemText}
        </p>
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
        <SheetTable
          title="Going into your inventory"
          count={kept.length}
          footer={
            <span>
              {skipped} item{skipped === 1 ? "" : "s"} skipped
            </span>
          }
        >
          <ul>
            {kept.map((r) => {
              const s = state[r.key]!;
              const name = s.choice === OWN ? s.ownName.trim() : r.candidates.find((c) => c.qid === s.choice)?.name;
              return (
                <li key={r.key} className="flex items-start gap-4 border-t border-gray-100 px-4 py-3 first:border-t-0">
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-[15px] font-medium leading-5 text-gray-900">{name}</p>
                    <p className="mt-0.5 truncate text-[13px] text-gray-500">{r.templateName}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[15px] font-medium tabular-nums text-gray-900">{naira.format(Number(s.price))}</p>
                    <p className="mt-0.5 text-[13px] tabular-nums text-gray-500">
                      {s.opening.trim() ? `${s.opening} in stock` : "No opening stock"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </SheetTable>
      )}
      <p className="mt-4 px-1 text-[13px] text-gray-500">
        {kept.length === 0 && `${skipped} item${skipped === 1 ? "" : "s"} skipped. `}Your choices help improve product suggestions for
        shops like yours.
      </p>
    </>
  );
}

/** Suggestions are slow the first time per sub-type (~5 s). */
export function StarterLoading() {
  return (
    <div aria-busy="true">
      <div className="mb-4 flex items-center gap-3 rounded-[14px] bg-gray-100 px-4 py-3 text-[13px] text-gray-600">
        <QorellyLoader className="h-5 w-5 shrink-0 text-primary" />
        Finding products shops like yours stock. This takes a few seconds the first time.
      </div>
      <div className="space-y-4">
        {[3, 2].map((n, g) => (
          <div key={g} className="rounded-[18px] bg-gray-100 p-1">
            <Skeleton className="mx-3 mb-3 mt-3.5 h-4 w-28 bg-gray-200" />
            <div className="rounded-[14px] bg-surface ring-1 ring-hairline/[0.04]">
              {Array.from({ length: n }, (_, i) => (
                <div key={i} className="border-t border-gray-100 px-4 pb-3 pt-0.5 first:border-t-0">
                  <div className="flex min-h-11 items-center gap-3 py-1">
                    <Skeleton className="h-5 w-5 rounded-md" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <div className={FIELD_GRID}>
                    <Skeleton className="col-span-2 h-10 rounded-[14px] sm:col-span-1" />
                    <Skeleton className="h-10 rounded-[14px]" />
                    <Skeleton className="h-10 rounded-[14px]" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Qorelly's "Start fresh" card: finish without starter items. */
export function StartFreshCard({ onSkip, disabled }: { onSkip: () => void; disabled?: boolean }) {
  return (
    <div className="mt-8 flex flex-wrap items-center gap-3 rounded-[18px] bg-gray-100 p-3 sm:flex-nowrap">
      <IconTile icon="Add-Circle" className="bg-surface text-gray-500" />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium text-gray-900">Start fresh</p>
        <p className="text-[13px] text-gray-500">Skip starter items and add your products after setup.</p>
      </div>
      <Button type="button" variant="quiet" size="lg" onClick={onSkip} disabled={disabled} className="max-sm:w-full">
        Skip & finish
      </Button>
    </div>
  );
}

export function StarterDone({ businessName, result }: { businessName: string; result: StarterResult }) {
  const added = result.created + result.skipped;
  return (
    <div className="q-rise flex flex-col items-center py-10 text-center sm:py-16">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-light text-primary">
        <SolarIcon name="Check-Circle" iconStyle="Bold" size={32} />
      </span>
      <h1 className="mt-6 text-[24px] font-medium leading-tight tracking-tight text-gray-900 sm:text-[28px]">{businessName} is ready</h1>
      <p className="mt-1.5 text-[14px] text-gray-500">
        {added} product{added === 1 ? "" : "s"} in your inventory
        {result.skipped > 0 ? ` (${result.skipped} already there)` : ""}.
      </p>
      {result.invalid.length > 0 && (
        <FormMessage
          variant="warning"
          className="mt-6 w-full max-w-md text-left"
          message={`${result.invalid.length} item${result.invalid.length === 1 ? " wasn't" : "s weren't"} added. You can add ${result.invalid.length === 1 ? "it" : "them"} from your inventory.`}
        />
      )}
      <Button asChild size="lg" className="mt-8 max-sm:w-full sm:min-w-48">
        <Link href="/">
          Go to dashboard
          <SolarIcon name="Alt-Arrow-Right" iconStyle="Outline" size={16} />
        </Link>
      </Button>
    </div>
  );
}
