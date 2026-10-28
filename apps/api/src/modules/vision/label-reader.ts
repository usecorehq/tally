/**
 * Point-to-sell: one product held up to the camera → its label, read by Muse
 * Spark. Pure: builds the request and validates the reply, no IO.
 *
 * Reading the label and matching it in Tally beats asking Spark to pick from the
 * merchant's item list: measured on a 640 px Close-Up photo (Oct 2026), the
 * label read took 2.4–3.0 s and got the brand every time; the pick-from-list
 * prompt took 3.3–6.2 s and mostly answered "none".
 */
import type { Reading } from "./inventory-match";
import { SHELF_MODEL, type ImageType } from "./shelf-reader";

export const LABEL_MODEL = SHELF_MODEL;

const LABEL_SCHEMA = {
  type: "object",
  properties: {
    brand: { type: "string", description: "Brand as printed; empty string if not legible." },
    name: { type: "string", description: "Product name without the brand, as printed; empty string if not legible." },
    pack: { type: "string", description: "Size or pack as printed (e.g. '400g', '50cl'); empty string if not legible." },
  },
  required: ["brand", "name", "pack"],
  additionalProperties: false,
};

const PROMPT =
  "A shopkeeper in Nigeria is holding one product up to the camera to sell it. Read the main product's label: brand, product name and pack size, exactly as printed. Use an empty string for anything you cannot read; do not guess.";

/** POST /v1/responses body: minimal reasoning, because this runs at the till. */
export function labelRequest(image: Buffer, type: ImageType): Record<string, unknown> {
  return {
    model: LABEL_MODEL,
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
    text: { format: { type: "json_schema", name: "product_label", schema: LABEL_SCHEMA, strict: true } },
    reasoning: { effort: "minimal" },
    max_output_tokens: 1500,
  };
}

/** The reading, or null when nothing on the label was legible. */
export function parseLabel(text: string): Reading | null {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("Model returned invalid JSON");
  }
  const clean = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, 120) : "");
  const brand = clean(raw?.brand);
  const name = clean(raw?.name) || brand;
  if (!name) return null;
  return { brand, name, pack: clean(raw?.pack) };
}
