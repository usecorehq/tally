"use client";

import { useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button, PageHeader, SolarIcon, Tray, TraySheet, cn, type SolarIconName } from "@tally/ui";
import { FOCUS, SEGMENT_THUMB, SEGMENT_TRACK } from "../../_components/segment";

export const TABS: { href: string; label: string; icon: SolarIconName }[] = [
  { href: "/settings/integrations", label: "Integrations", icon: "Widget-5" },
  { href: "/settings/usage", label: "Usage", icon: "Chart" },
  { href: "/settings/plan", label: "Plan", icon: "Stars" },
];

/** "Settings" and its three tabs; the business comes from the top-bar switcher. */
export function SettingsHeader({ active }: { active?: string } = {}) {
  const pathname = usePathname();
  const current = active ?? pathname;
  return (
    <>
      <PageHeader title="Settings" />
      <nav aria-label="Settings" className={cn("mb-6 flex w-full sm:w-fit", SEGMENT_TRACK)}>
        {TABS.map((t) => {
          const on = current === t.href;
          return (
            <Link key={t.href} href={t.href} aria-current={on ? "page" : undefined} className={cn("group flex h-11 min-w-0 flex-1 p-1 sm:flex-none", FOCUS)}>
              <span
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors",
                  on ? SEGMENT_THUMB : "text-gray-500 group-hover:text-gray-900",
                )}
              >
                <SolarIcon name={t.icon} iconStyle={on ? "Fill" : "Outline"} size={18} className={cn("max-[379px]:hidden", on && "text-primary-ink")} />
                {t.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

/** A failed read inside a section: says so with a retry that re-runs the server reads. */
export function SectionFailed({ title, body = "Check your connection and try again.", onRetry }: { title: string; body?: string; onRetry?: () => void }) {
  const router = useRouter();
  const [retrying, start] = useTransition();
  return (
    <Tray>
      <TraySheet role="alert" className="flex flex-col items-center gap-2 px-6 py-12 text-center">
        <span className="mb-1 flex size-10 items-center justify-center rounded-full bg-red-50 text-red-600">
          <SolarIcon name="Danger-Circle" iconStyle="Outline" size={20} />
        </span>
        <p className="font-medium tracking-tight text-gray-900">{title}</p>
        <p className="max-w-sm text-sm text-gray-500">{body}</p>
        <Button type="button" className="mt-2" variant="quiet" size="lg" disabled={retrying} onClick={onRetry ?? (() => start(() => router.refresh()))}>
          <SolarIcon name="Refresh" iconStyle="Outline" size={16} />
          {retrying ? "Trying again…" : "Try again"}
        </Button>
      </TraySheet>
    </Tray>
  );
}
