import { useEffect, useState } from "react";
import { SolarIcon } from "@tally/ui";

type Phase = "camera" | "scan" | "review" | "done";

// How long each screen holds, in ms; the loop restarts after "done".
const TIMELINE: { phase: Phase; ms: number }[] = [
  { phase: "camera", ms: 2600 },
  { phase: "scan", ms: 4200 },
  { phase: "review", ms: 4200 },
  { phase: "done", ms: 2600 },
];

// Units on the shelf photo (public/hero/shelf.jpg), in % of the frame. `line` 0 is the reviewed product.
export const SHELF_BOXES: { x: number; y: number; w: number; h: number; line: number }[] = [
  ...[19, 22.9, 26.9, 30.6].map((y) => ({ x: 13, y, w: 24, h: 3.6, line: 0 })),
  ...[18.2, 21.4, 24.5, 27.6, 30.9].map((y) => ({ x: 38, y, w: 18.5, h: 3.1, line: 1 })),
  ...[18.2, 21.4, 24.5, 27.6, 30.9].map((y) => ({ x: 57, y, w: 18, h: 3.1, line: 2 })),
  ...[41.5, 45.5, 49.5].map((y) => ({ x: 41, y, w: 26, h: 3.8, line: 3 })),
  ...[61.5, 65.5].map((y) => ({ x: 16, y, w: 24, h: 3.6, line: 4 })),
];

const SCAN_STAGES = ["Reading every label…", "Counting units…", "Matching to Qore Catalog…"];
const STEPS: { label: string; phases: Phase[] }[] = [
  { label: "Snap", phases: ["camera"] },
  { label: "Scan", phases: ["scan"] },
  { label: "Confirm", phases: ["review", "done"] },
];

function usePhase(): { phase: Phase; elapsed: number } {
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    setStill(mq.matches);
    const onChange = () => setStill(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (still) return;
    const started = performance.now();
    const tick = setInterval(() => setElapsed(performance.now() - started), 100);
    const next = setTimeout(() => setIndex((i) => (i + 1) % TIMELINE.length), TIMELINE[index]!.ms);
    return () => {
      clearInterval(tick);
      clearTimeout(next);
      setElapsed(0);
    };
  }, [index, still]);

  // Reduced motion: hold on the review, the screen that explains the most.
  return still ? { phase: "review", elapsed: 0 } : { phase: TIMELINE[index]!.phase, elapsed };
}

/** The mobile flow as a looping demo: snap a shelf, scan it, confirm a line, stock updated. */
export function ScanDemo() {
  const { phase, elapsed } = usePhase();
  const scanMs = TIMELINE[1]!.ms;
  const stage = SCAN_STAGES[Math.min(SCAN_STAGES.length - 1, Math.floor((elapsed / scanMs) * SCAN_STAGES.length))];
  const shown = phase === "scan" ? Math.ceil((elapsed / (scanMs * 0.8)) * SHELF_BOXES.length) : phase === "camera" ? 0 : SHELF_BOXES.length;

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative w-[290px] max-w-full rounded-[46px] bg-gray-950 p-2.5 shadow-[0_32px_80px_-20px_rgba(0,0,0,0.6)] ring-1 ring-white/10">
        <div className="relative flex h-[580px] flex-col overflow-hidden rounded-[38px] bg-surface">
          <div className="relative z-10 flex items-center justify-between px-6 pb-1 pt-3 text-[11px] font-semibold text-gray-900">
            <span>9:41</span>
            <span className="h-5 w-20 rounded-full bg-gray-950" aria-hidden />
            <span className="tabular-nums">100%</span>
          </div>

          {phase === "done" ? <Done /> : (
            <>
              <div className="flex items-center justify-between px-4 pb-2 pt-1">
                <p className="text-[13px] font-medium text-gray-900">
                  {phase === "camera" ? "Scan a shelf" : phase === "scan" ? "Scanning" : "Check what we found"}
                </p>
                {phase === "review" && <span className="text-[11px] tabular-nums text-gray-500">1 of 5</span>}
              </div>

              <div className="relative mx-3 overflow-hidden rounded-[18px] bg-gray-900">
                <img src="/landing/hero/shelf.jpg" alt="" className={`block aspect-[3/4] w-full object-cover transition duration-500 ${phase === "scan" ? "brightness-75" : ""}`} />
                {SHELF_BOXES.slice(0, shown).map((b, i) => {
                  const on = phase === "review" && b.line === 0;
                  return (
                    <span
                      key={i}
                      className={`q-pop absolute rounded-[3px] border-[1.5px] transition-colors ${
                        on ? "border-primary bg-primary/25" : phase === "review" ? "border-white/50" : "border-white"
                      }`}
                      style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%` }}
                    />
                  );
                })}
                {phase === "camera" && <Viewfinder />}
                {phase === "scan" && (
                  <div className="absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur-sm">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                    {stage}
                  </div>
                )}
              </div>

              <div className="flex flex-1 flex-col justify-end px-3 pb-4 pt-3">
                {phase === "camera" && (
                  <div className="flex flex-col items-center gap-3">
                    <p className="text-[11px] text-gray-500">Step back so the whole shelf fits</p>
                    <span className="relative flex h-14 w-14 items-center justify-center rounded-full ring-4 ring-gray-200">
                      <span className="h-11 w-11 animate-pulse rounded-full bg-primary" />
                    </span>
                  </div>
                )}
                {phase === "scan" && (
                  <div className="space-y-2">
                    <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-100"
                        style={{ width: `${Math.min(100, (elapsed / scanMs) * 100)}%` }}
                      />
                    </div>
                    <p className="text-center text-[11px] tabular-nums text-gray-500">{Math.min(shown, SHELF_BOXES.length)} units found</p>
                  </div>
                )}
                {phase === "review" && <ReviewCard pressing={elapsed > 3300} />}
              </div>
            </>
          )}
        </div>
      </div>

      <ol className="flex items-center gap-1.5 rounded-full bg-white/10 p-1 text-[12px] font-medium backdrop-blur-md" aria-label="What the demo shows">
        {STEPS.map((s, i) => {
          const on = s.phases.includes(phase);
          return (
            <li
              key={s.label}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors ${on ? "bg-white text-gray-900" : "text-white/70"}`}
            >
              <span className="tabular-nums">{i + 1}</span>
              {s.label}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Camera corners, as in the Tally logo. */
function Viewfinder() {
  const corner = "absolute h-8 w-8 border-white";
  return (
    <div className="pointer-events-none absolute inset-4">
      <span className={`${corner} left-0 top-0 rounded-tl-lg border-l-[3px] border-t-[3px]`} />
      <span className={`${corner} right-0 top-0 rounded-tr-lg border-r-[3px] border-t-[3px]`} />
      <span className={`${corner} bottom-0 left-0 rounded-bl-lg border-b-[3px] border-l-[3px]`} />
      <span className={`${corner} bottom-0 right-0 rounded-br-lg border-b-[3px] border-r-[3px]`} />
    </div>
  );
}

function ReviewCard({ pressing }: { pressing: boolean }) {
  return (
    <div className="q-rise space-y-2.5">
      <div className="rounded-[16px] bg-gray-100 p-1">
        <div className="space-y-2 rounded-[12px] bg-surface p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-hairline/[0.04]">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[13px] font-medium leading-tight text-gray-900">Toothpaste 140g</p>
              <p className="text-[11px] text-gray-500">red box · high confidence</p>
            </div>
            <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">In store</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-gray-500">Count</span>
            <span className="inline-flex items-center rounded-lg bg-gray-100 text-[12px] font-semibold tabular-nums text-gray-900">
              <span className="px-2.5 py-1 text-gray-500">−</span>4<span className="px-2.5 py-1 text-primary-ink">+</span>
            </span>
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <span className="flex h-9 flex-1 items-center justify-center rounded-xl bg-gray-100 text-[12px] font-medium text-gray-900">Skip</span>
        <span
          className={`flex h-9 flex-[2] items-center justify-center rounded-xl bg-primary text-[12px] font-medium text-primary-foreground transition-transform duration-150 ${pressing ? "scale-95" : ""}`}
        >
          Restock
        </span>
      </div>
    </div>
  );
}

function Done() {
  return (
    <div className="q-rise flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
        <SolarIcon name="Check-Circle" size={30} />
      </span>
      <p className="text-[17px] font-semibold tracking-tight text-gray-900">Stock updated</p>
      <p className="text-[12px] text-gray-500">5 products counted from one photo, 4 units added to toothpaste.</p>
    </div>
  );
}
