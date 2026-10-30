"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Skeleton, SolarIcon, cn } from "@tally/ui";
import { recentStocktakes } from "./actions";
import { entryTitle, flatEntries } from "./entry-text";
import { formatWhen } from "./format";
import { historyHref, newHref, sessionHref } from "./urls";
import type { HistoryEntry } from "./types";

/** Fired after a confirm, so the recents pick up the new status without a navigation. */
export const STOCKTAKE_CHANGED = "tally:stocktake-changed";
const POLL_MS = 5000;

type Loaded = { businessId: string; entries: HistoryEntry[] } | "failed" | null;

/** The sidebar's stock-take section on /stocktake pages: "Take new stock" and the recent sessions, like a chat list. */
export function StocktakeRecents() {
  const pathname = usePathname();
  const business = useSearchParams().get("business");
  const [data, setData] = useState<Loaded>(null);
  const [tick, setTick] = useState(0);
  const shown = pathname === "/stocktake" || pathname.startsWith("/stocktake/");

  useEffect(() => {
    if (!shown) return;
    let alive = true;
    recentStocktakes(business).then((res) => alive && setData(res.ok ? res.data : "failed"));
    return () => {
      alive = false;
    };
  }, [shown, business, pathname, tick]);

  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    window.addEventListener(STOCKTAKE_CHANGED, bump);
    return () => window.removeEventListener(STOCKTAKE_CHANGED, bump);
  }, []);

  // A running entry changes on its own: refresh until it settles.
  const running = data && data !== "failed" && flatEntries(data.entries).some((e) => e.status === "running");
  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => setTick((n) => n + 1), POLL_MS);
    return () => clearTimeout(t);
  }, [running, data]);

  if (!shown) return null;
  const active = /^\/stocktake\/history\/([^/]+)$/.exec(pathname)?.[1] ?? null;
  return <RecentsList data={data} active={active} onRetry={() => setTick((n) => n + 1)} newActive={pathname === "/stocktake"} />;
}

/** Presentational, so /design can render it with fixtures. */
export function RecentsList({
  data,
  active,
  newActive,
  onRetry,
}: {
  data: Loaded;
  active: string | null;
  newActive: boolean;
  onRetry: () => void;
}) {
  const businessId = data && data !== "failed" ? data.businessId : null;
  return (
    <div className="mt-4 flex min-h-0 flex-1 flex-col border-t border-gray-200 pt-4">
      <Link
        href={businessId ? newHref(businessId) : "/stocktake"}
        aria-current={newActive ? "page" : undefined}
        className={cn(
          "flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
          newActive ? "bg-surface text-gray-900 ring-1 ring-hairline/[0.06]" : "text-gray-600 hover:bg-gray-200/60 hover:text-gray-900",
        )}
      >
        <SolarIcon name="Add-Circle" iconStyle={newActive ? "Fill" : "Outline"} size={20} className={newActive ? "text-primary" : undefined} />
        Take new stock
      </Link>

      <div className="mt-4 flex items-center justify-between px-3 pb-1.5">
        <p className="text-[13px] text-gray-500">Recents</p>
        {businessId && (
          <Link href={historyHref(businessId)} className="text-[13px] text-gray-500 hover:text-gray-900">
            All
          </Link>
        )}
      </div>

      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
        {data === null ? (
          <div className="space-y-2 px-3 py-1" aria-busy="true" aria-label="Loading recent stock-takes">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        ) : data === "failed" ? (
          <div className="px-3 text-[13px] text-gray-500">
            Couldn&apos;t load your stock-takes.{" "}
            <button type="button" onClick={onRetry} className="font-medium text-gray-900 underline-offset-2 hover:underline">
              Try again
            </button>
          </div>
        ) : data.entries.length === 0 ? (
          <p className="px-3 text-[13px] text-gray-500">No stock-takes yet. Each one you take is kept here.</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {flatEntries(data.entries).map((e) => {
              const on = active === e.id;
              return (
                <li key={e.id}>
                  <Link
                    href={sessionHref(data.businessId, e.id)}
                    aria-current={on ? "page" : undefined}
                    title={`${entryTitle(e)} · ${formatWhen(e.startedAt)}`}
                    className={cn(
                      "flex items-start gap-2 rounded-xl px-3 py-2 text-sm transition-colors",
                      on ? "bg-surface text-gray-900 ring-1 ring-hairline/[0.06]" : "text-gray-700 hover:bg-gray-200/60 hover:text-gray-900",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{entryTitle(e)}</span>
                      <span className="block truncate text-xs tabular-nums text-gray-500">
                        {e.rerunOf ? "Rerun · " : ""}
                        {formatWhen(e.startedAt)}
                      </span>
                    </span>
                    {/* Only the states that need the merchant get a mark. */}
                    {e.status === "running" && <span aria-label="Running" className="mt-1.5 size-2 shrink-0 animate-pulse rounded-full bg-primary" />}
                    {e.status === "review" && (e.lines ?? 0) > 0 && <span aria-label="Ready to review" className="mt-1.5 size-2 shrink-0 rounded-full bg-amber-500" />}
                    {e.status === "failed" && <span aria-label="Failed" className="mt-1.5 size-2 shrink-0 rounded-full bg-red-500" />}
                    {e.status === "confirmed" && <span aria-label="Confirmed" className="mt-1.5 size-2 shrink-0 rounded-full bg-emerald-500" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
