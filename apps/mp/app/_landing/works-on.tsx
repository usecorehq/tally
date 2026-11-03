import { useEffect, useRef, useState, type ReactNode } from "react";
import { SolarIcon, type SolarIconName } from "@tally/ui";
import { delay } from "./reveal";

type Pt = [number, number];

/** A closed polygon as an SVG path with every corner rounded, convex or concave. */
function roundedPath(points: Pt[], radius: number) {
  const n = points.length;
  const corner = (i: number) => {
    const p = points[i]!;
    const prev = points[(i - 1 + n) % n]!;
    const next = points[(i + 1) % n]!;
    const toward = (q: Pt) => {
      const dx = q[0] - p[0];
      const dy = q[1] - p[1];
      const len = Math.hypot(dx, dy) || 1;
      const r = Math.min(radius, len / 2);
      return [p[0] + (dx / len) * r, p[1] + (dy / len) * r] as Pt;
    };
    return { p, a: toward(prev), b: toward(next) };
  };
  const f = (q: Pt) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`;
  const cs = points.map((_, i) => corner(i));
  let d = `M${f(cs[0]!.b)}`;
  for (let i = 1; i <= n; i++) {
    const c = cs[i % n]!;
    d += ` L${f(c.a)} Q${f(c.p)} ${f(c.b)}`;
  }
  return `${d} Z`;
}

// The panel's cut corner, and the notch the tabs sit in (wide screens only).
const CHAMFER = 76;
const NOTCH = { w: 250, h: 228, slope: 72 };

function panelPath(w: number, h: number, notch: boolean) {
  const pts: Pt[] = notch
    ? [
        [0, 0],
        [w - CHAMFER, 0],
        [w, CHAMFER],
        [w, h],
        [NOTCH.w + NOTCH.slope, h],
        [NOTCH.w, h - NOTCH.slope],
        [NOTCH.w, h - NOTCH.h],
        [0, h - NOTCH.h],
      ]
    : [
        [0, 0],
        [w - CHAMFER * 0.6, 0],
        [w, CHAMFER * 0.6],
        [w, h],
        [0, h],
      ];
  return roundedPath(pts, 26);
}

// ── The cards, one per surface ────────────────────────────────────────────

const CARD = "w-[min(360px,86%)] rounded-[22px] bg-surface p-5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)] ring-1 ring-hairline/[0.06]";

function Rise({ i, children }: { i: number; children: ReactNode }) {
  return (
    <div className="q-rise" style={{ animationDelay: `${120 + i * 90}ms` }}>
      {children}
    </div>
  );
}

function ProvisionCard() {
  const rows = [
    { name: "Tomato paste 70g", n: 24 },
    { name: "Evaporated milk 160g", n: 18 },
    { name: "Sardines 125g", n: 12 },
    { name: "Seasoning cubes", n: 40 },
    { name: "Custard powder 300g", n: 9 },
  ];
  return (
    <div className={CARD}>
      <p className="text-[11px] tabular-nums text-gray-500">Today 09:15 · Shelf 3</p>
      <p className="mt-1 text-[15px] font-semibold tracking-tight text-gray-900">Provision shelf</p>
      <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary-light px-2.5 py-1 text-[11px] font-medium text-primary-ink">
        <SolarIcon name="Stars" size={13} />
        Quick scan
      </span>
      <div className="mt-4 flex gap-4 border-b border-gray-100 text-[12px]">
        <span className="-mb-px border-b-2 border-primary-ink pb-2 font-medium text-gray-900">Products</span>
        <span className="pb-2 text-gray-500">Counts</span>
        <span className="pb-2 text-gray-500">Unsure</span>
      </div>
      <ul className="mt-3 space-y-2.5">
        {rows.map((r, i) => (
          <Rise key={r.name} i={i}>
            <li className={`flex items-center gap-2 text-[13px] ${i === rows.length - 1 ? "opacity-40 blur-[1px]" : ""}`}>
              <span className="size-1 rounded-full bg-gray-400" />
              <span className="flex-1 text-gray-800">{r.name}</span>
              <span className="tabular-nums text-gray-500">{r.n} units</span>
            </li>
          </Rise>
        ))}
      </ul>
    </div>
  );
}

const AGENT_STEPS = ["Find every pack", "Zoom into small labels", "Search Qore Catalog", "Recount where unsure", "Ready for your review"];

function PharmacyCard({ still }: { still: boolean }) {
  const [at, setAt] = useState(still ? AGENT_STEPS.length - 1 : 0);
  useEffect(() => {
    if (still) return;
    const t = setInterval(() => setAt((s) => (s + 1) % AGENT_STEPS.length), 1300);
    return () => clearInterval(t);
  }, [still]);
  return (
    <div className={CARD}>
      <div className="flex items-center justify-between">
        <p className="text-[14px] font-semibold tracking-tight text-gray-900">Stock-take agent</p>
        <span className="rounded-full bg-primary-light px-2 py-0.5 text-[10px] font-medium text-primary-ink">Running</span>
      </div>
      <div className="mt-3 rounded-[12px] bg-gray-50 p-3 ring-1 ring-hairline/[0.05]">
        <p className="text-[10px] text-gray-500">Goal</p>
        <p className="mt-0.5 text-[12px] text-gray-800">Read the small print on every pack, then match it to Qore Catalog.</p>
      </div>
      <ol className="mt-3 space-y-1">
        {AGENT_STEPS.map((s, i) => {
          const done = i < at;
          const now = i === at;
          return (
            <li
              key={s}
              className={`flex items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-[12px] transition-colors duration-300 ${now ? "bg-primary-light" : ""}`}
            >
              <span
                className={`flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
                  done ? "border-emerald-500 text-emerald-600" : now ? "border-primary-ink" : "border-gray-300"
                }`}
              >
                {done && <SolarIcon name="Check-Circle" size={16} />}
                {now && <span className="size-1.5 animate-pulse rounded-full bg-primary" />}
              </span>
              <span className={done ? "text-gray-400 line-through" : now ? "font-medium text-primary-ink" : "text-gray-500"}>{s}</span>
            </li>
          );
        })}
      </ol>
      <div className="mt-3 flex justify-between text-[10px] tabular-nums text-gray-500">
        <span>
          {at}/{AGENT_STEPS.length} steps
        </span>
        <span>Unsure lines wait for you</span>
      </div>
    </div>
  );
}

function CartonsCard({ still }: { still: boolean }) {
  const lines = [
    { name: "Black tea, 100 bags", n: 24 },
    { name: "Black tea, 50 bags", n: 16 },
    { name: "Green tea, 20 bags", n: 8 },
  ];
  const total = lines.reduce((s, l) => s + l.n, 0);
  const [shown, setShown] = useState(still ? total : 0);
  useEffect(() => {
    if (still) return;
    setShown(0);
    const t = setInterval(() => setShown((s) => (s >= total ? total : s + 1)), 28);
    return () => clearInterval(t);
  }, [still, total]);
  return (
    <div className={CARD}>
      <p className="text-[11px] text-gray-500">Counted by the unit</p>
      <p className="mt-1 flex items-baseline gap-2">
        <span className="font-display text-5xl tabular-nums tracking-tight text-gray-900">{shown}</span>
        <span className="text-[13px] text-gray-500">units</span>
      </p>
      <div className="mt-4 space-y-3">
        {lines.map((l) => (
          <div key={l.name}>
            <div className="flex justify-between text-[12px]">
              <span className="text-gray-800">{l.name}</span>
              <span className="tabular-nums text-gray-500">{Math.min(l.n, Math.max(0, Math.round((shown / total) * l.n)))}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-primary transition-[width] duration-150" style={{ width: `${(Math.min(shown, total) / total) * (l.n / 24) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[11px] text-gray-500">Every unit outlined on the photo, so you can check the count.</p>
    </div>
  );
}

function AisleCard() {
  const rows = [
    { name: "Infant cereal 400g", pill: "Strong", tone: "bg-emerald-50 text-emerald-700", n: 6 },
    { name: "Cereal porridge 350g", pill: "Medium", tone: "bg-amber-50 text-amber-700", n: 11 },
    { name: "Baby formula 400g", pill: "Unsure", tone: "bg-gray-100 text-gray-600", n: 4 },
  ];
  return (
    <div className={CARD}>
      <div className="flex items-center justify-between">
        <p className="text-[14px] font-semibold tracking-tight text-gray-900">Check what we found</p>
        <span className="text-[11px] tabular-nums text-gray-500">9 lines</span>
      </div>
      <div className="mt-3 space-y-1.5">
        {rows.map((r, i) => (
          <Rise key={r.name} i={i}>
            <div className="flex items-center gap-2 rounded-[12px] bg-gray-50 px-3 py-2.5 ring-1 ring-hairline/[0.04]">
              <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-gray-900">{r.name}</span>
              <span className="text-[11px] tabular-nums text-gray-500">×{r.n}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${r.tone}`}>{r.pill}</span>
            </div>
          </Rise>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-gray-500">Mixed brands and sizes. Anything unsure waits for you to pick.</p>
      <div className="mt-3 flex gap-2">
        <span className="flex h-9 flex-1 items-center justify-center rounded-xl bg-gray-100 text-[12px] font-medium text-gray-900">Review later</span>
        <span className="flex h-9 flex-[1.4] items-center justify-center rounded-xl bg-primary text-[12px] font-medium text-primary-foreground">Stock 9 items</span>
      </div>
    </div>
  );
}

const SURFACES: { title: string; icon: SolarIconName; photo: string; card: (still: boolean) => ReactNode }[] = [
  { title: "Provision shelves", icon: "Shop", photo: "/landing/works/provision.jpg", card: () => <ProvisionCard /> },
  { title: "Pharmacy shelves", icon: "Pills", photo: "/landing/works/pharmacy.jpg", card: (still) => <PharmacyCard still={still} /> },
  { title: "Crates and cartons", icon: "Box", photo: "/landing/works/cartons.jpg", card: (still) => <CartonsCard still={still} /> },
  { title: "Supermarket aisles", icon: "Layers", photo: "/landing/works/aisle.jpg", card: () => <AisleCard /> },
];

/** The surfaces Tally reads: a shop photo behind a card of what it found, picked from tabs in the panel's notch. */
export function WorksOn() {
  const panel = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [touched, setTouched] = useState(false);
  const [visible, setVisible] = useState(false);
  const [still, setStill] = useState(false);
  const [clip, setClip] = useState<string>();

  useEffect(() => {
    setStill(matchMedia("(prefers-reduced-motion: reduce)").matches);
    const el = panel.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e!.contentRect;
      setClip(`path("${panelPath(width, height, width >= 720)}")`);
    });
    ro.observe(el);
    const io = new IntersectionObserver(([e]) => setVisible(Boolean(e?.isIntersecting)), { threshold: 0.4 });
    io.observe(el);
    return () => {
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  // Rotates on its own until someone picks a tab.
  useEffect(() => {
    if (touched || still || !visible) return;
    const t = setTimeout(() => setActive((a) => (a + 1) % SURFACES.length), 6000);
    return () => clearTimeout(t);
  }, [active, touched, still, visible]);

  // The phone's tab row scrolls sideways; keep the active tab in it without moving the page.
  useEffect(() => {
    const r = row.current;
    const tab = r?.children[active] as HTMLElement | undefined;
    if (r && tab && r.scrollWidth > r.clientWidth) r.scrollTo({ left: tab.offsetLeft - 16, behavior: still ? "auto" : "smooth" });
  }, [active, still]);

  const pick = (i: number) => {
    setTouched(true);
    setActive(i);
  };

  const tabs = (className: string, ref?: React.RefObject<HTMLDivElement | null>) => (
    <div ref={ref} role="tablist" aria-label="Where Tally counts" className={className}>
      {SURFACES.map((s, i) => {
        const on = i === active;
        return (
          <button
            key={s.title}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => pick(i)}
            onMouseEnter={() => pick(i)}
            className={`flex shrink-0 items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-[15px] transition-[color,transform] duration-150 ease-out active:scale-[0.97] motion-reduce:active:scale-100 ${
              on ? "font-medium text-gray-900" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <SolarIcon name={s.icon} iconStyle={on ? "Fill" : "Outline"} size={20} className={on ? "text-primary-ink" : ""} />
            {s.title}
          </button>
        );
      })}
    </div>
  );

  return (
    <section id="works-on" className="scroll-mt-20 py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-8">
        <div className="grid gap-4 md:grid-cols-2 md:items-end md:gap-12">
          <h2 data-reveal className="font-display text-4xl tracking-tight text-gray-900 sm:text-5xl">Built for how Nigerian shops stock</h2>
          <p data-reveal style={delay(100)} className="max-w-md text-base leading-relaxed text-gray-600 md:justify-self-end">
            Busy shelves, mixed brands, handwritten price tags. Tally reads what's in the frame and tells you when a part of
            the photo couldn't be read.
          </p>
        </div>

        {tabs("-mx-4 mt-10 flex gap-1 overflow-x-auto px-4 pb-2 md:hidden", row)}

        <div data-reveal style={delay(180)} className="relative mt-4 md:mt-14">
          <div ref={panel} className="relative h-[460px] overflow-hidden bg-gray-900 sm:h-[560px]" style={{ clipPath: clip, borderRadius: clip ? 0 : 26 }}>
            {SURFACES.map((s, i) => (
              <img
                key={s.photo}
                src={s.photo}
                alt=""
                aria-hidden
                loading="lazy"
                className={`absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-700 [transition-timing-function:var(--ease-out)] ${
                  i === active ? "scale-100 opacity-100" : "scale-105 opacity-0"
                }`}
              />
            ))}
            <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/5 to-black/30" />
            <div role="tabpanel" aria-label={SURFACES[active]!.title} className="absolute inset-0 flex items-center justify-center md:pl-[250px]">
              <div key={active} className="q-rise flex w-full justify-center">
                {SURFACES[active]!.card(still)}
              </div>
            </div>
          </div>
          {/* The notch sits on the page background, outside the clipped photo. */}
          <div className="absolute bottom-0 left-0 hidden flex-col justify-center md:flex" style={{ width: NOTCH.w, height: NOTCH.h }}>
            {tabs("flex flex-col gap-2 pl-8 pr-4 pt-6")}
          </div>
        </div>
      </div>
    </section>
  );
}
