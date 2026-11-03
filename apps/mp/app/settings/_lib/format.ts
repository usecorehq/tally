import { formatNaira } from "@/lib/format";

// Lagos time on the server and in the browser alike, so server-rendered dates hydrate unchanged.
const TZ = "Africa/Lagos";
const day = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" });
const shortDay = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });

export const formatDay = (iso: string) => day.format(new Date(iso));
/** A usage bucket's YYYY-MM-DD, read as the calendar day it names. */
export const formatBucket = (date: string) => shortDay.format(new Date(`${date.slice(0, 10)}T00:00:00Z`));
export const formatCount = (n: number | null | undefined) => (n == null ? "–" : n.toLocaleString("en-NG"));

/** Integer kobo → "₦15,000", without floats. Display only: plan prices are never revenue. */
export function formatKobo(kobo: number): string {
  const sign = kobo < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(kobo));
  return `${sign}${formatNaira(`${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, "0")}`)}`;
}

/** "3 h 20 min", "45 min", "under a minute" for a 429's retry_after_seconds. */
export function formatWait(seconds: number): string {
  if (seconds < 60) return "under a minute";
  const h = Math.floor(seconds / 3600);
  const m = Math.ceil((seconds % 3600) / 60);
  if (h === 0) return `${m} min`;
  return m === 0 || m === 60 ? `${h + (m === 60 ? 1 : 0)} h` : `${h} h ${m} min`;
}
