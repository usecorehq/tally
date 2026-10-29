"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, PageHeader, SolarIcon, Tray, TraySheet } from "@tally/ui";
import { PICK_TITLE } from "./copy";

/** A failed read: says so and offers a retry. Never an empty page. */
export function LoadFailed({
  title,
  body,
  onRetry,
  retrying = false,
}: {
  title: string;
  body: string;
  onRetry: () => void;
  retrying?: boolean;
}) {
  return (
    <Tray className="max-w-[760px]">
      <TraySheet role="alert" className="flex flex-col items-center gap-2 px-6 py-12 text-center">
        <span className="mb-1 flex size-10 items-center justify-center rounded-full bg-red-50 text-red-600">
          <SolarIcon name="Danger-Circle" iconStyle="Outline" size={20} />
        </span>
        <p className="font-medium tracking-tight text-gray-900">{title}</p>
        <p className="max-w-sm break-words text-sm text-gray-500">{body}</p>
        <Button type="button" className="mt-2" variant="quiet" size="lg" disabled={retrying} onClick={onRetry}>
          <SolarIcon name="Refresh" iconStyle="Outline" size={16} />
          {retrying ? "Trying again…" : "Try again"}
        </Button>
      </TraySheet>
    </Tray>
  );
}

/** The page's businesses read failed: the stock-take heading, the error and a retry that re-runs the server read. */
export function BusinessesLoadFailed({ onRetry }: { onRetry?: () => void }) {
  const router = useRouter();
  const [retrying, startTransition] = useTransition();
  return (
    <>
      <PageHeader title={PICK_TITLE} className="[&_h1]:whitespace-normal" />
      <LoadFailed
        title="We couldn't load your businesses"
        body="Check your connection and try again."
        retrying={retrying}
        onRetry={onRetry ?? (() => startTransition(() => router.refresh()))}
      />
    </>
  );
}
