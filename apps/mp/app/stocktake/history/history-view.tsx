"use client";

import Link from "next/link";
import {
  Button,
  EmptyState,
  FieldLabel,
  IconTile,
  NativeSelect,
  PageHeader,
  Pill,
  SheetTable,
  Skeleton,
  SolarIcon,
  Tray,
  TraySheet,
  type PillTone,
} from "@tally/ui";
import { formatDay, formatTime, lagosDay, plural } from "../format";
import { LoadFailed } from "../load-failed";
import { newHref, runHref, scanHref } from "../urls";
import type { HistoryEntry } from "../types";

export const HISTORY_TITLE = "Stock-take history";

const STATUS: Record<HistoryEntry["status"], { label: string; tone: PillTone }> = {
  running: { label: "Running", tone: "blue" },
  review: { label: "Ready to review", tone: "amber" },
  confirmed: { label: "Confirmed", tone: "green" },
  failed: { label: "Failed", tone: "red" },
};

/** Every stock-take and quick scan of one business, newest first and grouped by day. Presentational for /design. */
export function HistoryView({
  businesses,
  businessId,
  entries,
  error,
  onBusiness,
  onRetry,
  retrying = false,
}: {
  businesses: { id: string; name: string }[];
  businessId: string;
  /** null while it failed to load. */
  entries: HistoryEntry[] | null;
  error?: string;
  onBusiness: (id: string) => void;
  onRetry: () => void;
  retrying?: boolean;
}) {
  const business = businesses.find((b) => b.id === businessId);
  return (
    <div className="q-rise max-w-[880px]">
      <PageHeader
        title={HISTORY_TITLE}
        subtitle={business ? `Every stock-take for ${business.name}. Open one to finish it or see what was decided.` : undefined}
        className="[&_h1]:whitespace-normal"
        actions={<NewStocktakeButton href={newHref(businessId)} />}
      />

      {businesses.length > 1 && (
        <div className="mb-5 max-w-sm">
          <FieldLabel htmlFor="history-business">Business</FieldLabel>
          <NativeSelect id="history-business" value={businessId} onChange={(e) => onBusiness(e.target.value)}>
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}

      {entries === null ? (
        <LoadFailed title="We couldn't load your stock-takes" body={error ?? "Check your connection and try again."} onRetry={onRetry} retrying={retrying} />
      ) : entries.length === 0 ? (
        <Tray>
          <TraySheet className="p-0">
            <EmptyState
              icon="History"
              title="No stock-takes yet"
              body="Take a photo of a shelf and Tally counts and matches what's on it. Every stock-take is kept here."
              action={<NewStocktakeButton href={newHref(businessId)} />}
            />
          </TraySheet>
        </Tray>
      ) : (
        <div className="space-y-4">
          {byDay(entries).map(([day, rows]) => (
            <SheetTable key={day} title={formatDay(rows[0]!.startedAt)} count={rows.length}>
              <ul className="divide-y divide-gray-100">
                {rows.map((e) => (
                  <li key={e.id}>
                    <EntryRow entry={e} businessId={businessId} />
                  </li>
                ))}
              </ul>
            </SheetTable>
          ))}
        </div>
      )}
    </div>
  );
}

function byDay(entries: HistoryEntry[]): [string, HistoryEntry[]][] {
  const groups = new Map<string, HistoryEntry[]>();
  for (const e of entries) {
    const day = lagosDay(e.startedAt);
    groups.set(day, [...(groups.get(day) ?? []), e]);
  }
  return [...groups];
}

function EntryRow({ entry: e, businessId }: { entry: HistoryEntry; businessId: string }) {
  const empty = e.status === "review" && e.lines === 0;
  const status = empty ? { label: "Nothing found", tone: "gray" as const } : STATUS[e.status];
  const href = e.runId ? runHref(businessId, e.runId) : scanHref(businessId, e.scanId!);
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-gray-50/70 focus-visible:bg-gray-50/70 focus-visible:outline-none">
      <IconTile icon={e.kind === "stocktake" ? "Stars" : "Gallery-Add"} active={e.status === "running"} className="h-10 w-10 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900">
          {e.kind === "stocktake" ? "Stock-take" : "Quick scan"} <span className="font-normal tabular-nums text-gray-500">· {formatTime(e.startedAt)}</span>
        </p>
        <p className="mt-0.5 break-words text-[13px] text-gray-500">{summary(e)}</p>
      </div>
      <Pill tone={status.tone} className="shrink-0">
        {status.label}
      </Pill>
      <SolarIcon name="Alt-Arrow-Right" iconStyle="Outline" size={16} className="shrink-0 text-gray-400 max-sm:hidden" />
    </Link>
  );
}

/** One line under the entry: what it found, or what was decided. */
function summary(e: HistoryEntry): string {
  if (e.status === "running") return "The agent is still working on it";
  if (e.status === "failed") return e.error ?? "It stopped before finishing";
  const lines = plural(e.lines ?? 0, "line");
  if (e.status === "review") {
    if (e.lines === 0) return "No products found in the photo";
    const left = (e.lines ?? 0) - Object.values(e.decided).reduce((a, b) => a + b, 0);
    return `${lines}, ${left} to confirm${e.fallback ? " · first pass only" : ""}`;
  }
  const parts = (
    [
      ["added", e.decided.add],
      ["restocked", e.decided.restock],
      ["restored", e.decided.restore],
      ["skipped", e.decided.skip],
    ] as const
  )
    .filter(([, n]) => n > 0)
    .map(([word, n]) => `${n} ${word}`);
  return [lines, ...parts].join(" · ");
}

export function NewStocktakeButton({ href }: { href: string }) {
  return (
    <Button asChild>
      <Link href={href}>
        <SolarIcon name="Gallery-Add" iconStyle="Bold" size={16} />
        New stock-take
      </Link>
    </Button>
  );
}

/** Holds the history's shape while it loads. */
export function HistorySkeleton() {
  return (
    <div className="max-w-[880px]" aria-busy="true" aria-label="Loading stock-take history">
      <PageHeader title={HISTORY_TITLE} className="[&_h1]:whitespace-normal" actions={<Skeleton className="h-10 w-40 rounded-xl" />} />
      <Tray>
        <Skeleton className="mx-3 mb-3 mt-2 h-4 w-24" />
        <TraySheet className="divide-y divide-gray-100 p-0">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5">
              <Skeleton className="h-10 w-10 rounded-[10px]" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3.5 w-64 max-w-full" />
              </div>
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
          ))}
        </TraySheet>
      </Tray>
    </div>
  );
}
