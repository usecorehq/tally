import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { CatalogError } from "@tally/catalog-client";
import * as jwt from "jsonwebtoken";
import request from "supertest";
import { SupabaseJwtGuard } from "../../common/guards/supabase-jwt.guard";
import { CatalogController } from "./catalog.controller";
import { CatalogService } from "./catalog.service";
import { TtlCache } from "./ttl-cache";

const TEN_MINUTES = 10 * 60 * 1000;

// Real controller, guard, validation and error mapping; only the Qore Catalog client is mocked.
const JWT_SECRET = "test-jwt-secret-not-real";
const CATALOG_KEY = "test-catalog-key-not-real";

const config: Record<string, string> = {
  "supabase.jwtSecret": JWT_SECRET,
  "supabase.url": "http://supabase.example.test",
  "catalog.baseUrl": "http://catalog.example.test",
  "catalog.apiKey": CATALOG_KEY,
};

const token = jwt.sign({ sub: "user-1", role: "authenticated", aud: "authenticated" }, JWT_SECRET, {
  algorithm: "HS256",
  expiresIn: 60,
});
const auth = { Authorization: `Bearer ${token}` };

const QID = "QC-7K2M-9XQ4-R";

const fail = (status: number) => async () => {
  throw new CatalogError(status, "/v1/x", { message: "upstream says no" }, `failed ${status} ${CATALOG_KEY}`);
};

describe("CatalogController (HTTP)", () => {
  let app: INestApplication;
  let service: CatalogService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CatalogController],
      providers: [
        CatalogService,
        { provide: ConfigService, useValue: { get: (k: string) => config[k], getOrThrow: (k: string) => config[k] } },
        { provide: APP_GUARD, useClass: SupabaseJwtGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix("api");
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
    service = moduleRef.get(CatalogService);
  });

  afterAll(() => app.close());

  // Fresh client spies and an empty cache for each test.
  let client: Record<"businessTaxonomy" | "subtypeTemplates" | "searchProducts" | "getProduct", jest.Mock>;
  beforeEach(() => {
    // The service exposes no way to clear its caches (by design); tests swap in empty ones.
    Object.assign(service, { verticalsCache: new TtlCache(TEN_MINUTES), templatesCache: new TtlCache(TEN_MINUTES) });
    client = {
      businessTaxonomy: jest.fn(async () => [{ code: "retail", label: "Retail", description: null, subtypes: [] }]),
      subtypeTemplates: jest.fn(async () => ({ subtype: { code: "supermarket" }, templates: [] })),
      searchProducts: jest.fn(async () => ({ total: 0, limit: 20, offset: 0, items: [] })),
      getProduct: jest.fn(async () => ({ qid: QID, status: "merged", mergedInto: "QC-8M3N-2PQ5-S" })),
    };
    Object.assign(service.client, client);
  });

  describe("auth", () => {
    it("verticals is public", async () => {
      await request(app.getHttpServer()).get("/api/catalog/verticals").expect(200);
    });

    it.each([
      "/api/catalog/subtypes/supermarket/templates",
      "/api/catalog/products?q=milk",
      `/api/catalog/products/${QID}`,
    ])("%s needs a Supabase JWT", async (path) => {
      await request(app.getHttpServer()).get(path).expect(401);
      await request(app.getHttpServer()).get(path).set(auth).expect(200);
    });
  });

  describe("routes call the client with the right arguments", () => {
    it("verticals → businessTaxonomy()", async () => {
      const res = await request(app.getHttpServer()).get("/api/catalog/verticals").expect(200);
      expect(client.businessTaxonomy).toHaveBeenCalledTimes(1);
      expect(res.body[0].code).toBe("retail");
    });

    it("templates → subtypeTemplates(code, suggestions), default 0", async () => {
      await request(app.getHttpServer()).get("/api/catalog/subtypes/supermarket/templates").set(auth).expect(200);
      await request(app.getHttpServer()).get("/api/catalog/subtypes/pharmacy/templates?suggestions=2").set(auth).expect(200);
      expect(client.subtypeTemplates.mock.calls).toEqual([
        ["supermarket", 0],
        ["pharmacy", 2],
      ]);
    });

    it("products → searchProducts with numbers and a default limit of 20", async () => {
      await request(app.getHttpServer()).get("/api/catalog/products?q=peak%20milk&brand=peak&offset=40").set(auth).expect(200);
      expect(client.searchProducts).toHaveBeenCalledWith({ limit: 20, q: "peak milk", brand: "peak", offset: 40 });
    });

    it("product → getProduct(qid), merged shape passed through", async () => {
      const res = await request(app.getHttpServer()).get(`/api/catalog/products/${QID}`).set(auth).expect(200);
      expect(client.getProduct).toHaveBeenCalledWith(QID);
      expect(res.body).toEqual({ qid: QID, status: "merged", mergedInto: "QC-8M3N-2PQ5-S" });
    });
  });

  describe("validation rejects before calling the catalogue", () => {
    it.each([
      "/api/catalog/subtypes/Super-Market/templates",
      "/api/catalog/subtypes/x/templates",
      "/api/catalog/subtypes/supermarket/templates?suggestions=6",
      "/api/catalog/subtypes/supermarket/templates?suggestions=-1",
      "/api/catalog/products?q=a",
      `/api/catalog/products?q=${"a".repeat(201)}`,
      "/api/catalog/products?limit=0",
      "/api/catalog/products?limit=101",
      "/api/catalog/products?offset=10001",
      "/api/catalog/products/QC-BAD",
      "/api/catalog/products/qc-7k2m-9xq4-r",
    ])("%s → 400", async (path) => {
      await request(app.getHttpServer()).get(path).set(auth).expect(400);
      for (const fn of Object.values(client)) expect(fn).not.toHaveBeenCalled();
    });
  });

  describe("error mapping", () => {

    it("404 → 404 with our message", async () => {
      client.getProduct.mockImplementation(fail(404));
      const res = await request(app.getHttpServer()).get(`/api/catalog/products/${QID}`).set(auth).expect(404);
      expect(res.body.message).toBe(`No product with Qore ID ${QID}`);
    });

    it("unknown sub-type → 404 'No business sub-type x'", async () => {
      client.subtypeTemplates.mockImplementation(fail(404));
      const res = await request(app.getHttpServer()).get("/api/catalog/subtypes/no_such/templates").set(auth).expect(404);
      expect(res.body.message).toBe("No business sub-type no_such");
    });

    it("catalogue 401 → 502 'Catalogue access misconfigured', no key in the body", async () => {
      client.searchProducts.mockImplementation(fail(401));
      const res = await request(app.getHttpServer()).get("/api/catalog/products?q=milk").set(auth).expect(502);
      expect(res.body.message).toBe("Catalogue access misconfigured");
      expect(JSON.stringify(res.body)).not.toContain(CATALOG_KEY);
    });

    it("catalogue 429 → 503 with Retry-After 30", async () => {
      client.searchProducts.mockImplementation(fail(429));
      const res = await request(app.getHttpServer()).get("/api/catalog/products?q=milk").set(auth).expect(503);
      expect(res.headers["retry-after"]).toBe("30");
    });

    it("network failure → 502 'Catalogue unavailable', no upstream URL", async () => {
      client.getProduct.mockImplementation(async () => {
        throw new TypeError("fetch failed http://catalog.example.test/v1/products");
      });
      const res = await request(app.getHttpServer()).get(`/api/catalog/products/${QID}`).set(auth).expect(502);
      expect(res.body.message).toBe("Catalogue unavailable");
      expect(JSON.stringify(res.body)).not.toContain("catalog.example.test");
    });
  });

  describe("cache", () => {
    it("verticals: second call within the TTL does not hit the catalogue", async () => {
      await request(app.getHttpServer()).get("/api/catalog/verticals").expect(200);
      await request(app.getHttpServer()).get("/api/catalog/verticals").expect(200);
      expect(client.businessTaxonomy).toHaveBeenCalledTimes(1);
    });

    it("templates: cached per (code, suggestions)", async () => {
      const get = (path: string) => request(app.getHttpServer()).get(path).set(auth).expect(200);
      await get("/api/catalog/subtypes/supermarket/templates?suggestions=2");
      await get("/api/catalog/subtypes/supermarket/templates?suggestions=2");
      await get("/api/catalog/subtypes/supermarket/templates?suggestions=0");
      await get("/api/catalog/subtypes/pharmacy/templates?suggestions=2");
      expect(client.subtypeTemplates).toHaveBeenCalledTimes(3);
    });

    it("failures are not cached", async () => {
      client.businessTaxonomy.mockImplementationOnce(fail(500));
      await request(app.getHttpServer()).get("/api/catalog/verticals").expect(502);
      await request(app.getHttpServer()).get("/api/catalog/verticals").expect(200);
      expect(client.businessTaxonomy).toHaveBeenCalledTimes(2);
    });

    it("search is never cached", async () => {
      await request(app.getHttpServer()).get("/api/catalog/products?q=milk").set(auth).expect(200);
      await request(app.getHttpServer()).get("/api/catalog/products?q=milk").set(auth).expect(200);
      expect(client.searchProducts).toHaveBeenCalledTimes(2);
    });
  });
});
