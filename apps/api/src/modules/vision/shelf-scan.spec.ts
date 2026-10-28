import { describe, expect, it } from "@jest/globals";
import type { MatchCandidate, MatchResult } from "@tally/catalog-client";
import type { ShelfProduct } from "./shelf-reader";
import { indexInventory } from "./inventory-match";
import { buildDetections, matchItems, plausible } from "./shelf-scan";

const none = indexInventory([], []);
const stockedA = indexInventory(
  [
    { id: "item-a", name: "Peak 400g", variantLabel: null, coreQid: "QC-A" },
    { id: "item-c", name: "Other", variantLabel: null, coreQid: "QC-C" },
  ],
  [],
);

const peak: ShelfProduct = {
  brand: "Peak",
  name: "Full Cream Milk Powder",
  pack: "400g",
  look: "yellow tin",
  count: 2,
  boxes: [{ x1: 1, y1: 2, x2: 3, y2: 4 }],
  confidence: "high",
};
const loose: ShelfProduct = { ...peak, brand: "", pack: "", name: "Tomato paste", confidence: "low" };

const candidate = (qid: string, score: number, brandSignal = 1): MatchCandidate =>
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
    signals: { text: 1, brand: brandSignal, size: 1 },
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
    const [first, second] = buildDetections([peak, loose], matches, stockedA, new Map(), id);

    expect(first).toMatchObject({ id: "d1", name: "Full Cream Milk Powder", count: 2, inventoryItemId: "item-a", inventoryMatch: "catalogue" });
    expect(first!.candidates.map((c) => [c.qid, c.inventoryItemId])).toEqual([
      ["QC-A", "item-a"],
      ["QC-B", null],
      ["QC-C", "item-c"],
    ]);
    expect(first!.candidates[0]).toMatchObject({ brand: "Peak", price: { median: 4500, min: 4200, max: 5100 } });
    expect(second).toMatchObject({ id: "d2", candidates: [], inventoryItemId: null, inventoryMatch: null });
  });

  it("returns detections without candidates when the catalogue gave nothing", () => {
    expect(buildDetections([peak], [], none, new Map(), id)[0]).toMatchObject({ candidates: [], inventoryItemId: null });
  });

  it("drops implausible candidates before keeping the top 3", () => {
    const matches = [
      result("0", [candidate("QC-X", 0.95, 0), candidate("QC-A", 0.9), candidate("QC-B", 0.5), candidate("QC-C", 0.4), candidate("QC-D", 0.3)]),
      result("1", [candidate("QC-E", 0.8, 0.5), candidate("QC-F", 0.7, 0.5)]),
    ];
    const [branded, unbranded] = buildDetections([peak, loose], matches, none, new Map(), id);
    expect(branded!.candidates.map((c) => c.qid)).toEqual(["QC-A", "QC-B", "QC-C"]);
    expect(unbranded!.candidates.map((c) => c.qid)).toEqual(["QC-E"]);
  });

  it("uses SAM's count and boxes when SAM found units, else Spark's", () => {
    const sam = [{ x1: 5, y1: 5, x2: 9, y2: 9 }, { x1: 10, y1: 5, x2: 14, y2: 9 }, { x1: 20, y1: 5, x2: 24, y2: 9 }];
    const [counted, missed, notRun] = buildDetections(
      [peak, loose, { ...peak, name: "Other" }],
      [],
      none,
      new Map([[0, sam], [1, []]]),
      id,
    );
    expect(counted).toMatchObject({ count: 3, countSource: "sam", sparkCount: 2, samCount: 3, boxes: sam });
    expect(missed).toMatchObject({ count: 2, countSource: "spark", sparkCount: 2, samCount: 0, boxes: peak.boxes });
    expect(notRun).toMatchObject({ count: 2, countSource: "spark", samCount: null });
  });

  it("passes a null price through", () => {
    const c = { ...candidate("QC-A", 0.9), price: null } as MatchCandidate;
    expect(buildDetections([peak], [result("0", [c])], none, new Map(), id)[0]!.candidates[0]!.price).toBeNull();
  });
});

describe("plausible", () => {
  it.each([
    ["brand read, brand matched", peak, candidate("QC-A", 0.4, 1), true],
    ["brand read, other brand", peak, candidate("QC-A", 0.95, 0), false],
    ["brand read, catalogue has no brand", peak, candidate("QC-A", 0.95, 0.5), false],
    ["no brand, strong name match", loose, candidate("QC-A", 0.75, 0.5), true],
    ["no brand, weak name match", loose, candidate("QC-A", 0.74, 0.5), false],
  ] as const)("%s", (_label, product, c, expected) => {
    expect(plausible(product, c)).toBe(expected);
  });
});
