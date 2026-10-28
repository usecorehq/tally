/**
 * Count each product's units with SAM 3.1. Pure: builds the requests, parses the
 * special-token output, assigns instances to products. No IO.
 *
 * SAM matches what a pack looks like, not its brand text (live: "Diplomat
 * toothpaste" → 0, "green toothpaste box" → 38). So each Spark product carries
 * a `look` phrase, SAM segments every instance of each distinct look, and an
 * instance counts for a product only when it sits where Spark saw that product.
 * Grammar: https://dev.meta.ai/docs/sam/reading-segmentation
 */
import type { Box, ImageType, ShelfProduct } from "./shelf-reader";

export const SAM_MODEL = "sam-3.1";
/** Instances below this confidence are ignored (live scores: ~0.5 marginal, ~0.8 clear). */
export const MIN_SAM_CONFIDENCE = 0.5;
/** One SAM request per distinct look; more than this many looks fall back to Spark's count. */
export const MAX_SAM_REQUESTS = 20;

export type SamInstance = { box: Box; confidence: number };

/** POST /v1/responses body: one concept prompt, boxes + compact masks, with confidence. */
export function samRequest(image: Buffer, type: ImageType, phrase: string): Record<string, unknown> {
  return {
    model: SAM_MODEL,
    input: [
      {
        type: "message",
        role: "user",
        content: [
          { type: "input_text", text: phrase },
          { type: "input_image", image_url: `data:${type};base64,${image.toString("base64")}` },
        ],
      },
    ],
    metadata: { include_confidence: "true", mask_encoding: "one_bit" },
  };
}

const BOX_TOKEN = /<\|box;([^|]*)\|>/g;

/**
 * Boxes from SAM's output text, converted from source pixels to the same 0–1000
 * grid Spark uses. Fields are read by key, so a token reads the same with or
 * without `c`. Masks are ignored. Empty text = zero matches (a valid outcome).
 */
export function parseSamInstances(text: string): SamInstance[] {
  const out: SamInstance[] = [];
  for (const [, body] of text.matchAll(BOX_TOKEN)) {
    const f = Object.fromEntries(
      body!.split(";").map((kv) => {
        const i = kv.indexOf("=");
        return [kv.slice(0, i), Number(kv.slice(i + 1))];
      }),
    ) as Record<string, number>;
    const { x1, y1, x2, y2, w, h } = f;
    if (![x1, y1, x2, y2, w, h].every((n) => Number.isFinite(n)) || !w || !h) continue;
    const box = {
      x1: grid(x1!, w),
      y1: grid(y1!, h),
      x2: grid(x2!, w),
      y2: grid(y2!, h),
    };
    if (box.x2 <= box.x1 || box.y2 <= box.y1) continue;
    out.push({ box, confidence: Number.isFinite(f.c) ? f.c! : 1 });
  }
  return out;
}

const grid = (px: number, size: number) => Math.min(1000, Math.max(0, Math.round((px / size) * 1000)));

/** The distinct looks to send to SAM, at most MAX_SAM_REQUESTS (first-seen order). */
export function distinctLooks(products: ShelfProduct[]): string[] {
  return [...new Set(products.map((p) => p.look))].slice(0, MAX_SAM_REQUESTS);
}

/**
 * For every product whose look SAM ran on, the SAM boxes that belong to it.
 * An instance belongs to the product (among those sharing its look) whose Spark
 * boxes it sits among: its centre inside the area Spark's boxes span, widened by
 * one typical unit. Ties go to the product with the nearest Spark box. Dropped:
 * instances near no product with that look, and instances sitting on a unit
 * Spark gave to a different-looking product (a blue neighbour of another brand).
 * Overlapping duplicates are merged. Products whose look wasn't run are absent.
 */
export function assignInstances(
  products: ShelfProduct[],
  byLook: Map<string, SamInstance[]>,
): Map<number, Box[]> {
  const result = new Map<number, Box[]>();
  const areas = products.map((p) => searchArea(p.boxes));

  products.forEach((p, i) => {
    if (byLook.has(p.look)) result.set(i, []);
  });

  for (const [look, instances] of byLook) {
    const owners = products.map((p, i) => i).filter((i) => products[i]!.look === look);
    for (const { box, confidence } of instances) {
      if (confidence < MIN_SAM_CONFIDENCE) continue;
      const c = centre(box);
      const inside = owners.filter((i) => contains(areas[i]!, c));
      if (inside.length === 0) continue;
      const onOwnUnit = inside.some((i) => products[i]!.boxes.some((b) => contains(b, c)));
      const onOtherUnit = products.some((p) => p.look !== look && p.boxes.some((b) => contains(b, c)));
      if (onOtherUnit && !onOwnUnit) continue;
      const owner = inside.reduce((best, i) => (nearest(products[i]!.boxes, c) < nearest(products[best]!.boxes, c) ? i : best));
      const boxes = result.get(owner)!;
      if (!boxes.some((b) => iou(b, box) > 0.5)) boxes.push(box);
    }
  }
  return result;
}

function searchArea(boxes: Box[]): Box {
  const ws = boxes.map((b) => b.x2 - b.x1).sort((a, b) => a - b);
  const hs = boxes.map((b) => b.y2 - b.y1).sort((a, b) => a - b);
  const padX = ws[Math.floor(ws.length / 2)] ?? 0;
  const padY = hs[Math.floor(hs.length / 2)] ?? 0;
  return {
    x1: Math.min(...boxes.map((b) => b.x1)) - padX,
    y1: Math.min(...boxes.map((b) => b.y1)) - padY,
    x2: Math.max(...boxes.map((b) => b.x2)) + padX,
    y2: Math.max(...boxes.map((b) => b.y2)) + padY,
  };
}

type Point = { x: number; y: number };
const centre = (b: Box): Point => ({ x: (b.x1 + b.x2) / 2, y: (b.y1 + b.y2) / 2 });
const contains = (a: Box, p: Point) => p.x >= a.x1 && p.x <= a.x2 && p.y >= a.y1 && p.y <= a.y2;
const nearest = (boxes: Box[], p: Point) => Math.min(...boxes.map((b) => Math.hypot(centre(b).x - p.x, centre(b).y - p.y)));

function iou(a: Box, b: Box): number {
  const w = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
  const h = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
  if (w <= 0 || h <= 0) return 0;
  const inter = w * h;
  return inter / ((a.x2 - a.x1) * (a.y2 - a.y1) + (b.x2 - b.x1) * (b.y2 - b.y1) - inter);
}
