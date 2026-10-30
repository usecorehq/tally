"use client";

import { useState } from "react";
import { Badge, ConfirmDialog, EmptyState, FormMessage, InitialsTile, Notice, SheetTable, Skeleton, SolarIcon, cn } from "@tally/ui";
import { SectionFailed } from "../_components/settings-parts";
import { formatDay } from "../_lib/format";
import type { ActionResult, Grant, Usage } from "../_lib/types";

function AppLogo({ grant }: { grant: Grant }) {
  if (!grant.client.logo_url) return <InitialsTile name={grant.client.name} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a partner's logo on any host
    <img src={grant.client.logo_url} alt="" aria-hidden width={40} height={40} className="h-10 w-10 shrink-0 rounded-[10px] bg-surface object-cover ring-1 ring-hairline/[0.06]" />
  );
}

/**
 * Apps connected to the business through Connect Tally, each with its share of this month's stock-takes.
 * `grants` null = the read failed; `usage` null only blanks the share column ("–").
 */
export function IntegrationsView({
  businessName,
  isOwner,
  grants,
  usage,
  revoke,
}: {
  businessName: string;
  isOwner: boolean;
  grants: Grant[] | null;
  usage: Usage | null;
  revoke: (grantId: string) => Promise<ActionResult>;
}) {
  const [target, setTarget] = useState<Grant | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOwner) {
    return (
      <Notice icon="Lock" title="Only the owner manages connected apps">
        Ask the owner of {businessName} to connect or remove apps.
      </Notice>
    );
  }
  if (grants === null) return <SectionFailed title="We couldn't load your connected apps" />;

  const monthTotal = usage?.month.stocktakes ?? null;
  const share = (client: Grant["client"]) => {
    if (!usage) return "–";
    const n = usage.by_source.find((s) => s.client_id === client.client_id)?.stocktakes ?? 0;
    if (!monthTotal) return "0 this month";
    return `${n.toLocaleString("en-NG")} · ${Math.round((n / monthTotal) * 100)}%`;
  };

  return (
    <div className="flex flex-col gap-4">
      <SheetTable
        title="Connected apps"
        count={grants.length}
        description={`Apps you allowed to work with ${businessName}.`}
        sheetClassName="[&_td]:align-top"
      >
        {grants.length === 0 ? (
          <EmptyState
            icon="Widget-5"
            title="No apps connected"
            body="With Connect Tally, apps you already use can run stock-takes and read your inventory, once you allow them."
          />
        ) : (
          <ul>
            {grants.map((g, i) => (
              <li key={g.id} className={cn("flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center", i > 0 && "border-t border-gray-100")}>
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <AppLogo grant={g} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gray-900">{g.client.name}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {g.scopes.map((s) => (
                        <Badge key={s} variant="secondary" className="font-mono text-[11px]">
                          {s}
                        </Badge>
                      ))}
                    </div>
                    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[13px] text-gray-500 sm:flex sm:flex-wrap sm:gap-x-4">
                      <div className="contents sm:flex sm:gap-1">
                        <dt>Connected</dt>
                        <dd className="text-gray-700">{formatDay(g.created_at)}</dd>
                      </div>
                      <div className="contents sm:flex sm:gap-1">
                        <dt>Last used</dt>
                        <dd className="text-gray-700">{g.last_used_at ? formatDay(g.last_used_at) : "Not yet"}</dd>
                      </div>
                      <div className="contents sm:flex sm:gap-1">
                        <dt>Stock-takes</dt>
                        <dd className="tabular-nums text-gray-700">{share(g.client)}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setTarget(g);
                  }}
                  aria-label={`Revoke ${g.client.name}`}
                  className="inline-flex h-9 items-center gap-1.5 self-start rounded-xl px-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/30 sm:self-center"
                >
                  <SolarIcon name="Trash-Bin-Minimalistic" iconStyle="Outline" size={16} />
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </SheetTable>

      <ConfirmDialog
        open={target !== null}
        onOpenChange={(open) => !open && setTarget(null)}
        title={target ? `Revoke ${target.client.name}?` : "Revoke access?"}
        description={
          target
            ? `${target.client.name} will lose access to ${businessName} within a minute. Stock-takes it already made stay in your history.`
            : undefined
        }
        destructive
        confirmLabel="Revoke access"
        onConfirm={async () => {
          setError(null);
          if (!target) return;
          const res = await revoke(target.id);
          if (!res.ok) {
            setError(res.error);
            throw new Error(res.error);
          }
        }}
      >
        {error ? <FormMessage message={error} /> : undefined}
      </ConfirmDialog>
    </div>
  );
}

export function IntegrationsSkeleton() {
  return (
    <div className="rounded-[18px] bg-gray-100 p-1" aria-busy aria-label="Loading">
      <div className="px-4 pb-2.5 pt-3">
        <Skeleton className="h-5 w-40" />
      </div>
      <div className="rounded-[14px] bg-surface ring-1 ring-hairline/[0.04]">
        {[0, 1].map((i) => (
          <div key={i} className={cn("flex items-center gap-3 px-4 py-4", i > 0 && "border-t border-gray-100")}>
            <Skeleton className="h-10 w-10 rounded-[10px]" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-56" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
