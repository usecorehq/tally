import type { CSSProperties } from "react";
import type { Box } from "./types";

// Big enough that most packs on a full shelf crop to 160+ px (Qore Catalog's minimum);
// ~1-2 MB as JPEG, under the API's 4 MB limit.
const LONG_EDGE = 2560;
const MAX_BYTES = 4 * 1024 * 1024;

/** Scale a photo to at most a 2560 px long edge and re-encode it as JPEG, as the API expects (EXIF rotation applied). */
export async function resizeForScan(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, LONG_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  for (const quality of [0.8, 0.65, 0.5]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= MAX_BYTES) return blob;
  }
  throw new Error("This photo is too large even after resizing.");
}

/** One small square thumbnail per detection, cut from the local photo around its largest box (0–1000 grid). */
export async function cropThumbs(photo: Blob, items: { id: string; boxes: Box[] }[], size = 96): Promise<Record<string, string>> {
  const bitmap = await createImageBitmap(photo);
  const out: Record<string, string> = {};
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  for (const { id, boxes } of items) {
    const box = boxes.reduce<Box | null>(
      (best, b) => (!best || (b.x2 - b.x1) * (b.y2 - b.y1) > (best.x2 - best.x1) * (best.y2 - best.y1) ? b : best),
      null,
    );
    if (!box) continue;
    const x = (box.x1 / 1000) * bitmap.width;
    const y = (box.y1 / 1000) * bitmap.height;
    const w = ((box.x2 - box.x1) / 1000) * bitmap.width;
    const h = ((box.y2 - box.y1) / 1000) * bitmap.height;
    const side = Math.max(w, h) * 1.1;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(bitmap, x + w / 2 - side / 2, y + h / 2 - side / 2, side, side, 0, 0, size, size);
    out[id] = canvas.toDataURL("image/jpeg", 0.8);
  }
  bitmap.close();
  return out;
}

/** The square around a box (0–1000 grid) that cropThumbs cuts, in pixels of a width × height image. */
function thumbSquare(box: Box, width: number, height: number) {
  const w = ((box.x2 - box.x1) / 1000) * width;
  const h = ((box.y2 - box.y1) / 1000) * height;
  const side = Math.min(Math.max(w, h) * 1.1, width, height);
  const cx = ((box.x1 + box.x2) / 2000) * width;
  const cy = ((box.y1 + box.y2) / 2000) * height;
  return { side, left: Math.min(Math.max(cx - side / 2, 0), width - side), top: Math.min(Math.max(cy - side / 2, 0), height - side) };
}

/**
 * The same thumbnail as cropThumbs, drawn by CSS from a remote photo (the stored shelf photo), so it needs
 * no canvas read of a cross-origin image and works for lines whose crop was never stored.
 */
export function remoteThumb(url: string, box: Box, width: number, height: number): CSSProperties {
  const { side, left, top } = thumbSquare(box, width, height);
  const fx = side / width;
  const fy = side / height;
  const pos = (offset: number, total: number, f: number) => (f >= 1 ? 0 : (offset / total / (1 - f)) * 100);
  return {
    backgroundImage: `url(${JSON.stringify(url)})`,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${100 / fx}% ${100 / fy}%`,
    backgroundPosition: `${pos(left, width, fx)}% ${pos(top, height, fy)}%`,
  };
}

/** The detection's largest box, which its thumbnail shows. */
export function largestBox(boxes: Box[]): Box | null {
  return boxes.reduce<Box | null>((best, b) => (!best || (b.x2 - b.x1) * (b.y2 - b.y1) > (best.x2 - best.x1) * (best.y2 - best.y1) ? b : best), null);
}

/** Quick checks in the browser, before the model's verdict: no network, a few milliseconds. */
export type LocalCheck = { dark: boolean; blurry: boolean; glare: boolean };

const CHECK_EDGE = 320;
const DARK_MEAN = 60;
/** Variance of the Laplacian below this on a 320 px copy: too soft to read labels. */
const BLUR_VARIANCE = 40;
/** Share of near-white pixels that means reflections over the labels. */
const GLARE_SHARE = 0.08;

export async function localCheck(photo: Blob): Promise<LocalCheck> {
  const bitmap = await createImageBitmap(photo);
  const scale = CHECK_EDGE / Math.max(bitmap.width, bitmap.height);
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const { data } = ctx.getImageData(0, 0, w, h);
  const grey = new Float32Array(w * h);
  let sum = 0;
  let bright = 0;
  for (let i = 0; i < w * h; i++) {
    const g = 0.299 * data[i * 4]! + 0.587 * data[i * 4 + 1]! + 0.114 * data[i * 4 + 2]!;
    grey[i] = g;
    sum += g;
    if (g >= 250) bright++;
  }
  let lapSum = 0;
  let lapSq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = grey[i - w]! + grey[i + w]! + grey[i - 1]! + grey[i + 1]! - 4 * grey[i]!;
      lapSum += lap;
      lapSq += lap * lap;
      n++;
    }
  }
  const variance = n ? lapSq / n - (lapSum / n) ** 2 : 0;
  return { dark: sum / (w * h) < DARK_MEAN, blurry: variance < BLUR_VARIANCE, glare: bright / (w * h) > GLARE_SHARE };
}

/** A ~1024 px JPEG copy for the photo check (under the API's 1 MB). */
export async function checkCopy(photo: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(photo);
  const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
  if (!blob) throw new Error("Couldn't prepare the photo check");
  return blob;
}
