"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { HistoryView } from "./history-view";
import type { HistoryEntry } from "../types";

/** HistoryView with navigation: retrying re-runs the server read. */
export function HistoryPage(props: { businesses: { id: string; name: string }[]; businessId: string; entries: HistoryEntry[] | null; error?: string }) {
  const router = useRouter();
  const [retrying, startTransition] = useTransition();
  return (
    <HistoryView
      {...props}
      onRetry={() => startTransition(() => router.refresh())}
      retrying={retrying}
    />
  );
}
