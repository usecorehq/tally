import { describe, expect, it } from "@jest/globals";
import { MAX_PRODUCTS, parseShelfProducts, SHELF_MODEL, shelfRequest, sniffImageType } from "./shelf-reader";

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBPVP8 ")]);

const box = (x = 10, y = 20, w = 100, h = 200) => ({ x_min: x, y_min: y, x_max: x + w, y_max: y + h });
const product = (over: Record<string, unknown> = {}) => ({
  brand: "Peak",
  name: "Full Cream Milk Powder",
  pack: "400g",
  look: "Yellow Tin",
  boxes: [box(), box(200)],
  confidence: "high",
  ...over,
});
const reply = (...products: unknown[]) => JSON.stringify({ products });

describe("sniffImageType", () => {
  it.each([
    [JPEG, "image/jpeg"],
    [PNG, "image/png"],
    [WEBP, "image/webp"],
    [Buffer.from("GIF89a"), null],
    [Buffer.from("<svg/>"), null],
    [Buffer.alloc(0), null],
  ])("%#", (buf, expected) => {
    expect(sniffImageType(buf)).toBe(expected);
  });
});

describe("shelfRequest", () => {
  it("sends the image as a data URL with schema-constrained output", () => {
    const body = shelfRequest(JPEG, "image/jpeg") as {
      model: string;
      input: { content: { type: string; image_url?: string }[] }[];
      text: { format: { type: string; name: string; strict: boolean } };
    };
    expect(body.model).toBe(SHELF_MODEL);
    const image = body.input[0]!.content.find((c) => c.type === "input_image");
    expect(image?.image_url).toBe(`data:image/jpeg;base64,${JPEG.toString("base64")}`);
    expect(body.text.format).toMatchObject({ type: "json_schema", name: "shelf_products", strict: true });
  });
});

describe("parseShelfProducts", () => {
  it("counts one unit per box", () => {
    expect(parseShelfProducts(reply(product()))).toEqual([
      {
        brand: "Peak",
        name: "Full Cream Milk Powder",
        pack: "400g",
        look: "yellow tin",
        count: 2,
        boxes: [
          { x1: 10, y1: 20, x2: 110, y2: 220 },
          { x1: 200, y1: 20, x2: 300, y2: 220 },
        ],
        confidence: "high",
      },
    ]);
  });

  it("clamps boxes to the 0-1000 grid and drops degenerate ones", () => {
    const [p] = parseShelfProducts(
      reply(product({ boxes: [{ x_min: -5, y_min: 900, x_max: 1004, y_max: 1001 }, box(50, 50, 0, 10), { x_min: 1 }] })),
    );
    expect(p!.boxes).toEqual([{ x1: 0, y1: 900, x2: 1000, y2: 1000 }]);
    expect(p!.count).toBe(1);
  });

  it("drops products without boxes or anything to call them", () => {
    expect(parseShelfProducts(reply(product({ name: "  ", brand: "", look: "" }), product({ boxes: [] })))).toEqual([]);
  });

  it("names a product from its brand, else its look, when the name isn't legible", () => {
    const [byBrand, byLook] = parseShelfProducts(reply(product({ name: "", brand: "ONGA" }), product({ name: "", brand: "", look: "green sachet" })));
    expect(byBrand).toMatchObject({ name: "ONGA", brand: "ONGA" });
    expect(byLook).toMatchObject({ name: "Green sachet", brand: "", look: "green sachet" });
  });

  it("merges the same product (case/space-insensitive) and keeps the best confidence", () => {
    const [p, ...rest] = parseShelfProducts(
      reply(product({ confidence: "low" }), product({ brand: "PEAK ", name: "full  cream milk powder", confidence: "medium", boxes: [box(500)] })),
    );
    expect(rest).toEqual([]);
    expect(p).toMatchObject({ count: 3, confidence: "medium", brand: "Peak" });
  });

  it("keeps different pack sizes apart", () => {
    expect(parseShelfProducts(reply(product(), product({ pack: "900g" })))).toHaveLength(2);
  });

  it("treats an unknown confidence as low", () => {
    expect(parseShelfProducts(reply(product({ confidence: "certain" })))[0]!.confidence).toBe("low");
  });

  it(`caps the list at ${MAX_PRODUCTS} products`, () => {
    const many = Array.from({ length: MAX_PRODUCTS + 5 }, (_, i) => product({ name: `Item ${i}` }));
    expect(parseShelfProducts(reply(...many))).toHaveLength(MAX_PRODUCTS);
  });

  it("returns [] for an empty shelf", () => {
    expect(parseShelfProducts(reply())).toEqual([]);
  });

  it.each(["", "{\"products\": [", "{\"items\": []}"])("throws on malformed output %j", (text) => {
    expect(() => parseShelfProducts(text)).toThrow();
  });
});
