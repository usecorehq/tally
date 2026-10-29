"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@tally/ui";
import { PickView, Working, type Photo } from "../../stocktake/stocktake-flow";
import { Outcome, ReviewTable } from "../../stocktake/review-table";
import { BusinessesLoadFailed, LoadFailed } from "../../stocktake/load-failed";
import { PickSkeleton } from "../../stocktake/pick-skeleton";
import { PICK_TITLE } from "../../stocktake/copy";
import { cropThumbs } from "../../stocktake/image";
import { ConfirmedView } from "../../stocktake/confirmed-view";
import { HistorySkeleton, HistoryView } from "../../stocktake/history/history-view";
import { SessionSkeleton } from "../../stocktake/session-skeleton";
import { RunFailed } from "../../stocktake/session";
import { HistoryButton } from "../../stocktake/stocktake-flow";
import { RecentsList } from "../../stocktake/recents";
import { DiscardButton, RerunButton } from "../../stocktake/scan-actions";
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
  confirmed,
  ended,
  drawShelf,
  history,
  reopened,
} from "./fixtures";

const BUSINESSES = [
  { id: "b1", name: "Mama Nkechi Provisions" },
  { id: "b2", name: "Lekki Mini Mart" },
];
const noop = () => undefined;
// Rerun says why it can't run; Discard succeeds after a pause. Neither calls a server action.
const fakeRerun = async () => ({ ok: false as const, status: 409, error: "Preview only: a real rerun opens the new run here." });
const fakeDiscard = async () => {
  await new Promise((r) => setTimeout(r, 600));
  return { ok: true as const, data: { status: "discarded" as const } };
};

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
  const [crops, setCrops] = useState<Record<string, string>>({});
  // Set after mount: fixture times relative to it would differ between server and client render.
  const [now, setNow] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let url = "";
    drawShelf().then((blob) => {
      url = URL.createObjectURL(blob);
      setPhoto({ blob, url, width: 1600, height: 1000 });
      // Stands in for the stored R2 crops of a reopened scan.
      cropThumbs(blob, DETECTIONS, 160).then(setCrops, () => undefined);
    });
    setNow(Date.now());
    return () => URL.revokeObjectURL(url);
  }, []);

  if (variant === "loading") return <PickSkeleton />;

  if (variant.startsWith("recents")) {
    if (now === null) return null;
    const data = variant === "recents-loading" ? null : variant === "recents-failed" ? "failed" : { businessId: "b1", entries: variant === "recents-empty" ? [] : history(now) };
    // The sidebar's stock-take section (stocktake/recents.tsx), at the sidebar's width.
    return (
      <div className="flex h-[560px] w-60 flex-col rounded-[18px] bg-gray-100 px-3 py-3">
        <RecentsList data={data as Parameters<typeof RecentsList>[0]["data"]} active="r2" newActive={false} onRetry={noop} />
      </div>
    );
  }
  if (variant === "history-loading") return <HistorySkeleton />;
  if (variant.startsWith("history")) {
    if (now === null) return null;
    return (
      <HistoryView
        businesses={BUSINESSES}
        businessId={businessId}
        entries={variant === "history-failed" ? null : variant === "history-empty" ? [] : history(now)}
        error={variant === "history-failed" ? "Something went wrong on our side. Try again." : undefined}
        onBusiness={setBusinessId}
        onRetry={noop}
        discard={fakeDiscard}
      />
    );
  }
  if (variant === "session-loading") return <SessionSkeleton />;
  if (variant === "session-failed") {
    if (now === null) return null;
    return <RunFailed business={BUSINESSES[0]!} startedAt={new Date(now - 27 * 3_600_000).toISOString()} error="First pass failed: Database busy, retry shortly" />;
  }
  if (variant === "session-not-found") {
    // session.tsx's SessionLoadFailed needs a router; same parts.
    return (
      <div className="q-rise">
        <PageHeader title="Stock-take" className="[&_h1]:whitespace-normal" actions={<HistoryButton href="#" />} />
        <LoadFailed title="We couldn't open this stock-take" body={ERRORS.failed} onRetry={noop} />
      </div>
    );
  }
  if (variant === "session-discarded" || variant === "session-superseded") {
    if (Object.keys(crops).length === 0 || now === null) return <p className="text-sm text-gray-500">Drawing the fixture crops…</p>;
    const scan = ended(variant === "session-discarded" ? "discarded" : "superseded", crops, now);
    return (
      <ConfirmedView
        scan={scan}
        businessName={BUSINESSES[0]!.name}
        kind="stocktake"
        actions={
          <>
            <HistoryButton href="#" />
            {scan.canRerun && <RerunButton businessId="b1" scanId="scan-fixture" run={fakeRerun} />}
          </>
        }
      />
    );
  }
  if (variant === "session-confirmed") {
    if (Object.keys(crops).length === 0 || now === null) return <p className="text-sm text-gray-500">Drawing the fixture crops…</p>;
    return <ConfirmedView scan={confirmed(crops, now)} businessName={BUSINESSES[0]!.name} kind="stocktake" actions={<HistoryButton href="#" />} />;
  }
  if (variant === "session-working-no-photo") {
    return <Working photo={null} phase={{ name: "working", mode: "agent", steps: STEPS, startedAt }} businessName={BUSINESSES[0]!.name} />;
  }
  if (variant === "session-reopened") {
    if (Object.keys(crops).length === 0 || now === null) return <p className="text-sm text-gray-500">Drawing the fixture crops…</p>;
    return (
      <ReviewTable
        businessId="b1"
        businessName={BUSINESSES[0]!.name}
        result={reopened(crops, now)}
        fallback={false}
        photo={null}
        photoUrl={null}
        onRestart={noop}
        actions={
          <>
            <HistoryButton href="#" />
            <RerunButton businessId="b1" scanId="scan-fixture" run={fakeRerun} />
            <DiscardButton businessId="b1" scanId="scan-fixture" discard={fakeDiscard} onDone={noop} />
          </>
        }
        confirm={async () => ({ ok: true, data: OUTCOME })}
      />
    );
  }
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
        historyHref="#"
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
