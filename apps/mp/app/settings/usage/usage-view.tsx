"use client";

import { EmptyState, Pill, SheetTable, Skeleton, SolarIcon, TraySection, TrayTile, cn } from "@tally/ui";
import { SectionFailed } from "../_components/settings-parts";
import { formatBucket, formatCount } from "../_lib/format";
import type { Usage } from "../_lib/types";

/** Today's stock-takes against the plan's daily limit. Amber near the limit, red at it: colour only for meaning. */
function Meter({ used, limit }: { used: number | null; limit: number | null }) {
  const ratio = used != null && limit ? Math.min(used / limit, 1) : 0;
  const tone = ratio >= 1 ? "bg-red-500" : ratio >= 0.8 ? "bg-amber-500" : "bg-primary";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-3xl font-medium leading-none tracking-tight tabular-nums text-gray-900">
          {formatCount(used)}
          <span className="text-lg text-gray-400"> / {formatCount(limit)}</span>
        </p>
        {used != null && limit != null && (
          <p className="text-sm text-gray-500">{used >= limit ? "Limit reached" : `${(limit - used).toLocaleString("en-NG")} left today`}</p>
        )}
      </div>
      <div
        role="meter"
        aria-label="Stock-takes today"
        aria-valuemin={0}
        aria-valuemax={limit ?? 0}
        aria-valuenow={used ?? 0}
        className="h-2.5 overflow-hidden rounded-full bg-gray-100"
      >
        <div className={cn("h-full rounded-full transition-[width]", tone)} style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}

/** 30 daily bars, stock-takes stacked on quick scans. Plain divs: no chart dependency. */
function DailyChart({ daily }: { daily: Usage["daily"] }) {
  const max = Math.max(1, ...daily.map((d) => d.stocktakes + d.scans));
  const total = daily.reduce((n, d) => n + d.stocktakes + d.scans, 0);
  if (total === 0) return <EmptyState icon="Chart" title="Nothing in the last 30 days" body="Stock-takes and quick scans will show here as they happen." className="py-10" />;
  const ticks = [0, Math.floor((daily.length - 1) / 2), daily.length - 1];
  return (
    <figure className="flex flex-col gap-3">
      <div className="flex items-center gap-4 text-[13px] text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px] bg-primary" /> Stock-takes
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px] bg-gray-300" /> Quick scans
        </span>
        <span className="ml-auto tabular-nums">Peak {max.toLocaleString("en-NG")}</span>
      </div>
      <div className="flex h-40 items-end gap-[3px] border-b border-gray-200" role="img" aria-label={`Daily stock-takes and quick scans, ${daily.length} days`}>
        {daily.map((d) => {
          const sum = d.stocktakes + d.scans;
          return (
            <div
              key={d.date}
              title={`${formatBucket(d.date)}: ${d.stocktakes} stock-takes, ${d.scans} quick scans`}
              className="flex h-full min-w-0 flex-1 flex-col justify-end"
            >
              <div className="flex flex-col overflow-hidden rounded-t-[3px]" style={{ height: `${(sum / max) * 100}%` }}>
                <div className="bg-gray-300" style={{ flexGrow: d.scans }} />
                <div className="bg-primary" style={{ flexGrow: d.stocktakes }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="relative h-4 text-[12px] text-gray-500">
        {ticks.map((i, k) => (
          <span
            key={i}
            className={cn("absolute top-0 tabular-nums", k === 0 ? "left-0" : k === 2 ? "right-0" : "left-1/2 -translate-x-1/2")}
          >
            {daily[i] ? formatBucket(daily[i].date) : ""}
          </span>
        ))}
      </div>
    </figure>
  );
}

/** Usage for one business: today against the plan, this month, 30 days, and which apps ran what. null = the read failed. */
export function UsageView({ usage }: { usage: Usage | null }) {
  const sources = usage ? [...usage.by_source].sort((a, b) => b.stocktakes - a.stocktakes) : [];
  const sourceTotal = sources.reduce((n, s) => n + s.stocktakes, 0);
  const tokens = usage ? usage.month.input_tokens + usage.month.output_tokens : null;
  return (
    <div className="flex flex-col gap-4">
      <TraySection
        title="Today"
        caption={
          usage ? (
            <span className="flex items-center gap-2">
              {usage.plan.name} plan{usage.plan.simulated && <Pill tone="violet" dot={false}>Simulated</Pill>}
            </span>
          ) : undefined
        }
      >
        <Meter used={usage?.today.stocktakes ?? null} limit={usage?.plan.daily_stocktake_limit ?? null} />
        <p className="mt-3 text-sm text-gray-500">
          {formatCount(usage?.today.scans)} {usage?.today.scans === 1 ? "quick scan" : "quick scans"} today · up to{" "}
          {formatCount(usage?.plan.max_concurrent_runs)} running at once
        </p>
      </TraySection>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <TrayTile label="Stock-takes this month" value={formatCount(usage?.month.stocktakes)} icon={<SolarIcon name="Gallery-Add" iconStyle="Outline" size={16} />} />
        <TrayTile label="Quick scans this month" value={formatCount(usage?.month.scans)} icon={<SolarIcon name="Magnifer" iconStyle="Outline" size={16} />} />
        <TrayTile className="max-sm:col-span-2" label="AI tokens this month" value={formatCount(tokens)} hint={usage ? `${formatCount(usage.month.input_tokens)} in · ${formatCount(usage.month.output_tokens)} out` : undefined} icon={<SolarIcon name="Stars" iconStyle="Outline" size={16} />} />
      </div>

      {usage === null ? (
        <SectionFailed title="We couldn't load your usage" />
      ) : (
        <>
          <TraySection title="Last 30 days">
            <DailyChart daily={usage.daily} />
          </TraySection>
          <SheetTable title="By source" description="Stock-takes this month, by the app that started them.">
            {sources.length === 0 || sourceTotal === 0 ? (
              <EmptyState icon="Widget-5" title="No stock-takes this month" className="py-10" />
            ) : (
              <ul>
                {sources.map((s, i) => (
                  <li key={s.client_id ?? "tally"} className={cn("flex items-center gap-3 px-4 py-3", i > 0 && "border-t border-gray-100")}>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">{s.name}</span>
                    <span className="hidden h-1.5 w-32 overflow-hidden rounded-full bg-gray-100 sm:block">
                      <span className="block h-full rounded-full bg-gray-400" style={{ width: `${(s.stocktakes / sourceTotal) * 100}%` }} />
                    </span>
                    <span className="w-16 text-right text-sm tabular-nums text-gray-700">{s.stocktakes.toLocaleString("en-NG")}</span>
                  </li>
                ))}
              </ul>
            )}
          </SheetTable>
        </>
      )}
    </div>
  );
}

export function UsageSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy aria-label="Loading">
      <Skeleton className="h-36 w-full rounded-[18px]" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Skeleton className="h-32 rounded-[18px]" />
        <Skeleton className="h-32 rounded-[18px]" />
        <Skeleton className="h-32 rounded-[18px]" />
      </div>
      <Skeleton className="h-64 w-full rounded-[18px]" />
    </div>
  );
}
