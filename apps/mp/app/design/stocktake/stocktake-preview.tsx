"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@tally/ui";
import { PickView, Working, type Photo } from "../../stocktake/stocktake-flow";
import { Outcome, ReviewTable } from "../../stocktake/review-table";
import { BusinessesLoadFailed, LoadFailed } from "../../stocktake/load-failed";
import { PickSkeleton } from "../../stocktake/pick-skeleton";
import { PICK_TITLE } from "../../stocktake/copy";
import type { Variant } from "./variants";
import {
  DETECTIONS,
  ERRORS,
  OUTCOME,
  OUTCOME_FEEDBACK_ERROR,
  OUTCOME_INVALID,
  OUTCOME_WARN,
  RESULT,
  RESULT_EMPTY,
  RESULT_NO_CATALOGUE,
  STEPS,
  drawShelf,
} from "./fixtures";

const BUSINESSES = [
  { id: "b1", name: "Mama Nkechi Provisions" },
  { id: "b2", name: "Lekki Mini Mart" },
];
const noop = () => undefined;

const PICK_ERRORS: Partial<Record<Variant, string>> = {
  "pick-file-error": ERRORS.file,
  "pick-error-busy": ERRORS.busy,
  "pick-error-timeout": ERRORS.timeout,
  "pick-error-setup": ERRORS.setup,
  "pick-error-failed": ERRORS.failed,
};

const OUTCOMES = {
  outcome: OUTCOME,
  "outcome-invalid": OUTCOME_INVALID,
  "outcome-feedback-error": OUTCOME_FEEDBACK_ERROR,
  "outcome-warn": OUTCOME_WARN,
} as const;

/** Renders the real stock-take components on fixtures; nothing here calls a server action. */
export function StocktakePreview({ variant }: { variant: Variant }) {
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [startedAt] = useState(() => Date.now() - 48_000);
  const [businessId, setBusinessId] = useState("b1");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let url = "";
    drawShelf().then((blob) => {
      url = URL.createObjectURL(blob);
      setPhoto({ blob, url, width: 1600, height: 1000 });
    });
    return () => URL.revokeObjectURL(url);
  }, []);

  if (variant === "loading") return <PickSkeleton />;
  if (variant === "businesses-failed") return <BusinessesLoadFailed onRetry={noop} />;
  if (variant === "route-error") {
    // stocktake/error.tsx, which needs a router; same parts.
    return (
      <div className="q-rise">
        <PageHeader title={PICK_TITLE} className="[&_h1]:whitespace-normal" />
        <LoadFailed title="Something went wrong" body="We couldn't open stock-take. Try again, or refresh the page." onRetry={noop} />
      </div>
    );
  }

  if (variant.startsWith("pick")) {
    // A file error happens before any photo is kept; recognition errors come back with the photo still chosen.
    const withPhoto = variant !== "pick" && variant !== "pick-preparing" && variant !== "pick-file-error";
    return (
      <PickView
        businesses={BUSINESSES}
        businessId={businessId}
        onBusiness={setBusinessId}
        error={PICK_ERRORS[variant] ?? null}
        preparing={variant === "pick-preparing"}
        photo={withPhoto ? photo : null}
        fileRef={fileRef}
        onFile={noop}
        onAgent={noop}
        onQuick={noop}
      />
    );
  }

  if (variant in OUTCOMES) {
    return <Outcome businessName={BUSINESSES[0]!.name} result={OUTCOMES[variant as keyof typeof OUTCOMES]} rows={DETECTIONS} onRestart={noop} />;
  }

  if (!photo) return <p className="text-sm text-gray-500">Drawing the fixture photo…</p>;

  if (variant.startsWith("working")) {
    const mode = variant === "working-quick" ? "quick" : "agent";
    const steps = variant === "working-agent" ? STEPS : [];
    return <Working photo={photo} phase={{ name: "working", mode, steps, startedAt }} businessName={BUSINESSES[0]!.name} />;
  }

  const result = variant === "review-empty" ? RESULT_EMPTY : variant === "review-catalogue-off" ? RESULT_NO_CATALOGUE : RESULT;
  return (
    <ReviewTable
      businessId="b1"
      businessName={BUSINESSES[0]!.name}
      result={result}
      fallback={variant === "review-fallback"}
      photo={photo.blob}
      photoUrl={photo.url}
      onRestart={noop}
      initial={{
        attempted: variant === "review-invalid",
        error: variant === "review-confirm-failed" ? ERRORS.confirm : undefined,
        selected: variant === "review-selected" ? "d3" : undefined,
      }}
      confirm={async () => {
        await new Promise((r) => setTimeout(r, 1200));
        return variant === "review-confirm-failed" ? { ok: false, status: 500, error: ERRORS.confirm } : { ok: true, data: OUTCOME };
      }}
    />
  );
}
