import { describe, expect, it } from "@jest/globals";
import sharp from "sharp";
import type { ResponsesResult } from "./meta-model.client";
import type { Box, ShelfProduct } from "./shelf-reader";
import {
  bandsToCuts,
  cellLabel,
  cellPixels,
  cellSummary,
  FALLBACK_GRID,
  gridCuts,
  layoutCells,
  parseLayout,
  stitch,
  sweepShelf,
  sweepSteps,
  toPhoto,
  type Cell,
  type CellRead,
} from "./shelf-sweep";

const product = (over: Partial<ShelfProduct> & { boxes: Box[] }): ShelfProduct => ({
  brand: "Acme",
  name: "Syrup",
  pack: "450g",
  look: "yellow jar",
  confidence: "high",
  ...over,
  count: over.boxes.length,
});

const read = (cell: Cell, products: ShelfProduct[], status: CellRead["status"] = products.length ? "read" : "empty"): CellRead => ({
  cell,
  status,
  products,
  ms: 1,
  usage: { input: 0, output: 0 },
  error: null,
});

describe("gridCuts", () => {
  it("splits 0-1000 into equal bands", () => {
    expect(gridCuts(2)).toEqual([0, 500, 1000]);
    expect(gridCuts(3)).toEqual([0, 333, 667, 1000]);
  });
});

describe("bandsToCuts", () => {
  it("makes contiguous cuts with boundaries halfway between bands, covering the edges", () => {
    expect(bandsToCuts([[100, 300], [350, 600], [620, 900]], 6)).toEqual([0, 325, 610, 1000]);
  });

  it("sorts, fixes swapped ends, drops thin bands and merges heavy overlaps", () => {
    expect(bandsToCuts([[600, 350], [100, 300], [500, 510], [110, 290]], 6)).toEqual([0, 325, 1000]);
  });

  it("falls back to equal bands past the cap, and null when nothing usable", () => {
    const many = Array.from({ length: 8 }, (_, i) => [i * 120, i * 120 + 100] as [number, number]);
    expect(bandsToCuts(many, 6)).toEqual(gridCuts(6));
    expect(bandsToCuts([[10, 20]], 6)).toBeNull();
  });
});

describe("parseLayout", () => {
  it("reads rows and bays", () => {
    const text = JSON.stringify({ rows: [{ y_min: 0, y_max: 480 }, { y_min: 520, y_max: 1000 }], bays: [{ x_min: 0, x_max: 1000 }] });
    expect(parseLayout(text)).toEqual({ rows: [0, 500, 1000], bays: [0, 1000] });
  });

  it("keeps one bay when bays are missing, and trims bays so cells stay under the cap", () => {
    const rows = Array.from({ length: 6 }, (_, i) => ({ y_min: i * 160, y_max: i * 160 + 150 }));
    const bays = [{ x_min: 0, x_max: 300 }, { x_min: 340, x_max: 650 }, { x_min: 700, x_max: 1000 }];
    expect(parseLayout(JSON.stringify({ rows, bays: [] }))!.bays).toEqual([0, 1000]);
    expect(parseLayout(JSON.stringify({ rows, bays }))!.bays).toEqual([0, 500, 1000]);
  });

  it("is null for bad JSON or no rows", () => {
    expect(parseLayout("nope")).toBeNull();
    expect(parseLayout(JSON.stringify({ rows: [], bays: [] }))).toBeNull();
  });
});

describe("layoutCells", () => {
  const cells = layoutCells([0, 500, 1000], [0, 500, 1000]);

  it("lists cells row by row, left to right, with labels", () => {
    expect(cells.map((c) => c.label)).toEqual(["Row 1, left", "Row 1, right", "Row 2, left", "Row 2, right"]);
    expect(cells.map((c) => c.index)).toEqual([0, 1, 2, 3]);
  });

  it("widens each crop by 10% of the cell on every side, clamped to the photo", () => {
    expect(cells[0]!.core).toEqual({ x1: 0, y1: 0, x2: 500, y2: 500 });
    expect(cells[0]!.crop).toEqual({ x1: 0, y1: 0, x2: 550, y2: 550 });
    expect(cells[3]!.crop).toEqual({ x1: 450, y1: 450, x2: 1000, y2: 1000 });
  });

  it("overlaps neighbours by 20% of a cell", () => {
    expect(cells[0]!.crop.x2 - cells[1]!.crop.x1).toBe(100);
  });
});

describe("cellLabel", () => {
  it("names bays only when there is more than one", () => {
    expect(cellLabel(1, 0, 1)).toBe("Row 2");
    expect(cellLabel(0, 1, 3)).toBe("Row 1, middle");
    expect(cellLabel(2, 3, 4)).toBe("Row 3, bay 4");
  });
});

describe("cellPixels / toPhoto", () => {
  it("snaps a crop to whole pixels and reports it back on the 0-1000 grid", () => {
    const { region, crop } = cellPixels({ x1: 450, y1: 0, x2: 1000, y2: 550 }, 1000, 3000);
    expect(region).toEqual({ left: 450, top: 0, width: 550, height: 1650 });
    expect(crop).toEqual({ x1: 450, y1: 0, x2: 1000, y2: 550 });
    // 333.3 of 1000 on 100 px: widened out to whole pixels 33..67, reported as 330..670.
    expect(cellPixels({ x1: 333.3, y1: 0, x2: 666.7, y2: 1000 }, 100, 100)).toEqual({
      region: { left: 33, top: 0, width: 34, height: 100 },
      crop: { x1: 330, y1: 0, x2: 670, y2: 1000 },
    });
  });

  it("maps a cell box back onto the photo", () => {
    const crop = { x1: 450, y1: 450, x2: 1000, y2: 1000 };
    expect(toPhoto({ x1: 0, y1: 0, x2: 1000, y2: 1000 }, crop)).toEqual(crop);
    expect(toPhoto({ x1: 100, y1: 200, x2: 300, y2: 400 }, crop)).toEqual({ x1: 505, y1: 560, x2: 615, y2: 670 });
  });
});

describe("stitch", () => {
  const [left, right] = layoutCells([0, 1000], [0, 500, 1000]);
  // A unit straddling x = 500 on the photo: whole in both crops (left 0–550, right 450–1000).
  const straddleInLeft = { x1: Math.round(((480 - 0) / 550) * 1000), y1: 100, x2: Math.round(((530 - 0) / 550) * 1000), y2: 300 };
  const straddleInRight = { x1: Math.round(((480 - 450) / 550) * 1000), y1: 100, x2: Math.round(((530 - 450) / 550) * 1000), y2: 300 };

  it("counts a unit in the overlap once: the cell whose core holds its centre keeps it", () => {
    const { products, sources } = stitch([
      read(left!, [product({ boxes: [{ x1: 100, y1: 100, x2: 200, y2: 300 }, straddleInLeft] })]),
      read(right!, [product({ boxes: [straddleInRight, { x1: 600, y1: 100, x2: 700, y2: 300 }] })]),
    ]);
    expect(products).toHaveLength(1);
    expect(products[0]!.count).toBe(3);
    expect(sources).toEqual([[0, 1]]);
  });

  it("merges the same product read in two cells and combines their units and best confidence", () => {
    const { products } = stitch([
      read(left!, [product({ brand: "", pack: "", confidence: "low", boxes: [{ x1: 100, y1: 100, x2: 200, y2: 300 }] })]),
      read(right!, [product({ brand: "ACME", boxes: [{ x1: 600, y1: 100, x2: 700, y2: 300 }] })]),
    ]);
    expect(products).toEqual([expect.objectContaining({ brand: "ACME", name: "Syrup", pack: "450g", count: 2, confidence: "high" })]);
  });

  it("keeps different sizes apart", () => {
    const { products } = stitch([
      read(left!, [product({ boxes: [{ x1: 100, y1: 100, x2: 200, y2: 300 }] })]),
      read(right!, [product({ pack: "1kg", boxes: [{ x1: 600, y1: 100, x2: 700, y2: 300 }] })]),
    ]);
    expect(products.map((p) => p.pack)).toEqual(["450g", "1kg"]);
  });

  it("takes an unreadable cell's units from its neighbour's overlap", () => {
    const { products } = stitch([read(left!, [product({ boxes: [straddleInLeft] })]), read(right!, [], "unreadable")]);
    expect(products[0]!.count).toBe(1);
  });

  it("gives a box read as two products to the more confident reading", () => {
    const box = { x1: 100, y1: 100, x2: 200, y2: 300 };
    const { products } = stitch([
      read(left!, [product({ name: "Syrup", confidence: "low", boxes: [box] }), product({ name: "Golden Syrup", boxes: [{ ...box, x2: 205 }] })]),
    ]);
    expect(products.map((p) => p.name)).toEqual(["Golden Syrup"]);
  });
});

describe("cellSummary / sweepSteps", () => {
  it("describes each cell for the trace, in reading order", () => {
    expect(cellSummary("Row 2, left", "read", 4, 11)).toBe("Row 2, left: 4 products (11 units)");
    expect(cellSummary("Row 1", "empty", 0, 0)).toBe("Row 1: no products");
    expect(cellSummary("Row 3", "unreadable", 0, 0)).toBe("Row 3: could not be read");
    const steps = sweepSteps({
      layout: { source: "grid", rows: 3, bays: 2, error: "x" },
      cells: [{ summary: "Row 1, left: 1 product (1 unit)", ms: 5 }] as never,
    });
    expect(steps.map((s) => s.summary)).toEqual(["Sweep: 3 rows × 2 bays (fixed grid)", "Row 1, left: 1 product (1 unit)"]);
  });
});

describe("sweepShelf", () => {
  const photo = () => sharp({ create: { width: 1200, height: 900, channels: 3, background: { r: 200, g: 200, b: 30 } } }).jpeg().toBuffer();
  const result = (text: string): ResponsesResult => ({ id: null, status: "completed", text, toolCalls: [], output: [], usage: { input_tokens: 100, output_tokens: 10 } });
  const shelf = JSON.stringify({
    products: [{ brand: "Acme", name: "Syrup", pack: "450g", look: "yellow jar", confidence: "high", boxes: [{ x_min: 400, y_min: 400, x_max: 600, y_max: 600 }] }],
  });

  it("falls back to the fixed grid when the layout fails, reads every cell and sums tokens", async () => {
    let calls = 0;
    const client = {
      respond: async (body: Record<string, unknown>) => {
        calls++;
        if ((body.text as { format: { name: string } }).format.name === "shelf_layout") throw new Error("boom");
        return result(shelf);
      },
    };
    const s = await sweepShelf(client, await photo());
    const cells = FALLBACK_GRID.rows * FALLBACK_GRID.bays;
    expect(calls).toBe(cells + 1);
    expect(s.layout).toEqual(expect.objectContaining({ source: "grid", error: "boom" }));
    expect(s.cells.map((c) => c.status)).toEqual(Array(cells).fill("read"));
    expect(s.usage).toEqual({ input: 100 * cells, output: 10 * cells, calls: cells });
    // Each cell's centre unit lands in its own core: one product, one unit per cell.
    expect(s.products).toHaveLength(1);
    expect(s.products[0]!.count).toBe(cells);
  });

  it("marks failed cells unreadable and throws only when every cell fails", async () => {
    let n = 0;
    const flaky = { respond: async () => (n++ % 2 ? result(shelf) : Promise.reject(new Error("timeout"))) };
    const s = await sweepShelf(flaky, await photo(), { layout: "grid", concurrency: 1 });
    expect(s.cells.map((c) => c.status)).toEqual(["unreadable", "read", "unreadable", "read", "unreadable", "read"]);
    await expect(sweepShelf({ respond: async () => Promise.reject(new Error("down")) }, await photo(), { layout: "grid" })).rejects.toThrow(/No sweep cell/);
  });
});
