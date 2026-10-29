/**
 * Before a scan: is this a shelf photo worth reading? Muse Spark judges framing, distance, angle and light
 * and gives one instruction. Advice only, never a block. Pure, no IO.
 */
import { SHELF_MODEL, type Box, type ImageType } from "./shelf-reader";

export const PHOTO_CHECK_MODEL = SHELF_MODEL;

export const PHOTO_ISSUES = ["not_shelf", "too_far", "too_close", "angled", "blurry", "dark", "glare", "obstructed", "cut_off"] as const;
export type PhotoIssue = (typeof PHOTO_ISSUES)[number];
export type PhotoVerdict = "good" | "usable" | "retake";

export type PhotoCheck = {
  verdict: PhotoVerdict;
  /** Worst first. */
  issues: PhotoIssue[];
  /** One short thing to do, e.g. "Step closer: fit one or two shelves in the photo." Empty when good. */
  instruction: string;
  /** Rough count of distinct products visible. */
  productsVisible: number;
  labelsLegible: "most" | "some" | "few" | "none";
  /** The area with the most readable products (0–1000 grid), or null. */
  region: Box | null;
};

const BOX = {
  type: "object",
  properties: { x_min: { type: "integer" }, y_min: { type: "integer" }, x_max: { type: "integer" }, y_max: { type: "integer" } },
  required: ["x_min", "y_min", "x_max", "y_max"],
  additionalProperties: false,
};

const SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["good", "usable", "retake"] },
    issues: { type: "array", items: { type: "string", enum: [...PHOTO_ISSUES] } },
    instruction: { type: "string", description: "One short instruction for the shopkeeper; empty string if the photo is good." },
    products_visible: { type: "integer" },
    labels_legible: { type: "string", enum: ["most", "some", "few", "none"] },
    has_region: { type: "boolean", description: "True when some area of the photo has readable products." },
    region: { ...BOX, description: "The area with the most readable products, on a 0-1000 grid of the image." },
  },
  required: ["verdict", "issues", "instruction", "products_visible", "labels_legible", "has_region", "region"],
  additionalProperties: false,
};

const PROMPT = [
  "A shopkeeper in Nigeria wants to count stock from this photo of a shelf, crate or pile of products.",
  "Judge only whether the photo is good enough to read every product's label and count the units; don't list products.",
  "good: the products face the camera, labels are mostly readable, and the frame holds one to a few shelves.",
  "usable: readable but with a problem that will cost some products. retake: most products can't be read.",
  "Issues: not_shelf (no stock in view), too_far (products too small to read), too_close (only a few products, cut off),",
  "angled (shelf seen at a steep angle, not facing the camera), blurry, dark, glare (reflections over labels),",
  "obstructed (something blocks the products), cut_off (the shelf continues out of frame and important stock is lost).",
  "Portrait or landscape are both fine. Give one short, plain instruction to fix the worst issue.",
].join(" ");

/** POST /v1/responses body: minimal reasoning, because the merchant waits on it. */
export function photoCheckRequest(image: Buffer, type: ImageType): Record<string, unknown> {
  return {
    model: PHOTO_CHECK_MODEL,
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
    text: { format: { type: "json_schema", name: "photo_check", schema: SCHEMA, strict: true } },
    reasoning: { effort: "minimal" },
    max_output_tokens: 800,
  };
}

const clamp = (v: unknown) => Math.min(1000, Math.max(0, Math.round(Number(v) || 0)));

/** The model's verdict, cleaned: unknown issues dropped, region only when it is a real box. */
export function parsePhotoCheck(text: string): PhotoCheck {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("Model returned invalid JSON");
  }
  const verdict: PhotoVerdict = raw.verdict === "good" || raw.verdict === "retake" ? raw.verdict : "usable";
  const issues = (Array.isArray(raw.issues) ? raw.issues : []).filter((i): i is PhotoIssue => PHOTO_ISSUES.includes(i as PhotoIssue));
  const legible = ["most", "some", "few", "none"].includes(raw.labels_legible as string) ? (raw.labels_legible as PhotoCheck["labelsLegible"]) : "some";
  const r = raw.region as Record<string, unknown> | undefined;
  const box = r ? { x1: clamp(r.x_min), y1: clamp(r.y_min), x2: clamp(r.x_max), y2: clamp(r.y_max) } : null;
  return {
    verdict,
    issues: [...new Set(issues)],
    instruction: typeof raw.instruction === "string" ? raw.instruction.replace(/\s+/g, " ").trim().slice(0, 160) : "",
    productsVisible: Math.max(0, Math.round(Number(raw.products_visible) || 0)),
    labelsLegible: legible,
    region: raw.has_region === true && box && box.x2 > box.x1 && box.y2 > box.y1 ? box : null,
  };
}
