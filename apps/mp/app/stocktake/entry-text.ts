import { plural } from "./format";
import type { HistoryEntry } from "./types";

/** The entry's title, like a chat's: what was on the shelf, or what happened to it. */
export function entryTitle(e: HistoryEntry): string {
  if (e.status === "running") return "Reading the shelf…";
  if (e.status === "failed") return "Stock-take failed";
  if (e.lines === 0) return "Nothing found";
  return e.preview.length > 0 ? e.preview.join(", ") : plural(e.lines ?? 0, "product");
}

/** One line under the title: what it found, or what was decided. */
export function entrySummary(e: HistoryEntry): string {
  if (e.status === "running") return "The agent is still working on it";
  if (e.status === "failed") return e.error ?? "It stopped before finishing";
  const lines = plural(e.lines ?? 0, "line");
  if (e.status === "review") {
    if (e.lines === 0) return "No products found in the photo";
    const left = (e.lines ?? 0) - Object.values(e.decided).reduce((a, b) => a + b, 0);
    return `${lines}, ${left} to confirm${e.fallback ? " · first pass only" : ""}`;
  }
  const parts = (
    [
      ["added", e.decided.add],
      ["restocked", e.decided.restock],
      ["restored", e.decided.restore],
      ["skipped", e.decided.skip],
    ] as const
  )
    .filter(([, n]) => n > 0)
    .map(([word, n]) => `${n} ${word}`);
  return [lines, ...parts].join(" · ");
}
