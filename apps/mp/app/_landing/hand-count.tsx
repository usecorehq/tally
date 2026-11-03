import type { ReactNode } from "react";
import { delay } from "./reveal";

type Pt = [number, number];
type Project = (x: number, y: number, z: number) => Pt;

/** Isometric projection around a screen origin: x runs down-right, y down-left, z up. */
const iso =
  (ox: number, oy: number): Project =>
  (x, y, z) => [ox + (x - y) * 0.866, oy + (x + y) * 0.5 - z];

const pts = (...ps: Pt[]) => ps.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" ");
const line = (a: Pt, b: Pt) => `M${a[0].toFixed(1)} ${a[1].toFixed(1)} L${b[0].toFixed(1)} ${b[1].toFixed(1)}`;

type Tone = "plain" | "accent" | "warn" | "ghost";

const FACES: Record<Tone, { stroke: string; top: string; left: string; right: string }> = {
  plain: { stroke: "stroke-gray-800", top: "fill-surface", left: "fill-gray-100", right: "fill-surface" },
  accent: { stroke: "stroke-primary-ink", top: "fill-primary-light", left: "fill-primary/20", right: "fill-primary-light" },
  warn: { stroke: "stroke-amber-600", top: "fill-amber-50", left: "fill-amber-100", right: "fill-amber-50" },
  ghost: { stroke: "stroke-gray-300", top: "fill-transparent", left: "fill-transparent", right: "fill-transparent" },
};

function Box({ p, x, y, z, w, d, h, tone = "plain" }: { p: Project; x: number; y: number; z: number; w: number; d: number; h: number; tone?: Tone }) {
  const f = FACES[tone];
  return (
    <g className={f.stroke} strokeWidth={1.25} strokeLinejoin="round" strokeDasharray={tone === "ghost" ? "3 3" : undefined}>
      <polygon className={f.left} points={pts(p(x, y + d, z), p(x + w, y + d, z), p(x + w, y + d, z + h), p(x, y + d, z + h))} />
      <polygon className={f.right} points={pts(p(x + w, y, z), p(x + w, y + d, z), p(x + w, y + d, z + h), p(x + w, y, z + h))} />
      <polygon className={f.top} points={pts(p(x, y, z + h), p(x + w, y, z + h), p(x + w, y + d, z + h), p(x, y + d, z + h))} />
    </g>
  );
}

/** A marked point: solid dot in a soft halo. */
function Dot({ at, warn = false, pulse = false }: { at: Pt; warn?: boolean; pulse?: boolean }) {
  return (
    <g>
      <circle cx={at[0]} cy={at[1]} r={7} className={warn ? "fill-amber-500/20" : "fill-primary/40"} />
      <circle cx={at[0]} cy={at[1]} r={3.5} className={`${warn ? "fill-amber-500" : "fill-primary-ink"} ${pulse ? "ill-pulse" : ""}`} />
    </g>
  );
}

function Wire({ d, warn = false }: { d: string; warn?: boolean }) {
  return <path d={d} fill="none" strokeWidth={1.25} className={`ill-flow ${warn ? "stroke-amber-500" : "stroke-gray-300"}`} />;
}

type Glyph = "search" | "tag" | "hourglass" | "clock" | "pencil" | "moon" | "warn" | "naira" | "question";

const GLYPHS: Record<Glyph, ReactNode> = {
  search: (
    <>
      <circle cx={-2} cy={-2} r={5.5} />
      <path d="M2.2 2.2 7 7" />
    </>
  ),
  tag: (
    <>
      <path d="M-8 0-2-7H7V7H-2Z" />
      <circle cx={3} cy={0} r={1.4} />
    </>
  ),
  hourglass: <path d="M-5-7H5M-5 7H5M-4-7C-4-2 4 2 4 7M4-7C4-2-4 2-4 7" />,
  clock: (
    <>
      <circle r={7} />
      <path d="M0-4V0L3 2" />
    </>
  ),
  pencil: <path d="M-6 6-5 1 3-7 7-3-1 5ZM1-5 5-1" />,
  moon: <path d="M4-6A7 7 0 1 0 6.5 3 5.5 5.5 0 0 1 4-6Z" />,
  warn: <path d="M0-7 7.5 6H-7.5ZM0-2V2M0 3.8V4" />,
  naira: <path d="M-4 7V-7L4 7V-7M-7-1H7M-7 2H7" />,
  question: <path d="M-3.5-3.5A3.5 3.5 0 1 1 1-.2C0 .4 0 1.2 0 2.5M0 5.5V6" />,
};

/** A round node holding a small line glyph. */
function Node({ at, glyph, label, tone = "plain" }: { at: Pt; glyph: Glyph; label?: string; tone?: "plain" | "accent" | "warn" }) {
  const stroke = tone === "accent" ? "stroke-primary-ink" : tone === "warn" ? "stroke-amber-600" : "stroke-gray-800";
  return (
    <g>
      <circle cx={at[0]} cy={at[1]} r={24} className="fill-gray-100" />
      <circle cx={at[0]} cy={at[1]} r={17} strokeWidth={1.25} className={`fill-surface ${stroke}`} />
      <g transform={`translate(${at[0]} ${at[1]})`} fill="none" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" className={stroke}>
        {GLYPHS[glyph]}
      </g>
      {label && (
        <text x={at[0]} y={at[1] + 40} textAnchor="middle" fontSize={11} className="fill-gray-500">
          {label}
        </text>
      )}
    </g>
  );
}

function Chip({ x, y, w, children, tone = "plain" }: { x: number; y: number; w: number; children: ReactNode; tone?: "plain" | "warn" }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={28} rx={8} strokeWidth={1.25} className={tone === "warn" ? "fill-amber-50 stroke-amber-600" : "fill-surface stroke-gray-800"} />
      <text x={x + 12} y={y + 18} fontSize={12} className={tone === "warn" ? "fill-amber-800" : "fill-gray-800"}>
        {children}
      </text>
    </g>
  );
}

// ── The four steps ────────────────────────────────────────────────────────

/** A shelf unit read item by item: three labels pulled out to the work they become. */
function ReadLabels() {
  const p = iso(70, 132);
  const shelves = [0, 38, 76];
  // Per shelf: [x, width, height] of each item; the last one on each shelf is the one being read.
  const items: [number, number, number][][] = [
    [[10, 22, 16], [38, 14, 22], [58, 14, 22], [80, 18, 14], [104, 14, 20]],
    [[10, 14, 24], [30, 14, 24], [52, 20, 16], [80, 14, 22], [104, 14, 22]],
    [[10, 18, 18], [34, 14, 24], [56, 14, 24], [78, 20, 16], [104, 14, 20]],
  ];
  const anchors = shelves.map((z, s) => {
    const [x, w, h] = items[s]![4]!;
    return p(x + w, 22, z + 4 + h / 2);
  });
  const nodes: Pt[] = [
    [300, 190],
    [300, 122],
    [300, 54],
  ];
  return (
    <svg viewBox="0 0 480 240" className="h-auto w-full" aria-hidden>
      <Box p={p} x={0} y={0} z={0} w={4} d={40} h={112} />
      {shelves.map((z, s) => (
        <g key={z}>
          <Box p={p} x={4} y={0} z={z} w={122} d={40} h={4} />
          {items[s]!.map(([x, w, h], i) => (
            <Box key={x} p={p} x={x} y={14} z={z + 4} w={w} d={16} h={h} tone={i === 4 ? "accent" : "plain"} />
          ))}
        </g>
      ))}
      <Box p={p} x={126} y={0} z={0} w={4} d={40} h={112} />
      {anchors.map((a, i) => (
        <Wire key={i} d={`M${a[0]} ${a[1]} H${222 + i * 14} V${nodes[i]![1]} H${nodes[i]![0] - 24}`} />
      ))}
      <Wire d="M324 122 H396" />
      <Wire d="M324 54 H360 V100 H396" />
      <Wire d="M324 190 H360 V144 H396" />
      {anchors.map((a, i) => (
        <Dot key={i} at={a} pulse={i === 1} />
      ))}
      <Node at={nodes[2]!} glyph="search" />
      <Node at={nodes[1]!} glyph="tag" />
      <Node at={nodes[0]!} glyph="hourglass" />
      <Node at={[420, 122]} glyph="clock" tone="accent" label="Hours" />
    </svg>
  );
}

/** A notebook of tally marks, and two counts of the same shelf that don't agree. */
function TallyPaper() {
  const p = iso(120, 64);
  const rows = [24, 46, 68, 90];
  const groups = [4, 3, 4, 2];
  const top = 6;
  return (
    <svg viewBox="0 0 480 240" className="h-auto w-full" aria-hidden>
      <Box p={p} x={0} y={0} z={0} w={170} d={112} h={6} />
      {rows.map((y) => (
        <path key={y} d={line(p(10, y + 6, top), p(160, y + 6, top))} strokeWidth={1} className="stroke-gray-200" />
      ))}
      {rows.map((y, r) =>
        Array.from({ length: groups[r]! }, (_, g) => {
          const gx = 14 + g * 36;
          return (
            <g key={`${r}-${g}`} strokeWidth={1.4} strokeLinecap="round" className={r === 3 ? "stroke-amber-600" : "stroke-gray-800"}>
              {[0, 5, 10, 15].map((dx) => (
                <path key={dx} d={line(p(gx + dx, y + 4, top), p(gx + dx, y - 10, top))} />
              ))}
              <path d={line(p(gx - 3, y + 1, top), p(gx + 19, y - 8, top))} />
            </g>
          );
        }),
      )}
      {/* The last row loses its place: a mark scribbled out. */}
      <path d={line(p(86, 90, top), p(102, 82, top))} strokeWidth={1.4} strokeLinecap="round" className="stroke-amber-600" />
      <path d={line(p(86, 84, top), p(102, 92, top))} strokeWidth={1.4} strokeLinecap="round" className="stroke-amber-600" />
      <Box p={p} x={40} y={104} z={top} w={96} d={6} h={6} />
      <Box p={p} x={136} y={104} z={top} w={12} d={6} h={6} tone="warn" />
      <Dot at={p(96, 84, top)} warn pulse />
      <Wire d={`M${p(170, 40, 3)[0]} ${p(170, 40, 3)[1]} H340 V58 H356`} />
      <Wire d={`M${p(170, 80, 3)[0]} ${p(170, 80, 3)[1]} H340 V128 H356`} warn />
      <Chip x={356} y={44} w={104}>
        Count 1 · 47
      </Chip>
      <Chip x={356} y={114} w={104} tone="warn">
        Count 2 · 52
      </Chip>
      <Node at={[408, 196]} glyph="question" tone="warn" />
      <Wire d="M408 142 V172" warn />
    </svg>
  );
}

/** Notes from the shop floor waiting for a quiet hour to be typed into a sheet. */
function TypeLater() {
  const cols = [178, 244, 310, 376];
  const rowsY = [84, 112, 140, 168];
  return (
    <svg viewBox="0 0 480 240" className="h-auto w-full" aria-hidden>
      <Wire d="M84 70 H124 V98 H150" />
      <Wire d="M84 170 H124 V154 H150" />
      <Node at={[60, 70]} glyph="pencil" label="Notebook" />
      <Node at={[60, 170]} glyph="moon" label="After hours" />
      <rect x={150} y={26} width={306} height={188} rx={12} strokeWidth={1.25} className="fill-surface stroke-gray-800" />
      <path d="M150 52 H456" strokeWidth={1.25} className="stroke-gray-800" />
      {[166, 178, 190].map((cx) => (
        <circle key={cx} cx={cx} cy={39} r={3} className="fill-gray-300" />
      ))}
      <rect x={166} y={62} width={274} height={136} rx={6} className="fill-gray-50" />
      {cols.map((x) => (
        <rect key={x} x={x} y={68} width={44} height={6} rx={3} className="fill-gray-300" />
      ))}
      {rowsY.map((y, r) =>
        cols.map((x, c) => {
          const filled = r < 2 || (r === 2 && c < 2);
          return (
            <rect
              key={`${r}-${c}`}
              x={x - 4}
              y={y}
              width={58}
              height={20}
              rx={4}
              strokeWidth={1}
              className={filled ? "fill-surface stroke-gray-200" : "fill-transparent stroke-gray-200"}
            />
          );
        }),
      )}
      {rowsY.slice(0, 3).map((y, r) =>
        cols.slice(0, r < 2 ? 4 : 2).map((x, c) => <rect key={`${r}-${c}`} x={x + 2} y={y + 7} width={c === 0 ? 40 : 22} height={6} rx={3} className="fill-gray-200" />),
      )}
      <rect x={306} y={140} width={58} height={20} rx={4} strokeWidth={1.25} className="fill-primary-light stroke-primary-ink" />
      <rect x={314} y={145} width={1.6} height={10} className="ill-blink fill-primary-ink" />
    </svg>
  );
}

/** One count in a month, and the book drifting away from the shelf after it. */
function RarelyHappens() {
  const cell = 18;
  const gap = 5;
  return (
    <svg viewBox="0 0 480 240" className="h-auto w-full" aria-hidden>
      <rect x={24} y={34} width={186} height={172} rx={12} strokeWidth={1.25} className="fill-surface stroke-gray-800" />
      <path d="M24 60 H210" strokeWidth={1.25} className="stroke-gray-800" />
      <rect x={38} y={44} width={48} height={6} rx={3} className="fill-gray-300" />
      {Array.from({ length: 35 }, (_, i) => {
        const x = 38 + (i % 7) * (cell + gap);
        const y = 72 + Math.floor(i / 7) * (cell + gap);
        const counted = i === 2;
        if (i === 32) return null;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={cell}
            height={cell}
            rx={4}
            strokeWidth={counted ? 1.25 : 1}
            className={counted ? "fill-primary-light stroke-primary-ink" : "fill-transparent stroke-gray-200"}
          />
        );
      })}
      <path d="M90 81 l3 3 6-6" fill="none" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="stroke-primary-ink" />
      <rect x={130} y={164} width={cell} height={cell} rx={4} strokeWidth={1.25} strokeDasharray="3 3" className="fill-transparent stroke-gray-400" />

      <path d="M246 196 H462 M246 40 V196" strokeWidth={1} className="stroke-gray-200" />
      <path d="M252 78 H456" fill="none" strokeWidth={1.4} strokeDasharray="5 5" className="stroke-gray-800" />
      <path d="M252 78 C292 82 306 104 336 108 S384 134 410 150 S446 166 456 170" fill="none" strokeWidth={1.6} className="stroke-primary-ink" />
      <path d="M462 80 V168" strokeWidth={1.25} className="stroke-amber-500" />
      <path d="M458 80 H466 M458 168 H466" strokeWidth={1.25} className="stroke-amber-500" />
      <Dot at={[252, 78]} />
      <Dot at={[456, 170]} warn pulse />
      <text x={300} y={68} fontSize={11} className="fill-gray-500">
        In your book
      </text>
      <text x={300} y={134} fontSize={11} className="fill-primary-ink">
        On the shelf
      </text>
      <text x={454} y={128} fontSize={11} textAnchor="end" className="fill-amber-700">
        Drift
      </text>
      <text x={252} y={214} fontSize={11} className="fill-gray-500">
        Last count
      </text>
      <text x={456} y={214} fontSize={11} textAnchor="end" className="fill-gray-500">
        Today
      </text>
    </svg>
  );
}

// ── What it costs ─────────────────────────────────────────────────────────

function RunOut() {
  const p = iso(56, 62);
  const xs = [8, 40, 72];
  return (
    <svg viewBox="0 0 320 180" className="h-auto w-full" aria-hidden>
      <Box p={p} x={0} y={0} z={0} w={170} d={30} h={4} />
      {xs.map((x) => (
        <Box key={x} p={p} x={x} y={8} z={4} w={22} d={16} h={24} />
      ))}
      <Box p={p} x={104} y={8} z={4} w={22} d={16} h={24} tone="ghost" />
      <Box p={p} x={138} y={8} z={4} w={22} d={16} h={24} tone="ghost" />
      <Dot at={p(127, 16, 18)} warn pulse />
      <Wire d={`M${p(127, 16, 18)[0]} ${p(127, 16, 18)[1]} V40 H226`} warn />
      <rect x={226} y={24} width={80} height={32} rx={10} strokeWidth={1.25} className="fill-surface stroke-gray-800" />
      <path d="M244 56 l-4 8 12-8" strokeWidth={1.25} strokeLinejoin="round" className="fill-surface stroke-gray-800" />
      <path d="M245 56.5 H251" strokeWidth={2} className="stroke-surface" />
      <text x={266} y={44} fontSize={12} textAnchor="middle" className="fill-gray-800">
        Any left?
      </text>
    </svg>
  );
}

function PileUp() {
  const p = iso(96, 98);
  const s = 30;
  return (
    <svg viewBox="0 0 320 180" className="h-auto w-full" aria-hidden>
      <Box p={p} x={0} y={0} z={0} w={s} d={s} h={s} />
      <Box p={p} x={s} y={0} z={0} w={s} d={s} h={s} />
      <Box p={p} x={0} y={s} z={0} w={s} d={s} h={s} />
      <Box p={p} x={s} y={s} z={0} w={s} d={s} h={s} />
      <Box p={p} x={0} y={0} z={s} w={s} d={s} h={s} />
      <Box p={p} x={s} y={0} z={s} w={s} d={s} h={s} />
      <Box p={p} x={0} y={s} z={s} w={s} d={s} h={s} />
      <Box p={p} x={0} y={0} z={s * 2} w={s} d={s} h={s} tone="warn" />
      <Dot at={p(s, s / 2, s * 2.5)} warn />
      <Wire d={`M${p(s, s / 2, s * 2.5)[0]} ${p(s, s / 2, s * 2.5)[1]} H210 V62 H234`} warn />
      <Node at={[258, 62]} glyph="naira" tone="warn" label="Money on the shelf" />
    </svg>
  );
}

function NoBarcode() {
  const p = iso(244, 96);
  const bars = [0, 4, 6, 11, 14, 16, 21, 24, 28, 30, 35, 38, 42, 44, 49, 52, 56, 58, 63, 66];
  return (
    <svg viewBox="0 0 320 180" className="h-auto w-full" aria-hidden>
      <rect x={18} y={46} width={96} height={68} rx={8} strokeWidth={1.25} className="fill-surface stroke-gray-800" />
      {bars.map((b, i) => (
        <rect key={b} x={30 + b} y={58} width={i % 3 === 0 ? 2.4 : 1.4} height={36} className="fill-gray-800" />
      ))}
      <rect x={30} y={100} width={44} height={5} rx={2.5} className="fill-gray-300" />
      <path d="M22 110 110 50" strokeWidth={1.6} strokeLinecap="round" className="stroke-amber-500" />
      <Wire d="M114 80 H150" warn />
      {/* A loose bag: no label to scan. */}
      <path
        d="M150 142 L157 98 H195 L202 142 Z"
        strokeWidth={1.25}
        strokeLinejoin="round"
        className="fill-gray-100 stroke-gray-800"
      />
      <path d="M157 98 L162 86 H190 L195 98 M168 86 V80 M184 86 V80 M166 80 H186" fill="none" strokeWidth={1.25} strokeLinejoin="round" className="stroke-gray-800" />
      <Box p={p} x={0} y={0} z={0} w={56} d={40} h={40} />
      <g transform={`translate(${p(56, 20, 20)[0] + 8} ${p(56, 20, 20)[1] - 2})`} fill="none" strokeWidth={1.6} strokeLinecap="round" className="stroke-amber-600">
        {GLYPHS.question}
      </g>
      <Dot at={[176, 120]} warn pulse />
    </svg>
  );
}

// ── The section ───────────────────────────────────────────────────────────

// The PRD's problem statement (§1): a hand count is slow, so it's rare, so stock drifts.
const STEPS: { title: string; body: string; art: ReactNode }[] = [
  { title: "Read every label", body: "Shelf by shelf, tin by tin, with a notebook in hand.", art: <ReadLabels /> },
  { title: "Tally it on paper", body: "Marks and totals that are easy to lose count of.", art: <TallyPaper /> },
  { title: "Type it in later", body: "Into a spreadsheet, when there's finally a quiet hour.", art: <TypeLater /> },
  { title: "So it rarely happens", body: "And between counts, the numbers drift from the shelf.", art: <RarelyHappens /> },
];

const COSTS: { title: string; body: string; art: ReactNode }[] = [
  { title: "Fast movers run out", body: "Customers ask for what's sold out before anyone notices.", art: <RunOut /> },
  { title: "Slow movers pile up", body: "Money sits on the shelf in stock that was over-ordered.", art: <PileUp /> },
  {
    title: "Barcodes don't cover it",
    body: "Scanning still means touching every unit, and loose goods and unlabeled cartons have no usable barcode.",
    art: <NoBarcode />,
  },
];

/** Where a hand count goes wrong: the four steps and their costs, each drawn as a line illustration. */
export function HandCount() {
  return (
    <section aria-labelledby="hand-count" className="pb-24 pt-4">
      <div className="mx-auto max-w-6xl px-4 sm:px-8">
        <h2 id="hand-count" data-reveal className="max-w-3xl font-display text-4xl tracking-tight text-gray-900 sm:text-5xl">
          Where a hand count goes wrong
        </h2>
        <p data-reveal style={delay(80)} className="mt-3 max-w-2xl text-base text-gray-600">
          In provision stores, supermarkets, pharmacies and mini-marts, a stock-take means hours with a notebook, and it
          costs more than the time.
        </p>

        <div data-reveal style={delay(140)} className="mt-12 overflow-hidden rounded-[28px] ring-1 ring-gray-200">
          <ol className="grid gap-px bg-gray-200 md:grid-cols-2">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex flex-col bg-surface p-6 sm:p-8">
                <div data-reveal style={delay(200 + (i % 2) * 90)}>
                  <p className="text-sm font-medium tabular-nums text-gray-400">0{i + 1}</p>
                  <h3 className="mt-2 text-xl font-medium tracking-tight text-gray-900">{s.title}</h3>
                  <p className="mt-1 text-[15px] leading-relaxed text-gray-600">{s.body}</p>
                </div>
                <div data-reveal style={delay(320 + (i % 2) * 90)} className="mt-6 sm:mt-8">
                  {s.art}
                </div>
              </li>
            ))}
          </ol>
          <div className="flex items-center gap-2 border-y border-gray-200 bg-gray-50 px-6 py-4 text-sm font-medium text-gray-600 sm:px-8">
            <span className="size-1.5 rounded-[2px] bg-amber-500" />
            What it costs the shop
          </div>
          <div className="grid gap-px bg-gray-200 md:grid-cols-3">
            {COSTS.map((c, i) => (
              <div key={c.title} className="flex flex-col bg-surface p-6 sm:p-8">
                <div data-reveal style={delay(120 + i * 90)}>
                  <h3 className="text-lg font-medium tracking-tight text-gray-900">{c.title}</h3>
                  <p className="mt-1 text-[15px] leading-relaxed text-gray-600">{c.body}</p>
                </div>
                <div data-reveal style={delay(240 + i * 90)} className="mt-6">
                  {c.art}
                </div>
              </div>
            ))}
          </div>
        </div>

        <p data-reveal className="mt-12 max-w-2xl font-display text-2xl leading-snug tracking-tight text-gray-900 sm:text-3xl">
          Tally turns that afternoon of counting into one photo.
        </p>
      </div>
    </section>
  );
}
