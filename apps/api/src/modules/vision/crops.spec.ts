import { describe, expect, it } from "@jest/globals";
import sharp from "sharp";
import {
  bestBox,
  boxPixels,
  catalogueSized,
  cropKey,
  cutCrops,
  makeCrops,
  MIN_CROP_SIDE,
  MIN_STORED_CROP_SIDE,
  modelCopy,
  pixelRegion,
  shelfPhotoKey,
  storablePhoto,
} from "./crops";

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

  it("with a lower minSide keeps small crops for R2", async () => {
    // 60 x 60 px box on a 1000 px photo: under 96, over 48.
    const [kept] = await makeCrops(await photo(1000, 1000), [{ x1: 100, y1: 100, x2: 160, y2: 160 }], { minSide: MIN_STORED_CROP_SIDE });
    expect(kept).not.toBeNull();
  });
});

describe("catalogueSized", () => {
  it("is true only when the short side reaches Qore Catalog's 96 px", async () => {
    const webp = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 3, background: "#fff" } }).webp().toBuffer();
    expect(MIN_CROP_SIDE).toBe(96);
    expect(await catalogueSized(await webp(96, 400))).toBe(true);
    expect(await catalogueSized(await webp(640, 95))).toBe(false);
  });
});

describe("storablePhoto", () => {
  it("keeps a phone's native resolution, caps the long side at 4096 px and keeps the key under tally/scans/", async () => {
    const phone = await sharp({ create: { width: 4032, height: 3024, channels: 3, background: "#fff" } }).jpeg().toBuffer();
    expect((await sharp(await storablePhoto(phone)).metadata()).width).toBe(4032);
    const huge = await sharp({ create: { width: 6000, height: 4000, channels: 3, background: "#fff" } }).jpeg().toBuffer();
    const meta = await sharp(await storablePhoto(huge)).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["jpeg", 4096, 2731]);
    expect(shelfPhotoKey("scan-1")).toBe("tally/scans/scan-1.jpg");
  });
});

/** A grey 3000 × 2000 shelf with one red product at (900, 500), 120 × 200 px. */
const shelf = () =>
  sharp({ create: { width: 3000, height: 2000, channels: 3, background: { r: 128, g: 128, b: 128 } } })
    .composite([{ input: { create: { width: 120, height: 200, channels: 3, background: { r: 255, g: 0, b: 0 } } }, left: 900, top: 500 }])
    .png()
    .toBuffer();

describe("modelCopy", () => {
  it("scales a large photo to a 2560 px JPEG for the models", async () => {
    const copy = await modelCopy(await shelf(), "image/png");
    const meta = await sharp(copy.image).metadata();
    expect([copy.type, meta.format, meta.width, meta.height, copy.width, copy.height]).toEqual(["image/jpeg", "jpeg", 2560, 1707, 2560, 1707]);
  });

  it("sends an upright photo within 2560 px untouched", async () => {
    const small = await photo(1600, 1200);
    const copy = await modelCopy(small, "image/jpeg");
    expect(copy.image).toBe(small);
    expect([copy.type, copy.width, copy.height]).toEqual(["image/jpeg", 1600, 1200]);
  });

  it("turns an EXIF-rotated photo upright, as crops see it", async () => {
    // Stored 1200 × 800 with orientation 6 (rotate 90°): upright it is 800 × 1200.
    const turned = await sharp({ create: { width: 1200, height: 800, channels: 3, background: "#fff" } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const copy = await modelCopy(turned, "image/jpeg");
    const meta = await sharp(copy.image).metadata();
    expect([meta.width, meta.height, meta.orientation ?? 1]).toEqual([800, 1200, 1]);
  });

  it("passes an undecodable image through, as before", async () => {
    const junk = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);
    expect((await modelCopy(junk, "image/jpeg")).image).toBe(junk);
  });

  it("a box read on the model copy maps back onto the full-resolution product", async () => {
    const full = await shelf();
    const copy = await modelCopy(full, "image/png");
    // Find the red product on the copy, as a model would, and express it on the 0–1000 grid.
    const { data, info } = await sharp(copy.image).raw().toBuffer({ resolveWithObject: true });
    let [x1, y1, x2, y2] = [info.width, info.height, 0, 0];
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const i = (y * info.width + x) * info.channels;
        if (data[i]! > 200 && data[i + 1]! < 80) [x1, y1, x2, y2] = [Math.min(x1, x), Math.min(y1, y), Math.max(x2, x + 1), Math.max(y2, y + 1)];
      }
    }
    const box = { x1: (x1 / info.width) * 1000, y1: (y1 / info.height) * 1000, x2: (x2 / info.width) * 1000, y2: (y2 / info.height) * 1000 };
    // On the copy the product is ~102 × 171 px; on the full photo it is back to ~120 × 200 px at (900, 500).
    const own = boxPixels(box, 3000, 2000);
    expect(Math.abs(own.width - 120)).toBeLessThanOrEqual(2);
    expect(Math.abs(own.height - 200)).toBeLessThanOrEqual(2);
    const r = pixelRegion(box, 3000, 2000);
    expect(Math.abs(r.left + r.width / 2 - 960)).toBeLessThanOrEqual(2);
    expect(Math.abs(r.top + r.height / 2 - 600)).toBeLessThanOrEqual(2);
    const { source, crops } = await cutCrops(full, [box]);
    expect(source).toEqual({ width: 3000, height: 2000 });
    expect(Math.abs(crops[0]!.boxWidth - 120)).toBeLessThanOrEqual(2);
    const meta = await sharp(crops[0]!.crop).metadata();
    expect(meta.width).toBeGreaterThanOrEqual(120);
  });
});

describe("cutCrops", () => {
  it("judges a box by its own size: an 88 px product padded to 99 px is not a catalogue crop", async () => {
    // 88 × 124 px on a 1024 px photo (the OMO sample of 30 Oct); with the 6% margin it would be ~99 × 139.
    const box = { x1: 100, y1: 100, x2: 100 + (88 / 1024) * 1000, y2: 100 + (124 / 1024) * 1000 };
    expect(Math.min(pixelRegion(box, 1024, 1024).width, pixelRegion(box, 1024, 1024).height)).toBeGreaterThanOrEqual(MIN_CROP_SIDE);
    const img = await photo(1024, 1024);
    expect((await cutCrops(img, [box])).crops).toEqual([null]);
    // Stored for Tally's own dataset, with its real size and never enlarged.
    const { crops } = await cutCrops(img, [box], { minSide: MIN_STORED_CROP_SIDE });
    expect([crops[0]!.boxWidth, crops[0]!.boxHeight]).toEqual([88, 124]);
    const meta = await sharp(crops[0]!.crop).metadata();
    expect(Math.max(meta.width!, meta.height!)).toBeLessThan(160);
  });

  it("cuts from the same 4096 px pixels as the stored photo", async () => {
    const huge = await photo(6000, 4000);
    const { source } = await cutCrops(huge, [null]);
    const stored = await sharp(await storablePhoto(huge)).metadata();
    expect(source).toEqual({ width: stored.width, height: stored.height });
  });
});
