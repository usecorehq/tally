import { describe, expect, it } from "@jest/globals";
import { BARCODE_PATTERN, isUniqueViolation, normalizeBarcode } from "./barcode";

describe("normalizeBarcode", () => {
  it("stores a 12-digit UPC-A as its 13-digit EAN form", () => {
    expect(normalizeBarcode("036000291452")).toBe("0036000291452");
  });
  it.each(["6156000024013", "96385074", "12345678901234", "ABC-123.x"])("leaves %s unchanged", (code) => {
    expect(normalizeBarcode(code)).toBe(code);
  });
  it("trims whitespace", () => {
    expect(normalizeBarcode(" 6156000024013 ")).toBe("6156000024013");
  });
});

describe("BARCODE_PATTERN", () => {
  it.each(["6156000024013", "0036000291452", "ABC-123", "SKU.42"])("accepts %s", (c) => expect(BARCODE_PATTERN.test(c)).toBe(true));
  it.each(["123", "x".repeat(65), "has space", "semi;colon", ""])("rejects %j", (c) => expect(BARCODE_PATTERN.test(c)).toBe(false));
});

describe("isUniqueViolation", () => {
  it("matches a raw postgres error and one wrapped by drizzle", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
    expect(isUniqueViolation({ name: "DrizzleQueryError", cause: { code: "23505" } })).toBe(true);
  });
  it.each([{ code: "23503" }, { cause: { code: "23502" } }, new Error("x"), null, undefined])("ignores %j", (e) => {
    expect(isUniqueViolation(e)).toBe(false);
  });
});
