import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { ForbiddenException, INestApplication, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import * as jwt from "jsonwebtoken";
import request from "supertest";
import { SupabaseJwtGuard } from "../../common/guards/supabase-jwt.guard";
import { BusinessesService } from "../businesses/businesses.service";
import { CatalogService } from "../catalog/catalog.service";
import { MAX_SHELF_IMAGE_BYTES, VisionController } from "./vision.controller";
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
const peak = { brand: "Peak", name: "Full Cream Milk Powder", pack: "400g", boxes: [{ x_min: 1, y_min: 1, x_max: 9, y_max: 9 }], confidence: "high" };

async function app(apiKey: string | undefined) {
  const businesses = { listInventory: jest.fn(async () => [{ id: "item-a", coreQid: "QC-A" }]) };
  const catalog = {
    client: {
      match: jest.fn(async () => ({
        items: [{ ref: "0", query: {}, parsedPack: null, candidates: [{ qid: "QC-A", name: "Peak 400g", variantLabel: null, size: null, packQty: 1, brand: null, score: 0.9, price: null }] }],
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
      { provide: ConfigService, useValue: { get: (k: string) => config[k], getOrThrow: (k: string) => config[k] } },
      { provide: APP_GUARD, useClass: SupabaseJwtGuard },
    ],
  }).compile();
  const nest = moduleRef.createNestApplication({ logger: false });
  nest.setGlobalPrefix("api");
  nest.useGlobalPipes(new ValidationPipe({ transform: true }));
  await nest.init();
  return { nest, businesses, catalog };
}

describe("VisionController shelf-scans (HTTP)", () => {
  let nest: INestApplication;
  let businesses: Awaited<ReturnType<typeof app>>["businesses"];
  let catalog: Awaited<ReturnType<typeof app>>["catalog"];
  const fetchSpy = jest.spyOn(global, "fetch");

  beforeAll(async () => {
    ({ nest, businesses, catalog } = await app("LLM_000_not-a-real-key"));
  });
  afterAll(async () => {
    await nest.close();
    fetchSpy.mockRestore();
  });
  beforeEach(() => {
    fetchSpy.mockReset();
    businesses.listInventory.mockClear();
    catalog.client.match.mockClear();
  });

  const post = () => request(nest.getHttpServer()).post(path);

  it("needs a Supabase JWT", async () => {
    await post().attach("image", JPEG, "shelf.jpg").expect(401);
  });

  it("reads, matches and flags stocked products", async () => {
    fetchSpy.mockResolvedValueOnce(sparkReply([peak]));
    const res = await post().set(auth).attach("image", JPEG, "shelf.jpg").expect(200);

    expect(businesses.listInventory).toHaveBeenCalledWith(BIZ, USER);
    expect(catalog.client.match).toHaveBeenCalledWith({ items: [{ ref: "0", brand: "Peak", name: "Full Cream Milk Powder", pack: "400g" }], limit: 3 });
    expect(res.body).toMatchObject({
      model: "muse-spark-1.3",
      catalogueAvailable: true,
      detections: [{ name: "Full Cream Milk Powder", count: 1, inventoryItemId: "item-a", candidates: [{ qid: "QC-A", inventoryItemId: "item-a" }] }],
    });
    expect(res.body.timings).toEqual({ readMs: expect.any(Number), matchMs: expect.any(Number), totalMs: expect.any(Number) });
  });

  it("an empty shelf skips the catalogue", async () => {
    fetchSpy.mockResolvedValueOnce(sparkReply([]));
    const res = await post().set(auth).attach("image", JPEG, "shelf.jpg").expect(200);
    expect(res.body.detections).toEqual([]);
    expect(catalog.client.match).not.toHaveBeenCalled();
  });

  it("a catalogue failure still returns the detections", async () => {
    fetchSpy.mockResolvedValueOnce(sparkReply([peak]));
    catalog.client.match.mockRejectedValueOnce(Object.assign(new Error("down"), { status: 503 }));
    const res = await post().set(auth).attach("image", JPEG, "shelf.jpg").expect(200);
    expect(res.body).toMatchObject({ catalogueAvailable: false, detections: [{ candidates: [], inventoryItemId: null }] });
  });

  it("checks membership before calling the model", async () => {
    businesses.listInventory.mockRejectedValueOnce(new ForbiddenException("Not a member of this business"));
    await post().set(auth).attach("image", JPEG, "shelf.jpg").expect(403);
    expect(fetchSpy).not.toHaveBeenCalled();
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
