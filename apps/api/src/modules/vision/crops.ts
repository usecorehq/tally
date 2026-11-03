/**
 * One tight crop per detection, cut while the photo is in memory: the product only, never the shelf or people.
 * Crops train recognition and can become the product's Qore Catalog picture once a curator approves one.
 */
import sharp from "sharp";
import type { Box, ImageType } from "./shelf-reader";

/** Qore Catalog rejects pictures whose short side is under 96 px for training samples: smaller crops stay in R2 only. */
export const MIN_CROP_SIDE = 96;
/** Smallest crop worth keeping in R2 for Tally's own dataset; below this it is noise. */
export const MIN_STORED_CROP_SIDE = 48;
const MAX_CROP_SIDE = 640;
/** Margin around the box, as a share of its size, so the label edge isn't cut off. */
export const PAD = 0.06;

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

/** A box's size in pixels of a width × height photo, before the context margin (rounded as in sampleContext). */
export function boxPixels(box: Box, width: number, height: number): { width: number; height: number } {
  return { width: Math.round(((box.x2 - box.x1) / 1000) * width), height: Math.round(((box.y2 - box.y1) / 1000) * height) };
}

/** One cut crop: the WebP, and the product's own size in the source photo before the margin. */
export type Crop = { crop: Buffer; boxWidth: number; boxHeight: number };

/**
 * WebP crops per box, cut from the full-resolution photo (upright, capped at MAX_PHOTO_SIDE like the stored photo,
 * so boxes share its pixels). null when there's no box or the box's short side, before the margin, is under minSide:
 * a small product is never padded or enlarged to pass. EXIF-oriented, no metadata.
 */
export async function cutCrops(
  image: Buffer,
  boxes: (Box | null)[],
  /** Agent zooms read small labels: a lower minimum, and enlarged to the max side. Never used for stored crops. */
  opts: { minSide?: number; enlarge?: boolean } = {},
): Promise<{ source: { width: number; height: number }; crops: (Crop | null)[] }> {
  const minSide = opts.minSide ?? MIN_CROP_SIDE;
  const { data, info } = await sharp(image)
    .rotate()
    .resize({ width: MAX_PHOTO_SIDE, height: MAX_PHOTO_SIDE, fit: "inside", withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const raw = { raw: { width: info.width, height: info.height, channels: info.channels } } as const;
  const crops = await Promise.all(
    boxes.map(async (box): Promise<Crop | null> => {
      if (!box) return null;
      const size = boxPixels(box, info.width, info.height);
      if (Math.min(size.width, size.height) < minSide) return null;
      const r = pixelRegion(box, info.width, info.height);
      if (r.width < 1 || r.height < 1) return null;
      const crop = await sharp(data, raw)
        .extract(r)
        .resize({ width: MAX_CROP_SIDE, height: MAX_CROP_SIDE, fit: "inside", withoutEnlargement: !opts.enlarge })
        .webp({ quality: 80 })
        .toBuffer();
      return { crop, boxWidth: size.width, boxHeight: size.height };
    }),
  );
  return { source: { width: info.width, height: info.height }, crops };
}

/** WebP crops per box (see cutCrops), without the sizes. */
export async function makeCrops(image: Buffer, boxes: (Box | null)[], opts: { minSide?: number; enlarge?: boolean } = {}): Promise<(Buffer | null)[]> {
  return (await cutCrops(image, boxes, opts)).crops.map((c) => c?.crop ?? null);
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

/** R2 key for a scan's shelf photo, kept for good as the stock-take's audit record. */
export const shelfPhotoKey = (scanId: string) => `tally/scans/${scanId}.jpg`;

/**
 * Long-side cap for the stored shelf photo and the pixels crops are cut from. Phones shoot ~4000 px; keeping that
 * is what lets a product 40–100 px wide in a 1024 px copy reach Qore Catalog's 96 px minimum.
 */
export const MAX_PHOTO_SIDE = 4096;

/** The stored copy of a shelf photo: upright, at most 4096 px, JPEG, with no metadata (EXIF and GPS dropped). */
export async function storablePhoto(image: Buffer): Promise<Buffer> {
  return sharp(image)
    .rotate()
    .resize({ width: MAX_PHOTO_SIDE, height: MAX_PHOTO_SIDE, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
}

/**
 * Long-side cap for the copy sent to Muse Spark and SAM: what they were sent before full-resolution photos
 * (mp uploaded at most 2560 px), so cost and latency don't change.
 */
export const MODEL_LONG_SIDE = 2560;

/**
 * The copy of a shelf photo the models read. Boxes come back on a 0–1000 grid of this copy, which is the full photo
 * upright and uniformly scaled, so the same grid maps straight onto the full-resolution pixels for cropping.
 * An upright photo already within MODEL_LONG_SIDE is sent untouched; one that can't be decoded too (as before).
 */
export async function modelCopy(image: Buffer, type: ImageType): Promise<{ image: Buffer; type: ImageType; width: number | null; height: number | null }> {
  try {
    const meta = await sharp(image).metadata();
    const turned = (meta.orientation ?? 1) >= 5;
    const width = (turned ? meta.height : meta.width) ?? 0;
    const height = (turned ? meta.width : meta.height) ?? 0;
    if (!width || !height) return { image, type, width: null, height: null };
    if ((meta.orientation ?? 1) === 1 && Math.max(width, height) <= MODEL_LONG_SIDE) return { image, type, width, height };
    const { data, info } = await sharp(image)
      .rotate()
      .resize({ width: MODEL_LONG_SIDE, height: MODEL_LONG_SIDE, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer({ resolveWithObject: true });
    return { image: data, type: "image/jpeg", width: info.width, height: info.height };
  } catch {
    return { image, type, width: null, height: null };
  }
}
