"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { historyHref } from "../urls";
import { HistoryView } from "./history-view";
import type { HistoryEntry } from "../types";

/** HistoryView with navigation: switching business and retrying re-run the server read. */
export function HistoryPage(props: { businesses: { id: string; name: string }[]; businessId: string; entries: HistoryEntry[] | null; error?: string }) {
  const router = useRouter();
  const [retrying, startTransition] = useTransition();
  return (
    <HistoryView
      {...props}
      onBusiness={(id) => router.push(historyHref(id))}
      onRetry={() => startTransition(() => router.refresh())}
      retrying={retrying}
    />
  );
}
