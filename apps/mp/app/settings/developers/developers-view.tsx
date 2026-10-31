"use client";

import Link from "next/link";
import { Badge, Button, EmptyState, Notice, SheetTable, Skeleton, SolarIcon, cn } from "@tally/ui";
import { SectionFailed } from "../_components/settings-parts";
import { formatDay } from "../_lib/format";
import { PARTNER_DEMO_URL, type DeveloperApp } from "./_lib/developer";
import { AppLogo, StatusPill } from "./_components/developer-parts";

const NEW_APP = "/settings/developers/new";

/** The signed-in user's Connect Tally apps. `apps` null = the read failed. Apps belong to the user, not the business. */
export function DevelopersView({ apps }: { apps: DeveloperApp[] | null }) {
  if (apps === null) return <SectionFailed title="We couldn't load your apps" />;
  const create = (
    <Button asChild size="sm">
      <Link href={NEW_APP}>
        <SolarIcon name="Add-Circle" iconStyle="Outline" size={16} />
        Create app
      </Link>
    </Button>
  );

  return (
    <div className="flex flex-col gap-4">
      <SheetTable
        title="Your apps"
        count={apps.length}
        description="Connect Tally apps you build. They belong to your account, not to a business."
        action={apps.length > 0 ? create : undefined}
      >
        {apps.length === 0 ? (
          <EmptyState
            icon="Widget-4"
            title="No apps yet"
            body="Create an app to get a client ID and secret, then let merchants connect their Tally business to it."
            action={create}
          />
        ) : (
          <ul>
            {apps.map((a, i) => (
              <li key={a.client_id} className={cn(i > 0 && "border-t border-gray-100")}>
                <Link
                  href={`/settings/developers/${a.client_id}`}
                  className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-gray-50/70 focus-visible:bg-gray-50 focus-visible:outline-none"
                >
                  <AppLogo app={a} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-gray-900">{a.name}</p>
                      <StatusPill status={a.status} />
                    </div>
                    <p className="mt-0.5 truncate font-mono text-[12.5px] text-gray-500">{a.client_id}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {a.scopes.map((s) => (
                        <Badge key={s} variant="secondary" className="font-mono text-[11px]">
                          {s}
                        </Badge>
                      ))}
                      <span className="text-[13px] text-gray-500">· Created {formatDay(a.created_at)}</span>
                    </div>
                  </div>
                  <SolarIcon name="Alt-Arrow-Right" iconStyle="Outline" size={18} className="text-gray-400" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SheetTable>
      <Notice icon="File-Text" title="New to Connect Tally?">
        The{" "}
        <a href={PARTNER_DEMO_URL} target="_blank" rel="noreferrer" className="font-medium text-primary-ink underline-offset-4 hover:underline">
          partner demo
        </a>{" "}
        walks through connecting a merchant, embedding a stock-take and reading the result.
      </Notice>
    </div>
  );
}

export function DevelopersSkeleton() {
  return (
    <div className="rounded-[18px] bg-gray-100 p-1" aria-busy aria-label="Loading">
      <div className="px-4 pb-2.5 pt-3">
        <Skeleton className="h-5 w-32" />
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
