import type { ReactNode } from "react";
import { SolarIcon } from "@tally/ui";
import { MetaMark } from "./meta-mark";
import { delay } from "./reveal";
import { SHELF_BOXES } from "./scan-demo";

/** Muse Spark reading a label: the pack, a scan line, and the fields it pulls out. */
function ReadsArt() {
  const fields = [
    { k: "Product", v: "Infant cereal" },
    { k: "Size", v: "400g" },
    { k: "Pack", v: "Box" },
  ];
  return (
    <div className="flex h-full items-center justify-center gap-4 px-5">
      <div className="relative w-[34%] shrink-0 -rotate-3 overflow-hidden rounded-[14px] bg-white p-1 shadow-[0_14px_30px_-14px_rgba(0,0,0,0.45)]">
        <img src="/landing/how/nutrova.jpg" alt="" className="block aspect-square w-full rounded-[10px] object-cover" />
        <span aria-hidden style={{ "--scan-travel": "96px" } as React.CSSProperties} className="ill-scan absolute inset-x-1 top-1 h-0.5 rounded-full bg-primary shadow-[0_0_12px_2px_rgba(120,86,255,0.6)]" />
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        {fields.map((f, i) => (
          <div key={f.k} className="q-rise flex items-center justify-between gap-2 rounded-[10px] bg-surface px-3 py-2 ring-1 ring-hairline/[0.06]" style={{ animationDelay: `${i * 120}ms` }}>
            <span className="text-[11px] text-gray-500">{f.k}</span>
            <span className="truncate text-[12px] font-medium text-gray-900">{f.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** SAM 3.1 outlining units on the shelf photo. */
function CountsArt() {
  return (
    <div className="flex h-full items-center justify-center gap-4 px-5">
      <div className="relative w-[38%] shrink-0 overflow-hidden rounded-[14px] bg-white p-1 shadow-[0_14px_30px_-14px_rgba(0,0,0,0.45)]">
        <div className="relative overflow-hidden rounded-[10px]">
          <img src="/landing/hero/shelf.jpg" alt="" className="block aspect-[3/4] w-full object-cover" />
          {SHELF_BOXES.map((b, i) => (
            <span
              key={i}
              className={`q-pop absolute rounded-[2px] border ${b.line === 0 ? "border-primary bg-primary/30" : "border-white"}`}
              style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%`, animationDelay: `${i * 40}ms` }}
            />
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <p className="font-display text-4xl tabular-nums tracking-tight text-gray-900">{SHELF_BOXES.length}</p>
        <p className="text-[12px] text-gray-500">units outlined</p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-light px-2 py-0.5 text-[11px] font-medium text-primary">
          <span className="size-1.5 rounded-[2px] bg-primary" />
          Toothpaste ×4
        </span>
      </div>
    </div>
  );
}

/** A read product matched to Qore Catalog. */
function MatchesArt() {
  const rows = [
    { name: "Infant cereal 400g", pill: "Strong", tone: "bg-emerald-50 text-emerald-700", on: true },
    { name: "Infant cereal 250g", pill: "Medium", tone: "bg-amber-50 text-amber-700", on: false },
    { name: "Breakfast cereal 400g", pill: "Low", tone: "bg-gray-100 text-gray-600", on: false },
  ];
  return (
    <div className="flex h-full flex-col justify-center gap-1.5 px-5">
      {rows.map((r, i) => (
        <div
          key={r.name}
          className={`q-rise flex items-center gap-2 rounded-[10px] px-3 py-2 ring-1 ${r.on ? "bg-primary-light ring-primary/20" : "bg-surface ring-hairline/[0.06]"}`}
          style={{ animationDelay: `${i * 120}ms` }}
        >
          <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-gray-900">{r.name}</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${r.tone}`}>{r.pill}</span>
        </div>
      ))}
      <p className="mt-1 px-1 text-[11px] text-gray-500">With a typical ₦ shelf price you can keep or change.</p>
    </div>
  );
}

const ENGINES: { name: string; role: string; by: ReactNode; body: string; art: ReactNode }[] = [
  {
    name: "Muse Spark",
    role: "Reads",
    by: <MetaMark className="h-3.5 w-auto" />,
    body: "Reads every label in the frame: brand, product and pack size.",
    art: <ReadsArt />,
  },
  {
    name: "SAM 3.1",
    role: "Counts",
    by: <MetaMark className="h-3.5 w-auto" />,
    body: "Finds and outlines every unit, so the count is the shelf, not a guess.",
    art: <CountsArt />,
  },
  {
    name: "Qore Catalog",
    role: "Matches",
    by: <SolarIcon name="Box" iconStyle="Fill" size={14} className="text-primary" />,
    body: "206,000+ Nigerian products with indicative ₦ shelf prices to match each one to.",
    art: <MatchesArt />,
  },
];

/** What does the work: two Meta models and Qore Catalog, in the order a photo meets them, then you. */
export function Powered() {
  return (
    <section id="powered" className="scroll-mt-20 bg-gray-50 py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-8">
        <div className="grid gap-6 md:grid-cols-2 md:items-end md:gap-12">
          <div>
            <p data-reveal className="mb-5 inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-hairline/[0.08]">
              <MetaMark className="h-3.5 w-auto" />
              Powered by Muse
            </p>
            <h2 data-reveal style={delay(80)} className="font-display text-4xl tracking-tight text-gray-900 sm:text-5xl">Powered by Muse and Qore Catalog</h2>
          </div>
          <p data-reveal style={delay(160)} className="max-w-md text-base leading-relaxed text-gray-600 md:justify-self-end">
            Two Meta models read and count the shelf. Qore Catalog knows Nigerian products and their prices. You have the
            last word.
          </p>
        </div>

        <ol className="relative mt-14 grid gap-3 lg:grid-cols-3 lg:gap-5">
          {ENGINES.map((e, i) => (
            <li key={e.name} data-reveal style={delay(200 + i * 110)} className="relative flex flex-col rounded-[26px] bg-gray-100 p-1.5">
              <div className="relative h-48 overflow-hidden rounded-[20px] bg-[radial-gradient(120%_100%_at_50%_0%,var(--color-surface),transparent_70%)]">
                {e.art}
              </div>
              <div className="flex flex-1 flex-col rounded-[20px] bg-surface p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-hairline/[0.04]">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-medium tabular-nums text-gray-400">0{i + 1}</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-600">
                    {e.by}
                    {e.role}
                  </span>
                </div>
                <h3 className="mt-3 text-xl font-medium tracking-tight text-gray-900">{e.name}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-gray-600">{e.body}</p>
              </div>
              {i < ENGINES.length - 1 && (
                <span
                  aria-hidden
                  className="absolute -right-[26px] top-24 z-10 hidden size-8 items-center justify-center rounded-full bg-surface text-gray-500 ring-1 ring-hairline/[0.08] lg:flex"
                >
                  <SolarIcon name="Arrow-Right" size={16} />
                </span>
              )}
            </li>
          ))}
        </ol>

        <div data-reveal style={delay(560)} className="mt-3 flex flex-col gap-4 rounded-[26px] bg-gray-900 p-5 text-white sm:flex-row sm:items-center sm:gap-5 sm:p-6">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/10">
            <SolarIcon name="Check-Circle" iconStyle="Fill" size={22} className="text-emerald-400" />
          </span>
          <div className="flex-1">
            <p className="font-medium tracking-tight">04 · You confirm</p>
            <p className="mt-0.5 text-[15px] text-white/70">
              Model output never writes to your stock on its own. Counts and matches are suggestions until you confirm them.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
