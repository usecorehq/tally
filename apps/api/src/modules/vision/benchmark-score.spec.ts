import { describe, expect, it } from "@jest/globals";
import { brandOk, cost, nameOk, scorePhoto, similarity, totals, type ScoredDetection, type TruthProduct } from "./benchmark-score";

const peak: TruthProduct = { brand: "Peak", name: "Full Cream Milk Powder", pack: "400g", count: 10, qid: "QC-PEAK" };
const crowns: TruthProduct = { brand: "Three Crowns", name: "Full Cream Milk", count: 5, qid: null };
const det = (d: Partial<ScoredDetection>): ScoredDetection => ({ brand: "", name: "", pack: "", count: 0, qid: null, ...d });

describe("similarity", () => {
  it("ignores case, punctuation and word order", () => {
    expect(similarity(peak, det({ brand: "PEAK", name: "milk powder, full-cream" }))).toBe(1);
  });

  it("is 0 when both read a brand and the brands share no word", () => {
    expect(similarity(crowns, det({ brand: "Peak", name: "Full Cream Milk" }))).toBe(0);
  });

  it("counts a brand the reader folded into the name", () => {
    expect(similarity(peak, det({ name: "Peak Full Cream Milk Powder" }))).toBe(1);
  });
});

describe("brandOk / nameOk", () => {
  it("brand ignores spaces and case", () => {
    expect(brandOk("Golden Penny", "GOLDENPENNY")).toBe(true);
    expect(brandOk("Peak", "")).toBe(false);
    expect(brandOk("", "")).toBe(true);
  });

  it("name needs the same words in any order", () => {
    expect(nameOk("Full Cream Milk Powder", "milk powder full cream")).toBe(true);
    expect(nameOk("Full Cream Milk Powder", "Full Cream Milk")).toBe(false);
  });
});

describe("scorePhoto", () => {
  it("pairs each truth product with its best detection and scores it", () => {
    const s = scorePhoto(
      [peak, crowns],
      [
        det({ brand: "Three Crowns", name: "Milk", count: 4 }),
        det({ brand: "Peak", name: "Full Cream Milk Powder", count: 13, qid: "QC-PEAK" }),
        det({ brand: "Indomie", name: "Noodles", count: 30 }),
      ],
    );
    expect(s.pairs).toEqual([
      { truth: 0, detection: 1, similarity: 1, brandOk: true, nameOk: true, qid: "right", countError: 3, countWithin: false },
      { truth: 1, detection: 0, similarity: 0.75, brandOk: true, nameOk: false, qid: null, countError: 1, countWithin: true },
    ]);
    expect(s.missed).toEqual([]);
    expect(s.extra).toEqual([2]);
  });

  it("gives a truth product to one detection only; the duplicate is extra", () => {
    const s = scorePhoto([peak], [det({ brand: "Peak", name: "Milk Powder", count: 4 }), det({ brand: "Peak", name: "Full Cream Milk Powder", count: 6 })]);
    expect(s.pairs.map((p) => p.detection)).toEqual([1]);
    expect(s.extra).toEqual([0]);
  });

  it("marks the Qore ID wrong or missing", () => {
    const wrong = scorePhoto([peak], [det({ brand: "Peak", name: "Full Cream Milk Powder", count: 10, qid: "QC-OTHER" })]);
    const missing = scorePhoto([peak], [det({ brand: "Peak", name: "Full Cream Milk Powder", count: 10 })]);
    expect(wrong.pairs[0]!.qid).toBe("wrong");
    expect(missing.pairs[0]!.qid).toBe("missing");
  });

  it("leaves weak lookalikes unmatched", () => {
    const s = scorePhoto([peak], [det({ name: "Cream crackers" })]);
    expect(s.pairs).toEqual([]);
    expect(s.missed).toEqual([0]);
    expect(s.extra).toEqual([0]);
  });

  it("allows exactly ±20% on the count", () => {
    const s = scorePhoto([peak], [det({ brand: "Peak", name: "Full Cream Milk Powder", count: 12 })]);
    expect(s.pairs[0]!.countWithin).toBe(true);
  });
});

describe("totals", () => {
  it("micro-averages over photos", () => {
    const a = scorePhoto([peak, crowns], [det({ brand: "Peak", name: "Full Cream Milk Powder", count: 10, qid: "QC-PEAK" })]);
    const b = scorePhoto([peak], [det({ brand: "Peak", name: "Full Cream Milk Powder", count: 6 }), det({ name: "Sugar" })]);
    expect(totals([a, b])).toEqual({
      truthProducts: 3,
      detections: 3,
      matched: 2,
      recall: 2 / 3,
      precision: 2 / 3,
      brandOk: 2,
      nameOk: 2,
      qid: { right: 1, wrong: 0, missing: 1 },
      countMae: 2,
      countWithin: 1,
    });
  });

  it("returns null ratios when there is nothing to divide by", () => {
    expect(totals([]).recall).toBeNull();
    expect(totals([]).countMae).toBeNull();
  });
});

describe("cost", () => {
  it("prices Spark tokens and SAM images", () => {
    expect(cost({ input: 1_000_000, output: 1_000_000, samImages: 1000 })).toBeCloseTo(1.25 + 4.25 + 2.5);
  });
});
