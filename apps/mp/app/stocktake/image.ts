import type { Box } from "./types";

const LONG_EDGE = 1600;
const MAX_BYTES = 4 * 1024 * 1024;

/** Scale a photo to a ~1600 px long edge and re-encode it as JPEG, as the API expects (EXIF rotation applied). */
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
