// Lagos time on the server and in the browser alike, so server-rendered dates hydrate unchanged.
const TZ = "Africa/Lagos";
const dateTime = new Intl.DateTimeFormat("en-NG", { timeZone: TZ, day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
const time = new Intl.DateTimeFormat("en-NG", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const dayLabel = new Intl.DateTimeFormat("en-NG", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" });
const clock = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const shortDate = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "short" });
const shortDateYear = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" });

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

/** "Today, 10:14", "Yesterday, 23:06", "28 Oct, 22:33"; the year only when it isn't this one. */
export function formatWhen(iso: string, now = new Date()): string {
  const day = formatDay(iso, now);
  const date = new Date(iso);
  const sameYear = lagosDay(iso).slice(0, 4) === dayKey.format(now).slice(0, 4);
  const label = day === "Today" || day === "Yesterday" ? day : (sameYear ? shortDate : shortDateYear).format(date);
  return `${label}, ${clock.format(date)}`;
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
