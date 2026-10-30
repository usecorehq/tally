"use client";

import { PageHeader } from "@tally/ui";
import { SettingsHeader, TABS } from "../../settings/_components/settings-parts";
import { IntegrationsSkeleton, IntegrationsView } from "../../settings/integrations/integrations-view";
import { UsageSkeleton, UsageView } from "../../settings/usage/usage-view";
import { PlanSkeleton, PlanView } from "../../settings/plan/plan-view";
import { LimitReached } from "../../settings/limit-reached";
import type { ActionResult } from "../../settings/_lib/types";
import { BUSINESSES, GRANTS, PLANS, PRO, USAGE, USAGE_EMPTY } from "./fixtures";
import type { Variant } from "./variants";

// Fixture actions: Revoke succeeds after a pause, Subscribe fails so the dialog's error shows.
const revoke = async (): Promise<ActionResult> => (await new Promise((r) => setTimeout(r, 600)), { ok: true });
const subscribe = async (): Promise<ActionResult> => (
  await new Promise((r) => setTimeout(r, 600)), { ok: false, error: "Preview only: a real switch calls the API." }
);

export function SettingsPreview({ variant }: { variant: Variant }) {
  const tab = variant.split("-")[0]!;
  const staff = variant.endsWith("-staff");
  const business = staff ? BUSINESSES[1]! : BUSINESSES[0]!;
  const header = <SettingsHeader businesses={BUSINESSES} businessId={business.id} active={TABS.find((t) => t.href.endsWith(tab))?.href} />;

  if (variant === "limit-reached") {
    return (
      <>
        <PageHeader title="LimitReached" subtitle="Shown where a stock-take answers 429" />
        <div className="flex flex-col gap-3">
          <LimitReached code="plan_limit" retryAfterSeconds={4 * 3600 + 1200} />
          <LimitReached code="concurrent_runs" retryAfterSeconds={45} />
          <LimitReached code="client_cap" retryAfterSeconds={2 * 3600} />
        </div>
      </>
    );
  }
  if (variant.endsWith("-loading")) {
    return (
      <>
        <PageHeader title="Settings" />
        {tab === "integrations" ? <IntegrationsSkeleton /> : tab === "usage" ? <UsageSkeleton /> : <PlanSkeleton />}
      </>
    );
  }

  const failed = variant.endsWith("-failed");
  if (tab === "integrations") {
    return (
      <>
        {header}
        <IntegrationsView
          businessName={business.name}
          isOwner={!staff}
          grants={failed ? null : variant === "integrations-empty" ? [] : GRANTS}
          usage={failed ? null : USAGE}
          revoke={revoke}
        />
      </>
    );
  }
  if (tab === "usage") {
    const usage =
      variant === "usage-empty"
        ? USAGE_EMPTY
        : variant === "usage-near-limit"
          ? { ...USAGE, today: { stocktakes: 4, scans: 2 } }
          : variant === "usage-at-limit"
            ? { ...USAGE, today: { stocktakes: 5, scans: 3 } }
            : USAGE;
    return (
      <>
        {header}
        <UsageView usage={failed ? null : usage} />
      </>
    );
  }
  return (
    <>
      {header}
      <PlanView
        key={variant}
        businessName={business.name}
        isOwner={!staff}
        usage={failed ? null : variant === "plan-pro" || variant === "plan-success" ? { ...USAGE, plan: PRO } : USAGE}
        plans={failed ? null : PLANS}
        subscribe={subscribe}
        initialDone={variant === "plan-success" ? "Pro" : null}
      />
    </>
  );
}
