"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, PageHeader, SolarIcon, Tray, TraySheet } from "@tally/ui";
import { pollStocktake } from "./actions";
import { ConfirmedView } from "./confirmed-view";
import { formatDateTime } from "./format";
import { LoadFailed } from "./load-failed";
import { loadPhoto, runKey, scanKey } from "./photo-store";
import { ReviewTable } from "./review-table";
import { HistoryButton, Working, type Photo } from "./stocktake-flow";
import { historyHref, newHref } from "./urls";
import type { ScanView, StocktakeRun } from "./types";

type Business = { id: string; name: string };

const POLL_MS = 1500;
/** Consecutive failed polls before saying so; the run keeps going on the server meanwhile. */
const POLL_FAILURES = 5;

/** The photo this browser kept for the session: undefined while looking, null when it has none. */
function usePhoto(key: string): Photo | null | undefined {
  const [photo, setPhoto] = useState<Photo | null | undefined>(undefined);
  useEffect(() => {
    let url = "";
    let alive = true;
    loadPhoto(key).then((p) => {
      if (!alive) return;
      if (p) url = URL.createObjectURL(p.blob);
      setPhoto(p ? { ...p, url } : null);
    });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [key]);
  return photo;
}

/** A stock-take run at /stocktake/history/<runId>: progress while it runs, then its scan; polling resumes after a refresh. */
export function RunSession({ business, initial }: { business: Business; initial: StocktakeRun }) {
  const [data, setData] = useState(initial);
  const [pollError, setPollError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const photo = usePhoto(runKey(initial.run.id));
  const running = data.run.status === "running";

  useEffect(() => {
    if (!running) return;
    let alive = true;
    let failures = 0;
    (async () => {
      while (alive) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        if (!alive) return;
        const res = await pollStocktake(business.id, initial.run.id);
        if (!alive) return;
        if (!res.ok) {
          if (++failures >= POLL_FAILURES) {
            setPollError(res.error);
            return;
          }
          continue;
        }
        failures = 0;
        setData(res.data);
        if (res.data.run.status !== "running") return;
      }
    })();
    return () => {
      alive = false;
    };
  }, [running, attempt, business.id, initial.run.id]);

  if (photo === undefined) return null;

  if (running) {
    if (pollError) {
      return (
        <div className="q-rise">
          <PageHeader title="Stock-take in progress" subtitle={business.name} className="[&_h1]:whitespace-normal" />
          <LoadFailed
            title="We lost track of this stock-take"
            body={`${pollError} It keeps running on our side; try again to pick it back up.`}
            onRetry={() => {
              setPollError(null);
              setAttempt((n) => n + 1);
            }}
          />
        </div>
      );
    }
    return (
      <Working
        photo={photo}
        phase={{ name: "working", mode: "agent", steps: data.steps, startedAt: new Date(data.run.startedAt).getTime() }}
        businessName={business.name}
      />
    );
  }

  if (data.run.status === "failed" || !data.result) {
    return <RunFailed business={business} startedAt={data.run.startedAt} error={data.run.error} />;
  }

  return <ScanContent business={business} scan={data.result} kind="stocktake" fallback={data.run.status === "fallback"} photo={photo} />;
}

/** A quick scan at /stocktake/history/<scanId>. */
export function ScanSession({ business, scan }: { business: Business; scan: ScanView }) {
  const photo = usePhoto(scanKey(scan.scanId));
  if (photo === undefined) return null;
  return <ScanContent business={business} scan={scan} kind="quick" fallback={false} photo={photo} />;
}

function ScanContent({
  business,
  scan,
  kind,
  fallback,
  photo,
}: {
  business: Business;
  scan: ScanView;
  kind: "stocktake" | "quick";
  fallback: boolean;
  photo: Photo | null;
}) {
  const router = useRouter();
  const history = <HistoryButton href={historyHref(business.id)} />;
  // This browser's copy shows at once; otherwise the photo stored with the scan.
  const photoUrl = photo?.url ?? scan.photoUrl ?? null;
  if (scan.status === "confirmed") {
    return (
      <ConfirmedView
        scan={scan}
        businessName={business.name}
        kind={kind}
        photoUrl={photoUrl}
        actions={
          <>
            {history}
            <Button asChild>
              <Link href={newHref(business.id)}>
                <SolarIcon name="Gallery-Add" iconStyle="Bold" size={16} />
                Take new stock
              </Link>
            </Button>
          </>
        }
      />
    );
  }
  return (
    <ReviewTable
      businessId={business.id}
      businessName={business.name}
      result={scan}
      fallback={fallback}
      photo={photo?.blob ?? null}
      photoUrl={photoUrl}
      onRestart={() => router.push(newHref(business.id))}
      actions={history}
    />
  );
}

/** A run that ended without a result: the reason, and the way to a new one. */
export function RunFailed({ business, startedAt, error }: { business: Business; startedAt: string; error: string | null }) {
  return (
    <div className="q-rise max-w-[760px]">
      <PageHeader
        title="Stock-take failed"
        subtitle={`${business.name} · started ${formatDateTime(startedAt)}`}
        className="[&_h1]:whitespace-normal"
        actions={<HistoryButton href={historyHref(business.id)} />}
      />
      <Tray>
        <TraySheet role="alert" className="flex flex-col items-center gap-2 px-6 py-12 text-center">
          <span className="mb-1 flex size-10 items-center justify-center rounded-full bg-red-50 text-red-600">
            <SolarIcon name="Danger-Circle" iconStyle="Outline" size={20} />
          </span>
          <p className="font-medium tracking-tight text-gray-900">This stock-take stopped before it finished</p>
          <p className="max-w-sm break-words text-sm text-gray-500">{sentence(error ?? "Something went wrong on our side")} Nothing in your stock changed.</p>
          <Button asChild className="mt-2" size="lg">
            <Link href={newHref(business.id)}>
              <SolarIcon name="Gallery-Add" iconStyle="Bold" size={16} />
              Take new stock
            </Link>
          </Button>
        </TraySheet>
      </Tray>
    </div>
  );
}

/** The session couldn't be read: not found (wrong link or business), or a retry. */
export function SessionLoadFailed({ businessId, status, error }: { businessId: string; status: number; error: string }) {
  const router = useRouter();
  const [retrying, startTransition] = useTransition();
  const missing = status === 404 || status === 400;
  return (
    <div className="q-rise">
      <PageHeader title="Stock-take" className="[&_h1]:whitespace-normal" actions={<HistoryButton href={historyHref(businessId)} />} />
      {missing ? (
        <Tray className="max-w-[760px]">
          <TraySheet className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <p className="font-medium tracking-tight text-gray-900">We couldn't find this stock-take</p>
            <p className="max-w-sm text-sm text-gray-500">It may belong to another of your businesses. Find it in the history.</p>
          </TraySheet>
        </Tray>
      ) : (
        <LoadFailed
          title="We couldn't open this stock-take"
          body={error}
          retrying={retrying}
          onRetry={() => startTransition(() => router.refresh())}
        />
      )}
    </div>
  );
}

const sentence = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);
