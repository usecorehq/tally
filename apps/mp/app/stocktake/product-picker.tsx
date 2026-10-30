"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, FormMessage, Pill, QorellyLoader, SearchWell, SolarIcon, cn } from "@tally/ui";
import { catalogueProduct, searchCatalogue } from "./actions";
import type { Candidate, CatalogImage, CatalogProduct, CatalogProductDetail, Detection, MatchStrength } from "./types";
import { ThumbImage, type Thumb } from "./thumb";

/** What a line is linked to: a catalogue product (with what the row shows and pre-fills), or a new item. */
export type Pick =
  | { kind: "product"; qid: string; name: string; variant: string | null; price: { median: number; min: number; max: number } | null; image: CatalogImage; match?: MatchStrength }
  | { kind: "new" };

const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });

const MATCH_PILL: Record<MatchStrength, { label: string; tone: "green" | "amber" | "gray" }> = {
  strong: { label: "Strong match", tone: "green" },
  medium: { label: "Medium match", tone: "amber" },
  low: { label: "Low match", tone: "gray" },
};

export function sizeLabel(p: { variantLabel?: string | null; size?: { value: number; unit: string } | null; packQty?: number }): string | null {
  const size = p.size ? `${p.size.value}${p.size.unit}` : null;
  const pack = p.packQty && p.packQty > 1 ? `× ${p.packQty}` : null;
  return p.variantLabel ?? ([size, pack].filter(Boolean).join(" ") || null);
}

export function pickFromCandidate(c: Candidate): Pick {
  return { kind: "product", qid: c.qid, name: c.name ?? c.qid, variant: sizeLabel(c), price: c.price ?? null, image: c.image ?? null, match: c.match };
}

function pickFromDetail(p: CatalogProductDetail, match?: MatchStrength): Pick {
  return { kind: "product", qid: p.qid, name: p.name, variant: sizeLabel(p), price: p.price, image: p.image ?? null, match };
}

/**
 * The product a detection line is linked to: its suggestions (with how well
 * each fits), other sizes of the current pick (the most common error is the
 * right product in the wrong size), a catalogue search, or a new item.
 * Picking anything closes the sheet; the line's name and price prefill follow.
 */
export function ProductPicker({
  open,
  onOpenChange,
  d,
  current,
  thumb,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  d: Detection;
  current: Pick | null;
  thumb: Thumb | undefined;
  onPick: (pick: Pick) => void;
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<CatalogProduct[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [sizes, setSizes] = useState<CatalogProductDetail["variants"] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const currentQid = current?.kind === "product" ? current.qid : null;
  const reading = [d.brand, d.name, d.pack].filter(Boolean).join(" ") || "Unreadable label";

  // Other sizes of the current pick, fetched when the sheet opens.
  useEffect(() => {
    if (!open || !currentQid) return setSizes(null);
    let live = true;
    catalogueProduct(currentQid).then((res) => live && setSizes(res.ok ? res.data.variants.filter((v) => v.qid !== currentQid) : []));
    return () => {
      live = false;
    };
  }, [open, currentQid]);

  // Debounced catalogue search; only the latest answer counts.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits(null);
      setSearching(false);
      return;
    }
    const mine = ++seq.current;
    setSearching(true);
    const t = setTimeout(async () => {
      const res = await searchCatalogue(q);
      if (mine !== seq.current) return;
      setSearching(false);
      if (res.ok) setHits(res.data);
      else setError(res.error);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  function close(next: boolean) {
    if (!next) {
      setQuery("");
      setHits(null);
      setError(null);
    }
    onOpenChange(next);
  }

  /** A product picked by Qore ID alone (another size, a search hit): fetch it for its name and price. */
  async function pickQid(qid: string) {
    setBusy(qid);
    setError(null);
    const res = await catalogueProduct(qid);
    setBusy(null);
    if (!res.ok) return setError(res.error);
    onPick(pickFromDetail(res.data));
    close(false);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent title="Choose the product" description="Pick what this line is, so the catalogue learns it too." className="max-w-xl" sheetClassName="p-0">
        <div className="flex items-center gap-3 border-b border-gray-100 p-4">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-[10px] bg-gray-100 ring-1 ring-hairline/[0.05]">
            <ThumbImage thumb={thumb} />
          </div>
          <div className="min-w-0">
            <p className="break-words text-[15px] font-medium text-gray-900">{reading}</p>
            <p className="mt-0.5 text-[13px] text-gray-500">
              {d.look} · counted {d.count}
            </p>
          </div>
        </div>

        <div className="space-y-5 p-4">
          {error && <FormMessage message={error} />}

          {d.candidates.length > 0 && (
            <Section title="Suggested">
              {d.candidates.map((c) => (
                <Option
                  key={c.qid}
                  selected={currentQid === c.qid}
                  image={c.image ?? null}
                  fallback={thumb}
                  name={c.name ?? c.qid}
                  detail={sizeLabel(c)}
                  price={c.price?.median}
                  match={c.match}
                  busy={busy === c.qid}
                  onClick={() => {
                    onPick(pickFromCandidate(c));
                    close(false);
                  }}
                />
              ))}
            </Section>
          )}

          {currentQid && sizes && sizes.length > 0 && (
            <Section title="Other sizes" hint={current?.kind === "product" ? current.name : undefined}>
              {sizes.map((v) => (
                <Option key={v.qid} selected={false} image={null} fallback={undefined} name={v.variantLabel ?? v.qid} detail={!v.variantLabel && v.packQty > 1 ? `× ${v.packQty}` : null} busy={busy === v.qid} onClick={() => pickQid(v.qid)} />
              ))}
            </Section>
          )}

          <Section title="Search the catalogue">
            <SearchWell value={query} onChange={(e) => setQuery(e.target.value)} onClear={() => setQuery("")} placeholder="Brand, product or size" aria-label="Search the catalogue" />
            {searching && (
              <p className="flex items-center gap-2 px-1 pt-2 text-[13px] text-gray-500">
                <QorellyLoader className="h-4 w-4" /> Searching…
              </p>
            )}
            {!searching && hits && hits.length === 0 && <p className="px-1 pt-2 text-[13px] text-gray-500">Nothing in the catalogue for “{query.trim()}”.</p>}
            {!searching &&
              hits?.map((h) => (
                <Option key={h.qid} selected={currentQid === h.qid} image={h.image ?? null} fallback={undefined} name={h.name} detail={sizeLabel(h)} busy={busy === h.qid} onClick={() => pickQid(h.qid)} />
              ))}
          </Section>

          <Option
            selected={current?.kind === "new"}
            image={null}
            fallback={undefined}
            icon="Add-Circle"
            name="New item (not in catalogue)"
            detail={`Stock it as your own item: “${reading}”`}
            onClick={() => {
              onPick({ kind: "new" });
              close(false);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-gray-500">
        {title}
        {hint && <span className="ml-1 normal-case tracking-normal text-gray-400">· {hint}</span>}
      </h3>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function Option({
  selected,
  image,
  fallback,
  icon,
  name,
  detail,
  price,
  match,
  busy,
  onClick,
}: {
  selected: boolean;
  image: CatalogImage;
  /** Shown when there is no catalogue picture: the merchant's own crop. */
  fallback: Thumb | undefined;
  icon?: "Add-Circle";
  name: string;
  detail?: string | null;
  price?: number;
  match?: MatchStrength;
  busy?: boolean;
  onClick: () => void;
}) {
  const src = image?.url;
  // Catalogue names usually carry the size already.
  const extra = detail && !name.includes(detail) ? detail : null;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors",
        selected ? "bg-primary-light/60 ring-1 ring-primary-ink" : "hover:bg-gray-50",
      )}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-gray-100 text-gray-400 ring-1 ring-hairline/[0.05]">
        {icon ? (
          <SolarIcon name={icon} iconStyle="Outline" size={20} />
        ) : src ? (
          // eslint-disable-next-line @next/next/no-img-element -- a catalogue picture
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : fallback ? (
          <ThumbImage thumb={fallback} />
        ) : (
          <SolarIcon name="Box" iconStyle="Outline" size={20} />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block break-words text-sm font-medium text-gray-900">{name}</span>
        {(extra || price != null) && (
          <span className="mt-0.5 block text-[13px] text-gray-500">
            {[extra, price != null ? `~${naira.format(price)}` : null].filter(Boolean).join(" · ")}
          </span>
        )}
      </span>
      {busy ? (
        <QorellyLoader className="h-4 w-4 shrink-0" />
      ) : (
        <>
          {match && (
            <Pill tone={MATCH_PILL[match].tone} className="shrink-0">
              {MATCH_PILL[match].label}
            </Pill>
          )}
          {selected && <SolarIcon name="Check-Circle" iconStyle="Fill" size={18} className="shrink-0 text-primary-ink" />}
        </>
      )}
    </button>
  );
}
