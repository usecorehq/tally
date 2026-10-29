import { describe, expect, it } from "@jest/globals";
import { parsePhotoCheck } from "./photo-check";

const raw = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    verdict: "good",
    issues: [],
    instruction: "",
    products_visible: 12,
    labels_legible: "most",
    has_region: true,
    region: { x_min: 0, y_min: 100, x_max: 1000, y_max: 900 },
    ...over,
  });

describe("parsePhotoCheck", () => {
  it("maps the model's answer to the API shape", () => {
    expect(parsePhotoCheck(raw())).toEqual({
      verdict: "good",
      issues: [],
      instruction: "",
      productsVisible: 12,
      labelsLegible: "most",
      region: { x1: 0, y1: 100, x2: 1000, y2: 900 },
    });
  });

  it("drops unknown issues and duplicates, and clamps the region to the grid", () => {
    const c = parsePhotoCheck(raw({ verdict: "retake", issues: ["blurry", "nope", "blurry"], region: { x_min: -5, y_min: 10, x_max: 1200, y_max: 50 } }));
    expect(c.issues).toEqual(["blurry"]);
    expect(c.region).toEqual({ x1: 0, y1: 10, x2: 1000, y2: 50 });
  });

  it("no region without has_region, or for an empty box; an odd verdict reads as usable", () => {
    expect(parsePhotoCheck(raw({ has_region: false })).region).toBeNull();
    expect(parsePhotoCheck(raw({ region: { x_min: 500, y_min: 500, x_max: 500, y_max: 600 } })).region).toBeNull();
    expect(parsePhotoCheck(raw({ verdict: "maybe" })).verdict).toBe("usable");
  });

  it("throws on invalid JSON", () => {
    expect(() => parsePhotoCheck("not json")).toThrow("Model returned invalid JSON");
  });
});
