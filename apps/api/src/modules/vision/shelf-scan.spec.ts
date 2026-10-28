import { describe, expect, it } from "@jest/globals";
import type { MatchCandidate, MatchResult } from "@tally/catalog-client";
import type { ShelfProduct } from "./shelf-reader";
import { buildDetections, matchItems } from "./shelf-scan";

const peak: ShelfProduct = {
  brand: "Peak",
  name: "Full Cream Milk Powder",
  pack: "400g",
  count: 2,
  boxes: [{ x1: 1, y1: 2, x2: 3, y2: 4 }],
  confidence: "high",
};
const loose: ShelfProduct = { ...peak, brand: "", pack: "", name: "Tomato paste", confidence: "low" };

const candidate = (qid: string, score: number): MatchCandidate =>
  ({
    qid,
    name: `Product ${qid}`,
    variantLabel: null,
    size: { value: 400, unit: "g" },
    packQty: 1,
    status: "active",
    family: { slug: "f", name: "F" },
    brand: { slug: "peak", name: "Peak" },
    category: { path: "a/b", name: "B" },
    price: { currency: "NGN", indicative: true, median: 4500, min: 4200, max: 5100, offers: 3, retailers: 2, observedAt: "2026-10-01" },
    score,
    signals: { text: 1, brand: 1, size: 1 },
  }) as MatchCandidate;

const result = (ref: string, candidates: MatchCandidate[]): MatchResult => ({
  ref,
  query: { brand: null, name: "x", pack: null },
  parsedPack: null,
  candidates,
});

describe("matchItems", () => {
  it("sends brand and pack only when read, ref = index", () => {
    expect(matchItems([peak, loose])).toEqual([
      { ref: "0", brand: "Peak", name: "Full Cream Milk Powder", pack: "400g" },
      { ref: "1", name: "Tomato paste" },
    ]);
  });
});

describe("buildDetections", () => {
  let n = 0;
  const id = () => `d${++n}`;

  it("maps results back by ref, keeps the top 3 and flags stocked products", () => {
    n = 0;
    const matches = [
      result("1", []),
      result("0", [candidate("QC-A", 0.9), candidate("QC-B", 0.8), candidate("QC-C", 0.7), candidate("QC-D", 0.6)]),
    ];
    const [first, second] = buildDetections([peak, loose], matches, new Map([["QC-A", "item-a"], ["QC-C", "item-c"]]), id);

    expect(first).toMatchObject({ id: "d1", name: "Full Cream Milk Powder", count: 2, inventoryItemId: "item-a" });
    expect(first!.candidates.map((c) => [c.qid, c.inventoryItemId])).toEqual([
      ["QC-A", "item-a"],
      ["QC-B", null],
      ["QC-C", "item-c"],
    ]);
    expect(first!.candidates[0]).toMatchObject({ brand: "Peak", price: { median: 4500, min: 4200, max: 5100 } });
    expect(second).toMatchObject({ id: "d2", candidates: [], inventoryItemId: null });
  });

  it("returns detections without candidates when the catalogue gave nothing", () => {
    expect(buildDetections([peak], [], new Map(), id)[0]).toMatchObject({ candidates: [], inventoryItemId: null });
  });

  it("passes a null price through", () => {
    const c = { ...candidate("QC-A", 0.9), price: null } as MatchCandidate;
    expect(buildDetections([peak], [result("0", [c])], new Map(), id)[0]!.candidates[0]!.price).toBeNull();
  });
});
