"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { InitialsTile, SolarIcon, cn } from "@tally/ui";
import { rememberBusiness } from "@/lib/business-cookie";
import { historyHref, newHref } from "../stocktake/urls";
import { FOCUS } from "./segment";

export type SwitcherBusiness = { id: string; name: string; subtypeCode: string; role: string };

/** "mini_mart" → "Mini mart". */
const readable = (code: string) => {
  const s = code.replace(/_/g, " ").trim().toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** Same section, other business: a session page goes back to a new stock-take. */
function switchHref(pathname: string, id: string): string {
  if (pathname.startsWith("/stocktake/history")) return pathname === "/stocktake/history" ? historyHref(id) : newHref(id);
  if (pathname.startsWith("/stocktake")) return newHref(id);
  if (pathname.startsWith("/settings")) return `${pathname}?business=${encodeURIComponent(id)}`;
  return `/inventory?business=${encodeURIComponent(id)}`;
}

/** Qorelly's V2 business switcher: the current business, the others to switch to, and Add business. */
export function BusinessSwitcher({ businesses, savedId, className }: { businesses: SwitcherBusiness[]; savedId?: string; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const requested = useSearchParams().get("business");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const current = businesses.find((b) => b.id === requested) ?? businesses.find((b) => b.id === savedId) ?? businesses[0];

  // A link to another business makes it the one the next page opens on.
  useEffect(() => {
    if (current && current.id !== savedId) rememberBusiness(current.id);
  }, [current, savedId]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!current) return null;

  const q = query.trim().toLowerCase();
  const shown = q ? businesses.filter((b) => b.name.toLowerCase().includes(q)) : businesses;

  function select(id: string) {
    setOpen(false);
    setQuery("");
    if (id === current!.id) return;
    rememberBusiness(id);
    router.push(switchHref(pathname, id));
  }

  return (
    <div ref={root} className={cn("relative min-w-0", className)}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className={cn("flex h-11 max-w-full items-center gap-2.5 rounded-xl px-2 text-left transition-colors hover:bg-gray-200/60", FOCUS)}
      >
        <InitialsTile name={current.name} className="h-8 w-8 rounded-[9px] text-[13px]" />
        <span className="min-w-0 truncate text-[15px] font-semibold tracking-tight text-gray-900">{current.name}</span>
        <SolarIcon name="Alt-Arrow-Down" iconStyle="Outline" size={16} className={cn("shrink-0 text-gray-500 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Switch business"
          className="absolute left-0 top-full z-30 mt-2 w-[min(320px,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-surface ring-1 ring-hairline/[0.08] dark:ring-hairline/15"
        >
          <p className="px-4 pb-2 pt-3.5 text-[13px] font-medium text-gray-500">
            Switch business <span className="tabular-nums text-gray-400">{businesses.length}</span>
          </p>
          {businesses.length > 5 && (
            <div className="px-3 pb-2">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a business"
                aria-label="Find a business"
                className="h-10 w-full rounded-xl bg-gray-100 px-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-primary-ink/40"
              />
            </div>
          )}
          <ul className="max-h-[50dvh] overflow-y-auto px-2 pb-2">
            {shown.map((b) => {
              const on = b.id === current.id;
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => select(b.id)}
                    aria-current={on ? "true" : undefined}
                    className={cn("flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-gray-100", on && "bg-gray-100", FOCUS)}
                  >
                    <InitialsTile name={b.name} className="h-9 w-9 rounded-[10px] text-[13px]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-gray-900">{b.name}</span>
                      <span className="block truncate text-xs text-gray-500">
                        {readable(b.role)} · {readable(b.subtypeCode)}
                      </span>
                    </span>
                    {on && <SolarIcon name="Check-Circle" iconStyle="Fill" size={20} className="shrink-0 text-primary-ink" />}
                  </button>
                </li>
              );
            })}
            {shown.length === 0 && <li className="px-2 py-3 text-sm text-gray-500">No business matches.</li>}
          </ul>
          <div className="border-t border-gray-100 p-2">
            <Link
              href="/businesses/new"
              onClick={() => setOpen(false)}
              className={cn("flex h-10 items-center gap-2 rounded-xl px-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900", FOCUS)}
            >
              <SolarIcon name="Add-Circle" iconStyle="Outline" size={20} />
              Add business
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
