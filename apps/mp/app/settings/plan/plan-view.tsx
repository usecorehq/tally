"use client";

import { useState } from "react";
import { Button, ConfirmDialog, FormMessage, Notice, Pill, Skeleton, SolarIcon, Tray, TraySection, TraySheet, cn } from "@tally/ui";
import { SectionFailed } from "../_components/settings-parts";
import { formatCount, formatKobo } from "../_lib/format";
import type { ActionResult, Plan, Usage } from "../_lib/types";

const limits = (daily: number | null | undefined, concurrent: number | null | undefined) => [
  `${formatCount(daily)} stock-takes a day`,
  `${formatCount(concurrent)} running at once`,
];

/**
 * The business's plan and the plans to compare. Subscribing is simulated: no card form, no charge,
 * and prices are shown for display only.
 */
export function PlanView({
  businessName,
  isOwner,
  usage,
  plans,
  subscribe,
  initialDone = null,
}: {
  businessName: string;
  isOwner: boolean;
  /** Carries the current plan; null = the read failed. */
  usage: Usage | null;
  plans: Plan[] | null;
  subscribe: (planCode: string) => Promise<ActionResult>;
  initialDone?: string | null;
}) {
  const [target, setTarget] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(initialDone);
  const current = usage?.plan ?? null;

  return (
    <div className="flex flex-col gap-4">
      {done && (
        <Notice tone="brand" icon="Check-Circle" title={`${businessName} is on ${done}`}>
          Simulated subscription: nothing was charged. The new limits apply now.
        </Notice>
      )}

      <TraySection title="Current plan" caption={current?.simulated ? <Pill tone="violet" dot={false}>Simulated</Pill> : undefined}>
        <div className="flex flex-col gap-1">
          <p className="text-2xl font-semibold tracking-tight text-gray-900">{current?.name ?? "–"}</p>
          <p className="text-sm text-gray-500">{limits(current?.daily_stocktake_limit, current?.max_concurrent_runs).join(" · ")}</p>
        </div>
      </TraySection>

      {plans === null ? (
        <SectionFailed title="We couldn't load the plans" />
      ) : (
        <Tray>
          <div className="px-4 pb-2.5 pt-3">
            <h2 className="font-medium tracking-tight text-gray-900">Compare plans</h2>
            <p className="mt-0.5 text-sm text-gray-500">Plans are simulated while Connect Tally is in preview. You won't be charged.</p>
          </div>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {plans.map((plan) => {
              const isCurrent = plan.code === current?.code;
              return (
                <TraySheet key={plan.code} className={cn("flex flex-col gap-5", isCurrent && "ring-2 ring-primary-ink/40")}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900">{plan.name}</p>
                      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-gray-900">
                        {formatKobo(plan.price_kobo_monthly)}
                        <span className="text-sm font-normal text-gray-500"> / month</span>
                      </p>
                    </div>
                    {isCurrent && <Pill tone="green">Current</Pill>}
                  </div>
                  <ul className="flex flex-col gap-2 text-sm text-gray-700">
                    {limits(plan.daily_stocktake_limit, plan.max_concurrent_runs).map((line) => (
                      <li key={line} className="flex items-center gap-2">
                        <SolarIcon name="Check-Circle" iconStyle="Outline" size={16} className="text-gray-400" />
                        {line}
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant={isCurrent ? "soft" : "primary"}
                    size="lg"
                    block
                    className="mt-auto"
                    disabled={isCurrent || !isOwner || !current}
                    onClick={() => {
                      setError(null);
                      setTarget(plan);
                    }}
                  >
                    {isCurrent ? "Current plan" : `Switch to ${plan.name}`}
                  </Button>
                </TraySheet>
              );
            })}
          </div>
          {!isOwner && <p className="px-4 pb-2 pt-3 text-sm text-gray-500">Only the owner of {businessName} can change its plan.</p>}
        </Tray>
      )}

      <ConfirmDialog
        open={target !== null}
        onOpenChange={(open) => !open && setTarget(null)}
        title="Simulated subscription: no charge"
        description={
          target
            ? `This moves ${businessName} to ${target.name} so you can try its limits. Nothing is charged and no payment details are needed.`
            : undefined
        }
        confirmLabel={target ? `Switch to ${target.name}` : "Switch"}
        onConfirm={async () => {
          if (!target) return;
          setError(null);
          const res = await subscribe(target.code);
          if (!res.ok) {
            setError(res.error);
            throw new Error(res.error);
          }
          setDone(target.name);
        }}
      >
        {error ? <FormMessage message={error} /> : undefined}
      </ConfirmDialog>
    </div>
  );
}

export function PlanSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy aria-label="Loading">
      <Skeleton className="h-28 w-full rounded-[18px]" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Skeleton className="h-60 rounded-[18px]" />
        <Skeleton className="h-60 rounded-[18px]" />
      </div>
    </div>
  );
}
