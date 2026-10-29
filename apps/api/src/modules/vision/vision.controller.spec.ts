import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import sharp from "sharp";
import { ForbiddenException, INestApplication, Logger, NotFoundException, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import * as jwt from "jsonwebtoken";
import { createHash } from "node:crypto";
import request from "supertest";
import { SupabaseJwtGuard } from "../../common/guards/supabase-jwt.guard";
import { BusinessesService } from "../businesses/businesses.service";
import { CatalogService } from "../catalog/catalog.service";
import { MAX_IDENTIFY_IMAGE_BYTES, MAX_SHELF_IMAGE_BYTES, VisionController } from "./vision.controller";
import { R2Storage } from "../media/r2-storage";
import { VisionRepository } from "./vision.repository";
import { STOCKTAKE_DEADLINES, VisionService } from "./vision.service";

/** A stored crop of the given size, as R2 would return it. */
const webp = (width: number, height: number) => sharp({ create: { width, height, channels: 3, background: "#c33" } }).webp().toBuffer();

// Real guard, controller and service; business lookup, catalogue and Meta Model API (fetch) are mocked.
// Live behaviour is checked by scripts/vision-smoke.mjs.
const SECRET = "test-jwt-secret-not-real";
const USER = "00000000-0000-4000-8000-0000000000aa";
const BIZ = "00000000-0000-4000-8000-000000000001";
const token = jwt.sign({ sub: USER, role: "authenticated", aud: "authenticated" }, SECRET, { algorithm: "HS256", expiresIn: 60 });
const auth = { Authorization: `Bearer ${token}` };
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);
const path = `/api/businesses/${BIZ}/vision/shelf-scans`;
const SCAN = "00000000-0000-4000-8000-0000000000c1";
const DET = "00000000-0000-4000-8000-0000000000d1";
const pending = {
  detectionId: DET,
  scanId: SCAN,
  position: 0,
  brand: "Peak",
  name: "Full Cream Milk Powder",
  pack: "400g",
  candidates: [{ qid: "QC-7K2M-9XQ4-R", score: 0.88 }],
  outcome: "accepted" as const,
  confirmedQid: "QC-7K2M-9XQ4-R",
  quantity: 6,
  itemName: "Peak Milk 400g",
  price: "4500.00",
};

/** A stored scan as repo.getScan returns it: one decided line (restocked) and one the agent flagged. */
const storedScan = (overrides: Record<string, unknown> = {}) => ({
  id: SCAN,
  businessId: BIZ,
  status: "open",
  readModel: "muse-spark-1.3",
  countModel: "sam-3.1",
  catalogueAvailable: true,
  createdAt: new Date("2026-10-29T09:00:00Z"),
  confirmedAt: null,
  detections: [
    {
      id: DET,
      position: 0,
      brand: "Peak",
      name: "Full Cream Milk Powder",
      pack: "400g",
      look: "yellow tin",
      confidence: "high",
      sparkCount: 6,
      samCount: 6,
      count: 6,
      countSource: "sam",
      boxes: [{ x1: 10, y1: 10, x2: 50, y2: 90 }],
      candidates: [{ qid: "QC-7K2M-9XQ4-R", score: 0.94, match: "strong" }],
      inventoryItemId: "item-a",
      inventoryMatch: "catalogue",
      action: "restock",
      itemId: "item-a",
      quantity: 6,
      confirmedQid: "QC-7K2M-9XQ4-R",
      decidedAt: new Date("2026-10-29T09:05:00Z"),
      review: null,
      evidence: null,
    },
    {
      id: "00000000-0000-4000-8000-0000000000d2",
      position: 1,
      brand: "",
      name: "Cooking Oil",
      pack: "",
      look: "clear bottle",
      confidence: "low",
      sparkCount: 2,
      samCount: null,
      count: 2,
      countSource: "spark",
      boxes: [],
      // Stored before match strengths were saved.
      candidates: [{ qid: "QC-AAAA-BBBB-C", score: 0.41 }],
      inventoryItemId: null,
      inventoryMatch: null,
      action: null,
      itemId: null,
      quantity: null,
      confirmedQid: null,
      decidedAt: null,
      review: "Agent couldn't confirm: label unreadable",
      evidence: [{ turn: 1, tool: "zoom", summary: "zoomed" }],
    },
  ],
  ...overrides,
});
const peakDetail = {
  qid: "QC-7K2M-9XQ4-R",
  name: "Peak Full Cream Milk Powder",
  variantLabel: "400g",
  size: { value: 400, unit: "g" },
  packQty: 1,
  status: "active",
  brand: { slug: "peak", name: "Peak" },
  image: null,
  price: { currency: "NGN", indicative: true, median: 4500, min: 4200, max: 5100, offers: 3, retailers: 2, observedAt: "2026-10-01" },
  variants: [],
};

const sparkReply = (products: unknown[]) =>
  new Response(
    JSON.stringify({
      status: "completed",
      output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ products }) }] }],
      usage: { input_tokens: 1500, output_tokens: 200 },
    }),
    { status: 200 },
  );
const peak = {
  brand: "Peak",
  name: "Full Cream Milk Powder",
  pack: "400g",
  look: "yellow tin",
  boxes: [{ x_min: 100, y_min: 100, x_max: 150, y_max: 200 }],
  confidence: "high",
};
// SAM output for "yellow tin": two units next to Spark's box, one far away (not this product).
const samText =
  "<0f>0<|box;x1=200;y1=200;x2=300;y2=400;w=2000;h=2000;c=0.9|><|mask;x=0;y=0;data=1,1,!A|>," +
  "1<|box;x1=310;y1=200;x2=410;y2=400;w=2000;h=2000;c=0.8|><|mask;x=0;y=0;data=1,1,!A|>," +
  "2<|box;x1=1800;y1=1800;x2=1900;y2=1950;w=2000;h=2000;c=0.9|><|mask;x=0;y=0;data=1,1,!A|>";
const samReply = (text: string) =>
  new Response(JSON.stringify({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text }] }] }), { status: 200 });
/** Route the mocked Meta API by model: Spark gets `spark`, SAM gets `sam`. */
const metaApi = (spark: () => Response, sam: () => Response) => async (_url: unknown, init?: RequestInit) =>
  JSON.parse(String(init?.body)).model === "sam-3.1" ? sam() : spark();

async function app(apiKey: string | undefined) {
  const businesses = {
    listInventory: jest.fn(async () => [{ id: "item-a", name: "Peak 400g", variantLabel: null, coreQid: "QC-A" }]),
    getForMember: jest.fn(async () => ({ id: BIZ, subtypeCode: "supermarket", role: "owner" })),
    sendFeedback: jest.fn(async () => ({ sent: 1, recorded: 1, duplicates: 0 }) as { sent: number; recorded: number; duplicates: number } | { sent: 0; error: string }),
  };
  const repo = {
    readings: jest.fn(async () => [] as { itemId: string; readingKey: string }[]),
    saveScan: jest.fn(async () => "scan-1"),
    archivedLinkedItems: jest.fn(async () => [] as { id: string; name: string; variantLabel: string | null; coreQid: string | null }[]),
    getScan: jest.fn(async (_b: string, _s: string) => storedScan() as Record<string, unknown>),
    scanItems: jest.fn(async (_b: string, _ids: string[], _qids: string[]) => [
      { id: "item-a", name: "Peak Milk 400g", coreQid: "QC-7K2M-9XQ4-R", archived: false },
    ]),
    history: jest.fn(async (_b: string, _limit: number) => ({
      runs: [] as Record<string, unknown>[],
      quick: [] as Record<string, unknown>[],
      counts: [] as Record<string, unknown>[],
    })),
    confirm: jest.fn(async () => ({
      created: 1,
      restocked: 0,
      restored: 0,
      skipped: 0,
      alreadyDecided: 0,
      invalid: [],
      scanConfirmed: true,
      pendingFeedback: [pending],
    })),
    markFeedbackSent: jest.fn(async () => undefined),
    rememberReading: jest.fn(async () => true),
    isActiveItem: jest.fn(async () => true),
    createRun: jest.fn(async () => "run-1"),
    failStaleRuns: jest.fn(async (_before: Date) => 0),
    addStep: jest.fn(async (_b: string, _r: string, _s: unknown) => undefined),
    finishRun: jest.fn(async (_r: string, _e: Record<string, unknown>) => undefined),
    getRun: jest.fn(async () => ({ id: "run-1", status: "running", scanId: null as string | null, steps: [] as Record<string, unknown>[] })),
  };
  const catalog = {
    client: {
      match: jest.fn(async () => ({
        items: [{ ref: "0", query: {}, parsedPack: null, candidates: [{ qid: "QC-A", name: "Peak 400g", variantLabel: null, size: null, packQty: 1, brand: null, score: 0.9, signals: { text: 1, brand: 1, size: 0.5 }, price: null }] }],
      })),
      uploadImage: jest.fn(async () => ({ sha256: "ab", qid: "QC-7K2M-9XQ4-R", view: "on_shelf", status: "pending", width: 400, height: 600 })),
      getProduct: jest.fn(async (qid: string): Promise<Record<string, unknown>> => {
        if (qid === peakDetail.qid) return peakDetail;
        throw Object.assign(new Error("not found"), { status: 404 });
      }),
    },
  };
  // R2 off by default; tests switch it on.
  const media = {
    enabled: false,
    put: jest.fn(async (_key: string, _body: Uint8Array, _type: string) => undefined),
    get: jest.fn(async (_key: string) => (await webp(400, 600)) as Uint8Array | null),
    presignedGetUrl: jest.fn(async (key: string, _seconds?: number) => `https://r2.example/${key}?sig=1`),
    exists: jest.fn(async (_key: string) => false),
  };
  const config: Record<string, unknown> = { "supabase.jwtSecret": SECRET, "meta.apiKey": apiKey, "meta.baseUrl": "https://api.meta.ai/v1" };
  const moduleRef = await Test.createTestingModule({
    controllers: [VisionController],
    providers: [
      VisionService,
      { provide: BusinessesService, useValue: businesses },
      { provide: CatalogService, useValue: catalog },
      { provide: VisionRepository, useValue: repo },
      { provide: R2Storage, useValue: media },
      { provide: ConfigService, useValue: { get: (k: string) => config[k], getOrThrow: (k: string) => config[k] } },
      { provide: APP_GUARD, useClass: SupabaseJwtGuard },
    ],
  }).compile();
  const nest = moduleRef.createNestApplication({ logger: false });
  nest.setGlobalPrefix("api");
  nest.useGlobalPipes(new ValidationPipe({ transform: true }));
  await nest.init();
  return { nest, businesses, catalog, repo, media };
}

describe("VisionController shelf-scans (HTTP)", () => {
  let nest: INestApplication;
  let businesses: Awaited<ReturnType<typeof app>>["businesses"];
  let catalog: Awaited<ReturnType<typeof app>>["catalog"];
  let repo: Awaited<ReturnType<typeof app>>["repo"];
  let media: Awaited<ReturnType<typeof app>>["media"];
  const fetchSpy = jest.spyOn(global, "fetch");

  beforeAll(async () => {
    ({ nest, businesses, catalog, repo, media } = await app("LLM_000_not-a-real-key"));
  });
  afterAll(async () => {
    await nest.close();
    fetchSpy.mockRestore();
  });
  beforeEach(() => {
    fetchSpy.mockReset();
    businesses.listInventory.mockClear();
    catalog.client.match.mockClear();
    repo.saveScan.mockClear();
    repo.readings.mockClear();
  });

  const post = () => request(nest.getHttpServer()).post(path);

  it("needs a Supabase JWT", async () => {
    await post().attach("image", JPEG, "shelf.jpg").expect(401);
  });

  it("reads, counts with SAM, matches and flags stocked products", async () => {
    fetchSpy.mockImplementation(metaApi(() => sparkReply([peak]), () => samReply(samText)));
    const res = await post().set(auth).attach("image", JPEG, "shelf.jpg").expect(200);

    const models = fetchSpy.mock.calls.map(([, init]) => JSON.parse(String(init?.body)));
    expect(models.map((b) => b.model)).toEqual(["muse-spark-1.3", "sam-3.1"]);
    expect(models[1].input[0].content[0]).toEqual({ type: "input_text", text: "yellow tin" });

    expect(businesses.listInventory).toHaveBeenCalledWith(BIZ, USER);
    expect(catalog.client.match).toHaveBeenCalledWith({ items: [{ ref: "0", brand: "Peak", name: "Full Cream Milk Powder", pack: "400g" }], limit: 10 });
    expect(res.body).toMatchObject({
      scanId: "scan-1",
      model: "muse-spark-1.3",
      countModel: "sam-3.1",
      catalogueAvailable: true,
      detections: [
        {
          name: "Full Cream Milk Powder",
          look: "yellow tin",
          count: 2,
          countSource: "sam",
          sparkCount: 1,
          samCount: 2,
          inventoryItemId: "item-a",
          inventoryMatch: "catalogue",
          inventoryItemArchived: false,
          // The mocked candidate's signals.size is 0.5 (no size agreement): ask first.
          inventoryNeedsConfirm: true,
          candidates: [{ qid: "QC-A", inventoryItemId: "item-a" }],
        },
      ],
    });
    expect(res.body.detections[0].boxes).toEqual([
      { x1: 100, y1: 100, x2: 150, y2: 200 },
      { x1: 155, y1: 100, x2: 205, y2: 200 },
    ]);
    const [scan, saved] = repo.saveScan.mock.calls[0] as unknown as [Record<string, unknown>, { id: string }[]];
    expect(scan).toMatchObject({
      businessId: BIZ,
      createdBy: USER,
      imageSha256: createHash("sha256").update(JPEG).digest("hex"),
      imageBytes: JPEG.length,
      readModel: "muse-spark-1.3",
      countModel: "sam-3.1",
      catalogueAvailable: true,
    });
    expect(saved.map((d) => d.id)).toEqual([res.body.detections[0].id]);
    expect(res.body.timings).toEqual({
      readMs: expect.any(Number),
      samMs: expect.any(Number),
      matchMs: expect.any(Number),
      totalMs: expect.any(Number),
    });
  });

  it("a SAM failure keeps Spark's count and still returns 200", async () => {
    fetchSpy.mockImplementation(metaApi(() => sparkReply([peak]), () => new Response("{}", { status: 500 })));
    const res = await post().set(auth).attach("image", JPEG, "shelf.jpg").expect(200);
    expect(res.body.detections[0]).toMatchObject({ count: 1, countSource: "spark", sparkCount: 1, samCount: null });
  });

  it("stores one crop per detection in R2 when it is configured, small ones too; a tiny box gets none", async () => {
    media.enabled = true;
    media.put.mockClear();
    try {
      const photo = await sharp({ create: { width: 1000, height: 1000, channels: 3, background: "#c33" } }).jpeg().toBuffer();
      const big = { ...peak, boxes: [{ x_min: 100, y_min: 100, x_max: 600, y_max: 700 }] };
      const tiny = { ...peak, name: "Tiny", boxes: [{ x_min: 900, y_min: 900, x_max: 920, y_max: 930 }] };
      // ~85 x 106 px: under Qore Catalog's 160 px, still kept for Tally's own dataset.
      const small = { ...peak, name: "Small", boxes: [{ x_min: 700, y_min: 100, x_max: 780, y_max: 200 }] };
      fetchSpy.mockImplementation(metaApi(() => sparkReply([big, tiny, small]), () => samReply("")));
      const log = jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
      const res = await post().set(auth).attach("image", photo, "shelf.jpg").expect(200);
      expect(res.body.cropsStored).toBe(2);
      // The tiny one can never become a catalogue picture: say so.
      expect(log).toHaveBeenCalledWith("Scan scan-1: 2 of 3 crops stored, 1 too small to store (< 48 px)");
      log.mockRestore();
      const crops = media.put.mock.calls.filter(([key]) => key.startsWith("tally/crops/"));
      expect(crops.map(([key]) => key).sort()).toEqual(["tally/crops/scan-1/0.webp", "tally/crops/scan-1/2.webp"]);
      const [, body, type] = media.put.mock.calls.find(([key]) => key.endsWith("/0.webp"))!;
      expect(type).toBe("image/webp");
      expect((await sharp(Buffer.from(body)).metadata()).format).toBe("webp");
    } finally {
      media.enabled = false;
    }
  });

  it("keeps the shelf photo in R2 with the scan: upright JPEG, no metadata", async () => {
    media.enabled = true;
    media.put.mockClear();
    try {
      const photo = await sharp({ create: { width: 1200, height: 900, channels: 3, background: "#c33" } })
        .jpeg()
        .withExif({ IFD0: { Copyright: "x" } })
        .toBuffer();
      fetchSpy.mockImplementation(metaApi(() => sparkReply([peak]), () => samReply("")));
      const res = await post().set(auth).attach("image", photo, "shelf.jpg").expect(200);
      expect(res.body.photoStored).toBe(true);
      const [, body, type] = media.put.mock.calls.find(([key]) => key === "tally/scans/scan-1.jpg")!;
      expect(type).toBe("image/jpeg");
      const meta = await sharp(Buffer.from(body)).metadata();
      expect([meta.format, meta.width, meta.height, meta.exif]).toEqual(["jpeg", 1200, 900, undefined]);
    } finally {
      media.enabled = false;
    }
  });

  it("an empty shelf skips the catalogue", async () => {
    fetchSpy.mockResolvedValueOnce(sparkReply([]));
    const res = await post().set(auth).attach("image", JPEG, "shelf.jpg").expect(200);
    expect(res.body.detections).toEqual([]);
    expect(catalog.client.match).not.toHaveBeenCalled();
  });

  it("a catalogue failure still returns the detections", async () => {
    fetchSpy.mockImplementation(metaApi(() => sparkReply([peak]), () => samReply("")));
    catalog.client.match.mockRejectedValueOnce(Object.assign(new Error("down"), { status: 503 }));
    const res = await post().set(auth).attach("image", JPEG, "shelf.jpg").expect(200);
    expect(res.body).toMatchObject({ catalogueAvailable: false, detections: [{ candidates: [], inventoryItemId: null }] });
  });

  it("checks membership before calling the model", async () => {
    businesses.listInventory.mockRejectedValueOnce(new ForbiddenException("Not a member of this business"));
    await post().set(auth).attach("image", JPEG, "shelf.jpg").expect(403);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(repo.saveScan).not.toHaveBeenCalled();
  });

  it("recognises an item from a reading the merchant confirmed before", async () => {
    repo.readings.mockResolvedValueOnce([{ itemId: "item-a", readingKey: "peak|full cream milk powder|400g" }]);
    fetchSpy.mockImplementation(metaApi(() => sparkReply([peak]), () => samReply("")));
    catalog.client.match.mockResolvedValueOnce({ items: [{ ref: "0", query: {}, parsedPack: null, candidates: [] }] } as never);
    const res = await post().set(auth).attach("image", JPEG, "shelf.jpg").expect(200);
    expect(res.body.detections[0]).toMatchObject({ candidates: [], inventoryItemId: "item-a", inventoryMatch: "reading" });
  });

  it("rejects a missing image, a non-image and an oversized image before the model", async () => {
    await post().set(auth).expect(400);
    await post().set(auth).attach("image", Buffer.from("<svg/>"), "x.jpg").expect(400);
    await post().set(auth).attach("image", Buffer.alloc(MAX_SHELF_IMAGE_BYTES + 1, 0xff), "big.jpg").expect(413);
    await request(nest.getHttpServer()).post("/api/businesses/not-a-uuid/vision/shelf-scans").set(auth).attach("image", JPEG, "a.jpg").expect(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([
    [429, { error: { message: "slow down", code: "rate_limit_exceeded" } }, { "retry-after": "12" }, 503],
    [401, { error: { message: "bad key", code: "invalid_api_key" } }, {}, 502],
    [400, { error: { message: "denied", code: "content_policy_violation" } }, {}, 400],
    [400, { error: { message: "`max_output_tokens`: too large", code: null } }, {}, 502],
    [500, { error: { message: "boom", code: null } }, {}, 502],
  ])("maps a Meta %i to %#", async (status, body, headers, expected) => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(body), { status, headers }));
    const res = await post().set(auth).attach("image", JPEG, "shelf.jpg").expect(expected);
    if (expected === 503) expect(res.headers["retry-after"]).toBe("12");
    expect(JSON.stringify(res.body)).not.toContain("LLM_");
  });

  it("stores nothing when the model call fails", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "boom" } }), { status: 500 }));
    await post().set(auth).attach("image", JPEG, "shelf.jpg").expect(502);
    expect(repo.saveScan).not.toHaveBeenCalled();
  });

  it("maps a model timeout to 504", async () => {
    fetchSpy.mockRejectedValueOnce(new DOMException("timed out", "TimeoutError"));
    await post().set(auth).attach("image", JPEG, "shelf.jpg").expect(504);
  });

  it("maps unparseable model output to 502", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "incomplete", output: [{ type: "message", content: [{ type: "output_text", text: '{"products": [' }] }] }), { status: 200 }),
    );
    await post().set(auth).attach("image", JPEG, "shelf.jpg").expect(502);
  });
});

describe("VisionController without META_MODEL_API_KEY", () => {
  it("returns 503 and never calls the model", async () => {
    const { nest } = await app(undefined);
    const fetchSpy = jest.spyOn(global, "fetch");
    await request(nest.getHttpServer()).post(path).set(auth).attach("image", JPEG, "shelf.jpg").expect(503);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    await nest.close();
  });
});

describe("VisionController confirm + get (HTTP)", () => {
  let nest: INestApplication;
  let ctx: Awaited<ReturnType<typeof app>>;
  const confirmPath = `${path}/${SCAN}/confirm`;
  const add = { detectionId: DET, action: "add", qid: "QC-7K2M-9XQ4-R", name: "Peak Milk 400g", price: "4500", quantity: 6 };

  beforeAll(async () => {
    ctx = await app("LLM_000_not-a-real-key");
    nest = ctx.nest;
  });
  afterAll(() => nest.close());
  beforeEach(() => {
    ctx.repo.confirm.mockClear();
    ctx.repo.markFeedbackSent.mockClear();
    ctx.businesses.sendFeedback.mockClear();
  });

  it.each([
    ["get", `${path}/${SCAN}`],
    ["post", confirmPath],
  ] as const)("%s %s needs a Supabase JWT", async (method, p) => {
    await request(nest.getHttpServer())[method](p).expect(401);
  });

  describe("get (reopen)", () => {
    beforeEach(() => {
      ctx.catalog.client.getProduct.mockClear();
      ctx.media.enabled = false;
    });

    it("checks membership and returns the scan with candidate details, store state, review and decisions", async () => {
      const res = await request(nest.getHttpServer()).get(`${path}/${SCAN}`).set(auth).expect(200);
      expect(ctx.businesses.getForMember).toHaveBeenCalledWith(BIZ, USER);
      expect(ctx.repo.getScan).toHaveBeenCalledWith(BIZ, SCAN);
      expect(ctx.repo.scanItems).toHaveBeenCalledWith(BIZ, ["item-a"], ["QC-7K2M-9XQ4-R", "QC-AAAA-BBBB-C"]);
      expect(res.body).toMatchObject({ scanId: SCAN, status: "open", model: "muse-spark-1.3", catalogueAvailable: true, confirmedAt: null });
      const [peakLine, oil] = res.body.detections;
      expect(peakLine).toMatchObject({
        id: DET,
        position: 0,
        inventoryItemId: "item-a",
        inventoryItemArchived: false,
        inventoryItemName: expect.any(String),
        // A strong catalogue match is sure.
        inventoryNeedsConfirm: false,
        review: null,
        cropUrl: null,
        candidates: [
          { qid: "QC-7K2M-9XQ4-R", score: 0.94, match: "strong", name: "Peak Full Cream Milk Powder", brand: "Peak", price: { median: 4500, min: 4200, max: 5100 }, inventoryItemId: "item-a" },
        ],
        decision: { action: "restock", itemId: "item-a", itemName: "Peak Milk 400g", quantity: 6, decidedAt: "2026-10-29T09:05:00.000Z" },
      });
      // The flagged line keeps its reason, so the review screen picks nothing for it.
      expect(oil).toMatchObject({ review: "Agent couldn't confirm: label unreadable", decision: null, evidence: [{ tool: "zoom" }] });
      expect(oil.candidates).toEqual([{ qid: "QC-AAAA-BBBB-C", score: 0.41, inventoryItemId: null }]);
      // One product didn't resolve: say so rather than fail.
      expect(res.body.candidateDetails).toBe(false);
    });

    it("follows a merged product once, and a catalogue outage still returns the scan", async () => {
      ctx.catalog.client.getProduct.mockImplementation(async (qid: string) => {
        if (qid === "QC-AAAA-BBBB-C") return { qid, status: "merged", mergedInto: peakDetail.qid };
        if (qid === peakDetail.qid) return peakDetail;
        throw Object.assign(new Error("down"), { status: 503 });
      });
      const merged = await request(nest.getHttpServer()).get(`${path}/${SCAN}`).set(auth).expect(200);
      expect(merged.body.detections[1].candidates[0]).toMatchObject({ qid: "QC-AAAA-BBBB-C", name: "Peak Full Cream Milk Powder" });

      ctx.catalog.client.getProduct.mockRejectedValue(Object.assign(new Error("down"), { status: 503 }));
      ctx.repo.getScan.mockResolvedValueOnce(storedScan({ detections: [{ ...storedScan().detections[0], candidates: [{ qid: "QC-ZZZZ-ZZZZ-Z", score: 0.9 }] }] }));
      const down = await request(nest.getHttpServer()).get(`${path}/${SCAN}`).set(auth).expect(200);
      expect(down.body.candidateDetails).toBe(false);
      expect(down.body.detections[0].candidates).toEqual([{ qid: "QC-ZZZZ-ZZZZ-Z", score: 0.9, inventoryItemId: null }]);
    });

    it("reports today's store state: an item archived since asks to restore, a name match asks first", async () => {
      ctx.repo.scanItems.mockResolvedValueOnce([{ id: "item-a", name: "Peak Milk 400g", coreQid: "QC-7K2M-9XQ4-R", archived: true }]);
      ctx.repo.getScan.mockResolvedValueOnce(
        storedScan({ detections: [{ ...storedScan().detections[0], action: null, itemId: null, quantity: null, confirmedQid: null, decidedAt: null, inventoryMatch: "name" }] }),
      );
      const res = await request(nest.getHttpServer()).get(`${path}/${SCAN}`).set(auth).expect(200);
      expect(res.body.detections[0]).toMatchObject({ inventoryItemArchived: true, inventoryNeedsConfirm: true, decision: null });
      // Archived items aren't "stocked" for a candidate.
      expect(res.body.detections[0].candidates[0].inventoryItemId).toBeNull();
    });

    it("gives each line a presigned crop URL when R2 is on", async () => {
      ctx.media.enabled = true;
      const res = await request(nest.getHttpServer()).get(`${path}/${SCAN}`).set(auth).expect(200);
      expect(res.body.detections.map((d: { cropUrl: string }) => d.cropUrl)).toEqual([
        `https://r2.example/tally/crops/${SCAN}/0.webp?sig=1`,
        `https://r2.example/tally/crops/${SCAN}/1.webp?sig=1`,
      ]);
      expect(ctx.media.presignedGetUrl).toHaveBeenCalledWith(`tally/crops/${SCAN}/0.webp`, 3600);
      // Scans from before photos were kept have none.
      expect(res.body.photoUrl).toBeNull();
    });

    it("gives the stored shelf photo a presigned URL", async () => {
      ctx.media.enabled = true;
      ctx.media.exists.mockResolvedValueOnce(true);
      const res = await request(nest.getHttpServer()).get(`${path}/${SCAN}`).set(auth).expect(200);
      expect(ctx.media.exists).toHaveBeenCalledWith(`tally/scans/${SCAN}.jpg`);
      expect(res.body.photoUrl).toBe(`https://r2.example/tally/scans/${SCAN}.jpg?sig=1`);
    });

    it("another business's scan is a 404", async () => {
      ctx.repo.getScan.mockRejectedValueOnce(new NotFoundException(`No scan ${SCAN}`));
      await request(nest.getHttpServer()).get(`${path}/${SCAN}`).set(auth).expect(404);
    });
  });

  it("confirm applies the decisions, sends photo feedback and marks it sent", async () => {
    const res = await request(nest.getHttpServer()).post(confirmPath).set(auth).send({ decisions: [add] }).expect(200);
    expect(ctx.repo.confirm).toHaveBeenCalledWith(BIZ, SCAN, USER, [expect.objectContaining(add)]);
    expect(ctx.businesses.sendFeedback).toHaveBeenCalledWith([
      expect.objectContaining({
        clientRef: `${SCAN}:0`,
        source: "photo",
        subtypeCode: "supermarket",
        outcome: "accepted",
        confirmedQid: "QC-7K2M-9XQ4-R",
        quantity: 6,
        unitPriceNgn: 4500,
      }),
    ]);
    expect(ctx.repo.markFeedbackSent).toHaveBeenCalledWith([DET]);
    expect(res.body).toEqual({
      created: 1,
      restocked: 0,
      restored: 0,
      skipped: 0,
      alreadyDecided: 0,
      invalid: [],
      scanConfirmed: true,
      feedback: { sent: 1, recorded: 1, duplicates: 0 },
      // R2 is off in this suite: no crop to send.
      images: { uploaded: 0, skipped: 1, failed: 0, skippedBy: { noProduct: 0, noCrop: 1, tooSmall: 0 } },
    });
  });

  describe("with R2 on", () => {
    beforeEach(() => {
      ctx.media.enabled = true;
      ctx.media.get.mockClear();
      ctx.catalog.client.uploadImage.mockClear();
    });
    afterEach(() => {
      ctx.media.enabled = false;
    });

    it("sends the line's crop after its feedback, linked by clientRef", async () => {
      const res = await request(nest.getHttpServer()).post(confirmPath).set(auth).send({ decisions: [add] }).expect(200);
      expect(ctx.media.get).toHaveBeenCalledWith(`tally/crops/${SCAN}/0.webp`);
      expect(ctx.catalog.client.uploadImage).toHaveBeenCalledWith({
        file: expect.any(Uint8Array),
        filename: "0.webp",
        qid: "QC-7K2M-9XQ4-R",
        view: "on_shelf",
        feedbackClientRef: `${SCAN}:0`,
      });
      expect(res.body.images).toEqual({ uploaded: 1, skipped: 0, failed: 0, skippedBy: { noProduct: 0, noCrop: 0, tooSmall: 0 } });
    });

    it("sends nothing for a new item (no Qore ID) or a line without a stored crop", async () => {
      ctx.repo.confirm.mockResolvedValueOnce({
        created: 2,
        restocked: 0,
        restored: 0,
        skipped: 0,
        alreadyDecided: 0,
        invalid: [],
        scanConfirmed: true,
        pendingFeedback: [
          { ...pending, outcome: "new_item", confirmedQid: null },
          { ...pending, detectionId: "d2", position: 1 },
        ],
      } as never);
      ctx.media.get.mockResolvedValueOnce(null);
      const res = await request(nest.getHttpServer()).post(confirmPath).set(auth).send({ decisions: [add] }).expect(200);
      expect(ctx.catalog.client.uploadImage).not.toHaveBeenCalled();
      expect(res.body.images).toEqual({ uploaded: 0, skipped: 2, failed: 0, skippedBy: { noProduct: 1, noCrop: 1, tooSmall: 0 } });
    });

    it("keeps a crop under 160 px out of Qore Catalog", async () => {
      ctx.media.get.mockResolvedValueOnce(await webp(120, 300));
      const res = await request(nest.getHttpServer()).post(confirmPath).set(auth).send({ decisions: [add] }).expect(200);
      expect(ctx.catalog.client.uploadImage).not.toHaveBeenCalled();
      expect(res.body.images).toEqual({ uploaded: 0, skipped: 1, failed: 0, skippedBy: { noProduct: 0, noCrop: 0, tooSmall: 1 } });
    });

    it("an upload failure is counted, not fatal, and logged with Qore Catalog's reason", async () => {
      const warn = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
      ctx.catalog.client.uploadImage.mockRejectedValueOnce(
        Object.assign(new Error(`Catalog POST /v1/images failed: 400 No feedback line ${SCAN}:0 for this key`), { status: 400 }),
      );
      const res = await request(nest.getHttpServer()).post(confirmPath).set(auth).send({ decisions: [add] }).expect(200);
      expect(res.body.images).toEqual({ uploaded: 0, skipped: 0, failed: 1, skippedBy: { noProduct: 0, noCrop: 0, tooSmall: 0 } });
      expect(warn).toHaveBeenCalledWith(`Crop ${SCAN}:0 rejected by Qore Catalog: Catalog POST /v1/images failed: 400 No feedback line ${SCAN}:0 for this key`);
      warn.mockRestore();
    });

    it("logs why each line sent nothing", async () => {
      const log = jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
      ctx.media.get.mockResolvedValueOnce(await webp(120, 300));
      await request(nest.getHttpServer()).post(confirmPath).set(auth).send({ decisions: [add] }).expect(200);
      expect(log).toHaveBeenCalledWith(`Crop ${SCAN}:0 not sent: crop 120×300 is under Qore Catalog's 160 px minimum`);
      expect(log).toHaveBeenCalledWith("Crops to Qore Catalog: 0 uploaded, 0 failed, 1 skipped (0 no product, 0 no crop, 1 too small)");
      log.mockRestore();
    });

    it("no pictures when feedback didn't go through", async () => {
      ctx.businesses.sendFeedback.mockResolvedValueOnce({ sent: 0, error: "Catalogue feedback not sent; inventory was saved" });
      await request(nest.getHttpServer()).post(confirmPath).set(auth).send({ decisions: [add] }).expect(200);
      expect(ctx.catalog.client.uploadImage).not.toHaveBeenCalled();
    });
  });

  it("a catalogue outage keeps the stock changes and leaves feedback pending", async () => {
    ctx.businesses.sendFeedback.mockResolvedValueOnce({ sent: 0, error: "Catalogue feedback not sent; inventory was saved" });
    const res = await request(nest.getHttpServer()).post(confirmPath).set(auth).send({ decisions: [add] }).expect(200);
    expect(res.body.feedback).toEqual({ sent: 0, error: "Catalogue feedback not sent; inventory was saved" });
    expect(ctx.repo.markFeedbackSent).not.toHaveBeenCalled();
  });

  it.each([
    ["no decisions", { decisions: [] }],
    ["unknown action", { decisions: [{ ...add, action: "sell" }] }],
    ["add without a name", { decisions: [{ ...add, name: undefined }] }],
    ["add with a float price", { decisions: [{ ...add, price: "4500.555" }] }],
    ["restock without an item", { decisions: [{ detectionId: DET, action: "restock", quantity: 2 }] }],
    ["restore without an item", { decisions: [{ detectionId: DET, action: "restore", quantity: 2 }] }],
    ["a fractional quantity", { decisions: [{ ...add, quantity: 1.5 }] }],
    ["a missing quantity", { decisions: [{ ...add, quantity: undefined }] }],
    ["a bad qid", { decisions: [{ ...add, qid: "QC-BAD" }] }],
    ["a non-uuid detection", { decisions: [{ ...add, detectionId: "d1" }] }],
  ])("confirm rejects %s before touching stock", async (_label, body) => {
    await request(nest.getHttpServer()).post(confirmPath).set(auth).send(body).expect(400);
    expect(ctx.repo.confirm).not.toHaveBeenCalled();
  });

  it("skip needs no quantity", async () => {
    await request(nest.getHttpServer())
      .post(confirmPath)
      .set(auth)
      .send({ decisions: [{ detectionId: DET, action: "skip" }] })
      .expect(200);
  });
});

describe("VisionController identify (HTTP)", () => {
  let nest: INestApplication;
  let ctx: Awaited<ReturnType<typeof app>>;
  // Own spy, created after the earlier describes restored theirs.
  let fetchSpy: ReturnType<typeof jest.spyOn<typeof global, "fetch">>;
  const identifyPath = `/api/businesses/${BIZ}/vision/identify`;
  const label = (brand: string, name: string, pack = "") => () => sparkLabel({ brand, name, pack });
  const sparkLabel = (l: Record<string, string>) =>
    new Response(JSON.stringify({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(l) }] }] }), {
      status: 200,
    });
  const items = [
    { id: "closeup", name: "Close-Up Toothpaste 130g", variantLabel: null, coreQid: "QC-CCCC-CCCC-C", price: "3000.00", quantityOnHand: "14.000" },
    { id: "ladyb", name: "Lady B Custard", variantLabel: null, coreQid: null, price: "6800.00", quantityOnHand: "3.000" },
  ];
  const catalogueCandidate = (qid: string, brand: number, size: number) => ({
    qid,
    name: `Product ${qid}`,
    variantLabel: null,
    size: null,
    packQty: 1,
    brand: { slug: "b", name: "B" },
    score: 0.88,
    signals: { text: 0.9, brand, size },
    price: { median: 3000, min: 2800, max: 3200 },
  });

  beforeAll(async () => {
    fetchSpy = jest.spyOn(global, "fetch");
    ctx = await app("LLM_000_not-a-real-key");
    nest = ctx.nest;
  });
  afterAll(async () => {
    await nest.close();
    fetchSpy.mockRestore();
  });
  beforeEach(() => {
    fetchSpy.mockReset();
    ctx.catalog.client.match.mockClear();
    ctx.businesses.listInventory.mockResolvedValue(items as never);
    ctx.repo.readings.mockResolvedValue([]);
  });

  const post = () => request(nest.getHttpServer()).post(identifyPath);

  it("needs a Supabase JWT", async () => {
    await post().attach("image", JPEG, "p.jpg").expect(401);
  });

  it("a remembered reading sells straight away with one model call and no catalogue call", async () => {
    ctx.repo.readings.mockResolvedValueOnce([{ itemId: "closeup", readingKey: "closeup|toothpaste|130g" }]);
    fetchSpy.mockImplementation(async () => label("Closeup", "Toothpaste", "130g")());
    const res = await post().set(auth).attach("image", JPEG, "p.jpg").expect(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchSpy.mock.calls[0]![1]?.body)).reasoning).toEqual({ effort: "minimal" });
    expect(ctx.catalog.client.match).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({
      reading: { brand: "Closeup", name: "Toothpaste", pack: "130g" },
      match: { itemId: "closeup", name: "Close-Up Toothpaste 130g", price: "3000.00", quantityOnHand: "14.000", inventoryMatch: "reading", needsConfirm: false },
      candidates: [],
    });
  });

  it("a hand-typed item matched by name asks first, without a catalogue call", async () => {
    fetchSpy.mockImplementation(async () => label("Lady B", "Custard")());
    const res = await post().set(auth).attach("image", JPEG, "p.jpg").expect(200);
    expect(ctx.catalog.client.match).not.toHaveBeenCalled();
    expect(res.body.match).toMatchObject({ itemId: "ladyb", inventoryMatch: "name", needsConfirm: true });
  });

  it("otherwise asks the catalogue; a stocked product with brand and size agreeing is sure", async () => {
    fetchSpy.mockImplementation(async () => label("Close-Up", "Red Hot", "130g")());
    ctx.catalog.client.match.mockResolvedValueOnce({
      items: [{ ref: "0", query: {}, parsedPack: null, candidates: [catalogueCandidate("QC-CCCC-CCCC-C", 1, 1)] }],
    } as never);
    const res = await post().set(auth).attach("image", JPEG, "p.jpg").expect(200);
    expect(ctx.catalog.client.match).toHaveBeenCalledWith({ items: [{ ref: "0", brand: "Close-Up", name: "Red Hot", pack: "130g" }], limit: 10 });
    expect(res.body.match).toMatchObject({ itemId: "closeup", inventoryMatch: "catalogue", needsConfirm: false });
  });

  it("not in store: no match, catalogue suggestions to add", async () => {
    fetchSpy.mockImplementation(async () => label("Pepsodent", "Toothpaste")());
    ctx.catalog.client.match.mockResolvedValueOnce({
      items: [{ ref: "0", query: {}, parsedPack: null, candidates: [catalogueCandidate("QC-PPPP-PPPP-P", 1, 0.5), catalogueCandidate("QC-XXXX-XXXX-X", 0, 0.5)] }],
    } as never);
    const res = await post().set(auth).attach("image", JPEG, "p.jpg").expect(200);
    expect(res.body.match).toBeNull();
    // The other-brand candidate is dropped as implausible.
    expect(res.body.candidates.map((c: { qid: string }) => c.qid)).toEqual(["QC-PPPP-PPPP-P"]);
  });

  it("an illegible label returns no match and skips the catalogue", async () => {
    fetchSpy.mockImplementation(async () => label("", "")());
    const res = await post().set(auth).attach("image", JPEG, "p.jpg").expect(200);
    expect(res.body).toMatchObject({ reading: null, match: null, candidates: [] });
    expect(ctx.catalog.client.match).not.toHaveBeenCalled();
  });

  it("checks membership before the model, and rejects bad or oversized images", async () => {
    ctx.businesses.listInventory.mockRejectedValueOnce(new ForbiddenException("Not a member of this business"));
    await post().set(auth).attach("image", JPEG, "p.jpg").expect(403);
    await post().set(auth).attach("image", Buffer.from("<svg/>"), "p.jpg").expect(400);
    await post().set(auth).attach("image", Buffer.alloc(MAX_IDENTIFY_IMAGE_BYTES + 1, 0xff), "p.jpg").expect(413);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("maps a model timeout to 504", async () => {
    fetchSpy.mockRejectedValueOnce(new DOMException("timed out", "TimeoutError"));
    await post().set(auth).attach("image", JPEG, "p.jpg").expect(504);
  });

  describe("confirm", () => {
    const ITEM = "00000000-0000-4000-8000-0000000000e1";
    const confirmPath = `${identifyPath}/confirm`;

    it("remembers the reading for the confirmed item", async () => {
      const res = await request(nest.getHttpServer())
        .post(confirmPath)
        .set(auth)
        .send({ reading: { brand: "Closeup", name: "Toothpaste", pack: "130g" }, itemId: ITEM })
        .expect(200);
      expect(ctx.businesses.getForMember).toHaveBeenCalledWith(BIZ, USER);
      expect(ctx.repo.rememberReading).toHaveBeenCalledWith(BIZ, ITEM, "closeup|toothpaste|130g");
      expect(res.body).toEqual({ itemId: ITEM, readingKey: "closeup|toothpaste|130g" });
    });

    it("404 when the item isn't an active item of this business", async () => {
      ctx.repo.rememberReading.mockResolvedValueOnce(false);
      await request(nest.getHttpServer())
        .post(confirmPath)
        .set(auth)
        .send({ reading: { brand: "Closeup", name: "Toothpaste", pack: "" }, itemId: ITEM })
        .expect(404);
    });

    it("doesn't remember a reading without a brand: too vague", async () => {
      ctx.repo.rememberReading.mockClear();
      const res = await request(nest.getHttpServer())
        .post(confirmPath)
        .set(auth)
        .send({ reading: { brand: "", name: "Cooking Oil", pack: "" }, itemId: ITEM })
        .expect(200);
      expect(ctx.repo.rememberReading).not.toHaveBeenCalled();
      expect(res.body).toEqual({ itemId: ITEM, readingKey: null });
    });

    it("404 for an unbranded reading when the item isn't an active item of this business", async () => {
      ctx.repo.isActiveItem.mockResolvedValueOnce(false);
      await request(nest.getHttpServer())
        .post(confirmPath)
        .set(auth)
        .send({ reading: { brand: "", name: "Toothpaste", pack: "" }, itemId: ITEM })
        .expect(404);
    });

    it.each([
      ["no reading", { itemId: ITEM }],
      ["empty name", { reading: { brand: "x", name: "", pack: "" }, itemId: ITEM }],
      ["bad item id", { reading: { brand: "", name: "x", pack: "" }, itemId: "x" }],
    ])("rejects %s", async (_label, body) => {
      ctx.repo.rememberReading.mockClear();
      await request(nest.getHttpServer()).post(confirmPath).set(auth).send(body).expect(400);
      expect(ctx.repo.rememberReading).not.toHaveBeenCalled();
    });
  });
});

describe("VisionController stock-takes (HTTP)", () => {
  let nest: INestApplication;
  let ctx: Awaited<ReturnType<typeof app>>;
  let fetchSpy: ReturnType<typeof jest.spyOn<typeof global, "fetch">>;
  const startPath = `/api/businesses/${BIZ}/vision/stocktakes`;
  const RUN = "00000000-0000-4000-8000-0000000000f1";
  const reply = (body: Record<string, unknown>) => new Response(JSON.stringify({ status: "completed", ...body }), { status: 200 });
  const text = (s: string) => ({ output: [{ type: "message", content: [{ type: "output_text", text: s }] }] });

  beforeAll(async () => {
    fetchSpy = jest.spyOn(global, "fetch");
    ctx = await app("LLM_000_not-a-real-key");
    nest = ctx.nest;
  });
  afterAll(async () => {
    await nest.close();
    fetchSpy.mockRestore();
  });
  beforeEach(() => {
    fetchSpy.mockReset();
    ctx.repo.createRun.mockClear();
    ctx.repo.finishRun.mockClear();
    ctx.repo.addStep.mockClear();
    ctx.repo.saveScan.mockClear();
    ctx.businesses.listInventory.mockResolvedValue([] as never);
  });

  /** The Meta API, routed by request: the agent turn (has tools), SAM, or the shelf read. */
  const metaRoutes = (agentTurns: Record<string, unknown>[]) =>
    fetchSpy.mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      if (body.tools) return reply({ id: `resp_${agentTurns.length}`, ...agentTurns.shift() });
      if (body.model === "sam-3.1") return reply(text(""));
      return reply(text(JSON.stringify({ products: [peak] })));
    });

  const waitForFinish = async () => {
    for (let i = 0; i < 100 && ctx.repo.finishRun.mock.calls.length === 0; i++) await new Promise((r) => setTimeout(r, 10));
    return ctx.repo.finishRun.mock.calls[0]?.[1];
  };

  it.each([
    ["post", startPath],
    ["get", `${startPath}/${RUN}`],
  ] as const)("%s %s needs a Supabase JWT", async (method, p) => {
    await request(nest.getHttpServer())[method](p).expect(401);
  });

  it("starts in the background (202) and finishes as a stored scan after the agent submits", async () => {
    metaRoutes([
      {
        output: [
          { type: "message", content: [{ type: "output_text", text: "Recording the one line." }] },
          { type: "function_call", call_id: "c1", name: "record_line", arguments: '{"line":0,"brand":"Peak","name":"Full Cream Milk Powder","pack":"400g","qid":"QC-A"}' },
          { type: "function_call", call_id: "c2", name: "submit_stocktake", arguments: "{}" },
        ],
      },
    ]);
    const res = await request(nest.getHttpServer()).post(startPath).set(auth).attach("image", JPEG, "shelf.jpg").expect(202);
    expect(res.body).toEqual({ runId: "run-1", status: "running" });
    expect(ctx.repo.createRun).toHaveBeenCalledWith(BIZ, USER, "muse-spark-1.3");

    expect(await waitForFinish()).toMatchObject({ status: "done", scanId: "scan-1", turns: 1, error: null });
    const [, saved] = ctx.repo.saveScan.mock.calls[0] as unknown as [unknown, { evidence?: { tool: string }[] }[]];
    expect(saved[0]!.evidence?.map((e) => e.tool)).toEqual(["record_line"]);
    // Saved for reopening: the recorded line needs no review, and each candidate keeps its match strength.
    expect(saved[0]).toMatchObject({ review: null, candidates: [{ qid: "QC-A", match: "medium" }] });
    const kinds = ctx.repo.addStep.mock.calls.map(([, , s]) => (s as { kind: string; tool?: string }).tool ?? (s as { kind: string }).kind);
    expect(kinds).toEqual(["baseline", "thought", "record_line", "submit_stocktake"]);
  });

  it("falls back to the quick scan when the agent fails", async () => {
    fetchSpy.mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      if (body.tools) return new Response(JSON.stringify({ error: { message: "boom" } }), { status: 500 });
      if (body.model === "sam-3.1") return reply(text(""));
      return reply(text(JSON.stringify({ products: [peak] })));
    });
    await request(nest.getHttpServer()).post(startPath).set(auth).attach("image", JPEG, "shelf.jpg").expect(202);
    expect(await waitForFinish()).toMatchObject({ status: "fallback", scanId: "scan-1" });
    expect(ctx.repo.saveScan).toHaveBeenCalledTimes(1);
  });

  it("records a failed run when the first pass fails", async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ error: { message: "down" } }), { status: 503 }));
    await request(nest.getHttpServer()).post(startPath).set(auth).attach("image", JPEG, "shelf.jpg").expect(202);
    expect(await waitForFinish()).toMatchObject({ status: "failed" });
    expect(ctx.repo.saveScan).not.toHaveBeenCalled();
  });

  describe("deadlines: every run ends", () => {
    const saved = { ...STOCKTAKE_DEADLINES };
    afterEach(() => Object.assign(STOCKTAKE_DEADLINES, saved));
    /** A call that never answers (ignores its abort signal), like a hung pooler connection. */
    const never = () => new Promise<Response>(() => undefined);

    it("a first pass that never finishes ends the run failed with the reason", async () => {
      Object.assign(STOCKTAKE_DEADLINES, { firstPassMs: 50 });
      fetchSpy.mockImplementation(never);
      await request(nest.getHttpServer()).post(startPath).set(auth).attach("image", JPEG, "shelf.jpg").expect(202);
      expect(await waitForFinish()).toMatchObject({ status: "failed", error: "First pass failed: First pass took longer than 0.05 s" });
      expect(ctx.repo.saveScan).not.toHaveBeenCalled();
    });

    it("store reads that never return (a saturated pool) fail the run fast, before any paid model call", async () => {
      Object.assign(STOCKTAKE_DEADLINES, { dbReadMs: 50 });
      ctx.businesses.listInventory.mockImplementationOnce(() => new Promise(() => undefined) as never);
      await request(nest.getHttpServer()).post(startPath).set(auth).attach("image", JPEG, "shelf.jpg").expect(202);
      expect(await waitForFinish()).toMatchObject({ status: "failed", error: "First pass failed: Database busy, retry shortly" });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("an agent that never finishes falls back to the first pass at the run deadline", async () => {
      Object.assign(STOCKTAKE_DEADLINES, { runMs: 300 });
      fetchSpy.mockImplementation(async (_url, init) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        if (body.tools) return never();
        if (body.model === "sam-3.1") return reply(text(""));
        return reply(text(JSON.stringify({ products: [peak] })));
      });
      await request(nest.getHttpServer()).post(startPath).set(auth).attach("image", JPEG, "shelf.jpg").expect(202);
      expect(await waitForFinish()).toMatchObject({ status: "fallback", scanId: "scan-1", error: "Agent stopped: Run deadline reached" });
    });

    it("a status write that fails is retried", async () => {
      metaRoutes([{ output: [{ type: "function_call", call_id: "c", name: "submit_stocktake", arguments: "{}" }] }]);
      ctx.repo.finishRun.mockRejectedValueOnce(new Error("connection reset"));
      await request(nest.getHttpServer()).post(startPath).set(auth).attach("image", JPEG, "shelf.jpg").expect(202);
      for (let i = 0; i < 300 && ctx.repo.finishRun.mock.calls.length < 2; i++) await new Promise((r) => setTimeout(r, 10));
      expect(ctx.repo.finishRun.mock.calls.map(([, e]) => e.status)).toEqual(["done", "done"]);
    });

    it("a run still running past the deadline is reported failed when read", async () => {
      const old = new Date(Date.now() - STOCKTAKE_DEADLINES.runMs - 120_000).toISOString();
      ctx.repo.getRun
        .mockResolvedValueOnce({ id: RUN, status: "running", startedAt: old, scanId: null, steps: [] } as never)
        .mockResolvedValueOnce({ id: RUN, status: "failed", startedAt: old, scanId: null, error: "Interrupted: the API restarted during the run", steps: [] } as never);
      ctx.repo.failStaleRuns.mockClear();
      const res = await request(nest.getHttpServer()).get(`${startPath}/${RUN}`).set(auth).expect(200);
      expect(ctx.repo.failStaleRuns).toHaveBeenCalledTimes(1);
      expect(res.body.run).toMatchObject({ status: "failed" });
    });
  });

  it("checks membership and the image before starting anything", async () => {
    ctx.businesses.getForMember.mockRejectedValueOnce(new ForbiddenException("Not a member of this business"));
    await request(nest.getHttpServer()).post(startPath).set(auth).attach("image", JPEG, "shelf.jpg").expect(403);
    await request(nest.getHttpServer()).post(startPath).set(auth).attach("image", Buffer.from("<svg/>"), "s.jpg").expect(400);
    expect(ctx.repo.createRun).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("get returns the run, its trace and (when stored) the scan", async () => {
    ctx.repo.getRun.mockResolvedValueOnce({
      id: RUN,
      status: "done",
      scanId: "scan-9",
      steps: [{ turn: 1, kind: "tool", tool: "zoom", summary: "zoomed 1,2,3,4", ms: 900, createdAt: "2026-10-29T10:00:00Z", args: { line: 0 } }],
    });
    const res = await request(nest.getHttpServer()).get(`${startPath}/${RUN}`).set(auth).expect(200);
    expect(ctx.repo.getScan).toHaveBeenCalledWith(BIZ, "scan-9");
    expect(res.body.run).toMatchObject({ id: RUN, status: "done", scanId: "scan-9" });
    expect(res.body.steps).toEqual([{ turn: 1, kind: "tool", tool: "zoom", summary: "zoomed 1,2,3,4", ms: 900, at: "2026-10-29T10:00:00Z" }]);
    expect(res.body.result).toMatchObject({ scanId: SCAN, status: "open", detections: [{ id: DET }, { review: "Agent couldn't confirm: label unreadable" }] });
  });
});

describe("VisionController stock-take history (HTTP)", () => {
  let nest: INestApplication;
  let ctx: Awaited<ReturnType<typeof app>>;
  const historyPath = `/api/businesses/${BIZ}/vision/stocktakes`;
  const at = (min: number) => new Date(Date.UTC(2026, 9, 29, 9, min));

  beforeAll(async () => {
    ctx = await app("LLM_000_not-a-real-key");
    nest = ctx.nest;
  });
  afterAll(() => nest.close());
  beforeEach(() => {
    ctx.repo.history.mockClear();
    ctx.repo.failStaleRuns.mockClear();
    ctx.businesses.getForMember.mockClear();
  });

  it("needs a Supabase JWT", async () => {
    await request(nest.getHttpServer()).get(historyPath).expect(401);
  });

  it("checks membership before reading anything", async () => {
    ctx.businesses.getForMember.mockRejectedValueOnce(new ForbiddenException("Not a member of this business"));
    await request(nest.getHttpServer()).get(historyPath).set(auth).expect(403);
    expect(ctx.repo.history).not.toHaveBeenCalled();
  });

  it("validates limit (1–100, default 30)", async () => {
    await request(nest.getHttpServer()).get(`${historyPath}?limit=0`).set(auth).expect(400);
    await request(nest.getHttpServer()).get(`${historyPath}?limit=101`).set(auth).expect(400);
    await request(nest.getHttpServer()).get(`${historyPath}?limit=abc`).set(auth).expect(400);
    await request(nest.getHttpServer()).get(historyPath).set(auth).expect(200);
    expect(ctx.repo.history).toHaveBeenLastCalledWith(BIZ, 30);
    await request(nest.getHttpServer()).get(`${historyPath}?limit=5`).set(auth).expect(200);
    expect(ctx.repo.history).toHaveBeenLastCalledWith(BIZ, 5);
  });

  // The preview dedupes names ignoring case and skips blank readings.
  it("merges runs and quick scans newest first, with status, counts and a preview", async () => {
    ctx.repo.history.mockResolvedValueOnce({
      runs: [
        { runId: "run-running", runStatus: "running", error: null, startedAt: at(50), scanId: null, scanStatus: null, confirmedAt: null },
        { runId: "run-open", runStatus: "fallback", error: null, startedAt: at(30), scanId: "scan-open", scanStatus: "open", confirmedAt: null },
        { runId: "run-failed", runStatus: "failed", error: "First pass failed: busy", startedAt: at(10), scanId: null, scanStatus: null, confirmedAt: null },
      ],
      quick: [{ scanId: "scan-quick", scanStatus: "confirmed", startedAt: at(40), confirmedAt: at(45) }],
      counts: [
        { scanId: "scan-open", lines: 5, add: 0, restock: 0, restore: 0, skip: 0, names: ["Peak", "peak", "", "Milo", "Indomie", "Dettol"] },
        { scanId: "scan-quick", lines: 4, add: 1, restock: 2, restore: 0, skip: 1, names: ["Cooking Oil"] },
      ],
    });
    const res = await request(nest.getHttpServer()).get(`${historyPath}?limit=3`).set(auth).expect(200);
    // Stale runs are marked failed first, so nothing shows "running" forever.
    expect(ctx.repo.failStaleRuns).toHaveBeenCalled();
    expect(res.body).toEqual([
      { id: "run-running", kind: "stocktake", runId: "run-running", scanId: null, status: "running", fallback: false, startedAt: at(50).toISOString(), confirmedAt: null, error: null, lines: null, decided: { add: 0, restock: 0, restore: 0, skip: 0 }, preview: [] },
      { id: "scan-quick", kind: "quick", runId: null, scanId: "scan-quick", status: "confirmed", fallback: false, startedAt: at(40).toISOString(), confirmedAt: at(45).toISOString(), error: null, lines: 4, decided: { add: 1, restock: 2, restore: 0, skip: 1 }, preview: ["Cooking Oil"] },
      { id: "run-open", kind: "stocktake", runId: "run-open", scanId: "scan-open", status: "review", fallback: true, startedAt: at(30).toISOString(), confirmedAt: null, error: null, lines: 5, decided: { add: 0, restock: 0, restore: 0, skip: 0 }, preview: ["Peak", "Milo", "Indomie"] },
    ]);
  });

  it("a failed run keeps its reason", async () => {
    ctx.repo.history.mockResolvedValueOnce({
      runs: [{ runId: "run-failed", runStatus: "failed", error: "First pass failed: busy", startedAt: at(10), scanId: null, scanStatus: null, confirmedAt: null }],
      quick: [],
      counts: [],
    });
    const res = await request(nest.getHttpServer()).get(historyPath).set(auth).expect(200);
    expect(res.body).toMatchObject([{ status: "failed", error: "First pass failed: busy", lines: null }]);
  });

  it("empty history is an empty list", async () => {
    const res = await request(nest.getHttpServer()).get(historyPath).set(auth).expect(200);
    expect(res.body).toEqual([]);
  });
});
