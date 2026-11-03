import { useEffect, useRef, useState, type ReactNode } from "react";
import { SolarIcon } from "@tally/ui";
import { delay } from "./reveal";

/** Steps through `count` states while the panel is on screen; holds the last one under reduced motion. */
function useLoop(count: number, ms: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [still, setStill] = useState(false);

  useEffect(() => {
    setStill(matchMedia("(prefers-reduced-motion: reduce)").matches);
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(Boolean(e?.isIntersecting)), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || still) return;
    const t = setTimeout(() => setStep((s) => (s + 1) % count), ms);
    return () => clearTimeout(t);
  }, [visible, still, step, count, ms]);

  return { ref, step: still ? count - 1 : step };
}

/** A product photo cut into a sticker: white edge, a tilt, a soft drop, popping in after `delay`. */
function Sticker({ src, className, rotate, delay = 0, show = true }: { src: string; className: string; rotate: number; delay?: number; show?: boolean }) {
  return (
    <span
      aria-hidden
      className={`absolute rounded-[14px] bg-white p-1 shadow-[0_12px_28px_-10px_rgba(0,0,0,0.45)] transition-[opacity,transform] duration-500 [transition-timing-function:var(--ease-out)] ${className}`}
      style={{
        transform: `rotate(${rotate}deg) scale(${show ? 1 : 0.6})`,
        opacity: show ? 1 : 0,
        transitionDelay: show ? `${delay}ms` : "0ms",
      }}
    >
      <img src={src} alt="" className="how-float block h-full w-full rounded-[10px] object-cover" style={{ animationDelay: `${delay}ms` }} />
    </span>
  );
}

/** The panel: a blurred shop photo with the UI and stickers on top. */
function Panel({ bg, children, panelRef }: { bg: string; children: ReactNode; panelRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div ref={panelRef} className="relative aspect-square w-full overflow-hidden rounded-[24px] bg-gray-900">
      <img src={bg} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover blur-[10px] brightness-[0.82] saturate-[1.15]" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/25" aria-hidden />
      {children}
    </div>
  );
}

const PILL = "flex items-center gap-2 rounded-full bg-white/95 px-4 py-2.5 text-[13px] text-gray-900 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.35)] backdrop-blur-md";

function Tick() {
  return (
    <svg width={12} height={12} viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M2.5 6.2 5 8.6l4.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Dots() {
  return (
    <span className="flex gap-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-1.5 animate-pulse rounded-full bg-primary" style={{ animationDelay: `${i * 150}ms` }} />
      ))}
    </span>
  );
}

function CountPanel() {
  const { ref, step } = useLoop(3, 1900);
  const found = step >= 1;
  return (
    <Panel bg="/landing/how/bg5.jpg" panelRef={ref}>
      <Sticker src="/landing/how/tin.jpg" className="left-[12%] top-[14%] h-[26%] w-[26%]" rotate={-8} delay={0} show={found} />
      <Sticker src="/landing/how/honey.jpg" className="right-[10%] top-[18%] h-[17%] w-[40%]" rotate={6} delay={120} show={found} />
      <Sticker src="/landing/how/cheese.jpg" className="bottom-[14%] left-[18%] h-[25%] w-[25%]" rotate={5} delay={240} show={found} />
      {[
        { c: "left-[30%] top-[12%]", n: "×4", d: 200 },
        { c: "right-[12%] top-[14%]", n: "×12", d: 320 },
        { c: "bottom-[36%] left-[36%]", n: "×6", d: 440 },
      ].map((b) => (
        <span
          key={b.n}
          className={`absolute rounded-full bg-primary px-2.5 py-1 text-[12px] font-semibold tabular-nums text-white shadow-lg transition-[opacity,transform] duration-300 ${b.c}`}
          style={{ opacity: found ? 1 : 0, transform: `scale(${found ? 1 : 0.5})`, transitionDelay: found ? `${b.d}ms` : "0ms" }}
        >
          {b.n}
        </span>
      ))}
      <div className="absolute inset-x-[9%] top-1/2 -translate-y-1/2">
        <div className={PILL}>
          {step === 0 ? (
            <>
              <span className="flex-1 text-gray-600">Counting units</span>
              <Dots />
            </>
          ) : (
            <>
              <SolarIcon name="Check-Circle" size={18} className="text-emerald-600" />
              <span className="flex-1 font-medium tabular-nums">22 units · 3 products</span>
              <span className="text-gray-500">{step === 2 ? "Review" : "Found"}</span>
            </>
          )}
        </div>
      </div>
    </Panel>
  );
}

const MATCHES = [
  { name: "Infant cereal 400g", score: "Strong", tone: "bg-emerald-50 text-emerald-700" },
  { name: "Infant cereal 250g", score: "Medium", tone: "bg-amber-50 text-amber-700" },
  { name: "Breakfast cereal 400g", score: "Low", tone: "bg-gray-100 text-gray-600" },
];

function MatchPanel() {
  const { ref, step } = useLoop(4, 1500);
  const picked = step >= 2;
  return (
    <Panel bg="/landing/how/bg3.jpg" panelRef={ref}>
      <Sticker src="/landing/how/cookies.jpg" className="left-[7%] top-[8%] h-[24%] w-[21%]" rotate={-9} delay={0} />
      <Sticker src="/landing/how/trugrains.jpg" className="right-[7%] top-[10%] h-[24%] w-[21%]" rotate={8} delay={150} />
      <Sticker src="/landing/how/nutrova.jpg" className="bottom-[8%] right-[12%] h-[21%] w-[21%]" rotate={-5} delay={300} />
      <div className="absolute inset-x-[11%] top-[30%]">
        <div className="rounded-[20px] bg-white/95 p-1.5 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.45)] backdrop-blur-md">
          <div className="flex items-center gap-2 px-3 pb-2 pt-2 text-[12px] text-gray-500">
            <span className="size-1.5 rounded-[2px] bg-primary" />
            Qore Catalog · 206,000+ products
          </div>
          <div className="space-y-1">
            {MATCHES.map((m, i) => {
              const on = picked && i === 0;
              return (
                <div
                  key={m.name}
                  className={`flex items-center gap-2 rounded-[14px] px-3 py-2.5 transition-colors duration-300 ${on ? "bg-primary-light" : step >= 1 && i === 0 ? "bg-gray-50" : ""}`}
                  style={{ opacity: step === 0 && i > 0 ? 0.35 : 1 }}
                >
                  <span className="flex-1 truncate text-[13px] font-medium text-gray-900">{m.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${m.tone}`}>{m.score}</span>
                  <span
                    className={`flex size-5 items-center justify-center rounded-full border transition-colors ${on ? "border-primary bg-primary text-white" : "border-gray-300"}`}
                  >
                    {on && <Tick />}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="px-3 pb-2 pt-2 text-[12px] text-gray-500">{picked ? "Matched with a typical ₦ shelf price" : "Reading the label…"}</div>
        </div>
      </div>
    </Panel>
  );
}

function ConfirmPanel() {
  const { ref, step } = useLoop(3, 1800);
  const printed = step >= 1;
  return (
    <Panel bg="/landing/how/bg2.jpg" panelRef={ref}>
      <Sticker src="/landing/how/tea.jpg" className="left-[8%] top-[9%] h-[15%] w-[28%]" rotate={-6} delay={0} />
      <Sticker src="/landing/how/teared.jpg" className="right-[9%] top-[12%] h-[17%] w-[24%]" rotate={7} delay={150} />
      <div className="absolute inset-x-[9%] top-[33%]">
        <div className={`${PILL} relative z-10`}>
          <span className="font-medium tabular-nums">6 selected</span>
          <span className="text-gray-400">·</span>
          <span className="flex-1 tabular-nums text-gray-600">142 units</span>
          <span className={`rounded-full px-3 py-1 text-[12px] font-medium text-white transition-colors ${printed ? "bg-emerald-600" : "bg-primary"}`}>
            {printed ? "Stocked" : "Stock"}
          </span>
        </div>
        {/* The slip prints down out of the bar, like a receipt. */}
        <div className="mx-4 -mt-3 overflow-hidden">
          <div
            className="rounded-b-[10px] bg-white px-4 pb-4 pt-6 font-mono text-[11px] leading-[1.7] text-gray-700 shadow-[0_12px_28px_-12px_rgba(0,0,0,0.4)] transition-transform duration-700 [transition-timing-function:var(--ease-out)]"
            style={{ transform: `translateY(${printed ? "0%" : "-105%"})` }}
          >
            <p className="text-center font-semibold tracking-wide text-gray-900">STOCK UPDATED</p>
            <div className="mt-2 space-y-0.5 tabular-nums">
              <p className="flex justify-between"><span>Added</span><span>2 items</span></p>
              <p className="flex justify-between"><span>Restocked</span><span>4 items</span></p>
              <p className="flex justify-between"><span>Units in</span><span>142</span></p>
            </div>
            <p className="mt-2 border-t border-dashed border-gray-300 pt-2 text-center text-gray-500">Nothing changes until you confirm</p>
          </div>
        </div>
      </div>
    </Panel>
  );
}

const HISTORY = [
  { title: "Stock-take", sub: "Today, 10:14 · 9 lines", pill: "Confirmed", tone: "bg-emerald-50 text-emerald-700" },
  { title: "Rerun", sub: "Today, 09:52 · same photo", pill: "Superseded", tone: "bg-gray-100 text-gray-600" },
  { title: "Quick scan", sub: "Yesterday, 18:30 · 6 lines", pill: "Ready to review", tone: "bg-amber-50 text-amber-700" },
];

function HistoryPanel() {
  const { ref, step } = useLoop(2, 2400);
  const fanned = step === 1;
  return (
    <Panel bg="/landing/how/bg4.jpg" panelRef={ref}>
      <div className="absolute inset-x-[10%] top-1/2 -translate-y-1/2">
        {HISTORY.map((h, i) => (
          <div
            key={h.title}
            className="flex items-center gap-3 rounded-[18px] bg-white/95 p-3.5 shadow-[0_14px_32px_-12px_rgba(0,0,0,0.45)] backdrop-blur-md transition-[transform,margin] duration-700 [transition-timing-function:var(--ease-out)]"
            style={{
              marginTop: i === 0 ? 0 : fanned ? 10 : -52,
              transform: fanned ? "none" : `scale(${1 - i * 0.05}) translateY(${i * 6}px)`,
              position: "relative",
              zIndex: HISTORY.length - i,
            }}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-700">
              <SolarIcon name={i === 1 ? "Refresh" : i === 2 ? "Gallery-Add" : "Stars"} iconStyle="Outline" size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-gray-900">{h.title}</p>
              <p className="text-[11px] text-gray-500">{h.sub}</p>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${h.tone}`}>{h.pill}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

const ROWS: { title: string; body: string; link: { label: string; href: string }; panel: ReactNode }[] = [
  {
    title: "Count",
    body: "One photo of a shelf, crate or pile. Muse Spark reads every label and SAM 3.1 counts each unit, so the count is the shelf, not a guess.",
    link: { label: "What it reads", href: "#works-on" },
    panel: <CountPanel />,
  },
  {
    title: "Match",
    body: "Each product is matched to Qore Catalog's 206,000+ Nigerian products, with a typical ₦ shelf price. Unsure matches are flagged, never guessed.",
    link: { label: "About Qore Catalog", href: "#powered" },
    panel: <MatchPanel />,
  },
  {
    title: "Confirm",
    body: "Keep, fix or skip each line, one by one or as a list. Your stock only changes when you say so, and every decision makes the next scan better.",
    link: { label: "Get Tally", href: "#get-tally" },
    panel: <ConfirmPanel />,
  },
  {
    title: "Keep",
    body: "Every stock-take stays in your history with its photo. Rerun one, finish a review later, or see exactly what changed and when.",
    link: { label: "Get Tally", href: "#get-tally" },
    panel: <HistoryPanel />,
  },
];

/** "How it works" as feature rows that stick near the top and stack as you scroll; covered rows shrink and dim a little. */
export function HowShowcase() {
  const rows = useRef<(HTMLDivElement | null)[]>([]);
  const [depth, setDepth] = useState<number[]>(ROWS.map(() => 0));

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const tops = rows.current.map((r) => r?.getBoundingClientRect().top ?? 0);
      // How far the next row has slid over this one, 0 (not yet) to 1 (fully stacked).
      setDepth(
        tops.map((top, i) => {
          const next = tops[i + 1];
          if (next == null) return 0;
          const start = window.innerHeight;
          return Math.min(1, Math.max(0, (start - next) / Math.max(1, start - top - 16)));
        }),
      );
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section id="how" className="scroll-mt-20 py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p data-reveal className="mb-4 flex items-center justify-center gap-2 text-sm font-medium text-gray-500">
            <span className="size-1.5 rounded-[2px] bg-primary" />
            How it works
          </p>
          <h2 data-reveal style={delay(80)} className="font-display text-4xl tracking-tight text-gray-900 sm:text-6xl">
            One photo in. Your stock count out.
          </h2>
          <p data-reveal style={delay(160)} className="mt-4 text-base text-gray-600">A quick scan takes 15 to 30 seconds. A full stock-take takes about a minute.</p>
        </div>

        <div className="mt-20">
          {ROWS.map((r, i) => (
            <div
              key={r.title}
              ref={(el) => {
                rows.current[i] = el;
              }}
              className="sticky mb-[14vh] last:mb-0"
              style={{ top: `calc(4.5rem + ${i * 14}px)` }}
            >
              {/* An opaque layer, so a row hides the one it slides over. */}
              <div
                className="-mx-4 grid origin-top items-start gap-6 rounded-[28px] bg-surface px-4 py-6 will-change-transform sm:-mx-8 sm:px-8 lg:grid-cols-[180px_minmax(0,520px)_minmax(0,1fr)] lg:gap-12 lg:py-8"
                style={{
                  transform: `scale(${1 - depth[i]! * 0.06})`,
                  filter: `brightness(${1 - depth[i]! * 0.1})`,
                  boxShadow: i === 0 ? undefined : "0 -28px 50px -40px rgba(0,0,0,0.35)",
                }}
              >
                <h3 className="font-display text-3xl tracking-tight text-gray-900 lg:pt-1">
                  <span className="mr-3 align-middle font-sans text-sm font-medium tabular-nums text-gray-400">0{i + 1}</span>
                  {r.title}
                </h3>
                {r.panel}
                <div className="lg:pt-2">
                  <p className="text-[15px] leading-relaxed text-gray-600">{r.body}</p>
                  <a href={r.link.href} className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-900 hover:text-primary">
                    {r.link.label}
                    <SolarIcon name="Arrow-Right" size={16} />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
