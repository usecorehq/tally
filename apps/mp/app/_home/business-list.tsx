import Link from "next/link";
import { Button, EmptyState, InitialsTile, PageHeader, Pill, SheetTable, Skeleton, SolarIcon } from "@tally/ui";

export type BusinessSummary = { id: string; name: string; subtypeCode: string; role: string };

/** "mini_mart" → "Mini mart". */
function readable(code: string): string {
  const s = code.replace(/_/g, " ").trim().toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// On a phone the single action stays beside the title (V2 page anatomy).
const HEADER = "max-sm:flex-row max-sm:items-start max-sm:justify-between";

function AddBusiness() {
  return (
    <Button asChild variant="quiet" className="max-sm:h-11">
      <Link href="/onboarding">
        <SolarIcon name="Add-Circle" iconStyle="Outline" size={18} />
        <span className="max-[399px]:hidden">Add a business</span>
        <span className="min-[400px]:hidden">Add</span>
      </Link>
    </Button>
  );
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
        className={HEADER}
        title="Your businesses"
        subtitle={businesses ? `${count} ${count === 1 ? "business" : "businesses"} on Tally` : "Pick one to see its stock"}
        actions={<AddBusiness />}
      />

      <SheetTable title="Businesses" count={businesses ? count : undefined}>
        {businesses === null ? (
          <EmptyState
            icon="Danger-Circle"
            title="Couldn't load your businesses"
            body="Check your connection, then try again."
            action={
              <Button asChild variant="quiet">
                <a href="/">
                  <SolarIcon name="Refresh" iconStyle="Outline" size={18} />
                  Try again
                </a>
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-gray-100">
            {businesses.map((b) => (
              <li key={b.id} className="relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50 sm:gap-4">
                <InitialsTile name={b.name} />
                <div className="min-w-0 flex-1">
                  {/* The whole row opens the business's inventory; the stock-take button sits above the stretched link. */}
                  <Link
                    href={`/inventory?business=${b.id}`}
                    className="line-clamp-2 break-words rounded-sm text-[15px] font-medium text-gray-900 outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-primary"
                  >
                    {b.name}
                  </Link>
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
                <Button asChild variant="soft" size="sm" className="relative max-sm:h-11">
                  <Link href={`/stocktake?business=${b.id}`} aria-label={`Stock-take ${b.name}`}>
                    <SolarIcon name="Gallery-Add" iconStyle="Outline" size={16} />
                    Stock-take
                  </Link>
                </Button>
                <SolarIcon name="Alt-Arrow-Right" iconStyle="Outline" size={16} className="text-gray-400 max-sm:hidden" />
              </li>
            ))}
          </ul>
        )}
      </SheetTable>
    </>
  );
}

/** The home page while /businesses loads: the same header and rows, in grey. */
export function BusinessListSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading your businesses">
      <PageHeader className={HEADER} title="Your businesses" subtitle={<span className="inline-block h-5 w-40 animate-pulse rounded-md bg-gray-200/90 align-middle" />} actions={<AddBusiness />} />
      <SheetTable title="Businesses">
        <ul className="divide-y divide-gray-100">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3 sm:gap-4">
              <Skeleton className="h-10 w-10 rounded-[10px]" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-48 max-w-full" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-11 w-28 rounded-xl sm:h-8 sm:rounded-lg" />
            </li>
          ))}
        </ul>
      </SheetTable>
    </div>
  );
}
