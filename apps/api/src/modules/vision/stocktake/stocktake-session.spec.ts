import { describe, expect, it, jest } from "@jest/globals";
import type { MatchCandidate, MatchResult } from "@tally/catalog-client";
import { indexInventory } from "../inventory-match";
import type { Box, ShelfProduct } from "../shelf-reader";
import { STOCKTAKE_LIMITS, StocktakeSession, type StocktakeDeps } from "./stocktake-session";

const box = (x1: number): Box => ({ x1, y1: 100, x2: x1 + 80, y2: 300 });
const product = (over: Partial<ShelfProduct>): ShelfProduct => ({
  brand: "",
  name: "x",
  pack: "",
  look: "red box",
  count: 2,
  boxes: [box(100), box(200)],
  confidence: "high",
  ...over,
});
const candidate = (qid: string, over: Partial<MatchCandidate> = {}): MatchCandidate =>
  ({
    qid,
    name: `Product ${qid}`,
    variantLabel: null,
    size: null,
    packQty: 1,
    status: "active",
    family: { slug: "f", name: "F" },
    brand: { slug: "b", name: "B" },
    category: { path: "a", name: "A" },
    image: null,
    price: null,
    score: 0.88,
    signals: { text: 0.9, brand: 1, size: 1 },
    ...over,
  }) as MatchCandidate;
const match = (ref: string, candidates: MatchCandidate[]): MatchResult => ({ ref, query: { brand: null, name: "", pack: null }, parsedPack: null, candidates });

function session(over: Partial<StocktakeDeps> = {}) {
  const deps: StocktakeDeps = {
    searchCatalogue: jest.fn(async () => [candidate("QC-GGGG-GGGG-G", { name: "Golden Penny Garri 1kg", brand: { slug: "golden-penny", name: "Golden Penny" } })]),
    countUnits: jest.fn(async () => [box(100), box(200), box(300), box(400)]),
    zoom: jest.fn(async () => "data:image/webp;base64,AAAA"),
    ...over,
  };
  const products = [
    product({ brand: "Closeup", name: "Toothpaste", confidence: "high" }),
    product({ name: "Garri", confidence: "low", look: "white bag" }),
  ];
  const inventory = indexInventory([{ id: "garri-item", name: "Garri", variantLabel: null, coreQid: "QC-GGGG-GGGG-G" }], []);
  const closeup = candidate("QC-CCCC-CCCC-C", { brand: { slug: "close-up", name: "Close-Up" } });
  const s = new StocktakeSession(products, [match("0", [closeup]), match("1", [])], new Map(), inventory, deps);
  return { s, deps };
}

describe("StocktakeSession", () => {
  it("lists the first pass as a checklist, marking lines that need a look", () => {
    const text = session().s.checklist();
    expect(text).toContain("0. [OK] Closeup · Toothpaste");
    expect(text).toContain("1. [CHECK] Garri");
    expect(text).toContain("no catalogue match");
  });

  it("zoom returns the close-up as an image (the line's largest box by default) and counts against the budget", async () => {
    const { s, deps } = session();
    const r = await s.execute("zoom", '{"line":1}', 1);
    expect(r.output).toEqual([
      { type: "input_text", text: "Close-up of line 1:" },
      { type: "input_image", image_url: "data:image/webp;base64,AAAA" },
    ]);
    expect(deps.zoom).toHaveBeenCalledWith(box(100));
    for (let i = 1; i < STOCKTAKE_LIMITS.maxZooms; i++) await s.execute("zoom", '{"line":1}', 1);
    expect((await s.execute("zoom", '{"line":1}', 2)).summary).toBe("zoom refused: budget");
  });

  it("search_catalogue adds candidates the line can record; at most 3 searches per line", async () => {
    const { s, deps } = session();
    const r = await s.execute("search_catalogue", '{"line":1,"name":"Garri","pack":"1kg","brand":"Golden Penny"}', 1);
    expect(deps.searchCatalogue).toHaveBeenCalledWith({ brand: "Golden Penny", name: "Garri", pack: "1kg" });
    expect(r.output).toContain("QC-GGGG-GGGG-G Golden Penny Garri 1kg");
    await s.execute("search_catalogue", '{"line":1,"name":"Garri"}', 1);
    await s.execute("search_catalogue", '{"line":1,"name":"Garri"}', 1);
    expect((await s.execute("search_catalogue", '{"line":1,"name":"Garri"}', 2)).summary).toBe("search refused: budget");
  });

  it("record_line refuses a Qore ID the line never saw (no invented products)", async () => {
    const { s } = session();
    await s.execute("zoom", '{"line":1}', 1);
    const r = await s.execute("record_line", '{"line":1,"brand":"","name":"Garri","pack":"","qid":"QC-ZZZZ-ZZZZ-Z"}', 1);
    expect(r.summary).toMatch(/^record refused: QC-ZZZZ-ZZZZ-Z was not returned/);
    expect(s.lines[1]!.recorded).toBe(false);
  });

  it("a recorded match becomes the line's top candidate, and the store check follows the shared rules", async () => {
    const { s } = session();
    await s.execute("zoom", '{"line":1}', 1);
    await s.execute("search_catalogue", '{"line":1,"name":"Garri","brand":"Golden Penny","pack":"1kg"}', 1);
    await s.execute("record_line", '{"line":1,"brand":"Golden Penny","name":"Garri","pack":"1kg","qid":"QC-GGGG-GGGG-G"}', 2);
    const d = s.detections()[1]!;
    expect(d).toMatchObject({ brand: "Golden Penny", name: "Garri", pack: "1kg", inventoryItemId: "garri-item", inventoryMatch: "catalogue" });
    expect(d.candidates[0]!.qid).toBe("QC-GGGG-GGGG-G");
    expect(d.evidence.map((e) => e.tool)).toEqual(["zoom", "search_catalogue", "record_line"]);
  });

  it("count_units only changes the count when record_line asks for it", async () => {
    const { s, deps } = session();
    await s.execute("count_units", '{"line":0,"look":"Red Box"}', 1);
    expect(deps.countUnits).toHaveBeenCalledWith("red box", 0);
    expect(s.detections()[0]).toMatchObject({ count: 2, countSource: "spark" });
    await s.execute("record_line", '{"line":0,"brand":"Closeup","name":"Toothpaste","pack":"","use_counted":true}', 2);
    expect(s.detections()[0]).toMatchObject({ count: 4, countSource: "sam" });
  });

  it("a low SAM count from the first pass is flagged and the zoom goes to Spark's boxes", async () => {
    const products = [product({ brand: "Golden", name: "Syrup", count: 3, boxes: [box(10), box(20), box(30)] })];
    const deps: StocktakeDeps = {
      searchCatalogue: jest.fn(async () => []),
      countUnits: jest.fn(async () => []),
      zoom: jest.fn(async () => "data:image/webp;base64,AAAA"),
    };
    const s = new StocktakeSession(products, [match("0", [])], new Map([[0, [box(500)]]]), indexInventory([], []), deps);
    expect(s.checklist()).toContain("[CHECK]");
    expect(s.detections()[0]).toMatchObject({ count: 3, countSource: "spark", review: expect.stringContaining("Counts disagree: read 3, SAM found 1") });
    await s.execute("zoom", '{"line":0}', 1);
    expect(deps.zoom).toHaveBeenCalledWith(box(10));
  });

  it("use_counted without a count is refused", async () => {
    const { s } = session();
    expect((await s.execute("record_line", '{"line":0,"brand":"Closeup","name":"Toothpaste","pack":"","use_counted":true}', 1)).summary).toBe(
      "record refused: use_counted needs a count_units result for this line.",
    );
  });

  it("a recorded match survives even when the rewritten brand would filter it out", async () => {
    // An unbranded search found an other-brand product; the agent then records the brand it read.
    const other = candidate("QC-OOOO-OOOO-O", { name: "Gino Tomato Paste 210g", signals: { text: 0.7, brand: 0.5, size: 0.5 } });
    const { s } = session({ searchCatalogue: jest.fn(async () => [other]) });
    await s.execute("zoom", '{"line":1}', 1);
    await s.execute("search_catalogue", '{"line":1,"name":"Tomato Paste"}', 1);
    await s.execute("record_line", '{"line":1,"brand":"Gino","name":"Tomato Paste","pack":"210g","qid":"QC-OOOO-OOOO-O"}', 2);
    expect(s.detections()[1]!.candidates[0]!.qid).toBe("QC-OOOO-OOOO-O");
  });

  it("find_in_store answers from the merchant's items", async () => {
    const { s } = session();
    await s.execute("search_catalogue", '{"line":1,"name":"Garri"}', 1);
    expect((await s.execute("find_in_store", '{"line":1}', 1)).output).toContain("In store: item garri-item");
    expect((await s.execute("find_in_store", '{"line":0}', 1)).output).toBe("Not in the merchant's store.");
  });

  it("an unresolved line keeps its reading and says why", async () => {
    const { s } = session();
    await s.execute("zoom", '{"line":1}', 1);
    const r = await s.execute("record_line", '{"line":1,"brand":"","name":"Garri","pack":"","unresolved_reason":"label hidden"}', 1);
    expect(r.summary).toBe("recorded unresolved: label hidden");
    // The merchant sees why, and the line sorts to the top for review.
    expect(s.detections()[1]!.review).toBe("Agent couldn't confirm: label hidden");
  });

  it("rejects bad input without throwing", async () => {
    const { s } = session();
    expect((await s.execute("zoom", "{not json", 1)).summary).toBe("invalid JSON arguments");
    expect((await s.execute("zoom", '{"line":9}', 1)).summary).toBe("unknown line");
    expect((await s.execute("teleport", '{"line":0}', 1)).summary).toBe("unknown tool teleport");
  });

  it("submit is refused while lines are open; the third try ends with them flagged for the merchant", async () => {
    const { s } = session();
    await s.execute("record_line", '{"line":0,"brand":"Closeup","name":"Toothpaste","pack":"","qid":"QC-CCCC-CCCC-C"}', 1);
    expect((await s.execute("submit_stocktake", "{}", 2)).summary).toBe("submit refused: 1 open");
    expect((await s.execute("submit_stocktake", "{}", 3)).summary).toBe("submit refused: 1 open");
    const r = await s.execute("submit_stocktake", "{}", 4);
    expect(r).toMatchObject({ done: true, output: "Submitted. Lines 1 go to the merchant unreviewed." });
    expect(s.submitted).toBe(true);
    expect(s.detections().map((d) => d.review)).toEqual([null, "Not reviewed by the agent: first-pass result."]);
  });

  it("submit is accepted at once when every line is recorded", async () => {
    const { s } = session();
    await s.execute("zoom", '{"line":1}', 1);
    await s.execute("record_line", '{"line":0,"brand":"Closeup","name":"Toothpaste","pack":""}', 1);
    await s.execute("record_line", '{"line":1,"brand":"","name":"Garri","pack":"","unresolved_reason":"not legible"}', 1);
    expect(await s.execute("submit_stocktake", "{}", 2)).toMatchObject({ done: true, summary: "submitted" });
  });

  describe("verification at record_line", () => {
    it("a flagged (CHECK) line needs a zoom first", async () => {
      const { s } = session();
      const r = await s.execute("record_line", '{"line":1,"brand":"","name":"Garri","pack":""}', 1);
      expect(r.output).toBe("Refused: this line was flagged: zoom into it before recording.");
      await s.execute("zoom", '{"line":1}', 1);
      expect((await s.execute("record_line", '{"line":1,"brand":"","name":"Garri","pack":""}', 2)).output).toBe("Recorded.");
    });

    it("changing an OK line's label needs a zoom first", async () => {
      const { s } = session();
      const r = await s.execute("record_line", '{"line":0,"brand":"Pepsodent","name":"Toothpaste","pack":""}', 1);
      expect(r.output).toBe("Refused: you changed the label: zoom into it first so the reading comes from the pack.");
    });

    it("the zoom rule lifts once the zoom budget is spent", async () => {
      const { s } = session();
      for (let i = 0; i < STOCKTAKE_LIMITS.maxZooms; i++) await s.execute("zoom", '{"line":0}', 1);
      expect((await s.execute("record_line", '{"line":1,"brand":"","name":"Garri","pack":""}', 2)).output).toBe("Recorded.");
    });

    it("a matched product must be the brand that was read", async () => {
      const peak = candidate("QC-PPPP-PPPP-P", { name: "Peak Milk", brand: { slug: "peak", name: "Peak" } });
      const { s } = session({ searchCatalogue: jest.fn(async () => [peak]) });
      await s.execute("zoom", '{"line":1}', 1);
      await s.execute("search_catalogue", '{"line":1,"name":"milk"}', 1);
      const r = await s.execute("record_line", '{"line":1,"brand":"Dano","name":"Milk","pack":"","qid":"QC-PPPP-PPPP-P"}', 2);
      expect(r.output).toBe('Refused: QC-PPPP-PPPP-P is a Peak product but you read "Dano". Pick a Dano product or leave qid empty.');
      // Brand spelling differences are fine.
      const cu = candidate("QC-UUUU-UUUU-U", { brand: { slug: "close-up", name: "Close-Up" } });
      const { s: s2 } = session({ searchCatalogue: jest.fn(async () => [cu]) });
      await s2.execute("zoom", '{"line":1}', 1);
      await s2.execute("search_catalogue", '{"line":1,"name":"toothpaste"}', 1);
      expect((await s2.execute("record_line", '{"line":1,"brand":"closeup","name":"Toothpaste","pack":"","qid":"QC-UUUU-UUUU-U"}', 2)).output).toBe("Recorded.");
    });

    it("a matched product must be the size that was read (Peak 900g is not Peak 400g)", async () => {
      const p400 = candidate("QC-PPPP-PPPP-P", { brand: { slug: "peak", name: "Peak" }, size: { value: 400, unit: "g" } });
      const { s } = session({ searchCatalogue: jest.fn(async () => [p400]) });
      await s.execute("zoom", '{"line":1}', 1);
      await s.execute("search_catalogue", '{"line":1,"name":"milk"}', 1);
      expect((await s.execute("record_line", '{"line":1,"brand":"Peak","name":"Milk","pack":"900g","qid":"QC-PPPP-PPPP-P"}', 2)).output).toBe(
        "Refused: QC-PPPP-PPPP-P is 400g but the pack says 900g. Pick the matching size or leave qid empty.",
      );
      // Units convert: 0.4kg is 400g.
      expect((await s.execute("record_line", '{"line":1,"brand":"Peak","name":"Milk","pack":"0.4kg","qid":"QC-PPPP-PPPP-P"}', 3)).output).toBe("Recorded.");
    });

    it("three refusals escalate the line to the merchant instead of looping", async () => {
      const { s } = session();
      const bad = '{"line":1,"brand":"","name":"Garri","pack":"","qid":"QC-ZZZZ-ZZZZ-Z"}';
      await s.execute("zoom", '{"line":1}', 1);
      await s.execute("record_line", bad, 1);
      await s.execute("record_line", bad, 2);
      const r = await s.execute("record_line", bad, 3);
      expect(r.summary).toMatch(/^escalated: QC-ZZZZ-ZZZZ-Z was not returned/);
      expect(s.lines[1]).toMatchObject({ recorded: true, chosenQid: null });
      expect(s.detections()[1]!.review).toMatch(/^Escalated after 3 refused records/);
      expect((await s.execute("record_line", '{"line":1,"brand":"","name":"Garri","pack":""}', 4)).summary).toBe("record refused: already recorded");
    });
  });
});
