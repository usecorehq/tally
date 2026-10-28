import { describe, expect, it } from "@jest/globals";
import sharp from "sharp";
import { bestBox, cropKey, makeCrops, MIN_CROP_SIDE, pixelRegion } from "./crops";

const photo = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 200, g: 30, b: 30 } } })
    .jpeg()
    .toBuffer();

describe("cropKey", () => {
  it("is tally/crops/<scanId>/<position>.webp", () => {
    expect(cropKey("scan-1", 3)).toBe("tally/crops/scan-1/3.webp");
  });
});

describe("bestBox", () => {
  it("picks the largest box, or null for none", () => {
    expect(bestBox([{ x1: 0, y1: 0, x2: 10, y2: 10 }, { x1: 0, y1: 0, x2: 50, y2: 20 }])).toEqual({ x1: 0, y1: 0, x2: 50, y2: 20 });
    expect(bestBox([])).toBeNull();
  });
});

describe("pixelRegion", () => {
  it("maps the 0-1000 grid to pixels with a small margin, clamped to the image", () => {
    expect(pixelRegion({ x1: 100, y1: 200, x2: 600, y2: 700 }, 2000, 1000)).toEqual({ left: 140, top: 170, width: 1120, height: 560 });
    expect(pixelRegion({ x1: 0, y1: 0, x2: 1000, y2: 1000 }, 800, 600)).toEqual({ left: 0, top: 0, width: 800, height: 600 });
  });
});

describe("makeCrops", () => {
  it("returns a webp crop per usable box, at most 640 px, and null for tiny or missing boxes", async () => {
    const [big, tiny, none] = await makeCrops(await photo(2000, 1500), [
      { x1: 100, y1: 100, x2: 900, y2: 900 },
      { x1: 10, y1: 10, x2: 40, y2: 40 },
      null,
    ]);
    const meta = await sharp(big!).metadata();
    expect(meta.format).toBe("webp");
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(640);
    expect(Math.min(meta.width!, meta.height!)).toBeGreaterThanOrEqual(MIN_CROP_SIDE);
    expect(tiny).toBeNull();
    expect(none).toBeNull();
  });

  it("never enlarges a small-but-usable crop", async () => {
    const [crop] = await makeCrops(await photo(400, 400), [{ x1: 0, y1: 0, x2: 1000, y2: 1000 }]);
    const meta = await sharp(crop!).metadata();
    expect([meta.width, meta.height]).toEqual([400, 400]);
  });
});
