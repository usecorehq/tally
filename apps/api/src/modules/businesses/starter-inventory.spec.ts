import { describe, expect, it } from "@jest/globals";
import type { StarterItem } from "./businesses.dto";
import { planStarterInventory } from "./starter-inventory";

const BIZ = "00000000-0000-4000-8000-000000000001";
const RICE = "QC-7K2M-9XQ4-R";
const OTHER = "QC-8M3N-2PQ5-S";
const item = (over: Partial<StarterItem>): StarterItem => ({
  clientRef: "c1",
  templateItemName: "Rice (Bag)",
  outcome: "accepted",
  name: "Big Bull Rice 25kg",
  price: "45000.00",
  ...over,
});
const plan = (...items: StarterItem[]) => planStarterInventory(BIZ, "supermarket", items);

describe("planStarterInventory", () => {
  it("accepted → stock the suggested product; feedback carries suggestedQid", () => {
    const p = plan(item({ suggestedQid: RICE, suggestedScore: 0.9, openingQuantity: 4 }));
    expect(p.items).toEqual([
      expect.objectContaining({ clientRef: "c1", openingQuantity: 4, row: expect.objectContaining({ coreQid: RICE, source: "template", price: "45000.00", businessId: BIZ }) }),
    ]);
    expect(p.feedback).toEqual([
      {
        clientRef: "c1",
        businessRef: BIZ,
        subtypeCode: "supermarket",
        source: "template",
        input: { name: "Rice (Bag)" },
        suggestedQid: RICE,
        suggestedScore: 0.9,
        outcome: "accepted",
        quantity: 4,
        unitPriceNgn: 45000,
      },
    ]);
  });

  it("accepted with only qid → confirmedQid, so the catalogue still has a product", () => {
    const p = plan(item({ qid: RICE }));
    expect(p.items[0]!.row.coreQid).toBe(RICE);
    expect(p.feedback[0]).toMatchObject({ outcome: "accepted", confirmedQid: RICE });
    expect(p.feedback[0]).not.toHaveProperty("suggestedQid");
  });

  it("corrected → stock the picked product; feedback has both qids", () => {
    const p = plan(item({ outcome: "corrected", suggestedQid: RICE, qid: OTHER }));
    expect(p.items[0]!.row.coreQid).toBe(OTHER);
    expect(p.feedback[0]).toMatchObject({ outcome: "corrected", suggestedQid: RICE, confirmedQid: OTHER });
  });

  it("new_item → no catalogue link; feedback has confirmedName", () => {
    const p = plan(item({ outcome: "new_item", suggestedQid: RICE, name: "Mama's Ofada Rice" }));
    expect(p.items[0]!.row.coreQid).toBeNull();
    expect(p.feedback[0]).toMatchObject({ outcome: "new_item", confirmedName: "Mama's Ofada Rice" });
    expect(p.feedback[0]).not.toHaveProperty("confirmedQid");
  });

  it("removed → nothing stocked, feedback only, no price or quantity", () => {
    const p = plan(item({ outcome: "removed", suggestedQid: RICE, name: undefined, price: undefined }));
    expect(p.items).toEqual([]);
    expect(p.feedback).toEqual([expect.objectContaining({ outcome: "removed", suggestedQid: RICE })]);
    expect(p.feedback[0]).not.toHaveProperty("quantity");
    expect(p.feedback[0]).not.toHaveProperty("unitPriceNgn");
  });

  it.each([
    ["accepted without any qid", item({}), "accepted needs suggestedQid"],
    ["corrected without qid", item({ outcome: "corrected", suggestedQid: RICE }), "corrected needs qid"],
    ["kept item without price", item({ suggestedQid: RICE, price: undefined }), "name and price are required"],
    ["kept item without name", item({ outcome: "new_item", name: undefined }), "name and price are required"],
  ])("%s is reported invalid and skipped", (_label, input, reason) => {
    const p = plan(input);
    expect(p.items).toEqual([]);
    expect(p.feedback).toEqual([]);
    expect(p.invalid).toEqual([{ clientRef: "c1", reason: expect.stringContaining(reason) }]);
  });

  it("a duplicate clientRef in one request is applied once", () => {
    const p = plan(item({ suggestedQid: RICE }), item({ suggestedQid: OTHER }));
    expect(p.items).toHaveLength(1);
    expect(p.invalid).toEqual([{ clientRef: "c1", reason: "duplicate clientRef in request" }]);
  });

  it("feedback price is whole Naira and quantity only when whole (catalogue validates both as integers)", () => {
    const p = plan(item({ suggestedQid: RICE, price: "2500.50", openingQuantity: 2.5 }));
    expect(p.items[0]!.row.price).toBe("2500.50");
    expect(p.items[0]!.openingQuantity).toBe(2.5);
    expect(p.feedback[0]).toMatchObject({ unitPriceNgn: 2501 });
    expect(p.feedback[0]).not.toHaveProperty("quantity");
  });

  it("opening quantity defaults to 0 and optional fields to null", () => {
    const p = plan(item({ suggestedQid: RICE }));
    expect(p.items[0]).toMatchObject({ openingQuantity: 0, row: { variantLabel: null, sizeValue: null, packQty: 1, categoryPath: null } });
  });
});
