import { Skeleton, Tray, TraySheet } from "@tally/ui";

/** Holds a session's shape (heading, then lines) while it loads from the server. */
export function SessionSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading stock-take">
      <div className="mb-6 space-y-2.5">
        <Skeleton className="h-7 w-64 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Tray>
        <Skeleton className="mx-3 mb-3 mt-2 h-4 w-20" />
        <TraySheet className="divide-y divide-gray-100 p-0">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-4">
              <Skeleton className="h-14 w-14 rounded-[10px]" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-56 max-w-full" />
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-6 w-28 rounded-full" />
              </div>
            </div>
          ))}
        </TraySheet>
      </Tray>
    </div>
  );
}
