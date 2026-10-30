"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Button,
  FieldLabel,
  FormMessage,
  IconTile,
  NativeSelect,
  Notice,
  PageHeader,
  QorellyLoader,
  SolarIcon,
  Tray,
  TrayFooter,
  TraySheet,
  WellHeader,
  cn,
  type SolarIconName,
} from "@tally/ui";
import { checkPhoto, quickScan, startStocktake } from "./actions";
import { checkCopy, localCheck, resizeForScan } from "./image";
import { PhotoCheckPanel, type CheckState } from "./photo-check";
import { PICK_SUBTITLE, PICK_TITLE } from "./copy";
import { runKey, savePhoto, scanKey } from "./photo-store";
import { historyHref, sessionHref } from "./urls";
import type { AgentStep } from "./types";

export type Business = { id: string; name: string };
export type Photo = { blob: Blob; url: string; width: number; height: number };

/** Below this long edge, packs on a whole shelf are too small to read reliably. */
const SMALL_PHOTO_EDGE = 1500;

export type Phase = { name: "pick" } | { name: "working"; mode: "agent" | "quick"; steps: AgentStep[]; startedAt: number };

/** A new stock-take: business, photo, then the kind of run. Each run continues at its own URL. */
export function StocktakeFlow({ businesses, initialBusinessId }: { businesses: Business[]; initialBusinessId: string }) {
  const router = useRouter();
  const businessId = initialBusinessId;
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [phase, setPhase] = useState<Phase>({ name: "pick" });
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [check, setCheck] = useState<CheckState | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Check each new photo: the browser's own checks at once, then Muse Spark's verdict. Advice only.
  useEffect(() => {
    if (!photo) return setCheck(null);
    let alive = true;
    setCheck({ status: "checking", local: null });
    (async () => {
      const local = await localCheck(photo.blob).catch(() => null);
      if (alive) setCheck({ status: "checking", local });
      const f = new FormData();
      const copy = await checkCopy(photo.blob).catch(() => null);
      if (copy) f.append("image", copy, "check.jpg");
      const res = copy ? await checkPhoto(businessId, f) : null;
      if (alive) setCheck({ status: "done", local, result: res?.ok ? res.data : null });
    })();
    return () => {
      alive = false;
    };
  }, [photo, businessId]);

  useEffect(() => () => {
    if (photo) URL.revokeObjectURL(photo.url);
  }, [photo]);

  const business = businesses.find((b) => b.id === businessId)!;

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setPreparing(true);
    try {
      const blob = await resizeForScan(file);
      const bitmap = await createImageBitmap(blob);
      setPhoto({ blob, url: URL.createObjectURL(blob), width: bitmap.width, height: bitmap.height });
      bitmap.close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't read that photo. Try another one.");
    } finally {
      setPreparing(false);
    }
  }

  function form() {
    const f = new FormData();
    f.append("image", photo!.blob, "shelf.jpg");
    return f;
  }

  const kept = () => ({ blob: photo!.blob, width: photo!.width, height: photo!.height });

  async function runQuick() {
    setError(null);
    setPhase({ name: "working", mode: "quick", steps: [], startedAt: Date.now() });
    const res = await quickScan(businessId, form());
    if (!res.ok) {
      setError(res.error);
      setPhase({ name: "pick" });
      return;
    }
    await savePhoto(scanKey(res.data.scanId), kept());
    router.push(sessionHref(businessId, res.data.scanId));
  }

  async function runAgent() {
    setError(null);
    setPhase({ name: "working", mode: "agent", steps: [], startedAt: Date.now() });
    const started = await startStocktake(businessId, form());
    if (!started.ok) {
      setError(started.error);
      setPhase({ name: "pick" });
      return;
    }
    // The run continues on the server; its own URL polls it and survives a refresh.
    await savePhoto(runKey(started.data.runId), kept());
    router.push(sessionHref(businessId, started.data.runId));
  }

  if (phase.name === "working") {
    return <Working photo={photo} phase={phase} businessName={business.name} />;
  }

  return (
    <PickView
      businessId={businessId}
      error={error}
      preparing={preparing}
      photo={photo}
      check={check}
      fileRef={fileRef}
      onFile={onFile}
      onAgent={runAgent}
      onQuick={runQuick}
      historyHref={historyHref(businessId)}
    />
  );
}

/** Choose the business and the photo, then the kind of run. Presentational, so /design can render it with fixtures. */
export function PickView({
  businessId,
  error,
  preparing,
  photo,
  check = null,
  fileRef,
  onFile,
  onAgent,
  onQuick,
  historyHref,
}: {
  businessId: string;
  error: string | null;
  preparing: boolean;
  photo: Photo | null;
  /** The photo check for the picked photo; null before one is picked. */
  check?: CheckState | null;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onFile: (file: File | undefined) => void;
  onAgent: () => void;
  onQuick: () => void;
  historyHref: string;
}) {
  return (
    <div className="q-rise max-w-[760px]">
      <PageHeader
        title={PICK_TITLE}
        subtitle={PICK_SUBTITLE}
        className="[&_h1]:whitespace-normal"
        actions={<HistoryButton href={historyHref} />}
      />

      <div className="space-y-5">

        {/* Without a photo the error is about the file; with one it's about the run, so it sits by the buttons. */}
        {!photo && <FormMessage message={error} />}

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          // Opens the rear camera on phones; a file picker on desktop.
          capture="environment"
          className="sr-only"
          id="photo"
          onChange={(e) => onFile(e.target.files?.[0])}
        />

        {photo ? (
          <div className="q-fade-in space-y-5">
            {/* The tray hugs the photo, whatever its shape. */}
            <Tray className="w-fit max-w-full">
              <TraySheet className="p-1">
                <div className="relative w-fit max-w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL */}
                  <img src={photo.url} alt="Shelf photo to scan" className="block max-h-[420px] w-auto max-w-full rounded-[10px] object-contain" />
                </div>
              </TraySheet>
              <TrayFooter>
                <span className="tabular-nums">
                  {photo.width}×{photo.height} JPEG · {Math.round(photo.blob.size / 1024)} KB
                </span>
                <Button variant="ghost" size="sm" className="-my-1 -mr-2 max-sm:h-11" onClick={() => fileRef.current?.click()}>
                  <SolarIcon name="Refresh" iconStyle="Outline" size={16} />
                  Use another photo
                </Button>
              </TrayFooter>
            </Tray>

            {check && <PhotoCheckPanel check={check} onRetake={() => fileRef.current?.click()} />}
            {Math.max(photo.width, photo.height) < SMALL_PHOTO_EDGE && (
              <FormMessage
                variant="warning"
                message="This photo is small, so products may be missed. Use the camera's full-size photo, or take a closer one of each shelf."
              />
            )}
            <FormMessage message={error} />
            {/* One primary, last: on the right on desktop, on top on phones. */}
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <Button size="xl" variant="soft" onClick={onQuick}>
                Quick scan
              </Button>
              <Button size="xl" onClick={onAgent}>
                <SolarIcon name="Stars" iconStyle="Bold" size={18} />
                Start stock-take
              </Button>
            </div>
            <Notice icon="Clock-Circle">
              Stock-take takes about a minute: an agent zooms into unclear labels and searches the catalogue again. Quick scan
              takes 15–30 seconds.
            </Notice>
          </div>
        ) : (
          <Tray size="lg">
            <label htmlFor="photo" className="block cursor-pointer">
              <TraySheet size="lg" className="flex flex-col items-center px-6 py-12 text-center sm:py-14">
                {preparing ? (
                  <span className="flex h-14 w-14 items-center justify-center">
                    <QorellyLoader className="h-9 w-9" />
                  </span>
                ) : (
                  <IconTile icon="Gallery-Add" active className="h-14 w-14" />
                )}
                <h2 className="mt-5 text-lg font-medium tracking-tight text-gray-900" aria-live="polite">
                  {preparing ? "Preparing photo…" : "Upload or take a shelf photo"}
                </h2>
                <p className="mt-1.5 max-w-sm text-sm text-gray-500">
                  JPEG, PNG or WebP. One shelf or a pile of stock, labels facing the camera.
                </p>
                {!preparing && (
                  <Button asChild size="lg" className="mt-6">
                    <span>
                      <SolarIcon name="Upload-Minimalistic" iconStyle="Outline" size={18} />
                      Choose a photo
                    </span>
                  </Button>
                )}
              </TraySheet>
            </label>
            <TrayFooter className="justify-center text-center">Nothing changes in your stock until you confirm.</TrayFooter>
          </Tray>
        )}
      </div>
    </div>
  );
}

/** The run in progress: the photo under a soft pulse (when this browser has it), the headline and the agent's trace. */
export function Working({
  photo,
  phase,
  businessName,
}: {
  photo: Pick<Photo, "url" | "width" | "height"> | null;
  phase: Extract<Phase, { name: "working" }>;
  businessName: string;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const elapsed = Math.max(0, Math.round((now - phase.startedAt) / 1000));
  const latest = phase.steps.at(-1);
  const headline =
    phase.mode === "quick"
      ? "Reading the shelf…"
      : latest
        ? `${describe(latest).title}…`
        : "First pass: reading the shelf…";

  return (
    <div className="q-rise grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-8">
      <Tray className="w-fit max-w-full self-start">
        {photo ? (
          <TraySheet className="relative overflow-hidden p-1">
            {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL */}
            <img src={photo.url} alt="Shelf being scanned" className="block max-h-[480px] w-auto max-w-full rounded-[10px] object-contain" />
            <span aria-hidden className="pointer-events-none absolute inset-1 animate-pulse rounded-[10px] bg-white/35" />
          </TraySheet>
        ) : (
          // Opened elsewhere while running: the stored photo arrives with the result.
          <TraySheet className="flex w-[min(360px,100%)] flex-col items-center px-6 py-12 text-center">
            <IconTile icon="Gallery-Add" className="h-12 w-12" />
            <p className="mt-3 text-sm text-gray-500">The shelf photo is saved with the stock-take and shows when it&apos;s ready.</p>
          </TraySheet>
        )}
        <TrayFooter>
          <span>{phase.mode === "quick" ? "Quick scan" : "Stock-take agent"}</span>
          {photo && photo.width > 0 && <span className="tabular-nums">{photo.width}×{photo.height}</span>}
        </TrayFooter>
      </Tray>

      <div className="min-w-0">
        <div className="flex items-start gap-3">
          <QorellyLoader className="mt-0.5 h-7 w-7" />
          <h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight text-gray-900" aria-live="polite">
            {headline}
          </h1>
        </div>
        <p className="mt-2 text-sm text-gray-500">
          {phase.mode === "quick" ? "Quick scan" : "Stock-take agent"} for {businessName} ·{" "}
          <span className="tabular-nums">{elapsed}s</span>
        </p>

        {phase.mode === "quick" ? (
          <Tray className="mt-6">
            <WellHeader title="What happens now" caption="15–30 seconds" />
            <TraySheet className="p-0">
              <ul className="divide-y divide-gray-100">
                {QUICK_STAGES.map(([icon, title, detail]) => (
                  <li key={title} className="flex items-center gap-3 px-4 py-3.5">
                    <IconTile icon={icon} className="h-10 w-10" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">{title}</p>
                      <p className="text-[13px] text-gray-500">{detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </TraySheet>
          </Tray>
        ) : (
          <Tray className="mt-6">
            <WellHeader title="What the agent is doing" count={phase.steps.length || undefined} />
            <TraySheet>
              <ol className="relative space-y-4 before:absolute before:bottom-1.5 before:left-[5px] before:top-1.5 before:w-px before:bg-gray-200">
                {phase.steps.length === 0 && (
                  <TraceItem current title="Reading every product, counting units and matching the catalogue" detail="About 20–30 s" />
                )}
                {/* Newest step first, so what the agent is doing now is always at the top. */}
                {phase.steps.map((s, i) => ({ s, i })).reverse().map(({ s, i }) => {
                  const d = describe(s);
                  return (
                    <TraceItem
                      key={i}
                      current={i === phase.steps.length - 1}
                      thought={s.kind === "thought"}
                      title={d.title}
                      detail={d.detail}
                    />
                  );
                })}
              </ol>
            </TraySheet>
          </Tray>
        )}
      </div>
    </div>
  );
}

const QUICK_STAGES: [SolarIconName, string, string][] = [
  ["Gallery-Add", "Read every product", "Muse Spark reads the labels in the photo"],
  ["Layers", "Count the units", "SAM outlines and counts each pack"],
  ["Magnifer", "Match the catalogue", "Qore Catalog finds the products and typical prices"],
];

function TraceItem({ title, detail, current, thought = false }: { title: string; detail?: string; current: boolean; thought?: boolean }) {
  return (
    <li className="q-fade-in relative pl-6">
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-1.5 h-[11px] w-[11px] rounded-full ring-4 ring-surface",
          current ? "bg-primary" : "bg-gray-300 dark:bg-gray-400",
        )}
      />
      {current && <span aria-hidden className="absolute left-0 top-1.5 h-[11px] w-[11px] animate-ping rounded-full bg-primary/40" />}
      <p className={cn("break-words text-sm", thought ? "italic text-gray-600" : "font-medium text-gray-900")}>{title}</p>
      {detail && <p className="mt-0.5 break-words text-[13px] text-gray-500">{detail}</p>}
    </li>
  );
}

/** A merchant-readable line for one agent step; `detail` is the API's own summary. */
function describe(s: AgentStep): { title: string; detail?: string } {
  if (s.kind === "baseline") return { title: s.summary.replace(/^First pass:/, "First pass done:"), detail: "Now checking the unclear lines" };
  if (s.kind === "thought") return { title: s.summary.length > 160 ? `${s.summary.slice(0, 160)}…` : s.summary };
  switch (s.tool) {
    case "zoom": {
      const m = /^read the label of "(.*)" up close$/.exec(s.summary);
      return m ? { title: `Zooming into “${m[1]}”`, detail: "Reading the label up close" } : { title: "Zooming into a label", detail: s.summary };
    }
    case "search_catalogue": {
      const m = /^search "(.*)" → (\d+)/.exec(s.summary);
      return m ? { title: `Searching catalogue for “${m[1]}”`, detail: `${m[2]} plausible match${m[2] === "1" ? "" : "es"}` } : { title: "Searching catalogue", detail: s.summary };
    }
    case "find_in_store":
      return { title: "Checking your store", detail: s.summary };
    case "count_units": {
      const m = /^count "(.*)" → (\d+)/.exec(s.summary);
      return m ? { title: `Counting “${m[1]}”`, detail: `${m[2]} found` } : { title: "Counting units", detail: s.summary };
    }
    case "record_line":
      return { title: "Recording a line", detail: s.summary };
    case "submit_stocktake":
      return { title: "Finishing the stock-take", detail: s.summary };
    default:
      return { title: s.tool ?? "Working", detail: s.summary };
  }
}

/** Opens the business's past stock-takes. */
export function HistoryButton({ href }: { href: string }) {
  return (
    <Button variant="quiet" asChild>
      <Link href={href}>
        <SolarIcon name="History" iconStyle="Outline" size={16} />
        History
      </Link>
    </Button>
  );
}
