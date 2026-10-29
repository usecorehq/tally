"use client";

import { useEffect, useState } from "react";
import { SolarIcon, cn, type SolarIconName } from "@tally/ui";
import { FOCUS, SEGMENT_THUMB, SEGMENT_TRACK } from "./segment";

export type ThemeChoice = "light" | "dark" | "system";
const KEY = "tally-theme";

/**
 * Runs in <head> before first paint (see layout.tsx), so a dark page never
 * flashes light. Kept tiny and dependency-free; mirrors apply() below.
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${KEY}")||"system";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;

function apply(choice: ThemeChoice) {
  const dark = choice === "dark" || (choice === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

const OPTIONS: { key: ThemeChoice; label: string; icon: SolarIconName }[] = [
  { key: "light", label: "Light", icon: "Sun-2" },
  { key: "dark", label: "Dark", icon: "Moon" },
  { key: "system", label: "Auto", icon: "Monitor" },
];

/** Light / Dark / Auto (follows the device). Saved in this browser only. */
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [choice, setChoice] = useState<ThemeChoice>("system");

  useEffect(() => {
    try {
      setChoice((localStorage.getItem(KEY) as ThemeChoice | null) ?? "system");
    } catch {
      // Storage blocked: stay on the device setting.
    }
  }, []);

  // Auto follows the device live.
  useEffect(() => {
    if (choice !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [choice]);

  function pick(next: ThemeChoice) {
    setChoice(next);
    apply(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Not saved; it still applies for this visit.
    }
  }

  // A radiogroup is one tab stop; the arrow keys move the choice.
  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const i = OPTIONS.findIndex((o) => o.key === choice);
    const next = OPTIONS[(i + step + OPTIONS.length) % OPTIONS.length]!;
    pick(next.key);
    (e.currentTarget.parentElement?.children[OPTIONS.indexOf(next)] as HTMLElement | undefined)?.focus();
  }

  // Each option is the full-height target (44px compact); the thumb sits inside it.
  return (
    <div role="radiogroup" aria-label="Appearance" className={cn("flex", SEGMENT_TRACK)}>
      {OPTIONS.map((o) => {
        const on = o.key === choice;
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onKeyDown={onKeyDown}
            aria-label={compact ? o.label : undefined}
            title={o.label}
            onClick={() => pick(o.key)}
            className={cn("group flex p-1", FOCUS, compact ? "h-11 w-11" : "h-10 min-w-0 flex-1")}
          >
            <span
              className={cn(
                "flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg text-[13px] font-medium transition-colors",
                on ? SEGMENT_THUMB : "text-gray-500 group-hover:text-gray-900",
              )}
            >
              <SolarIcon name={o.icon} iconStyle={on ? "Fill" : "Outline"} size={16} />
              {!compact && o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
