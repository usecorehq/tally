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
import { entrySummary, entryTitle } from "../entry-text";
import { formatDay, formatWhen, lagosDay } from "../format";
import { LoadFailed } from "../load-failed";
import { newHref, sessionHref } from "../urls";
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
  const href = sessionHref(businessId, e.id);
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-gray-50/70 focus-visible:bg-gray-50/70 focus-visible:outline-none">
      <IconTile icon={e.kind === "stocktake" ? "Stars" : "Gallery-Add"} active={e.status === "running"} className="h-10 w-10 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">{entryTitle(e)}</p>
        <p className="mt-0.5 break-words text-[13px] text-gray-500">
          {e.kind === "stocktake" ? "Stock-take" : "Quick scan"} · {entrySummary(e)}
        </p>
      </div>
      {/* When it ran, above its status: readable at a glance without the day heading. */}
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <time dateTime={e.startedAt} className="whitespace-nowrap text-xs tabular-nums text-gray-500">
          {formatWhen(e.startedAt)}
        </time>
        <Pill tone={status.tone}>{status.label}</Pill>
      </div>
      <SolarIcon name="Alt-Arrow-Right" iconStyle="Outline" size={16} className="shrink-0 text-gray-400 max-sm:hidden" />
    </Link>
  );
}

export function NewStocktakeButton({ href }: { href: string }) {
  return (
    <Button asChild>
      <Link href={href}>
        <SolarIcon name="Gallery-Add" iconStyle="Bold" size={16} />
        Take new stock
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
