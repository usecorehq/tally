import Link from "next/link";
import { Button, EmptyState, InitialsTile, PageHeader, Pill, SheetTable, SolarIcon } from "@tally/ui";

export type BusinessSummary = { id: string; name: string; subtypeCode: string; role: string };

/** "mini_mart" → "Mini mart". */
function readable(code: string): string {
  const s = code.replace(/_/g, " ").trim().toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * The home page body. `businesses` is null when the read failed: that is an
 * error with a retry, never an empty list or a zero.
 */
export function BusinessList({ businesses }: { businesses: BusinessSummary[] | null }) {
  const count = businesses?.length ?? 0;

  return (
    <>
      <PageHeader
        title="Your businesses"
        subtitle={businesses ? `${count} ${count === 1 ? "business" : "businesses"} on Tally` : undefined}
        actions={
          <Button asChild variant="quiet">
            <Link href="/onboarding">
              <SolarIcon name="Add-Circle" iconStyle="Outline" size={18} />
              Add a business
            </Link>
          </Button>
        }
      />

      <SheetTable title="Businesses">
        {businesses === null ? (
          <EmptyState
            icon="Danger-Circle"
            title="Couldn't load your businesses"
            body="Refresh the page to try again."
            action={
              <Button asChild variant="quiet">
                <a href="/">
                  <SolarIcon name="Refresh" iconStyle="Outline" size={18} />
                  Refresh
                </a>
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-gray-100">
            {businesses.map((b) => (
              <li key={b.id} className="flex items-center gap-3 px-4 py-3 sm:gap-4">
                <InitialsTile name={b.name} />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 break-words text-[15px] font-medium text-gray-900">{b.name}</p>
                  <div className="mt-0.5 flex min-w-0 items-center gap-2">
                    <p className="truncate text-[13px] text-gray-500">{readable(b.subtypeCode)}</p>
                    {b.role !== "owner" && (
                      <Pill dot={false} className="shrink-0">
                        {readable(b.role)}
                      </Pill>
                    )}
                  </div>
                </div>
                {/* sm is 32px; lift it to a 44px target where it is tapped. */}
                <Button asChild variant="soft" size="sm" className="max-sm:h-11">
                  <Link href={`/stocktake?business=${b.id}`}>
                    <SolarIcon name="Gallery-Add" iconStyle="Outline" size={16} />
                    Stock-take
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </SheetTable>
    </>
  );
}
