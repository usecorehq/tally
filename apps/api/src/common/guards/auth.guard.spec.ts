import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Controller, Get, INestApplication, Param, Post } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { ThrottlerModule } from "@nestjs/throttler";
import * as jwt from "jsonwebtoken";
import request from "supertest";
import { CurrentUser, type AuthenticatedUser } from "../decorators/current-user.decorator";
import { Public } from "../decorators/public.decorator";
import { RateLimit } from "../decorators/rate-limit.decorator";
import { Scopes } from "../decorators/scopes.decorator";
import { AuthGuard } from "./auth.guard";
import { GRANT_CACHE_MS, GrantStatusService } from "./grant-status.service";
import { AppThrottlerGuard, throttlerOptions } from "./throttler";

const SUPABASE_SECRET = "test-jwt-secret-not-real";
const CLIENT_SECRET = "test-client-jwt-secret-not-real-0123456789";
const USER = "00000000-0000-4000-8000-0000000000aa";
const BIZ_A = "00000000-0000-4000-8000-000000000001";
const BIZ_B = "00000000-0000-4000-8000-000000000002";
const CID = "00000000-0000-4000-8000-0000000000c1";
const GID = "00000000-0000-4000-8000-0000000000d1";

const userToken = (secret = SUPABASE_SECRET, aud = "authenticated") =>
  jwt.sign({ sub: USER, role: "authenticated", aud }, secret, { algorithm: "HS256", expiresIn: 60 });
const clientToken = (opts: { aud?: string; secret?: string; bid?: string; scope?: string; exp?: number; omit?: string } = {}) => {
  const claims: Record<string, unknown> = {
    iss: "tally",
    aud: opts.aud ?? "tally-client",
    sub: USER,
    bid: opts.bid ?? BIZ_A,
    cid: CID,
    gid: GID,
    scope: opts.scope ?? "stocktake:write stocktake:read",
    exp: opts.exp ?? Math.floor(Date.now() / 1000) + 900,
  };
  if (opts.omit) delete claims[opts.omit];
  return jwt.sign(claims, opts.secret ?? CLIENT_SECRET, { algorithm: "HS256" });
};
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

@Controller("t")
class ProbeController {
  @Get("businesses/:businessId/read")
  @Scopes("stocktake:read")
  read(@CurrentUser() p: AuthenticatedUser, @Param("businessId") _b: string) {
    return p;
  }

  @Post("businesses/:businessId/write")
  @Scopes("stocktake:write", "inventory:read")
  write() {
    return { ok: true };
  }

  @Get("catalog")
  @Scopes("stocktake:write")
  catalog() {
    return { ok: true };
  }

  @Get("unscoped/:businessId")
  unscoped(@CurrentUser() p: AuthenticatedUser) {
    return p;
  }

  @Public()
  @RateLimit("ip")
  @Get("public")
  open() {
    return { ok: true };
  }

  @Post("client-limited")
  @Scopes()
  @RateLimit("client")
  limited() {
    return { ok: true };
  }
}

describe("AuthGuard", () => {
  let app: INestApplication;
  const grants = { isLive: jest.fn(async () => true) };

  beforeAll(async () => {
    const config: Record<string, string> = { "supabase.jwtSecret": SUPABASE_SECRET, "clients.jwtSecret": CLIENT_SECRET };
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot(throttlerOptions)],
      controllers: [ProbeController],
      providers: [
        { provide: ConfigService, useValue: { get: (k: string) => config[k] } },
        { provide: GrantStatusService, useValue: grants },
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: APP_GUARD, useClass: AppThrottlerGuard },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => {
    grants.isLive.mockClear();
    grants.isLive.mockResolvedValue(true);
  });

  const http = () => request(app.getHttpServer());

  describe("user tokens", () => {
    it("reach scoped and unscoped routes as kind user", async () => {
      const res = await http().get(`/t/businesses/${BIZ_B}/read`).set(bearer(userToken())).expect(200);
      expect(res.body).toEqual({ kind: "user", sub: USER, role: "authenticated", aud: "authenticated" });
      await http().get(`/t/unscoped/${BIZ_B}`).set(bearer(userToken())).expect(200);
      expect(grants.isLive).not.toHaveBeenCalled();
    });

    it("are never throttled", async () => {
      for (let i = 0; i < 70; i++) await http().get(`/t/businesses/${BIZ_A}/read`).set(bearer(userToken())).expect(200);
    });
  });

  describe("secret separation", () => {
    it("a Supabase-signed token claiming aud tally-client is rejected", async () => {
      await http().get(`/t/businesses/${BIZ_A}/read`).set(bearer(clientToken({ secret: SUPABASE_SECRET }))).expect(401);
      await http().get(`/t/businesses/${BIZ_A}/read`).set(bearer(clientToken({ aud: "tally-embed", secret: SUPABASE_SECRET }))).expect(401);
    });

    it("a client-secret-signed token claiming aud authenticated is rejected", async () => {
      await http().get(`/t/unscoped/${BIZ_A}`).set(bearer(userToken(CLIENT_SECRET))).expect(401);
    });

    it("rejects alg none and a wrong issuer", async () => {
      const none = jwt.sign({ aud: "tally-client", iss: "tally", sub: USER, bid: BIZ_A, cid: CID, gid: GID, scope: "stocktake:read" }, "", {
        algorithm: "none",
      });
      await http().get(`/t/businesses/${BIZ_A}/read`).set(bearer(none)).expect(401);
      const wrongIss = jwt.sign({ aud: "tally-client", iss: "other", sub: USER, bid: BIZ_A, cid: CID, gid: GID, scope: "stocktake:read" }, CLIENT_SECRET);
      await http().get(`/t/businesses/${BIZ_A}/read`).set(bearer(wrongIss)).expect(401);
    });

    it.each(["bid", "cid", "gid", "scope", "sub"])("rejects a client token missing %s", async (omit) => {
      await http().get(`/t/businesses/${BIZ_A}/read`).set(bearer(clientToken({ omit }))).expect(401);
    });
  });

  describe("client and embed tokens", () => {
    it.each(["tally-client", "tally-embed"])("%s reaches its own business with the scope", async (aud) => {
      const res = await http().get(`/t/businesses/${BIZ_A}/read`).set(bearer(clientToken({ aud }))).expect(200);
      expect(res.body).toEqual({
        kind: aud === "tally-client" ? "client" : "embed",
        sub: USER,
        aud,
        clientId: CID,
        grantId: GID,
        businessId: BIZ_A,
        scopes: ["stocktake:write", "stocktake:read"],
      });
      expect(grants.isLive).toHaveBeenCalledWith({ grantId: GID, clientId: CID, businessId: BIZ_A, userId: USER });
    });

    it("a business A token on business B is 403", async () => {
      const res = await http().get(`/t/businesses/${BIZ_B}/read`).set(bearer(clientToken())).expect(403);
      expect(res.body.code).toBe("business_mismatch");
    });

    it("a missing scope is 403", async () => {
      const res = await http().post(`/t/businesses/${BIZ_A}/write`).set(bearer(clientToken())).expect(403);
      expect(res.body.code).toBe("insufficient_scope");
      await http().get(`/t/businesses/${BIZ_A}/read`).set(bearer(clientToken({ scope: "inventory:read" }))).expect(403);
    });

    it("a scoped route without :businessId only checks the scope", async () => {
      await http().get("/t/catalog").set(bearer(clientToken())).expect(200);
    });

    it.each(["tally-client", "tally-embed"])("an unscoped route is 403 for %s", async (aud) => {
      const res = await http().get(`/t/unscoped/${BIZ_A}`).set(bearer(clientToken({ aud }))).expect(403);
      expect(res.body.code).toBe("client_not_allowed");
    });

    it("a revoked grant is 401 grant_revoked", async () => {
      grants.isLive.mockResolvedValue(false);
      const res = await http().get(`/t/businesses/${BIZ_A}/read`).set(bearer(clientToken())).expect(401);
      expect(res.body.code).toBe("grant_revoked");
    });

    it("an expired token is 401 token_expired", async () => {
      const res = await http()
        .get(`/t/businesses/${BIZ_A}/read`)
        .set(bearer(clientToken({ exp: Math.floor(Date.now() / 1000) - 10 })))
        .expect(401);
      expect(res.body.code).toBe("token_expired");
    });
  });

  describe("throttling", () => {
    it("limits a grant to 60 requests a minute across routes", async () => {
      // Its own grant id, so earlier tests' requests don't count.
      const own = bearer(
        jwt.sign(
          { iss: "tally", aud: "tally-client", sub: USER, bid: BIZ_A, cid: CID, gid: "00000000-0000-4000-8000-0000000000d9", scope: "stocktake:write stocktake:read" },
          CLIENT_SECRET,
          { expiresIn: 900 },
        ),
      );
      for (let i = 0; i < 30; i++) await http().get(`/t/businesses/${BIZ_A}/read`).set(own).expect(200);
      for (let i = 0; i < 30; i++) await http().get("/t/catalog").set(own).expect(200);
      const res = await http().get("/t/catalog").set(own).expect(429);
      expect(res.body.code).toBe("rate_limited");
    });

    it("limits a client to 10 a minute on client-limited routes", async () => {
      const own = bearer(
        jwt.sign(
          { iss: "tally", aud: "tally-client", sub: USER, bid: BIZ_A, cid: "00000000-0000-4000-8000-0000000000c9", gid: "00000000-0000-4000-8000-0000000000d8", scope: "stocktake:write" },
          CLIENT_SECRET,
          { expiresIn: 900 },
        ),
      );
      for (let i = 0; i < 10; i++) await http().post("/t/client-limited").set(own).expect(201);
      await http().post("/t/client-limited").set(own).expect(429);
    });

    it("limits a public route to 60 a minute per IP", async () => {
      for (let i = 0; i < 60; i++) await http().get("/t/public").expect(200);
      await http().get("/t/public").expect(429);
    });
  });
});

describe("GrantStatusService", () => {
  const claims = { grantId: GID, clientId: CID, businessId: BIZ_A, userId: USER };
  function serviceWith(rows: Array<Record<string, unknown>>) {
    const limit = jest.fn(async () => rows.slice(0, 1));
    const db = { select: () => ({ from: () => ({ where: () => ({ limit }) }) }) };
    return { service: new GrantStatusService(db as never), limit };
  }

  it("a revoke lands once the 60 s cache window passes", async () => {
    const row: Record<string, unknown> = { clientId: CID, businessId: BIZ_A, userId: USER, revokedAt: null };
    const { service, limit } = serviceWith([row]);
    const t0 = 1_000_000;
    expect(await service.isLive(claims, t0)).toBe(true);
    row.revokedAt = new Date();
    expect(await service.isLive(claims, t0 + GRANT_CACHE_MS - 1)).toBe(true);
    expect(limit).toHaveBeenCalledTimes(1);
    expect(await service.isLive(claims, t0 + GRANT_CACHE_MS)).toBe(false);
  });

  it("is not live when the grant is missing or its claims don't match the row", async () => {
    expect(await serviceWith([]).service.isLive(claims)).toBe(false);
    const other = serviceWith([{ clientId: CID, businessId: BIZ_B, userId: USER, revokedAt: null }]);
    expect(await other.service.isLive(claims)).toBe(false);
  });
});
