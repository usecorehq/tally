import { describe, expect, it } from "@jest/globals";
import { indexInventory, matchInventory, readingKey } from "./inventory-match";

const items = [
  { id: "peak-400", name: "Peak Full Cream Milk Powder 400 g", variantLabel: null, coreQid: "QC-AAAA-AAAA-A" },
  { id: "peak-900", name: "Peak Full Cream Milk Powder", variantLabel: "900g", coreQid: null },
  { id: "ladyb", name: "Lady B Custard", variantLabel: null, coreQid: null },
  { id: "pepsodent", name: "Pepsodent Toothpaste", variantLabel: null, coreQid: null },
  { id: "closeup", name: "Closeup Toothpaste", variantLabel: null, coreQid: null },
  // Linked to the catalogue, so never matched by name.
  { id: "sensodyne", name: "Sensodyne Toothpaste", variantLabel: null, coreQid: "QC-SSSS-SSSS-S" },
];
const archived = [
  { id: "old-milo", name: "Milo 400g", variantLabel: null, coreQid: "QC-MMMM-MMMM-M" },
  // An archived copy of a product that is also active: the active one wins.
  { id: "old-peak", name: "Peak old", variantLabel: null, coreQid: "QC-AAAA-AAAA-A" },
];
const reading = (brand: string, name: string, pack = "") => ({ brand, name, pack });

describe("readingKey", () => {
  it("folds case, punctuation and spacing", () => {
    expect(readingKey(reading(" Lady-B ", "Custard  Powder", "2KG"))).toBe("lady b|custard powder|2kg");
  });
});

describe("matchInventory", () => {
  const index = indexInventory(items, [{ itemId: "ladyb", readingKey: "lady b|custard powder|2kg" }], archived);

  it("a remembered reading wins, even for a product the catalogue doesn't know", () => {
    expect(matchInventory(reading("Lady B", "Custard Powder", "2kg"), [], index)).toEqual({ itemId: "ladyb", match: "reading", archived: false });
  });

  it("then any plausible candidate's Qore ID on an active item, best candidate first", () => {
    expect(matchInventory(reading("Peak", "Milk", "400g"), ["QC-ZZZZ-ZZZZ-Z", "QC-AAAA-AAAA-A"], index)).toEqual({
      itemId: "peak-400",
      match: "catalogue",
      archived: false,
    });
  });

  it("offers to restore an item the merchant removed rather than adding a duplicate", () => {
    expect(matchInventory(reading("Milo", "Milo"), ["QC-MMMM-MMMM-M"], index)).toEqual({ itemId: "old-milo", match: "catalogue", archived: true });
  });

  it("an active item beats an archived copy of the same product", () => {
    expect(matchInventory(reading("Peak", "x"), ["QC-AAAA-AAAA-A"], index)).toMatchObject({ itemId: "peak-400", archived: false });
  });

  it("ambiguous names don't match", () => {
    const twins = indexInventory(
      [
        { id: "a", name: "Peak Milk 400g", variantLabel: null, coreQid: null },
        { id: "b", name: "Peak Milk Tin", variantLabel: null, coreQid: null },
      ],
      [],
    );
    expect(matchInventory(reading("Peak", "Milk"), [], twins)).toBeNull();
  });

  it("then brand + name in exactly one hand-typed (unlinked) item's name, with a compatible size", () => {
    expect(matchInventory(reading("Pepsodent", "Toothpaste"), [], index)).toEqual({ itemId: "pepsodent", match: "name", archived: false });
    expect(matchInventory(reading("Peak", "Full Cream Milk Powder", "900g"), [], index)).toEqual({ itemId: "peak-900", match: "name", archived: false });
  });

  it.each([
    ["no legible brand", reading("", "Toothpaste")],
    ["a size no unlinked item has", reading("Peak", "Full Cream Milk Powder", "400g")],
    ["only a catalogue-linked item has the name", reading("Sensodyne", "Toothpaste")],
    ["a brand the merchant doesn't stock", reading("Colgate", "Toothpaste")],
  ])("no match: %s", (_label, r) => {
    expect(matchInventory(r, [], index)).toBeNull();
  });

  it("ignores readings that point at archived (absent) items", () => {
    const stale = indexInventory(items, [{ itemId: "gone", readingKey: "x|y|z" }]);
    expect(matchInventory(reading("x", "y", "z"), [], stale)).toBeNull();
  });
});
