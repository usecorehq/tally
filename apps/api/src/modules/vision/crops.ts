/**
 * One tight product crop per detection, cut from the shelf photo while it is
 * still in memory: the product only, never the whole shelf or the people in
 * it. Crops train recognition and, once a curator approves one, can become the
 * product's picture in Qore Catalog (POST /v1/images).
 */
import sharp from "sharp";
import type { Box } from "./shelf-reader";

/** Qore Catalog rejects pictures whose short side is under 160 px. */
export const MIN_CROP_SIDE = 160;
const MAX_CROP_SIDE = 640;
/** Margin around the box, as a share of its size, so the label edge isn't cut off. */
const PAD = 0.06;

/** R2 key for a detection's crop: tally/crops/<scanId>/<position>.webp. */
export const cropKey = (scanId: string, position: number) => `tally/crops/${scanId}/${position}.webp`;

/** The detection's largest box: the unit with the most pixels reads best. */
export function bestBox(boxes: Box[]): Box | null {
  let best: Box | null = null;
  for (const b of boxes) {
    if (!best || (b.x2 - b.x1) * (b.y2 - b.y1) > (best.x2 - best.x1) * (best.y2 - best.y1)) best = b;
  }
  return best;
}

/** Pixel rectangle for a 0–1000 box on a width × height image, padded and clamped. */
export function pixelRegion(box: Box, width: number, height: number): { left: number; top: number; width: number; height: number } {
  const padX = ((box.x2 - box.x1) * PAD) / 1000;
  const padY = ((box.y2 - box.y1) * PAD) / 1000;
  const x1 = Math.max(0, Math.floor((box.x1 / 1000 - padX) * width));
  const y1 = Math.max(0, Math.floor((box.y1 / 1000 - padY) * height));
  const x2 = Math.min(width, Math.ceil((box.x2 / 1000 + padX) * width));
  const y2 = Math.min(height, Math.ceil((box.y2 / 1000 + padY) * height));
  return { left: x1, top: y1, width: Math.max(0, x2 - x1), height: Math.max(0, y2 - y1) };
}

/**
 * WebP crops for each box (null where none is worth keeping: no box, or a
 * short side under MIN_CROP_SIDE). Decodes the photo once; honours EXIF
 * orientation; output carries no metadata.
 */
export async function makeCrops(
  image: Buffer,
  boxes: (Box | null)[],
  /** Agent zooms read small labels: a lower minimum, and enlarged to the max side. */
  opts: { minSide?: number; enlarge?: boolean } = {},
): Promise<(Buffer | null)[]> {
  const minSide = opts.minSide ?? MIN_CROP_SIDE;
  const { data, info } = await sharp(image).rotate().raw().toBuffer({ resolveWithObject: true });
  const raw = { raw: { width: info.width, height: info.height, channels: info.channels } } as const;
  return Promise.all(
    boxes.map(async (box) => {
      if (!box) return null;
      const r = pixelRegion(box, info.width, info.height);
      if (Math.min(r.width, r.height) < minSide) return null;
      return sharp(data, raw)
        .extract(r)
        .resize({ width: MAX_CROP_SIDE, height: MAX_CROP_SIDE, fit: "inside", withoutEnlargement: !opts.enlarge })
        .webp({ quality: 80 })
        .toBuffer();
    }),
  );
}
