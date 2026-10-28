import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { ForbiddenException, INestApplication, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import * as jwt from "jsonwebtoken";
import { createHash } from "node:crypto";
import request from "supertest";
import { SupabaseJwtGuard } from "../../common/guards/supabase-jwt.guard";
import { BusinessesService } from "../businesses/businesses.service";
import { CatalogService } from "../catalog/catalog.service";
import { MAX_SHELF_IMAGE_BYTES, VisionController } from "./vision.controller";
import { VisionRepository } from "./vision.repository";
import { VisionService } from "./vision.service";

// Real guard, controller and service; the business lookup, the catalogue and
// the Meta Model API (global fetch) are mocked. Live behaviour is checked with
// scripts/vision-smoke.mjs.
const SECRET = "test-jwt-secret-not-real";
const USER = "00000000-0000-4000-8000-0000000000aa";
const BIZ = "00000000-0000-4000-8000-000000000001";
const token = jwt.sign({ sub: USER, role: "authenticated", aud: "authenticated" }, SECRET, { algorithm: "HS256", expiresIn: 60 });
const auth = { Authorization: `Bearer ${token}` };
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);
const path = `/api/businesses/${BIZ}/vision/shelf-scans`;

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
  const businesses = { listInventory: jest.fn(async () => [{ id: "item-a", name: "Peak 400g", variantLabel: null, coreQid: "QC-A" }]) };
  const repo = {
    readings: jest.fn(async () => [] as { itemId: string; readingKey: string }[]),
    saveScan: jest.fn(async () => "scan-1"),
    archivedLinkedItems: jest.fn(async () => [] as { id: string; name: string; variantLabel: string | null; coreQid: string | null }[]),
  };
  const catalog = {
    client: {
      match: jest.fn(async () => ({
        items: [{ ref: "0", query: {}, parsedPack: null, candidates: [{ qid: "QC-A", name: "Peak 400g", variantLabel: null, size: null, packQty: 1, brand: null, score: 0.9, signals: { text: 1, brand: 1, size: 0.5 }, price: null }] }],
      })),
    },
  };
  const config: Record<string, unknown> = { "supabase.jwtSecret": SECRET, "meta.apiKey": apiKey, "meta.baseUrl": "https://api.meta.ai/v1" };
  const moduleRef = await Test.createTestingModule({
    controllers: [VisionController],
    providers: [
      VisionService,
      { provide: BusinessesService, useValue: businesses },
      { provide: CatalogService, useValue: catalog },
      { provide: VisionRepository, useValue: repo },
      { provide: ConfigService, useValue: { get: (k: string) => config[k], getOrThrow: (k: string) => config[k] } },
      { provide: APP_GUARD, useClass: SupabaseJwtGuard },
    ],
  }).compile();
  const nest = moduleRef.createNestApplication({ logger: false });
  nest.setGlobalPrefix("api");
  nest.useGlobalPipes(new ValidationPipe({ transform: true }));
  await nest.init();
  return { nest, businesses, catalog, repo };
}

describe("VisionController shelf-scans (HTTP)", () => {
  let nest: INestApplication;
  let businesses: Awaited<ReturnType<typeof app>>["businesses"];
  let catalog: Awaited<ReturnType<typeof app>>["catalog"];
  let repo: Awaited<ReturnType<typeof app>>["repo"];
  const fetchSpy = jest.spyOn(global, "fetch");

  beforeAll(async () => {
    ({ nest, businesses, catalog, repo } = await app("LLM_000_not-a-real-key"));
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
