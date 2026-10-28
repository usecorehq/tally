import { describe, expect, it } from "@jest/globals";
import { indexInventory, matchInventory, readingKey } from "./inventory-match";

const items = [
  { id: "peak-400", name: "Peak Full Cream Milk Powder 400 g", variantLabel: null, coreQid: "QC-AAAA-AAAA-A" },
  { id: "peak-900", name: "Peak Full Cream Milk Powder", variantLabel: "900g", coreQid: null },
  { id: "ladyb", name: "Lady B Custard", variantLabel: null, coreQid: null },
  { id: "pepsodent", name: "Pepsodent Toothpaste", variantLabel: null, coreQid: null },
  { id: "closeup", name: "Closeup Toothpaste", variantLabel: null, coreQid: null },
];
const reading = (brand: string, name: string, pack = "") => ({ brand, name, pack });

describe("readingKey", () => {
  it("folds case, punctuation and spacing", () => {
    expect(readingKey(reading(" Lady-B ", "Custard  Powder", "2KG"))).toBe("lady b|custard powder|2kg");
  });
});

describe("matchInventory", () => {
  const index = indexInventory(items, [{ itemId: "ladyb", readingKey: "lady b|custard powder|2kg" }]);

  it("a remembered reading wins, even for a product the catalogue doesn't know", () => {
    expect(matchInventory(reading("Lady B", "Custard Powder", "2kg"), null, index)).toEqual({ itemId: "ladyb", match: "reading" });
  });

  it("then the top catalogue candidate's Qore ID", () => {
    expect(matchInventory(reading("Peak", "Milk", "400g"), "QC-AAAA-AAAA-A", index)).toEqual({ itemId: "peak-400", match: "catalogue" });
  });

  it("then brand + name in exactly one item's name, with a compatible size", () => {
    expect(matchInventory(reading("Pepsodent", "Toothpaste"), null, index)).toEqual({ itemId: "pepsodent", match: "name" });
    expect(matchInventory(reading("Peak", "Full Cream Milk Powder", "900g"), null, index)).toEqual({ itemId: "peak-900", match: "name" });
    expect(matchInventory(reading("Peak", "Full Cream Milk Powder", "400g"), null, index)).toEqual({ itemId: "peak-400", match: "name" });
  });

  it.each([
    ["no legible brand", reading("", "Toothpaste")],
    ["ambiguous: both Peak items fit when no size is read", reading("Peak", "Full Cream Milk Powder")],
    ["a size no item has", reading("Peak", "Full Cream Milk Powder", "1.8kg")],
    ["a brand the merchant doesn't stock", reading("Colgate", "Toothpaste")],
  ])("no match: %s", (_label, r) => {
    expect(matchInventory(r, null, index)).toBeNull();
  });

  it("ignores readings that point at archived (absent) items", () => {
    const stale = indexInventory(items, [{ itemId: "gone", readingKey: "x|y|z" }]);
    expect(matchInventory(reading("x", "y", "z"), null, stale)).toBeNull();
  });
});
