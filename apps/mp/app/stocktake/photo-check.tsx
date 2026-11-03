"use client";

import { Button, Pill, SolarIcon, type PillTone } from "@tally/ui";
import type { LocalCheck } from "./image";
import type { PhotoCheck } from "./types";

export type CheckState =
  | { status: "checking"; local: LocalCheck | null }
  | { status: "done"; local: LocalCheck | null; result: PhotoCheck | null };

const VERDICT: Record<PhotoCheck["verdict"], { label: string; tone: PillTone }> = {
  good: { label: "Good photo", tone: "green" },
  usable: { label: "Usable, could be better", tone: "amber" },
  retake: { label: "Retake recommended", tone: "red" },
};

const ISSUE: Record<PhotoCheck["issues"][number], string> = {
  not_shelf: "no stock in view",
  too_far: "too far",
  too_close: "too close",
  angled: "at an angle",
  blurry: "blurry",
  dark: "too dark",
  glare: "glare on labels",
  obstructed: "something in the way",
  cut_off: "shelf cut off",
};

/** The browser's own findings, for when the model's verdict is missing or to add to it. */
function localIssues(local: LocalCheck | null): string[] {
  if (!local) return [];
  return [local.dark && "too dark", local.blurry && "blurry", local.glare && "glare on labels"].filter((x): x is string => Boolean(x));
}

/** The photo check under the picked photo: advice only, the merchant can always scan anyway. */
export function PhotoCheckPanel({ check, onRetake }: { check: CheckState; onRetake: () => void }) {
  const local = localIssues(check.local);
  if (check.status === "checking") {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500" role="status">
        <SolarIcon name="Stars" iconStyle="Outline" size={16} className="animate-pulse text-primary-ink" />
        Checking the photo with Muse Spark…
      </div>
    );
  }
  const r = check.result;
  // No verdict (busy, offline): only say something when the browser itself found a problem.
  if (!r) {
    if (local.length === 0) return null;
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm text-amber-700" role="status">
        <SolarIcon name="Danger-Triangle" iconStyle="Outline" size={16} />
        This photo looks {local.join(", ")}. A clearer photo reads more products.
      </div>
    );
  }
  const issues = [...new Set([...r.issues.map((i) => ISSUE[i]), ...local])];
  return (
    <div className="space-y-2" role="status">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={VERDICT[r.verdict].tone}>{VERDICT[r.verdict].label}</Pill>
        {issues.length > 0 && <span className="text-[13px] text-gray-500">{issues.join(" · ")}</span>}
        <span className="text-xs text-gray-400">
          {r.productsVisible > 0 && `~${r.productsVisible} products · `}labels {r.labelsLegible === "most" ? "mostly" : r.labelsLegible} readable
        </span>
      </div>
      {r.verdict !== "good" && r.instruction && <p className="text-sm text-gray-700">{r.instruction}</p>}
      {r.verdict === "retake" && (
        <Button variant="soft" size="sm" onClick={onRetake}>
          <SolarIcon name="Refresh" iconStyle="Outline" size={16} />
          Retake photo
        </Button>
      )}
    </div>
  );
}
