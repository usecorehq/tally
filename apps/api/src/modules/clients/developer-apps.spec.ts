import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import type { schema } from "@tally/db";
import * as jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { AuthGuard } from "../../common/guards/auth.guard";
import { GrantStatusService } from "../../common/guards/grant-status.service";
import { BillingService } from "../billing/billing.service";
import { ClientsController } from "./clients.controller";
import { ClientsRepository, type ClientsTx } from "./clients.repository";
import { ClientsService } from "./clients.service";
import { DeveloperAppsController } from "./developer-apps.controller";
import { DeveloperAppsService, MAX_APPS_PER_OWNER } from "./developer-apps.service";
import { sha256Hex } from "./oauth";

// HTTP layer plus the real services over an in-memory repository; SQL is verified on staging.
const SUPABASE_SECRET = "test-jwt-secret-not-real";
const CLIENT_JWT_SECRET = "test-client-jwt-secret-not-real-0123456789";
const DEV = "00000000-0000-4000-8000-0000000000d1";
const OTHER_DEV = "00000000-0000-4000-8000-0000000000d2";
const BIZ = "00000000-0000-4000-8000-000000000001";
const bearer = (sub: string) => ({
  Authorization: `Bearer ${jwt.sign({ sub, role: "authenticated", aud: "authenticated" }, SUPABASE_SECRET, { algorithm: "HS256", expiresIn: 60 })}`,
});
const basic = (id: string, secret: string) => ({ Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}` });
const VALID = {
  name: "  Partner App ",
  logo_url: "https://partner.example/logo.png",
  redirect_uris: ["https://partner.example/callback"],
  allowed_origins: ["https://partner.example"],
  scopes: ["stocktake:read", "stocktake:write"],
};

class FakeRepo {
  clients: schema.OauthClient[] = [];
  grants: Pick<schema.OauthGrant, "id" | "clientId" | "revokedAt">[] = [];

  reset() {
    this.clients = [];
    this.grants = [];
  }

  private readonly tx: Pick<ClientsTx, "suspendClient" | "revokeClientGrants"> = {
    suspendClient: async (id, at) => Object.assign(this.clients.find((c) => c.id === id)!, { status: "suspended", updatedAt: at }),
    revokeClientGrants: async (clientId, at) => {
      for (const g of this.grants) if (g.clientId === clientId && !g.revokedAt) g.revokedAt = at;
    },
  };

  transaction = async <T>(fn: (tx: ClientsTx) => Promise<T>) => fn(this.tx as ClientsTx);
  findClient = async (clientId: string) => this.clients.find((c) => c.clientId === clientId);
  listOwnedClients = async (userId: string) => this.clients.filter((c) => c.ownerUserId === userId).reverse();
  countOwnedClients = async (userId: string) => this.clients.filter((c) => c.ownerUserId === userId).length;
  insertClient = async (v: schema.NewOauthClient) => {
    const now = new Date();
    const row = {
      id: randomUUID(), logoUrl: null, allowedOrigins: [], status: "active", dailyStocktakeCap: 200, maxConcurrentRuns: 3,
      theme: {}, createdAt: now, updatedAt: now, ...v,
    } as schema.OauthClient;
    this.clients.push(row);
    return row;
  };
  updateClient = async (id: string, v: Partial<schema.OauthClient>) => Object.assign(this.clients.find((c) => c.id === id)!, v, { updatedAt: new Date() });
  countActiveGrants = async (clientId: string) => this.grants.filter((g) => g.clientId === clientId && !g.revokedAt).length;
  revokeByRefreshHash = async () => undefined;
}

describe("DeveloperAppsController (HTTP)", () => {
  let app: INestApplication;
  const repo = new FakeRepo();
  const billing = { clientUsage: jest.fn(async (_id: string) => ({ today: { used: 4, running: 1 }, month: { stocktakes: 41, scans: 9 } })) };
  const config: Record<string, string> = { "supabase.jwtSecret": SUPABASE_SECRET, "clients.jwtSecret": CLIENT_JWT_SECRET };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ClientsController, DeveloperAppsController],
      providers: [
        ClientsService,
        DeveloperAppsService,
        { provide: ClientsRepository, useValue: repo },
        { provide: BillingService, useValue: billing },
        { provide: ConfigService, useValue: { get: (k: string) => config[k] } },
        { provide: GrantStatusService, useValue: { isLive: async () => true } },
        { provide: APP_GUARD, useClass: AuthGuard },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix("api");
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => repo.reset());

  const http = () => request(app.getHttpServer());
  const create = (sub = DEV, body: Record<string, unknown> = VALID) => http().post("/api/clients/v1/apps").set(bearer(sub)).send(body);
  // The token endpoint's client authentication: 200 {} with a working secret, 401 invalid_client otherwise.
  const authenticates = async (clientId: string, secret: string) =>
    (await http().post("/api/clients/v1/oauth/revoke").set(basic(clientId, secret)).type("form").send({ token: "x" })).status === 200;

  describe("access", () => {
    it("needs a signed-in user", async () => {
      await http().get("/api/clients/v1/apps").expect(401);
      await http().post("/api/clients/v1/apps").send(VALID).expect(401);
    });

    it("refuses a Connect Tally access token: these routes carry no @Scopes", async () => {
      const token = jwt.sign(
        { iss: "tally", aud: "tally-client", sub: DEV, bid: BIZ, cid: randomUUID(), gid: randomUUID(), scope: "stocktake:write stocktake:read inventory:read" },
        CLIENT_JWT_SECRET,
        { algorithm: "HS256", expiresIn: 60 },
      );
      await http().get("/api/clients/v1/apps").set({ Authorization: `Bearer ${token}` }).expect(403);
    });

    it("lists only the caller's apps, and someone else's app is a 404 on every route", async () => {
      const mine = (await create().expect(201)).body;
      await create(OTHER_DEV, { ...VALID, name: "Theirs" }).expect(201);
      repo.clients.push({ ...repo.clients[0]!, id: randomUUID(), clientId: "tc_000000000000000000script", ownerUserId: null });

      const list = await http().get("/api/clients/v1/apps").set(bearer(DEV)).expect(200);
      expect(list.body.map((a: { client_id: string }) => a.client_id)).toEqual([mine.client_id]);

      const id = mine.client_id;
      for (const [method, path] of [
        ["get", `/api/clients/v1/apps/${id}`],
        ["patch", `/api/clients/v1/apps/${id}`],
        ["post", `/api/clients/v1/apps/${id}/rotate-secret`],
        ["post", `/api/clients/v1/apps/${id}/suspend`],
        ["get", `/api/clients/v1/apps/${id}/activity`],
      ] as const) {
        const res = await http()[method](path).set(bearer(OTHER_DEV)).send({ name: "Taken" }).expect(404);
        expect(res.body.code).toBe("app_not_found");
      }
      // A script-made app (no owner) is nobody's to manage here.
      await http().get("/api/clients/v1/apps/tc_000000000000000000script").set(bearer(DEV)).expect(404);
      expect(repo.clients.find((c) => c.clientId === id)!.status).toBe("active");
    });

    it("400s a malformed client id", async () => {
      await http().get("/api/clients/v1/apps/not-an-id").set(bearer(DEV)).expect(400);
    });
  });

  describe("create", () => {
    it("returns the secret once, stores only its hash, and owns the app with the default caps", async () => {
      const res = await create().expect(201);
      expect(res.headers["cache-control"]).toBe("no-store");
      expect(res.body).toMatchObject({
        client_id: expect.stringMatching(/^tc_[a-z0-9]{24}$/),
        client_secret: expect.stringMatching(/^tcs_[A-Za-z0-9_-]{43}$/),
        name: "Partner App",
        status: "active",
        scopes: ["stocktake:write", "stocktake:read"],
        daily_stocktake_cap: 200,
        max_concurrent_runs: 3,
      });
      const row = repo.clients[0]!;
      expect(row.ownerUserId).toBe(DEV);
      expect(row.secretHash).toBe(sha256Hex(res.body.client_secret));
      expect(res.body.secret_prefix).toBe(res.body.client_secret.slice(4, 12));
      expect(JSON.stringify(row)).not.toContain(res.body.client_secret);

      const [listed] = (await http().get("/api/clients/v1/apps").set(bearer(DEV)).expect(200)).body;
      const fetched = (await http().get(`/api/clients/v1/apps/${res.body.client_id}`).set(bearer(DEV)).expect(200)).body;
      for (const body of [listed, fetched]) {
        expect(body).not.toHaveProperty("client_secret");
        expect(JSON.stringify(body)).not.toContain(res.body.client_secret);
      }
      expect(await authenticates(res.body.client_id, res.body.client_secret)).toBe(true);
    });

    it.each([
      ["a missing name", { name: undefined }],
      ["a blank name", { name: "   " }],
      ["a name over 80 chars", { name: "x".repeat(81) }],
      ["an http logo", { logo_url: "http://partner.example/logo.png" }],
      ["no redirect URIs", { redirect_uris: [] }],
      ["redirect_uris that isn't a list", { redirect_uris: "https://partner.example/callback" }],
      ["an http redirect URI", { redirect_uris: ["http://partner.example/callback"] }],
      ["a redirect URI with a fragment", { redirect_uris: ["https://partner.example/callback#x"] }],
      ["11 redirect URIs", { redirect_uris: Array.from({ length: 11 }, (_, i) => `https://partner.example/${i}`) }],
      ["an origin with a path", { allowed_origins: ["https://partner.example/shop"] }],
      ["an origin with a trailing slash", { allowed_origins: ["https://partner.example/"] }],
      ["an http origin", { allowed_origins: ["http://partner.example"] }],
      ["no scopes", { scopes: [] }],
      ["an unknown scope", { scopes: ["stocktake:write", "admin"] }],
      ["identify, which clients can't reach", { scopes: ["identify"] }],
    ])("400 invalid_app for %s", async (_, override) => {
      const res = await create(DEV, { ...VALID, ...override }).expect(400);
      expect(res.body).toMatchObject({ statusCode: 400, code: "invalid_app", message: expect.any(String) });
      expect(repo.clients).toHaveLength(0);
    });

    it("allows no logo and no iframe origins", async () => {
      const res = await create(DEV, { ...VALID, logo_url: undefined, allowed_origins: undefined }).expect(201);
      expect(res.body).toMatchObject({ logo_url: null, allowed_origins: [] });
    });

    it(`409 app_limit after ${MAX_APPS_PER_OWNER} apps, suspended ones included`, async () => {
      for (let i = 0; i < MAX_APPS_PER_OWNER; i++) await create().expect(201);
      await http().post(`/api/clients/v1/apps/${repo.clients[0]!.clientId}/suspend`).set(bearer(DEV)).expect(200);
      expect((await create().expect(409)).body.code).toBe("app_limit");
      await create(OTHER_DEV).expect(201);
    });
  });

  describe("update", () => {
    it("changes the name, logo, redirect URIs and origins, but never the scopes or secret", async () => {
      const made = (await create().expect(201)).body;
      const res = await http()
        .patch(`/api/clients/v1/apps/${made.client_id}`)
        .set(bearer(DEV))
        .send({ name: "Renamed", logo_url: null, redirect_uris: ["https://partner.example/cb2"], allowed_origins: [], scopes: ["inventory:read"] })
        .expect(200);
      expect(res.body).toMatchObject({ name: "Renamed", logo_url: null, redirect_uris: ["https://partner.example/cb2"], allowed_origins: [], scopes: made.scopes });
      expect(res.body).not.toHaveProperty("client_secret");
      expect(await authenticates(made.client_id, made.client_secret)).toBe(true);
    });

    it("validates like create, and 400s an empty change", async () => {
      const { client_id } = (await create().expect(201)).body;
      const patch = (body: Record<string, unknown>) => http().patch(`/api/clients/v1/apps/${client_id}`).set(bearer(DEV)).send(body);
      expect((await patch({ redirect_uris: ["http://partner.example/cb"] }).expect(400)).body.code).toBe("invalid_app");
      expect((await patch({ allowed_origins: ["https://partner.example/x"] }).expect(400)).body.code).toBe("invalid_app");
      expect((await patch({}).expect(400)).body.code).toBe("invalid_app");
    });
  });

  describe("rotate-secret", () => {
    it("returns a new secret once; the old one stops working at once", async () => {
      const made = (await create().expect(201)).body;
      const res = await http().post(`/api/clients/v1/apps/${made.client_id}/rotate-secret`).set(bearer(DEV)).expect(200);
      expect(res.headers["cache-control"]).toBe("no-store");
      expect(res.body.client_secret).toMatch(/^tcs_[A-Za-z0-9_-]{43}$/);
      expect(res.body.client_secret).not.toBe(made.client_secret);
      expect(res.body.secret_prefix).toBe(res.body.client_secret.slice(4, 12));
      expect(await authenticates(made.client_id, made.client_secret)).toBe(false);
      expect(await authenticates(made.client_id, res.body.client_secret)).toBe(true);
    });
  });

  describe("suspend", () => {
    it("suspends, disconnects every business, and blocks rotate and edits", async () => {
      const made = (await create().expect(201)).body;
      const id = repo.clients[0]!.id;
      repo.grants = [
        { id: randomUUID(), clientId: id, revokedAt: null },
        { id: randomUUID(), clientId: id, revokedAt: null },
        { id: randomUUID(), clientId: randomUUID(), revokedAt: null },
      ];
      const res = await http().post(`/api/clients/v1/apps/${made.client_id}/suspend`).set(bearer(DEV)).expect(200);
      expect(res.body.status).toBe("suspended");
      expect(repo.grants.map((g) => !!g.revokedAt)).toEqual([true, true, false]);
      expect(await authenticates(made.client_id, made.client_secret)).toBe(false);

      expect((await http().post(`/api/clients/v1/apps/${made.client_id}/rotate-secret`).set(bearer(DEV)).expect(409)).body.code).toBe("app_suspended");
      expect((await http().patch(`/api/clients/v1/apps/${made.client_id}`).set(bearer(DEV)).send({ name: "Back" }).expect(409)).body.code).toBe("app_suspended");
      // Suspending again is a no-op, not an error.
      await http().post(`/api/clients/v1/apps/${made.client_id}/suspend`).set(bearer(DEV)).expect(200);
    });
  });

  describe("activity", () => {
    it("counts active grants and reports usage against the app's caps", async () => {
      const made = (await create().expect(201)).body;
      const id = repo.clients[0]!.id;
      repo.grants = [
        { id: randomUUID(), clientId: id, revokedAt: null },
        { id: randomUUID(), clientId: id, revokedAt: new Date() },
      ];
      const res = await http().get(`/api/clients/v1/apps/${made.client_id}/activity`).set(bearer(DEV)).expect(200);
      expect(billing.clientUsage).toHaveBeenCalledWith(id);
      expect(res.body).toEqual({
        client_id: made.client_id,
        active_grants: 1,
        today: { used: 4, running: 1 },
        month: { stocktakes: 41, scans: 9 },
        caps: { daily_stocktake_cap: 200, max_concurrent_runs: 3 },
      });
    });
  });
});
