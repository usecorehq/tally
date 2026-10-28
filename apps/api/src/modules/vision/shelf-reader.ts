/**
 * Shelf photo → the distinct products in it, read by Muse Spark in one call.
 * Pure: builds the Responses request and validates the reply, no IO.
 *
 * Spark reports one box per visible unit (Meta's grounding guide: pointing at
 * every instance before counting beats asking for a number), so count is the
 * number of boxes. Boxes are on Spark's 0–1000 grid of the uploaded image.
 * See docs/architecture/vision-recognition.md.
 */

export const SHELF_MODEL = "muse-spark-1.3";

/** At most this many distinct products per photo: Qore Catalog /v1/match takes 50. */
export const MAX_PRODUCTS = 50;
const MAX_BOXES_PER_PRODUCT = 60;

export type Box = { x1: number; y1: number; x2: number; y2: number };
export type Confidence = "high" | "medium" | "low";

export type ShelfProduct = {
  /** Empty when the brand isn't legible. */
  brand: string;
  name: string;
  /** Size / pack as printed, e.g. "50cl", "400g", "x12"; empty when not legible. */
  pack: string;
  /** Short visual noun phrase for SAM 3.1: one colour + one container word, no brand, e.g. "red box". */
  look: string;
  count: number;
  boxes: Box[];
  confidence: Confidence;
};

export type ImageType = "image/jpeg" | "image/png" | "image/webp";

/** The image type from its magic bytes, or null. The client's Content-Type is not trusted. */
export function sniffImageType(buf: Buffer): ImageType | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  return null;
}

const BOX_SCHEMA = {
  type: "object",
  properties: {
    x_min: { type: "integer" },
    y_min: { type: "integer" },
    x_max: { type: "integer" },
    y_max: { type: "integer" },
  },
  required: ["x_min", "y_min", "x_max", "y_max"],
  additionalProperties: false,
};

export const SHELF_SCHEMA = {
  type: "object",
  properties: {
    products: {
      type: "array",
      items: {
        type: "object",
        properties: {
          brand: { type: "string", description: "Brand as printed on the pack; empty string if not legible." },
          name: { type: "string", description: "Product name without the brand, as printed (e.g. 'Full Cream Milk Powder')." },
          pack: { type: "string", description: "Size or pack as printed (e.g. '400g', '50cl', '1L', 'x12'); empty string if not legible." },
          look: {
            type: "string",
            description: "Exactly one colour word + one container word for what one unit looks like, no brand or text (e.g. 'red box', 'yellow bucket', 'white bottle', 'green tin', 'blue sachet').",
          },
          boxes: { type: "array", items: BOX_SCHEMA, description: "One box per visible unit of this product." },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: ["brand", "name", "pack", "look", "boxes", "confidence"],
        additionalProperties: false,
      },
    },
  },
  required: ["products"],
  additionalProperties: false,
};

const PROMPT = [
  "You are an object grounding expert looking at a photo of stock in a Nigerian shop: a shelf, a counter or a pile of goods.",
  "List every distinct packaged product you can see. Units with the same brand, name and pack size are one product; different sizes or flavours are different products.",
  "For each product, read the brand, product name and pack size exactly as printed on the packaging. Do not guess text you cannot read: leave brand or pack as an empty string instead.",
  "Give one bounding box per visible unit of that product, as [x_min, y_min, x_max, y_max] on a normalized 0-1000 grid with (0,0) at the top-left of the image. Do not miss any units.",
  "Ignore shelving, price tags, people and anything that is not a product for sale.",
  "confidence: high when the label is clearly legible, medium when partly legible, low when you are inferring from shape or colour.",
  "look: the unit's main colour and container for a segmentation model, as exactly two words: one colour + one container (e.g. 'red box', 'yellow bucket', 'white bottle'). Never two colours, never a brand.",
].join("\n");

/** POST /v1/responses body for one shelf photo. */
export function shelfRequest(image: Buffer, type: ImageType): Record<string, unknown> {
  return {
    model: SHELF_MODEL,
    input: [
      {
        type: "message",
        role: "user",
        content: [
          { type: "input_text", text: PROMPT },
          { type: "input_image", image_url: `data:${type};base64,${image.toString("base64")}` },
        ],
      },
    ],
    text: { format: { type: "json_schema", name: "shelf_products", schema: SHELF_SCHEMA, strict: true } },
    reasoning: { effort: "low" },
    max_output_tokens: 16000,
  };
}

/**
 * Validate Spark's JSON. Decoding is schema-constrained, but the values are
 * still model output: trim text, clamp boxes to the grid, drop unnamed or
 * box-less products, merge duplicates, cap the list.
 */
export function parseShelfProducts(text: string): ShelfProduct[] {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Model returned invalid JSON");
  }
  const items = (raw as { products?: unknown })?.products;
  if (!Array.isArray(items)) throw new Error("Model returned no products array");

  const byKey = new Map<string, ShelfProduct>();
  for (const item of items as Record<string, unknown>[]) {
    const brand = clean(item?.brand);
    const look = clean(item?.look).toLowerCase().slice(0, 60);
    // Spark sometimes reads only the brand ("ONGA") or nothing legible; the unit still needs counting.
    const name = clean(item?.name) || brand || capitalise(look);
    if (!name) continue;
    const pack = clean(item.pack);
    const boxes = (Array.isArray(item.boxes) ? item.boxes : []).map(toBox).filter((b): b is Box => b !== null);
    if (boxes.length === 0) continue;
    const confidence: Confidence = item.confidence === "high" || item.confidence === "medium" ? item.confidence : "low";

    const key = [brand, name, pack].map((s) => s.toLowerCase()).join("|");
    const existing = byKey.get(key);
    if (existing) {
      existing.boxes.push(...boxes);
      if (rank(confidence) > rank(existing.confidence)) existing.confidence = confidence;
    } else {
      byKey.set(key, { brand, name, pack, look: look || name.toLowerCase(), count: 0, boxes, confidence });
    }
  }

  return [...byKey.values()].slice(0, MAX_PRODUCTS).map((p) => {
    const boxes = p.boxes.slice(0, MAX_BOXES_PER_PRODUCT);
    return { ...p, boxes, count: boxes.length };
  });
}

function clean(v: unknown): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, 120) : "";
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const clamp = (n: number) => Math.min(1000, Math.max(0, Math.round(n)));

function toBox(v: unknown): Box | null {
  const b = v as Record<string, unknown> | null;
  const nums = [b?.x_min, b?.y_min, b?.x_max, b?.y_max];
  if (!nums.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  const [x1, y1, x2, y2] = (nums as number[]).map(clamp) as [number, number, number, number];
  if (x2 <= x1 || y2 <= y1) return null;
  return { x1, y1, x2, y2 };
}

function rank(c: Confidence): number {
  return c === "high" ? 2 : c === "medium" ? 1 : 0;
}
