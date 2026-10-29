"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, SolarIcon, Tray, TraySheet } from "@tally/ui";

/**
 * Something threw while rendering Inventory (the page's own reads already
 * show their failures inline). The shell is a server component, so this
 * stands alone on the grey frame.
 */
export default function InventoryError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gray-100 px-4 py-10">
      <Tray size="lg" className="w-full max-w-[440px] bg-gray-200/60">
        <TraySheet size="lg" className="flex flex-col items-center gap-2 text-center max-sm:p-6">
          <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-red-50 text-red-600">
            <SolarIcon name="Danger-Circle" iconStyle="Outline" size={24} />
          </span>
          <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-gray-900">Inventory didn't load</h1>
          <p className="text-[13px] leading-5 text-gray-500">Something went wrong on our side. Try again in a moment.</p>
          <div className="mt-6 flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-center">
            <Button asChild variant="quiet" size="lg">
              <Link href="/">Your businesses</Link>
            </Button>
            <Button size="lg" onClick={() => retry()}>
              <SolarIcon name="Refresh" iconStyle="Outline" size={18} />
              Try again
            </Button>
          </div>
        </TraySheet>
      </Tray>
    </main>
  );
}
