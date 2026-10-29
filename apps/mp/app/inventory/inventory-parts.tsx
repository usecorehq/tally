import Link from "next/link";
import { Button, IconTile, PageHeader, SheetTable, Skeleton, SolarIcon, Tray, TraySheet, TrayTile, cn } from "@tally/ui";

/** A figure we don't have (failed or still loading) shows this, never 0. */
export const NO_FIGURE = "–";

/** The page's one primary: capture a shelf, as the mobile Inventory tab's card. */
export function ScanCard({ businessId, className }: { businessId: string | null; className?: string }) {
  const href = businessId ? `/stocktake?business=${businessId}` : "/stocktake";
  return (
    <Tray className={className}>
      <TraySheet className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <IconTile icon="Gallery-Add" />
          <div className="min-w-0">
            <h2 className="font-medium tracking-tight text-gray-900">Scan a shelf</h2>
            <p className="mt-0.5 text-[13px] leading-5 text-gray-500">
              Take one photo. Tally counts every product and matches it to Qore Catalog, then you confirm.
            </p>
          </div>
        </div>
        <Button asChild size="lg" className="max-sm:w-full">
          <Link href={href}>
            <SolarIcon name="Gallery-Add" iconStyle="Outline" size={18} />
            Scan shelf
          </Link>
        </Button>
      </TraySheet>
    </Tray>
  );
}

/** Items / Units / Low stock. `undefined` means not read (yet): the tile shows "–". */
export function InventoryTiles({
  items,
  units,
  low,
  className,
}: {
  items?: string;
  units?: string;
  low?: number;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-3 gap-3", className)}>
      <TrayTile label="Items" value={items ?? NO_FIGURE} />
      <TrayTile label="Units" value={units ?? NO_FIGURE} />
      <TrayTile
        label="Low stock"
        value={low == null ? NO_FIGURE : <span className={low > 0 ? "text-amber-600" : undefined}>{low}</span>}
      />
    </div>
  );
}

/** Inventory while its reads run: the real header, card and tiles ("–"), grey rows for the list. */
export function InventorySkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading inventory">
      <PageHeader eyebrow={<span className="inline-block h-4 w-24 animate-pulse rounded-md bg-gray-200/90 align-middle" />} title="Inventory" />
      <ScanCard businessId={null} className="mb-6" />
      <InventoryTiles className="mb-6" />
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Skeleton className="h-11 flex-1 rounded-xl bg-gray-100" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-14 rounded-xl bg-gray-100" />
          <Skeleton className="h-10 w-28 rounded-xl bg-gray-100" />
        </div>
      </div>
      <SheetTable title="Stock">
        <ul className="divide-y divide-gray-100">
          {[0, 1, 2, 3, 4].map((i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-10 w-10 rounded-full md:h-9 md:w-9" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-56 max-w-full" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-4 w-16 max-md:hidden" />
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 w-28 max-md:hidden" />
            </li>
          ))}
        </ul>
      </SheetTable>
    </div>
  );
}
