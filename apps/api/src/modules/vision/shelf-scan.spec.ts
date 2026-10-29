import { describe, expect, it } from "@jest/globals";
import type { MatchCandidate, MatchResult } from "@tally/catalog-client";
import type { ShelfProduct } from "./shelf-reader";
import { indexInventory } from "./inventory-match";
import { buildDetections, matchItems, matchStrength, plausible } from "./shelf-scan";

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

const candidate = (qid: string, score: number, brandSignal = 1, textSignal = 1): MatchCandidate =>
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
    signals: { text: textSignal, brand: brandSignal, size: 1 },
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

    expect(first).toMatchObject({
      id: "d1",
      name: "Full Cream Milk Powder",
      count: 2,
      inventoryItemId: "item-a",
      inventoryMatch: "catalogue",
      // candidate() sets signals.size = 1
      inventoryNeedsConfirm: false,
    });
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
      result("1", [candidate("QC-E", 0.6, 0.5, 0.7), candidate("QC-F", 0.7, 0.5, 0.45)]),
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
    // Live semantic-search reads: "Powdered milk" → Nestlé Cream Milk Powder (text 0.70), "RED" → a red wine (0.51).
    ["no brand, meaning-level match", loose, candidate("QC-A", 0.598, 0.5, 0.7), true],
    ["no brand, at the line (\"tomato puree tin\" → Gino tomato paste, 0.501)", loose, candidate("QC-A", 0.5, 0.5, 0.501), true],
    ["no brand, just under (\"Palm oil\" → a body oil, 0.496)", loose, candidate("QC-A", 0.498, 0.5, 0.496), false],
    ["no brand, weak text even with a high score", loose, candidate("QC-A", 0.76, 0.5, 0.45), false],
  ] as const)("%s", (_label, product, c, expected) => {
    expect(plausible(product, c)).toBe(expected);
  });
});

describe("unbranded reads never count as sure in stock", () => {
  it("asks even when the catalogue product is stocked and the size agrees", () => {
    const stocked = indexInventory([{ id: "rice", name: "Big Bull Rice 50kg", variantLabel: null, coreQid: "QC-R" }], []);
    const rice = { ...loose, name: "Rice", pack: "50kg" };
    const c = { ...candidate("QC-R", 0.67, 0.5, 0.59), signals: { text: 0.59, brand: 0.5, size: 1 } } as MatchCandidate;
    expect(buildDetections([rice], [result("0", [c])], stocked, new Map(), () => "d")[0]).toMatchObject({
      inventoryItemId: "rice",
      inventoryMatch: "catalogue",
      inventoryNeedsConfirm: true,
    });
  });
});

describe("matchStrength", () => {
  it.each([
    ["brand and size agree", { text: 0.9, brand: 1, size: 1 }, "strong"],
    ["brand agrees, other size (Peak 900g read, 400g offered)", { text: 0.9, brand: 1, size: 0 }, "medium"],
    ["brand agrees, no size read", { text: 0.8, brand: 1, size: 0.5 }, "medium"],
    ["no brand read, strong name match", { text: 0.81, brand: 0.5, size: 0.5 }, "medium"],
    ["no brand read, size agrees but weak name", { text: 0.6, brand: 0.5, size: 1 }, "low"],
    // Live: an unbranded "Blue box" pre-filled a hair dye at ₦11,499.
    ["no brand read, weak name (\"Blue box\" → a hair dye)", { text: 0.55, brand: 0.5, size: 0.5 }, "low"],
    ["a different brand", { text: 0.95, brand: 0, size: 1 }, "low"],
  ] as const)("%s → %s", (_label, signals, expected) => {
    expect(matchStrength(signals)).toBe(expected);
  });

  it("every detection candidate carries its strength and the catalogue image (null until approved)", () => {
    const c = { ...candidate("QC-A", 0.88), image: { url: "https://api.qorecatalogue.com/v1/images/ab.webp", width: 400, height: 600 } } as MatchCandidate;
    const [d] = buildDetections([peak], [result("0", [c, candidate("QC-B", 0.7, 1, 0.9)])], none, new Map(), () => "d");
    expect(d!.candidates.map((x) => [x.qid, x.match, x.image?.url ?? null])).toEqual([
      ["QC-A", "strong", "https://api.qorecatalogue.com/v1/images/ab.webp"],
      ["QC-B", "strong", null],
    ]);
  });
});
