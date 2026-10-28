"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button, FormMessage, Label, NativeSelect, QorellyLoader, SolarIcon, cn } from "@tally/ui";
import { pollStocktake, quickScan, startStocktake } from "./actions";
import { resizeForScan } from "./image";
import { ReviewTable } from "./review-table";
import type { AgentStep, ShelfScanResult } from "./types";

type Business = { id: string; name: string };
type Photo = { blob: Blob; url: string; width: number; height: number };

type Phase =
  | { name: "pick" }
  | { name: "working"; mode: "agent" | "quick"; steps: AgentStep[]; startedAt: number }
  | { name: "review"; result: ShelfScanResult; fallback: boolean };

const POLL_MS = 1500;
// The agent's budget is 150 s after a ~20–30 s first pass; stop polling well after that.
const POLL_GIVE_UP_MS = 6 * 60 * 1000;

/** Page frame: logo, title and a way back, like the onboarding shell but wider for the review table. */
export function Shell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/95 backdrop-blur-sm">
        <div className={cn("mx-auto flex items-center gap-4 px-6 py-4", wide ? "max-w-[1120px]" : "max-w-[880px]")}>
          <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-primary text-sm font-bold text-white" aria-hidden>
            T
          </div>
          <p className="flex-1 text-[15px] font-medium text-gray-900">Stock-take</p>
          <Button asChild variant="ghost" size="sm">
            <Link href="/">
              <SolarIcon name="Alt-Arrow-Left" iconStyle="Outline" size={16} />
              Businesses
            </Link>
          </Button>
        </div>
      </header>
      <main className={cn("mx-auto w-full flex-1 px-6 pb-32 pt-8", wide ? "max-w-[1120px]" : "max-w-[880px]")}>{children}</main>
    </div>
  );
}

export function StocktakeFlow({ businesses, initialBusinessId }: { businesses: Business[]; initialBusinessId: string }) {
  const [businessId, setBusinessId] = useState(initialBusinessId);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [phase, setPhase] = useState<Phase>({ name: "pick" });
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // Bumped to cancel an in-flight poll loop (new scan, unmount).
  const pollGen = useRef(0);

  useEffect(() => () => void pollGen.current++, []);
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

  async function runQuick() {
    setError(null);
    setPhase({ name: "working", mode: "quick", steps: [], startedAt: Date.now() });
    const res = await quickScan(businessId, form());
    if (res.ok) setPhase({ name: "review", result: res.data, fallback: false });
    else {
      setError(res.error);
      setPhase({ name: "pick" });
    }
  }

  async function runAgent() {
    setError(null);
    const gen = ++pollGen.current;
    const startedAt = Date.now();
    setPhase({ name: "working", mode: "agent", steps: [], startedAt });
    const started = await startStocktake(businessId, form());
    if (!started.ok) {
      setError(started.error);
      setPhase({ name: "pick" });
      return;
    }

    while (pollGen.current === gen) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      if (pollGen.current !== gen) return;
      const res = await pollStocktake(businessId, started.data.runId);
      if (pollGen.current !== gen) return;
      if (!res.ok) {
        // A blip while polling isn't fatal; the run keeps going on the server.
        if (Date.now() - startedAt < POLL_GIVE_UP_MS) continue;
        setError(res.error);
        setPhase({ name: "pick" });
        return;
      }
      const { run, steps, result } = res.data;
      if (run.status === "running") {
        if (Date.now() - startedAt > POLL_GIVE_UP_MS) {
          setError("The stock-take is taking much longer than usual. Try again, or use Quick scan.");
          setPhase({ name: "pick" });
          return;
        }
        setPhase({ name: "working", mode: "agent", steps, startedAt });
        continue;
      }
      if (run.status === "failed" || !result) {
        setError(`The stock-take failed${run.error ? `: ${run.error}` : ""}. Try again, or use Quick scan.`);
        setPhase({ name: "pick" });
        return;
      }
      setPhase({ name: "review", result, fallback: run.status === "fallback" });
      return;
    }
  }

  function reset() {
    pollGen.current++;
    setPhase({ name: "pick" });
    setPhoto(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  if (phase.name === "working") {
    return (
      <Shell>
        <Working photo={photo!} phase={phase} businessName={business.name} />
      </Shell>
    );
  }

  if (phase.name === "review") {
    return (
      <Shell wide>
        <ReviewTable
          businessId={businessId}
          businessName={business.name}
          result={phase.result}
          fallback={phase.fallback}
          photo={photo!.blob}
          onRestart={reset}
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">Count a shelf from a photo</h1>
      <p className="mt-2 text-base text-gray-500">
        Tally reads every product in the photo, counts the units and matches them to the catalogue. You check the
        results before anything changes in your stock.
      </p>

      <div className="mt-8 space-y-6">
        {businesses.length > 1 && (
          <div className="max-w-sm space-y-1.5">
            <Label htmlFor="business" className="text-xs text-gray-500">
              Business
            </Label>
            <NativeSelect id="business" value={businessId} onChange={(e) => setBusinessId(e.target.value)}>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </NativeSelect>
          </div>
        )}

        <FormMessage message={error} />

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
          <div className="space-y-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL */}
            <img
              src={photo.url}
              alt="Shelf photo to scan"
              className="max-h-[420px] w-full rounded-2xl border border-gray-200 bg-gray-50 object-contain"
            />
            <p className="text-[13px] text-gray-500">
              {photo.width}×{photo.height} JPEG · {Math.round(photo.blob.size / 1024)} KB ·{" "}
              <button type="button" className="font-medium text-primary hover:underline" onClick={() => fileRef.current?.click()}>
                Use another photo
              </button>
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="cta" onClick={runAgent}>
                <SolarIcon name="Stars" iconStyle="Bold" size={18} />
                Start stock-take
              </Button>
              <Button size="cta" variant="outline" onClick={runQuick}>
                Quick scan
              </Button>
            </div>
            <p className="text-[13px] text-gray-500">
              Stock-take takes about a minute: an agent zooms into unclear labels and searches the catalogue again.
              Quick scan takes 15–30 seconds.
            </p>
          </div>
        ) : (
          <label
            htmlFor="photo"
            className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-300 px-6 py-16 text-center transition hover:border-primary hover:bg-primary-light/40"
          >
            {preparing ? (
              <QorellyLoader className="h-8 w-8" />
            ) : (
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-light text-primary">
                <SolarIcon name="Gallery-Add" iconStyle="Bold" size={28} />
              </span>
            )}
            <span className="text-[15px] font-medium text-gray-900">{preparing ? "Preparing photo…" : "Upload or take a shelf photo"}</span>
            <span className="text-[13px] text-gray-500">JPEG, PNG or WebP. One shelf or a pile of stock, labels facing the camera.</span>
          </label>
        )}
      </div>
    </Shell>
  );
}

function Working({ photo, phase, businessName }: { photo: Photo; phase: Extract<Phase, { name: "working" }>; businessName: string }) {
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
    <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL */}
      <img src={photo.url} alt="Shelf being scanned" className="w-full rounded-2xl border border-gray-200 bg-gray-50 object-contain" />
      <div>
        <div className="flex items-center gap-3">
          <QorellyLoader className="h-6 w-6" />
          <h1 className="text-xl font-semibold tracking-tight text-gray-900" aria-live="polite">
            {headline}
          </h1>
        </div>
        <p className="mt-2 text-[13px] text-gray-500">
          {phase.mode === "quick" ? "Quick scan" : "Stock-take agent"} for {businessName} · {elapsed}s
        </p>

        {phase.mode === "quick" ? (
          <p className="mt-6 text-sm text-gray-600">
            Muse Spark reads every product, SAM counts the units and Qore Catalog matches them. This takes 15–30 seconds.
          </p>
        ) : (
          <ol className="mt-6 space-y-3 border-l border-gray-200 pl-5">
            {phase.steps.length === 0 && (
              <li className="text-sm text-gray-500">Reading every product, counting units and matching the catalogue (about 20–30 s).</li>
            )}
            {phase.steps.map((s, i) => {
              const d = describe(s);
              const last = i === phase.steps.length - 1;
              return (
                <li key={i} className="relative">
                  <span
                    className={cn(
                      "absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full",
                      last ? "bg-primary" : "bg-gray-300",
                    )}
                    aria-hidden
                  />
                  <p className={cn("text-sm", s.kind === "thought" ? "italic text-gray-600" : "font-medium text-gray-900")}>{d.title}</p>
                  {d.detail && <p className="mt-0.5 break-words text-[13px] text-gray-500">{d.detail}</p>}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

/** A merchant-readable line for one agent step; `detail` is the API's own summary. */
function describe(s: AgentStep): { title: string; detail?: string } {
  if (s.kind === "baseline") return { title: s.summary.replace(/^First pass:/, "First pass done:"), detail: "Now checking the unclear lines" };
  if (s.kind === "thought") return { title: s.summary.length > 160 ? `${s.summary.slice(0, 160)}…` : s.summary };
  switch (s.tool) {
    case "zoom":
      return { title: "Zooming into a label", detail: s.summary };
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
