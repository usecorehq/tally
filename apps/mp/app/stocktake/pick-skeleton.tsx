import { PageHeader, Skeleton, Tray, TrayFooter, TraySheet } from "@tally/ui";
import { PICK_SUBTITLE, PICK_TITLE } from "./copy";

/** Holds the shape of the pick page (heading, business, photo drop) while the businesses load. */
export function PickSkeleton() {
  return (
    <div className="max-w-[760px]" aria-busy="true" aria-label="Loading stock-take">
      <PageHeader title={PICK_TITLE} subtitle={PICK_SUBTITLE} className="[&_h1]:whitespace-normal" />
      <div className="space-y-5">
        <div className="max-w-sm">
          <Skeleton className="mb-2 h-4 w-16" />
          <Skeleton className="h-12 w-full rounded-[14px]" />
        </div>
        <Tray size="lg">
          <TraySheet size="lg" className="flex flex-col items-center px-6 py-12 sm:py-14">
            <Skeleton className="h-14 w-14 rounded-full" />
            <Skeleton className="mt-5 h-6 w-56 max-w-full" />
            <Skeleton className="mt-2.5 h-4 w-72 max-w-full" />
            <Skeleton className="mt-6 h-11 w-40 rounded-xl" />
          </TraySheet>
          <TrayFooter className="justify-center">
            <Skeleton className="h-4 w-64 max-w-full" />
          </TrayFooter>
        </Tray>
      </div>
    </div>
  );
}
