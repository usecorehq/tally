"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, ConfirmDialog, FormMessage, IconButton, SolarIcon } from "@tally/ui";
import { discardScan, rerunScan } from "./actions";
import { STOCKTAKE_CHANGED } from "./recents";
import { sessionHref } from "./urls";
import type { ActionResult } from "./types";

type Override<T> = () => Promise<ActionResult<T>>;

/** Runs the agent again on the stored photo; the new run opens at its own URL, grouped with this one. */
export function RerunButton({ businessId, scanId, run }: { businessId: string; scanId: string; run?: Override<{ runId: string }> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        variant="quiet"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await (run ? run() : rerunScan(businessId, scanId));
            if (!res.ok) return setError(res.error);
            window.dispatchEvent(new Event(STOCKTAKE_CHANGED));
            router.push(sessionHref(businessId, res.data.runId));
          })
        }
      >
        <SolarIcon name="Refresh" iconStyle="Outline" size={16} className={pending ? "animate-spin" : undefined} />
        {pending ? "Starting…" : "Rerun"}
      </Button>
      {error && <FormMessage message={error} className="max-w-xs text-right" />}
    </span>
  );
}

/** Drops an open stock-take after a confirm; it stays in history, read-only. */
export function DiscardButton({
  businessId,
  scanId,
  compact = false,
  discard,
  onDone,
}: {
  businessId: string;
  scanId: string;
  /** An icon button, for history rows. */
  compact?: boolean;
  discard?: Override<{ status: "discarded" }>;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      {compact ? (
        <IconButton icon="Trash-Bin-Minimalistic" label="Discard this stock-take" tone="ghost" onClick={() => setOpen(true)} />
      ) : (
        <Button variant="quiet" onClick={() => setOpen(true)}>
          <SolarIcon name="Trash-Bin-Minimalistic" iconStyle="Outline" size={16} />
          Discard
        </Button>
      )}
      <ConfirmDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setError(null);
        }}
        destructive
        title="Discard this stock-take?"
        description="Nothing changes in your stock. It stays in your history, read-only, and you can't confirm it later."
        confirmLabel="Discard"
        onConfirm={async () => {
          const res = await (discard ? discard() : discardScan(businessId, scanId));
          if (!res.ok) {
            setError(res.error);
            // Keeps the dialog open with the reason.
            throw new Error(res.error);
          }
          window.dispatchEvent(new Event(STOCKTAKE_CHANGED));
          if (onDone) onDone();
          else router.refresh();
        }}
      >
        {error && <FormMessage message={error} />}
      </ConfirmDialog>
    </>
  );
}
