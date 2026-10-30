import Link from "next/link";
import { Button, SolarIcon, cn } from "@tally/ui";
import { formatWait } from "./_lib/format";

/** The `code` of a 429 from a stock-take run or quick scan (contracts §6). */
export type LimitCode = "plan_limit" | "client_cap" | "concurrent_runs";

const COPY: Record<LimitCode, { title: string; body: string; upgrade: boolean }> = {
  plan_limit: {
    title: "You've used today's stock-takes",
    body: "Your plan's daily limit is reached. Upgrade for more, or try again when it resets.",
    upgrade: true,
  },
  client_cap: {
    title: "This app has reached its daily limit",
    body: "The connected app can't start more stock-takes for your business today.",
    upgrade: false,
  },
  concurrent_runs: {
    title: "Too many stock-takes running at once",
    body: "Wait for one to finish, or upgrade to run more side by side.",
    upgrade: true,
  },
};

/** Shown where a stock-take was refused with 429. Safe in server and client components. */
export function LimitReached({ code, retryAfterSeconds, className }: { code: LimitCode; retryAfterSeconds?: number | null; className?: string }) {
  const copy = COPY[code] ?? COPY.plan_limit;
  return (
    <div role="alert" className={cn("flex flex-col gap-3 rounded-[18px] bg-amber-50 px-4 py-4 text-sm text-amber-900 sm:flex-row sm:items-center", className)}>
      <SolarIcon name="Danger-Triangle" iconStyle="Outline" size={20} className="shrink-0 text-amber-700" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-gray-900">{copy.title}</p>
        <p className="mt-0.5">
          {copy.body}
          {retryAfterSeconds != null && retryAfterSeconds > 0 && <> Try again in {formatWait(retryAfterSeconds)}.</>}
        </p>
      </div>
      {copy.upgrade && (
        <Button asChild size="md" className="self-start sm:self-center">
          <Link href="/settings/plan">
            <SolarIcon name="Stars" iconStyle="Outline" size={16} />
            Upgrade
          </Link>
        </Button>
      )}
    </div>
  );
}
