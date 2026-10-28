import { describe, expect, it } from "@jest/globals";
import { feedbackFor, feedbackRef, outcomeFor, type DecidedDetection } from "./confirm-plan";

const BIZ = "00000000-0000-4000-8000-000000000001";
const SCAN = "00000000-0000-4000-8000-0000000000c1";
const base: DecidedDetection = {
  scanId: SCAN,
  position: 2,
  brand: "Peak",
  name: "Full Cream Milk Powder",
  pack: "400g",
  candidates: [
    { qid: "QC-AAAA-AAAA-A", score: 0.88 },
    { qid: "QC-BBBB-BBBB-B", score: 0.66 },
  ],
  outcome: "accepted",
  confirmedQid: "QC-AAAA-AAAA-A",
  quantity: 6,
  itemName: "Peak Milk 400g",
  price: "4500.00",
};

describe("outcomeFor", () => {
  it.each([
    ["skip", null, "QC-AAAA-AAAA-A", "removed"],
    ["add", "QC-AAAA-AAAA-A", "QC-AAAA-AAAA-A", "accepted"],
    ["restock", "QC-BBBB-BBBB-B", "QC-AAAA-AAAA-A", "corrected"],
    ["add", null, "QC-AAAA-AAAA-A", "new_item"],
    ["restock", null, null, "new_item"],
    ["restore", "QC-AAAA-AAAA-A", null, "corrected"],
  ] as const)("%s qid=%s top=%s → %s", (action, qid, top, expected) => {
    expect(outcomeFor(action, qid, top)).toBe(expected);
  });
});

describe("feedbackFor", () => {
  it("sends the reading, the top suggestion, the confirmed product, whole units and whole Naira", () => {
    expect(feedbackFor(base, BIZ, "supermarket")).toEqual({
      clientRef: `${SCAN}:2`,
      businessRef: BIZ,
      subtypeCode: "supermarket",
      source: "photo",
      input: { brand: "Peak", name: "Full Cream Milk Powder", pack: "400g" },
      suggestedQid: "QC-AAAA-AAAA-A",
      suggestedScore: 0.88,
      outcome: "accepted",
      confirmedQid: "QC-AAAA-AAAA-A",
      quantity: 6,
      unitPriceNgn: 4500,
    });
  });

  it("new_item carries the merchant's name and no Qore ID; unread brand/pack are omitted", () => {
    const fb = feedbackFor({ ...base, brand: "", pack: "", candidates: [], outcome: "new_item", confirmedQid: null, price: "1250.50" }, BIZ, "x");
    expect(fb).toMatchObject({ input: { name: "Full Cream Milk Powder" }, outcome: "new_item", confirmedName: "Peak Milk 400g", unitPriceNgn: 1251 });
    expect(fb).not.toHaveProperty("confirmedQid");
    expect(fb).not.toHaveProperty("suggestedQid");
    expect(fb.input).not.toHaveProperty("brand");
  });

  it("removed carries no product, quantity or price", () => {
    const fb = feedbackFor({ ...base, outcome: "removed", confirmedQid: null, quantity: null, itemName: null, price: null }, BIZ, "x");
    expect(fb).toMatchObject({ outcome: "removed", suggestedQid: "QC-AAAA-AAAA-A" });
    for (const key of ["confirmedQid", "confirmedName", "quantity", "unitPriceNgn"]) expect(fb).not.toHaveProperty(key);
  });

  it("feedbackRef is scanId:position", () => {
    expect(feedbackRef(SCAN, 0)).toBe(`${SCAN}:0`);
  });
});
