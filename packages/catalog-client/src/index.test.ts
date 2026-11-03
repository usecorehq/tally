import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CatalogClient, CatalogError, catalogClient, type FeedbackItem, type MatchItem } from "./index";

const BASE = "https://catalog.test/";
const KEY = "test-key-not-real";

type Call = { url: string; init: RequestInit & { headers: Headers } };

let calls: Call[];
let nextResponse: () => Response;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

beforeEach(() => {
  calls = [];
  nextResponse = () => json({});
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: Call["init"]) => {
      calls.push({ url, init });
      return nextResponse();
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const last = () => calls[calls.length - 1]!;

describe("requests", () => {
  const client = new CatalogClient(BASE, KEY);

  const getCases: [string, () => Promise<unknown>, string][] = [
    ["searchProducts", () => client.searchProducts({ q: "peak milk", limit: 5, offset: 10 }), "/v1/products?q=peak+milk&limit=5&offset=10"],
    ["searchProducts (no params)", () => client.searchProducts(), "/v1/products"],
    ["getProduct", () => client.getProduct("QC-0A1B-2C3D-4"), "/v1/products/QC-0A1B-2C3D-4"],
    ["businessTaxonomy", () => client.businessTaxonomy(), "/v1/business-taxonomy"],
    ["subtypeTemplates", () => client.subtypeTemplates("supermarket", 2), "/v1/business-taxonomy/subtypes/supermarket/templates?suggestions=2"],
    ["subtypeTemplates (no suggestions)", () => client.subtypeTemplates("supermarket"), "/v1/business-taxonomy/subtypes/supermarket/templates"],
    ["brands", () => client.brands({ q: "peak" }), "/v1/brands?q=peak"],
    ["categories", () => client.categories(), "/v1/categories"],
    ["feedbackStats", () => client.feedbackStats("2026-10-01"), "/v1/feedback/stats?since=2026-10-01"],
    ["feedbackStats (no since)", () => client.feedbackStats(), "/v1/feedback/stats"],
    ["whoAmI", () => client.whoAmI(), "/v1/keys/me"],
  ];

  it.each(getCases)("%s → GET %s with x-api-key", async (_name, call, path) => {
    await call();
    expect(last().url).toBe(`https://catalog.test${path}`);
    expect(last().init.method).toBe("GET");
    expect(last().init.headers.get("x-api-key")).toBe(KEY);
    expect(last().init.body).toBeUndefined();
    expect(last().init.headers.has("content-type")).toBe(false);
  });

  it("health → GET /v1/health without the key, no-store", async () => {
    nextResponse = () => json({ status: "ok", db: "up" });
    await expect(client.health()).resolves.toEqual({ status: "ok", db: "up" });
    expect(last().url).toBe("https://catalog.test/v1/health");
    expect(last().init.headers.has("x-api-key")).toBe(false);
    expect(last().init.cache).toBe("no-store");
  });

  it("match → POST /v1/match with a JSON body", async () => {
    const items: MatchItem[] = [{ ref: "a", brand: "Peak", name: "Full Cream Milk Powder", pack: "400g" }];
    await client.match({ items, limit: 3 });
    expect(last().url).toBe("https://catalog.test/v1/match");
    expect(last().init.method).toBe("POST");
    expect(last().init.headers.get("content-type")).toBe("application/json");
    expect(last().init.headers.get("x-api-key")).toBe(KEY);
    expect(JSON.parse(last().init.body as string)).toEqual({ items, limit: 3 });
  });

  it("sendFeedback → POST /v1/feedback with { items }", async () => {
    const items: FeedbackItem[] = [
      { clientRef: "c1", businessRef: "b1", input: { name: "Peak 400g" }, suggestedQid: "QC-0A1B-2C3D-4", outcome: "accepted" },
    ];
    await client.sendFeedback(items);
    expect(last().url).toBe("https://catalog.test/v1/feedback");
    expect(last().init.method).toBe("POST");
    expect(last().init.headers.get("content-type")).toBe("application/json");
    expect(JSON.parse(last().init.body as string)).toEqual({ items });
  });

  it("encodes path segments", async () => {
    await client.subtypeTemplates("a/b c");
    expect(last().url).toBe("https://catalog.test/v1/business-taxonomy/subtypes/a%2Fb%20c/templates");
  });

  it("omits x-api-key when no key is given", async () => {
    await new CatalogClient(BASE).whoAmI();
    expect(last().init.headers.has("x-api-key")).toBe(false);
  });

  it("passes init through (Next cache options, extra headers)", async () => {
    await client.categories({ cache: "force-cache", headers: { "x-request-id": "r1" } } as RequestInit);
    expect(last().init.cache).toBe("force-cache");
    expect(last().init.headers.get("x-request-id")).toBe("r1");
    expect(last().init.headers.get("x-api-key")).toBe(KEY);
  });

  it("sets a timeout signal on every request", async () => {
    await client.categories();
    expect(last().init.signal).toBeInstanceOf(AbortSignal);
  });

  it("uses 20s for templates with suggestions, 10s otherwise", async () => {
    const spy = vi.spyOn(AbortSignal, "timeout");
    await client.subtypeTemplates("supermarket", 2);
    await client.subtypeTemplates("supermarket", 0);
    await client.categories();
    expect(spy.mock.calls.map((c) => c[0])).toEqual([20_000, 10_000, 10_000]);
    spy.mockRestore();
  });

  it("catalogClient() keeps the factory signature", async () => {
    await catalogClient(BASE, KEY).whoAmI();
    expect(last().url).toBe("https://catalog.test/v1/keys/me");
    expect(last().init.headers.get("x-api-key")).toBe(KEY);
  });
});

describe("errors", () => {
  const client = new CatalogClient(BASE, KEY);

  it("throws CatalogError with status, path and parsed body on non-2xx", async () => {
    const body = { statusCode: 404, path: "/v1/products/QC-0A1B-2C3D-4", timestamp: "t", message: "Product not found" };
    nextResponse = () => json(body, 404);
    const err = await client.getProduct("QC-0A1B-2C3D-4").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CatalogError);
    expect(err).toMatchObject({ status: 404, path: "/v1/products/QC-0A1B-2C3D-4", body });
    expect((err as Error).message).toContain("404");
    expect((err as Error).message).toContain("Product not found");
  });

  it("keeps validation issues on the body", async () => {
    const body = { statusCode: 400, path: "/v1/match", timestamp: "t", message: "Validation failed", issues: [{ path: "items.0.name", message: "Required" }] };
    nextResponse = () => json(body, 400);
    const err = (await client.match({ items: [{ name: "" }] }).catch((e: unknown) => e)) as CatalogError;
    expect(err.status).toBe(400);
    expect(err.body).toEqual(body);
  });

  it("keeps a non-JSON body as text", async () => {
    nextResponse = () => new Response("Bad Gateway", { status: 502 });
    const err = (await client.categories().catch((e: unknown) => e)) as CatalogError;
    expect(err.status).toBe(502);
    expect(err.body).toBe("Bad Gateway");
  });

  it.each([401, 403, 429])("never puts the key in the message (%i)", async (status) => {
    nextResponse = () => json({ statusCode: status, path: "/v1/keys/me", timestamp: "t", message: `bad key ${KEY}` }, status);
    const err = (await client.whoAmI().catch((e: unknown) => e)) as CatalogError;
    expect(err.status).toBe(status);
    expect(err.message).not.toContain(KEY);
    expect(String(err.stack)).not.toContain(KEY);
  });
});

describe("guards (no request sent)", () => {
  const client = new CatalogClient(BASE, KEY);
  const fetchMock = () => globalThis.fetch as unknown as ReturnType<typeof vi.fn>;

  it("rejects 51 match items", async () => {
    const items = Array.from({ length: 51 }, (_, i) => ({ name: `item ${i}` }));
    await expect(client.match({ items })).rejects.toMatchObject({ name: "CatalogError", status: 400 });
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("rejects 0 match items", async () => {
    await expect(client.match({ items: [] })).rejects.toBeInstanceOf(CatalogError);
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("accepts 50 match items", async () => {
    await client.match({ items: Array.from({ length: 50 }, (_, i) => ({ name: `item ${i}` })) });
    expect(fetchMock()).toHaveBeenCalledOnce();
  });

  it("rejects 101 feedback items", async () => {
    const items: FeedbackItem[] = Array.from({ length: 101 }, (_, i) => ({
      clientRef: `c${i}`,
      businessRef: "b1",
      input: { name: "x" },
      outcome: "new_item",
      confirmedName: "x",
    }));
    await expect(client.sendFeedback(items)).rejects.toMatchObject({ status: 400 });
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("rejects 0 feedback items", async () => {
    await expect(client.sendFeedback([])).rejects.toBeInstanceOf(CatalogError);
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it.each(["QC-0A1B-2C3D", "qc-0a1b-2c3d-4", "QC-0I1B-2C3D-4", "QC-0A1B-2C3D-U", "../keys/me"])(
    "rejects bad qid %s",
    async (qid) => {
      await expect(client.getProduct(qid)).rejects.toMatchObject({ status: 400 });
      expect(fetchMock()).not.toHaveBeenCalled();
    },
  );
});

describe("uploadImage", () => {
  const client = new CatalogClient(BASE, KEY);
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

  it("POSTs multipart /v1/images with the key and lets fetch set the boundary", async () => {
    nextResponse = () => json({ sha256: "ab".repeat(32), qid: "QC-0A1B-2C3D-4", view: "on_shelf", status: "pending", width: 200, height: 300 });
    const res = await client.uploadImage({ file: jpeg, filename: "crop.webp", qid: "QC-0A1B-2C3D-4", view: "on_shelf", feedbackClientRef: "scan:0" });
    expect(res.status).toBe("pending");
    expect(last().url).toBe("https://catalog.test/v1/images");
    expect(last().init.method).toBe("POST");
    expect(last().init.headers.get("x-api-key")).toBe(KEY);
    expect(last().init.headers.get("content-type")).toBeNull();
    const form = last().init.body as FormData;
    expect(form.get("qid")).toBe("QC-0A1B-2C3D-4");
    expect(form.get("view")).toBe("on_shelf");
    expect(form.get("feedbackClientRef")).toBe("scan:0");
    expect((form.get("file") as File).name).toBe("crop.webp");
    expect((form.get("file") as File).size).toBe(jpeg.byteLength);
  });

  it("omits the optional fields", async () => {
    await client.uploadImage({ file: jpeg, filename: "c.jpg", qid: "QC-0A1B-2C3D-4" });
    const form = last().init.body as FormData;
    expect(form.has("view")).toBe(false);
    expect(form.has("feedbackClientRef")).toBe(false);
  });

  it("sends the training sample context as strings, and returns the sample", async () => {
    nextResponse = () =>
      json({ sha256: "ab".repeat(32), qid: "QC-0A1B-2C3D-4", view: "on_shelf", status: "accepted", width: 200, height: 300, role: "training", sampleId: "smp_1" });
    const res = await client.uploadImage({
      file: jpeg,
      filename: "c.webp",
      qid: "QC-0A1B-2C3D-4",
      sample: {
        box: { x: 120, y: 40, w: 96, h: 210 },
        sourceWidth: 2560,
        sourceHeight: 1920,
        detectorModel: "sam-3.1",
        capturedAt: "2026-10-29T09:00:00.000Z",
        labelBrand: "Peak",
        labelName: "Milk",
        labelPack: "",
      },
    });
    expect(res).toMatchObject({ status: "accepted", role: "training", sampleId: "smp_1" });
    const form = last().init.body as FormData;
    expect(["boxX", "boxY", "boxW", "boxH"].map((k) => form.get(k))).toEqual(["120", "40", "96", "210"]);
    expect(form.get("sourceWidth")).toBe("2560");
    expect(form.get("detectorModel")).toBe("sam-3.1");
    expect(form.get("capturedAt")).toBe("2026-10-29T09:00:00.000Z");
    expect(form.get("labelBrand")).toBe("Peak");
    // Empty strings and missing fields are left out.
    expect(form.has("labelPack")).toBe(false);
    expect(form.has("detectorConfidence")).toBe(false);
  });

  it("sends a new item's crop without a qid, linked by its feedback line", async () => {
    nextResponse = () => json({ sha256: "ab".repeat(32), qid: null, view: "on_shelf", status: "pending", width: 200, height: 300, role: "training", sampleId: "smp_2" });
    const res = await client.uploadImage({ file: jpeg, filename: "c.webp", view: "on_shelf", feedbackClientRef: "scan:3" });
    expect(res).toMatchObject({ qid: null, status: "pending", sampleId: "smp_2" });
    const form = last().init.body as FormData;
    expect(form.has("qid")).toBe(false);
    expect(form.get("feedbackClientRef")).toBe("scan:3");
  });

  it("refuses a new item's crop without its feedback line, before any request", async () => {
    await expect(client.uploadImage({ file: jpeg, filename: "c.webp" })).rejects.toMatchObject({ status: 400 });
    expect(calls).toHaveLength(0);
  });

  it("feedbackResolutions → GET /v1/feedback/resolutions with since and limit", async () => {
    nextResponse = () => json({ items: [{ clientRef: "scan:3", resolution: "linked", qid: "QC-0A1B-2C3D-4", resolvedAt: "2026-10-29T10:00:00.000Z" }] });
    const res = await client.feedbackResolutions({ since: "2026-10-29T09:00:00.000Z", limit: 200 });
    expect(res.items[0]).toMatchObject({ resolution: "linked" });
    expect(last().url).toBe("https://catalog.test/v1/feedback/resolutions?since=2026-10-29T09%3A00%3A00.000Z&limit=200");
    expect(last().init.headers.get("x-api-key")).toBe(KEY);
  });

  it("drops a box without area: all four box fields or none", async () => {
    await client.uploadImage({ file: jpeg, filename: "c.webp", qid: "QC-0A1B-2C3D-4", sample: { box: { x: 1, y: 1, w: 0, h: 5 } } });
    const form = last().init.body as FormData;
    expect(["boxX", "boxY", "boxW", "boxH"].some((k) => form.has(k))).toBe(false);
  });

  it.each([
    ["an empty file", { file: new Uint8Array(), filename: "x", qid: "QC-0A1B-2C3D-4" }],
    ["a file over 8 MB", { file: new Uint8Array(8 * 1024 * 1024 + 1), filename: "x", qid: "QC-0A1B-2C3D-4" }],
    ["a bad qid", { file: jpeg, filename: "x", qid: "QC-BAD" }],
  ])("rejects %s before any request", async (_label, upload) => {
    await expect(client.uploadImage(upload)).rejects.toMatchObject({ status: 400 });
    expect(calls).toHaveLength(0);
  });

  it("surfaces a 404 (unknown qid) as CatalogError without the key", async () => {
    nextResponse = () => json({ statusCode: 404, message: "Unknown qid" }, 404);
    const err = await client.uploadImage({ file: jpeg, filename: "x", qid: "QC-0A1B-2C3D-4" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CatalogError);
    expect(err).toMatchObject({ status: 404 });
    expect(String((err as Error).message)).not.toContain(KEY);
  });
});
