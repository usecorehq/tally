/**
 * One tight crop per detection, cut while the photo is in memory: the product only, never the shelf or people.
 * Crops train recognition and can become the product's Qore Catalog picture once a curator approves one.
 */
import sharp from "sharp";
import type { Box } from "./shelf-reader";

/** Qore Catalog rejects pictures whose short side is under 160 px: smaller crops stay in R2 only. */
export const MIN_CROP_SIDE = 160;
/** Smallest crop worth keeping in R2 for Tally's own dataset; below this it is noise. */
export const MIN_STORED_CROP_SIDE = 48;
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

/** WebP crops per box (null when there's no box or its short side is under minSide); EXIF-oriented, no metadata. */
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

/** A stored crop's size; 0×0 when it can't be read. */
export async function cropSize(crop: Uint8Array): Promise<{ width: number; height: number }> {
  const { width, height } = await sharp(crop)
    .metadata()
    .catch(() => ({ width: 0, height: 0 }));
  return { width: width ?? 0, height: height ?? 0 };
}

/** True when a stored crop is big enough for Qore Catalog (short side >= MIN_CROP_SIDE). */
export async function catalogueSized(crop: Uint8Array): Promise<boolean> {
  const { width, height } = await cropSize(crop);
  return Math.min(width, height) >= MIN_CROP_SIDE;
}
