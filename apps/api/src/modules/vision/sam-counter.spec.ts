import { describe, expect, it } from "@jest/globals";
import { assignInstances, distinctLooks, MAX_SAM_REQUESTS, parseSamInstances, SAM_MODEL, samRequest, type SamInstance } from "./sam-counter";
import type { Box, ShelfProduct } from "./shelf-reader";

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const box = (x1: number, y1: number, x2: number, y2: number): Box => ({ x1, y1, x2, y2 });
const product = (over: Partial<ShelfProduct>): ShelfProduct => ({
  brand: "",
  name: "x",
  pack: "",
  look: "red box",
  count: 1,
  boxes: [box(0, 0, 10, 10)],
  confidence: "high",
  ...over,
});
const inst = (b: Box, confidence = 0.9): SamInstance => ({ box: b, confidence });

describe("samRequest", () => {
  it("sends the look as the only text, with confidence and one-bit masks", () => {
    const body = samRequest(JPEG, "image/jpeg", "red box") as {
      model: string;
      input: { content: { type: string; text?: string }[] }[];
      metadata: Record<string, string>;
    };
    expect(body.model).toBe(SAM_MODEL);
    expect(body.input[0]!.content[0]).toEqual({ type: "input_text", text: "red box" });
    expect(body.metadata).toEqual({ include_confidence: "true", mask_encoding: "one_bit" });
  });
});

describe("parseSamInstances", () => {
  it("reads boxes by key, converts source pixels to the 0-1000 grid and ignores masks", () => {
    const text =
      "<0f>0<|box;x1=100;y1=50;x2=300;y2=250;w=1000;h=500;c=0.91|><|mask;x=0;y=0;c=0.91;data=2,2,!AB|>," +
      "3<|box;x1=0;y1=0;x2=10;y2=10;w=1000;h=500|><|mask;x=0;y=0;data=1,1,~|~|>";
    expect(parseSamInstances(text)).toEqual([
      { box: { x1: 100, y1: 100, x2: 300, y2: 500 }, confidence: 0.91 },
      { box: { x1: 0, y1: 0, x2: 10, y2: 20 }, confidence: 1 },
    ]);
  });

  it("returns [] for zero matches (empty output)", () => {
    expect(parseSamInstances("")).toEqual([]);
  });

  it("skips malformed or degenerate boxes", () => {
    expect(parseSamInstances("<0f>0<|box;x1=5;y1=5;x2=5;y2=9;w=10;h=10|>,1<|box;x1=a;w=10|>")).toEqual([]);
  });
});

describe("distinctLooks", () => {
  it("dedupes looks in first-seen order and caps the requests", () => {
    expect(distinctLooks([product({ look: "red box" }), product({ look: "blue tin" }), product({ look: "red box" })])).toEqual([
      "red box",
      "blue tin",
    ]);
    const many = Array.from({ length: MAX_SAM_REQUESTS + 3 }, (_, i) => product({ look: `look ${i}` }));
    expect(distinctLooks(many)).toHaveLength(MAX_SAM_REQUESTS);
  });
});

describe("assignInstances", () => {
  // Two red products side by side on one shelf, a blue one below.
  const left = product({ name: "left", boxes: [box(100, 100, 150, 200), box(160, 100, 210, 200)] });
  const right = product({ name: "right", boxes: [box(600, 100, 650, 200)] });
  const blue = product({ name: "blue", look: "blue tin", boxes: [box(100, 600, 150, 700)] });

  it("gives each instance to the same-look product it sits among", () => {
    const byLook = new Map([
      ["red box", [inst(box(100, 100, 150, 200)), inst(box(220, 100, 270, 200)), inst(box(610, 100, 660, 200)), inst(box(900, 900, 950, 990))]],
    ]);
    const result = assignInstances([left, right, blue], byLook);
    expect(result.get(0)).toHaveLength(2); // own unit + the neighbour within one unit's width
    expect(result.get(1)).toHaveLength(1);
    expect(result.has(2)).toBe(false); // blue tin not run
  });

  it("drops low-confidence instances and merges overlapping duplicates", () => {
    const byLook = new Map([["red box", [inst(box(100, 100, 150, 200)), inst(box(102, 102, 152, 202)), inst(box(160, 100, 210, 200), 0.3)]]]);
    expect(assignInstances([left], byLook).get(0)).toHaveLength(1);
  });

  it("drops an instance sitting on a different-looking product's unit", () => {
    // A red-ish box detected on the blue product's unit, inside left's widened area.
    const near = product({ name: "near", look: "red box", boxes: [box(100, 500, 150, 590)] });
    const byLook = new Map([["red box", [inst(box(100, 600, 150, 700))]]]);
    expect(assignInstances([near, blue], byLook).get(0)).toEqual([]);
  });

  it("keeps an empty list for a look SAM ran on but found nothing", () => {
    expect(assignInstances([left], new Map([["red box", []]])).get(0)).toEqual([]);
  });
});
