// Lagos time on the server and in the browser alike, so server-rendered dates hydrate unchanged.
const TZ = "Africa/Lagos";
const dateTime = new Intl.DateTimeFormat("en-NG", { timeZone: TZ, day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
const time = new Intl.DateTimeFormat("en-NG", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const dayLabel = new Intl.DateTimeFormat("en-NG", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" });

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
export const formatTime = (iso: string) => time.format(new Date(iso));
export const lagosDay = (iso: string) => dayKey.format(new Date(iso));

/** "Today", "Yesterday" or the full date, relative to `now`. */
export function formatDay(iso: string, now = new Date()): string {
  const day = lagosDay(iso);
  if (day === dayKey.format(now)) return "Today";
  if (day === dayKey.format(new Date(now.getTime() - 86_400_000))) return "Yesterday";
  return dayLabel.format(new Date(iso));
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
