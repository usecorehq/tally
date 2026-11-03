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
  cn,
  type PillTone,
} from "@tally/ui";
import { entrySummary, entryTitle } from "../entry-text";
import { formatDay, formatWhen, lagosDay } from "../format";
import { LoadFailed } from "../load-failed";
import { DiscardButton } from "../scan-actions";
import { newHref, sessionHref } from "../urls";
import type { HistoryEntry } from "../types";

export const HISTORY_TITLE = "Stock-take history";

const STATUS: Record<HistoryEntry["status"], { label: string; tone: PillTone }> = {
  running: { label: "Running", tone: "blue" },
  review: { label: "Ready to review", tone: "amber" },
  confirmed: { label: "Confirmed", tone: "green" },
  failed: { label: "Failed", tone: "red" },
  discarded: { label: "Discarded", tone: "gray" },
  superseded: { label: "Superseded", tone: "gray" },
};

/** Every stock-take and quick scan of one business, newest first and grouped by day. Presentational for /design. */
export function HistoryView({
  businesses,
  businessId,
  entries,
  error,
  onRetry,
  retrying = false,
  discard,
}: {
  businesses: { id: string; name: string }[];
  businessId: string;
  /** null while it failed to load. */
  entries: HistoryEntry[] | null;
  error?: string;
  onRetry: () => void;
  retrying?: boolean;
  /** /design passes a fixture instead of the server action. */
  discard?: Parameters<typeof DiscardButton>[0]["discard"];
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
            <SheetTable key={day} title={formatDay(lastActivity(rows[0]!))} count={rows.length}>
              <ul className="divide-y divide-gray-100">
                {rows.map((e) => (
                  <li key={e.id}>
                    <EntryRow entry={e} businessId={businessId} discard={discard} />
                    {/* Reruns of the same photo, nested like replies in a thread. */}
                    {(e.reruns ?? []).length > 0 && (
                      <ul className="ml-[3.25rem] border-l border-gray-100 pb-1.5">
                        {e.reruns!.map((x) => (
                          <li key={x.id}>
                            <EntryRow entry={x} businessId={businessId} discard={discard} rerun />
                          </li>
                        ))}
                      </ul>
                    )}
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

/** A group's newest run: a fresh rerun files the whole group under today. */
const lastActivity = (e: HistoryEntry) => [e, ...(e.reruns ?? [])].reduce((t, x) => (x.startedAt > t ? x.startedAt : t), e.startedAt);

function byDay(entries: HistoryEntry[]): [string, HistoryEntry[]][] {
  const groups = new Map<string, HistoryEntry[]>();
  for (const e of entries) {
    const day = lagosDay(lastActivity(e));
    groups.set(day, [...(groups.get(day) ?? []), e]);
  }
  return [...groups];
}

function EntryRow({
  entry: e,
  businessId,
  rerun = false,
  discard,
}: {
  entry: HistoryEntry;
  businessId: string;
  rerun?: boolean;
  discard?: Parameters<typeof DiscardButton>[0]["discard"];
}) {
  const empty = e.status === "review" && e.lines === 0;
  const status = empty ? { label: "Nothing found", tone: "gray" as const } : STATUS[e.status];
  const href = sessionHref(businessId, e.id);
  return (
    <div className="flex items-center pr-2 transition-colors hover:bg-gray-50/70">
      <Link
        href={href}
        className={cn("flex min-w-0 flex-1 items-center gap-3 py-3.5 pr-2 focus-visible:bg-gray-50/70 focus-visible:outline-none", rerun ? "pl-3" : "pl-4")}
      >
        {rerun ? (
          <IconTile icon="Refresh" active={e.status === "running"} className="h-8 w-8 shrink-0" />
        ) : (
          <IconTile icon={e.kind === "stocktake" ? "Stars" : "Gallery-Add"} active={e.status === "running"} className="h-10 w-10 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-900">{rerun ? "Rerun" : entryTitle(e)}</p>
          <p className="mt-0.5 break-words text-[13px] text-gray-500">
            {rerun ? entrySummary(e) : `${e.kind === "stocktake" ? "Stock-take" : "Quick scan"} · ${entrySummary(e)}`}
          </p>
        </div>
        {/* When it ran, above its status: readable at a glance without the day heading. */}
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <time dateTime={e.startedAt} className="whitespace-nowrap text-xs tabular-nums text-gray-500">
            {formatWhen(e.startedAt)}
          </time>
          <Pill tone={status.tone}>{status.label}</Pill>
        </div>
      </Link>
      {/* Outside the link: a button can't sit inside an anchor. */}
      {e.status === "review" && e.scanId ? (
        <DiscardButton businessId={businessId} scanId={e.scanId} compact discard={discard} />
      ) : (
        <span aria-hidden className="w-10 shrink-0 max-sm:hidden" />
      )}
    </div>
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
