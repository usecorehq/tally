/**
 * Scoring for scripts/vision-benchmark.mjs: a scan's detections against a
 * hand-counted ground truth. Pure, no IO; not used by any route.
 *
 * Matching: each detection pairs with at most one truth product, best pairs
 * first (greedy), by token overlap (Dice) of normalised "brand name". A pair
 * needs similarity >= MIN_PAIR_SIMILARITY, and when both sides read a brand,
 * the brands must share a word ("Peak Full Cream" never pairs with "Three
 * Crowns Full Cream"). An extra detection of an already-paired product (the
 * reader split one product into two lines) counts against precision.
 *
 * Per pair: brand read right (normalised, spaces ignored), name read right
 * (same words in any order), Qore ID right / wrong / missing (only when the
 * truth has one), absolute count error, count within ±20%.
 */

export type TruthProduct = { brand: string; name: string; pack?: string; count: number; qid?: string | null };
export type ScoredDetection = { brand: string; name: string; pack: string; count: number; qid: string | null };

export const MIN_PAIR_SIMILARITY = 0.5;
export const COUNT_TOLERANCE = 0.2;

/** Muse Spark Standard, $ per million tokens; SAM 3.1, $ per image. */
export const PRICES = { sparkInPerM: 1.25, sparkOutPerM: 4.25, samPerImage: 2.5 / 1000 } as const;

export type Pair = {
  truth: number;
  detection: number;
  similarity: number;
  brandOk: boolean;
  nameOk: boolean;
  /** null when the truth has no Qore ID. */
  qid: "right" | "wrong" | "missing" | null;
  countError: number;
  countWithin: boolean;
};

export type PhotoScore = {
  truthProducts: number;
  detections: number;
  pairs: Pair[];
  /** Truth products nothing detected, and detections that matched no truth product. */
  missed: number[];
  extra: number[];
};

export type Totals = {
  truthProducts: number;
  detections: number;
  matched: number;
  /** null when there is nothing to divide by. */
  recall: number | null;
  precision: number | null;
  brandOk: number;
  nameOk: number;
  qid: { right: number; wrong: number; missing: number };
  /** Mean absolute count error over matched products. */
  countMae: number | null;
  countWithin: number;
};

const STOPWORDS = new Set(["and", "the", "of", "with"]);

export const normalise = (s: string | null | undefined) =>
  (s ?? "").toLowerCase().replace(/&/g, " and ").replace(/[^\p{L}\p{N}.]+/gu, " ").replace(/\s+/g, " ").trim();

const words = (s: string | null | undefined) => normalise(s).split(" ").filter((w) => w && !STOPWORDS.has(w));

/** Dice coefficient of two word lists, as sets. */
export function dice(a: string[], b: string[]): number {
  const A = new Set(a);
  const B = new Set(b);
  if (A.size + B.size === 0) return 0;
  let shared = 0;
  for (const w of A) if (B.has(w)) shared++;
  return (2 * shared) / (A.size + B.size);
}

/** 0–1: how alike a detection and a truth product are by brand + name; 0 when both read a brand and they share no word. */
export function similarity(truth: Pick<TruthProduct, "brand" | "name">, det: Pick<ScoredDetection, "brand" | "name">): number {
  const tb = words(truth.brand);
  const db = words(det.brand);
  if (tb.length && db.length && !tb.some((w) => db.includes(w))) return 0;
  return dice([...tb, ...words(truth.name)], [...db, ...words(det.name)]);
}

export const brandOk = (truth: string, read: string) => normalise(truth).replace(/ /g, "") === normalise(read).replace(/ /g, "");
export const nameOk = (truth: string, read: string) => {
  const a = new Set(words(truth));
  const b = new Set(words(read));
  return a.size === b.size && [...a].every((w) => b.has(w));
};

export function scorePhoto(truth: TruthProduct[], detections: ScoredDetection[]): PhotoScore {
  const candidates: { t: number; d: number; s: number }[] = [];
  truth.forEach((t, ti) =>
    detections.forEach((d, di) => {
      const s = similarity(t, d);
      if (s >= MIN_PAIR_SIMILARITY) candidates.push({ t: ti, d: di, s });
    }),
  );
  // Best pairs first; ties keep truth order, then detection order.
  candidates.sort((a, b) => b.s - a.s || a.t - b.t || a.d - b.d);

  const usedT = new Set<number>();
  const usedD = new Set<number>();
  const pairs: Pair[] = [];
  for (const c of candidates) {
    if (usedT.has(c.t) || usedD.has(c.d)) continue;
    usedT.add(c.t);
    usedD.add(c.d);
    const t = truth[c.t]!;
    const d = detections[c.d]!;
    const countError = Math.abs(d.count - t.count);
    pairs.push({
      truth: c.t,
      detection: c.d,
      similarity: Math.round(c.s * 100) / 100,
      brandOk: brandOk(t.brand, d.brand),
      nameOk: nameOk(t.name, d.name),
      qid: !t.qid ? null : !d.qid ? "missing" : d.qid === t.qid ? "right" : "wrong",
      countError,
      countWithin: countError <= COUNT_TOLERANCE * t.count,
    });
  }
  pairs.sort((a, b) => a.truth - b.truth);
  return {
    truthProducts: truth.length,
    detections: detections.length,
    pairs,
    missed: truth.map((_, i) => i).filter((i) => !usedT.has(i)),
    extra: detections.map((_, i) => i).filter((i) => !usedD.has(i)),
  };
}

/** Micro-averaged over every photo: each product weighs the same, whichever photo it is in. */
export function totals(scores: PhotoScore[]): Totals {
  const pairs = scores.flatMap((s) => s.pairs);
  const truthProducts = scores.reduce((n, s) => n + s.truthProducts, 0);
  const detections = scores.reduce((n, s) => n + s.detections, 0);
  const ratio = (a: number, b: number) => (b ? a / b : null);
  return {
    truthProducts,
    detections,
    matched: pairs.length,
    recall: ratio(pairs.length, truthProducts),
    precision: ratio(pairs.length, detections),
    brandOk: pairs.filter((p) => p.brandOk).length,
    nameOk: pairs.filter((p) => p.nameOk).length,
    qid: {
      right: pairs.filter((p) => p.qid === "right").length,
      wrong: pairs.filter((p) => p.qid === "wrong").length,
      missing: pairs.filter((p) => p.qid === "missing").length,
    },
    countMae: ratio(
      pairs.reduce((n, p) => n + p.countError, 0),
      pairs.length,
    ),
    countWithin: pairs.filter((p) => p.countWithin).length,
  };
}

/** Estimated $ for Spark tokens plus SAM images. */
export function cost(usage: { input: number; output: number; samImages: number }): number {
  return (usage.input * PRICES.sparkInPerM + usage.output * PRICES.sparkOutPerM) / 1e6 + usage.samImages * PRICES.samPerImage;
}
