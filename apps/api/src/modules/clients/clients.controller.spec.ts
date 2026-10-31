import { afterAll, beforeAll, beforeEach, describe, expect, it } from "@jest/globals";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import type { schema } from "@tally/db";
import * as jwt from "jsonwebtoken";
import { randomBytes, randomUUID } from "node:crypto";
import request from "supertest";
import { AuthGuard } from "../../common/guards/auth.guard";
import { GrantStatusService } from "../../common/guards/grant-status.service";
import { ClientsController } from "./clients.controller";
import { ClientsRepository, type ClientsTx } from "./clients.repository";
import { ClientsService } from "./clients.service";
import { pkceS256, randomToken, sha256Hex } from "./oauth";

// HTTP layer plus the real service over an in-memory repository; SQL and row locks are verified on staging.
const SUPABASE_SECRET = "test-jwt-secret-not-real";
const CLIENT_JWT_SECRET = "test-client-jwt-secret-not-real-0123456789";
const OWNER = "00000000-0000-4000-8000-0000000000aa";
const STAFF = "00000000-0000-4000-8000-0000000000bb";
const BIZ = "00000000-0000-4000-8000-000000000001";
const OTHER_BIZ = "00000000-0000-4000-8000-000000000002";
const CLIENT_UUID = "00000000-0000-4000-8000-0000000000c1";
const CLIENT_ID = "tc_abcdefghijklmnopqrstuvwx";
const REDIRECT = "https://partner.example/callback";
// Built at runtime so the secrets guard never sees a client-secret-shaped literal.
const CLIENT_SECRET = ["tcs", randomBytes(32).toString("base64url")].join("_");
const basic = (id: string, secret: string) => `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
const CLIENT_AUTH = { Authorization: basic(CLIENT_ID, CLIENT_SECRET) };
const bearer = (sub: string) => ({
  Authorization: `Bearer ${jwt.sign({ sub, role: "authenticated", aud: "authenticated" }, SUPABASE_SECRET, { algorithm: "HS256", expiresIn: 60 })}`,
});

class FakeRepo {
  clients: schema.OauthClient[] = [];
  codes: schema.OauthCode[] = [];
  grants: schema.OauthGrant[] = [];
  owners: { businessId: string; userId: string; name: string }[] = [];

  reset() {
    const now = new Date();
    this.clients = [
      {
        id: CLIENT_UUID, clientId: CLIENT_ID, ownerUserId: null, name: "Partner App", logoUrl: null,
        secretHash: sha256Hex(CLIENT_SECRET), secretPrefix: CLIENT_SECRET.slice(4, 12),
        redirectUris: [REDIRECT], allowedOrigins: [], allowedScopes: ["stocktake:write", "stocktake:read"],
        status: "active", dailyStocktakeCap: 200, maxConcurrentRuns: 3, theme: {}, createdAt: now, updatedAt: now,
      },
    ];
    this.codes = [];
    this.grants = [];
    this.owners = [
      { businessId: BIZ, userId: OWNER, name: "Shop A" },
      { businessId: OTHER_BIZ, userId: OWNER, name: "Shop B" },
    ];
  }

  private readonly tx: Pick<ClientsTx, keyof ClientsTx> = {
    lockCode: async (h) => this.codes.find((c) => c.codeHash === h),
    markCodeUsed: async (id, at) => void (this.codes.find((c) => c.id === id)!.usedAt = at),
    revokeActiveGrant: async (clientId, businessId, at) => {
      for (const g of this.grants) if (g.clientId === clientId && g.businessId === businessId && !g.revokedAt) g.revokedAt = at;
    },
    insertGrant: async (v) => {
      const now = new Date();
      const row = { id: randomUUID(), previousRefreshTokenHash: null, lastUsedAt: null, revokedAt: null, createdAt: now, updatedAt: now, ...v } as schema.OauthGrant;
      this.grants.push(row);
      return row;
    },
    lockGrantByRefreshHash: async (h) => this.grants.find((g) => g.refreshTokenHash === h),
    lockGrantByPreviousHash: async (h) => this.grants.find((g) => g.previousRefreshTokenHash === h),
    rotateRefresh: async (id, v) => Object.assign(this.grants.find((g) => g.id === id)!, v),
    revokeGrant: async (id, at) => void (this.grants.find((g) => g.id === id)!.revokedAt = at),
    suspendClient: async (id) => Object.assign(this.clients.find((c) => c.id === id)!, { status: "suspended" }),
    revokeClientGrants: async (clientId, at) => {
      for (const g of this.grants) if (g.clientId === clientId && !g.revokedAt) g.revokedAt = at;
    },
  };

  async transaction<T>(fn: (tx: ClientsTx) => Promise<T>): Promise<T> {
    const snapshot = structuredClone({ codes: this.codes, grants: this.grants });
    try {
      return await fn(this.tx as ClientsTx);
    } catch (err) {
      Object.assign(this, snapshot);
      throw err;
    }
  }

  findClient = async (clientId: string) => this.clients.find((c) => c.clientId === clientId);
  findClientById = async (id: string) => this.clients.find((c) => c.id === id);
  findBusiness = async (id: string) => {
    const o = this.owners.find((x) => x.businessId === id);
    return o && { id: o.businessId, name: o.name };
  };
  ownedBusinesses = async (userId: string, clientId: string) =>
    this.owners
      .filter((o) => o.userId === userId)
      .map((o) => ({
        id: o.businessId,
        name: o.name,
        connected: this.grants.some((g) => g.businessId === o.businessId && g.clientId === clientId && !g.revokedAt),
      }));
  isOwner = async (businessId: string, userId: string) => this.owners.some((o) => o.businessId === businessId && o.userId === userId);
  insertCode = async (v: schema.NewOauthCode) =>
    void this.codes.push({ id: randomUUID(), usedAt: null, createdAt: new Date(), codeChallengeMethod: "S256", ...v } as schema.OauthCode);
  revokeByRefreshHash = async (clientId: string, h: string, at: Date) => {
    for (const g of this.grants) {
      if (g.clientId === clientId && !g.revokedAt && (g.refreshTokenHash === h || g.previousRefreshTokenHash === h)) g.revokedAt = at;
    }
  };
  listActiveGrants = async (businessId: string) =>
    this.grants
      .filter((g) => g.businessId === businessId && !g.revokedAt)
      .map((g) => ({ ...g, client: { clientId: CLIENT_ID, name: "Partner App", logoUrl: null } }));
  findGrant = async (id: string) => this.grants.find((g) => g.id === id);
  revokeGrant = async (id: string, at: Date) => this.tx.revokeGrant(id, at);
}

describe("ClientsController (HTTP)", () => {
  let app: INestApplication;
  const repo = new FakeRepo();
  const config: Record<string, string | undefined> = { "supabase.jwtSecret": SUPABASE_SECRET, "clients.jwtSecret": CLIENT_JWT_SECRET };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ClientsController],
      providers: [
        ClientsService,
        { provide: ClientsRepository, useValue: repo },
        { provide: ConfigService, useValue: { get: (k: string) => config[k] } },
        { provide: GrantStatusService, useValue: { isLive: async ({ grantId }: { grantId: string }) => repo.grants.some((g) => g.id === grantId && !g.revokedAt) } },
        { provide: APP_GUARD, useClass: AuthGuard },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix("api");
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => {
    repo.reset();
    config["clients.jwtSecret"] = CLIENT_JWT_SECRET;
  });

  const http = () => request(app.getHttpServer());
  const authorizeQuery = { client_id: CLIENT_ID, redirect_uri: REDIRECT, scope: "stocktake:read stocktake:write" };

  async function mintCode(businessId = BIZ) {
    const verifier = randomToken();
    const res = await http()
      .post("/api/clients/v1/oauth/codes")
      .set(bearer(OWNER))
      .send({ ...authorizeQuery, business_id: businessId, code_challenge: pkceS256(verifier), code_challenge_method: "S256" })
      .expect(200);
    return { code: res.body.code as string, verifier };
  }

  const exchange = (code: string, verifier: string, redirect = REDIRECT) =>
    http()
      .post("/api/clients/v1/oauth/token")
      .set(CLIENT_AUTH)
      .type("form")
      .send({ grant_type: "authorization_code", code, redirect_uri: redirect, code_verifier: verifier });

  const refresh = (token: string) =>
    http().post("/api/clients/v1/oauth/token").set(CLIENT_AUTH).type("form").send({ grant_type: "refresh_token", refresh_token: token });

  async function connect() {
    const { code, verifier } = await mintCode();
    return (await exchange(code, verifier).expect(200)).body as { access_token: string; refresh_token: string };
  }

  describe("authorize-info", () => {
    it("needs a Supabase JWT", async () => {
      await http().get("/api/clients/v1/oauth/authorize-info").query(authorizeQuery).expect(401);
    });

    it("returns the client, scopes in canonical order, and owned businesses with connected flags", async () => {
      await connect();
      const res = await http().get("/api/clients/v1/oauth/authorize-info").set(bearer(OWNER)).query(authorizeQuery).expect(200);
      expect(res.body.client).toEqual({ client_id: CLIENT_ID, name: "Partner App", logo_url: null });
      expect(res.body.scopes.map((s: { scope: string }) => s.scope)).toEqual(["stocktake:write", "stocktake:read"]);
      expect(res.body.businesses).toEqual([
        { id: BIZ, name: "Shop A", connected: true },
        { id: OTHER_BIZ, name: "Shop B", connected: false },
      ]);
    });

    it.each([
      ["an unknown client", { client_id: "tc_000000000000000000000000" }],
      ["a missing client_id", { client_id: undefined }],
      ["a redirect_uri mismatch", { redirect_uri: "https://partner.example/other" }],
      ["a redirect_uri that only shares a prefix", { redirect_uri: `${REDIRECT}/x` }],
      ["a missing redirect_uri", { redirect_uri: undefined }],
    ])("400 invalid_client for %s", async (_, override) => {
      const res = await http()
        .get("/api/clients/v1/oauth/authorize-info")
        .set(bearer(OWNER))
        .query({ ...authorizeQuery, ...override })
        .expect(400);
      expect(res.body).toEqual({ error: "invalid_client", error_description: expect.any(String) });
    });

    it("400 invalid_client for a suspended client", async () => {
      repo.clients[0]!.status = "suspended";
      const res = await http().get("/api/clients/v1/oauth/authorize-info").set(bearer(OWNER)).query(authorizeQuery).expect(400);
      expect(res.body.error).toBe("invalid_client");
    });

    it.each([
      ["a scope outside allowed_scopes", "stocktake:write inventory:read", "invalid_scope"],
      ["an unknown scope", "stocktake:delete", "invalid_scope"],
      ["an empty scope", " ", "invalid_scope"],
    ])("400 for %s", async (_, scope, error) => {
      const res = await http()
        .get("/api/clients/v1/oauth/authorize-info")
        .set(bearer(OWNER))
        .query({ ...authorizeQuery, scope })
        .expect(400);
      expect(res.body.error).toBe(error);
    });

    it("400 invalid_request without scope", async () => {
      const res = await http()
        .get("/api/clients/v1/oauth/authorize-info")
        .set(bearer(OWNER))
        .query({ client_id: CLIENT_ID, redirect_uri: REDIRECT })
        .expect(400);
      expect(res.body.error).toBe("invalid_request");
    });
  });

  describe("codes", () => {
    it("stores only the sha256 of a 60 s code", async () => {
      const before = Date.now();
      const { code } = await mintCode();
      expect(repo.codes).toHaveLength(1);
      expect(repo.codes[0]!.codeHash).toBe(sha256Hex(code));
      expect(JSON.stringify(repo.codes)).not.toContain(code);
      expect(repo.codes[0]!.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 60_000);
      expect(repo.codes[0]!.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 60_000);
    });

    it("403 not_owner when the caller doesn't own the business", async () => {
      const res = await http()
        .post("/api/clients/v1/oauth/codes")
        .set(bearer(STAFF))
        .send({ ...authorizeQuery, business_id: BIZ, code_challenge: pkceS256(randomToken()), code_challenge_method: "S256" })
        .expect(403);
      expect(res.body.code).toBe("not_owner");
      expect(repo.codes).toHaveLength(0);
    });

    it.each([
      ["plain challenge method", { code_challenge_method: "plain" }],
      ["a short challenge", { code_challenge: "abc" }],
      ["a non-uuid business", { business_id: "nope" }],
    ])("400 invalid_request for %s", async (_, override) => {
      const res = await http()
        .post("/api/clients/v1/oauth/codes")
        .set(bearer(OWNER))
        .send({ ...authorizeQuery, business_id: BIZ, code_challenge: pkceS256(randomToken()), code_challenge_method: "S256", ...override })
        .expect(400);
      expect(res.body.error).toBe("invalid_request");
    });
  });

  describe("token: authorization_code", () => {
    it("issues a 900 s client token and an opaque refresh token from a form body", async () => {
      const { code, verifier } = await mintCode();
      const res = await exchange(code, verifier).expect(200);
      expect(res.headers["cache-control"]).toBe("no-store");
      expect(res.body).toMatchObject({ token_type: "Bearer", expires_in: 900, scope: "stocktake:write stocktake:read", business_id: BIZ });
      const claims = jwt.verify(res.body.access_token, CLIENT_JWT_SECRET, { algorithms: ["HS256"], audience: "tally-client", issuer: "tally" }) as jwt.JwtPayload;
      const grant = repo.grants[0]!;
      expect(claims).toMatchObject({ sub: OWNER, bid: BIZ, cid: CLIENT_UUID, gid: grant.id, scope: "stocktake:write stocktake:read" });
      expect(claims.exp! - claims.iat!).toBe(900);
      expect(claims.jti).toEqual(expect.any(String));
      expect(grant.refreshTokenHash).toBe(sha256Hex(res.body.refresh_token));
      expect(grant.refreshExpiresAt.getTime() - Date.now()).toBeGreaterThan(29 * 24 * 3600 * 1000);
      expect(repo.codes[0]!.usedAt).not.toBeNull();
    });

    it("accepts a JSON body", async () => {
      const { code, verifier } = await mintCode();
      await http()
        .post("/api/clients/v1/oauth/token")
        .set(CLIENT_AUTH)
        .send({ grant_type: "authorization_code", code, redirect_uri: REDIRECT, code_verifier: verifier })
        .expect(200);
    });

    it("a code works only once", async () => {
      const { code, verifier } = await mintCode();
      await exchange(code, verifier).expect(200);
      const res = await exchange(code, verifier).expect(400);
      expect(res.body.error).toBe("invalid_grant");
      expect(repo.grants).toHaveLength(1);
    });

    it("a wrong verifier is invalid_grant and leaves the code unused", async () => {
      const { code, verifier } = await mintCode();
      const res = await exchange(code, randomToken()).expect(400);
      expect(res.body.error).toBe("invalid_grant");
      expect(repo.codes[0]!.usedAt).toBeNull();
      await exchange(code, verifier).expect(200);
    });

    it("an expired code is invalid_grant", async () => {
      const { code, verifier } = await mintCode();
      repo.codes[0]!.expiresAt = new Date(Date.now() - 1);
      expect((await exchange(code, verifier).expect(400)).body.error).toBe("invalid_grant");
    });

    it("a different redirect_uri is invalid_grant", async () => {
      const { code, verifier } = await mintCode();
      expect((await exchange(code, verifier, "https://partner.example/other").expect(400)).body.error).toBe("invalid_grant");
    });

    it("another client can't redeem the code", async () => {
      const { code, verifier } = await mintCode();
      const otherSecret = ["tcs", randomBytes(32).toString("base64url")].join("_");
      repo.clients.push({ ...repo.clients[0]!, id: randomUUID(), clientId: "tc_bbbbbbbbbbbbbbbbbbbbbbbb", secretHash: sha256Hex(otherSecret) });
      const res = await http()
        .post("/api/clients/v1/oauth/token")
        .set({ Authorization: basic("tc_bbbbbbbbbbbbbbbbbbbbbbbb", otherSecret) })
        .type("form")
        .send({ grant_type: "authorization_code", code, redirect_uri: REDIRECT, code_verifier: verifier })
        .expect(400);
      expect(res.body.error).toBe("invalid_grant");
    });

    it("reconnecting the same business revokes the old grant", async () => {
      const first = await connect();
      await connect();
      expect(repo.grants.filter((g) => !g.revokedAt)).toHaveLength(1);
      expect((await refresh(first.refresh_token).expect(400)).body.error).toBe("invalid_grant");
    });

    it.each([
      ["no Authorization", {}],
      ["a wrong secret", { Authorization: basic(CLIENT_ID, "tcs_wrong") }],
      ["an unknown client", { Authorization: basic("tc_000000000000000000000000", CLIENT_SECRET) }],
      ["a bearer header", { Authorization: "Bearer x" }],
    ])("401 invalid_client with %s", async (_, headers) => {
      const res = await http().post("/api/clients/v1/oauth/token").set(headers).type("form").send({ grant_type: "refresh_token", refresh_token: "x" }).expect(401);
      expect(res.body).toEqual({ error: "invalid_client", error_description: expect.any(String) });
    });

    it("401 invalid_client for a suspended client", async () => {
      repo.clients[0]!.status = "suspended";
      await refresh("x").expect(401);
    });

    it("400 unsupported_grant_type and invalid_request", async () => {
      const send = (body: object) => http().post("/api/clients/v1/oauth/token").set(CLIENT_AUTH).type("form").send(body);
      expect((await send({ grant_type: "password" }).expect(400)).body.error).toBe("unsupported_grant_type");
      expect((await send({}).expect(400)).body.error).toBe("invalid_request");
      expect((await send({ grant_type: "authorization_code", code: "x" }).expect(400)).body.error).toBe("invalid_request");
    });

    it("503 without TALLY_CLIENT_JWT_SECRET, leaving the code unused", async () => {
      const { code, verifier } = await mintCode();
      config["clients.jwtSecret"] = undefined;
      await exchange(code, verifier).expect(503);
      expect(repo.codes[0]!.usedAt).toBeNull();
    });
  });

  describe("token: refresh_token", () => {
    it("rotates: the new token works, the old one stops working", async () => {
      const first = await connect();
      const second = (await refresh(first.refresh_token).expect(200)).body;
      expect(second.refresh_token).not.toBe(first.refresh_token);
      const grant = repo.grants[0]!;
      expect(grant.refreshTokenHash).toBe(sha256Hex(second.refresh_token));
      expect(grant.previousRefreshTokenHash).toBe(sha256Hex(first.refresh_token));
      await refresh(second.refresh_token).expect(200);
    });

    it("replaying a rotated token revokes the whole grant", async () => {
      const first = await connect();
      const second = (await refresh(first.refresh_token).expect(200)).body;
      expect((await refresh(first.refresh_token).expect(400)).body.error).toBe("invalid_grant");
      expect(repo.grants[0]!.revokedAt).not.toBeNull();
      expect((await refresh(second.refresh_token).expect(400)).body.error).toBe("invalid_grant");
    });

    it("an expired refresh token is invalid_grant", async () => {
      const first = await connect();
      repo.grants[0]!.refreshExpiresAt = new Date(Date.now() - 1);
      await refresh(first.refresh_token).expect(400);
    });

    it("an unknown refresh token is invalid_grant", async () => {
      expect((await refresh(randomToken()).expect(400)).body.error).toBe("invalid_grant");
    });
  });

  describe("revoke", () => {
    it("revokes the grant and answers 200 {}", async () => {
      const first = await connect();
      const res = await http().post("/api/clients/v1/oauth/revoke").set(CLIENT_AUTH).type("form").send({ token: first.refresh_token }).expect(200);
      expect(res.body).toEqual({});
      expect(repo.grants[0]!.revokedAt).not.toBeNull();
      await refresh(first.refresh_token).expect(400);
    });

    it("answers 200 {} for an unknown or missing token", async () => {
      await http().post("/api/clients/v1/oauth/revoke").set(CLIENT_AUTH).type("form").send({ token: "unknown" }).expect(200, {});
      await http().post("/api/clients/v1/oauth/revoke").set(CLIENT_AUTH).type("form").send({}).expect(200, {});
    });

    it("401 invalid_client without client auth", async () => {
      await http().post("/api/clients/v1/oauth/revoke").type("form").send({ token: "x" }).expect(401);
    });
  });

  describe("grants", () => {
    it("lists active grants for the owner", async () => {
      await connect();
      const res = await http().get("/api/clients/v1/grants").set(bearer(OWNER)).query({ businessId: BIZ }).expect(200);
      expect(res.body).toEqual([
        {
          id: repo.grants[0]!.id,
          client: { client_id: CLIENT_ID, name: "Partner App", logo_url: null },
          business_id: BIZ,
          scopes: ["stocktake:write", "stocktake:read"],
          created_at: expect.any(String),
          last_used_at: expect.any(String),
        },
      ]);
    });

    it("403 not_owner for a non-owner, 401 without a JWT, 400 without businessId", async () => {
      await connect();
      expect((await http().get("/api/clients/v1/grants").set(bearer(STAFF)).query({ businessId: BIZ }).expect(403)).body.code).toBe("not_owner");
      await http().get("/api/clients/v1/grants").query({ businessId: BIZ }).expect(401);
      await http().get("/api/clients/v1/grants").set(bearer(OWNER)).expect(400);
    });

    it("DELETE revokes for the owner only", async () => {
      const first = await connect();
      const id = repo.grants[0]!.id;
      await http().delete(`/api/clients/v1/grants/${id}`).set(bearer(STAFF)).expect(403);
      expect(repo.grants[0]!.revokedAt).toBeNull();
      await http().delete(`/api/clients/v1/grants/${id}`).set(bearer(OWNER)).expect(204);
      expect(repo.grants[0]!.revokedAt).not.toBeNull();
      await refresh(first.refresh_token).expect(400);
      await http().delete(`/api/clients/v1/grants/${randomUUID()}`).set(bearer(OWNER)).expect(404);
    });
  });

  describe("me, sessions, embed-config", () => {
    const embedTokenFrom = async (accessToken: string) =>
      (await http().post("/api/clients/v1/sessions").set({ Authorization: `Bearer ${accessToken}` }).expect(200)).body;

    it("me describes the token's client, business and scopes", async () => {
      const { access_token } = await connect();
      const res = await http().get("/api/clients/v1/me").set({ Authorization: `Bearer ${access_token}` }).expect(200);
      expect(res.body).toEqual({ client_id: CLIENT_ID, business: { id: BIZ, name: "Shop A" }, scopes: ["stocktake:write", "stocktake:read"] });
    });

    it("me and sessions are 403 for a Supabase user", async () => {
      expect((await http().get("/api/clients/v1/me").set(bearer(OWNER)).expect(403)).body.code).toBe("client_token_required");
      await http().post("/api/clients/v1/sessions").set(bearer(OWNER)).expect(403);
    });

    it("a session is a 900 s embed token with the grant's scopes", async () => {
      const { access_token } = await connect();
      const body = await embedTokenFrom(access_token);
      expect(body.business_id).toBe(BIZ);
      const claims = jwt.verify(body.session_token, CLIENT_JWT_SECRET, { audience: "tally-embed", issuer: "tally", algorithms: ["HS256"] }) as jwt.JwtPayload;
      expect(claims).toMatchObject({ sub: OWNER, bid: BIZ, cid: CLIENT_UUID, gid: repo.grants[0]!.id, scope: "stocktake:write stocktake:read" });
      expect(claims.exp! - claims.iat!).toBe(900);
      expect(new Date(body.expires_at).getTime()).toBe(claims.exp! * 1000);
    });

    it("an embed token can't mint sessions or read me", async () => {
      const { access_token } = await connect();
      const { session_token } = await embedTokenFrom(access_token);
      await http().post("/api/clients/v1/sessions").set({ Authorization: `Bearer ${session_token}` }).expect(403);
      await http().get("/api/clients/v1/me").set({ Authorization: `Bearer ${session_token}` }).expect(403);
    });

    it("sessions need stocktake:write", async () => {
      repo.clients[0]!.allowedScopes = ["stocktake:read"];
      const verifier = randomToken();
      const { body } = await http()
        .post("/api/clients/v1/oauth/codes")
        .set(bearer(OWNER))
        .send({ ...authorizeQuery, scope: "stocktake:read", business_id: BIZ, code_challenge: pkceS256(verifier), code_challenge_method: "S256" })
        .expect(200);
      const { access_token } = (await exchange(body.code, verifier).expect(200)).body;
      const res = await http().post("/api/clients/v1/sessions").set({ Authorization: `Bearer ${access_token}` }).expect(403);
      expect(res.body.code).toBe("insufficient_scope");
    });

    it("a client token is 401 grant_revoked once the merchant disconnects", async () => {
      const { access_token } = await connect();
      await http().delete(`/api/clients/v1/grants/${repo.grants[0]!.id}`).set(bearer(OWNER)).expect(204);
      const res = await http().get("/api/clients/v1/me").set({ Authorization: `Bearer ${access_token}` }).expect(401);
      expect(res.body.code).toBe("grant_revoked");
    });

    it("client tokens can't reach the user-only clients routes", async () => {
      const { access_token } = await connect();
      const auth = { Authorization: `Bearer ${access_token}` };
      await http().get("/api/clients/v1/oauth/authorize-info").set(auth).query(authorizeQuery).expect(403);
      await http().get("/api/clients/v1/grants").set(auth).query({ businessId: BIZ }).expect(403);
    });

    it("embed-config is public and returns only the non-secret fields", async () => {
      repo.clients[0]!.allowedOrigins = ["https://partner.example"];
      const res = await http().get("/api/clients/v1/embed-config").query({ client_id: CLIENT_ID }).expect(200);
      expect(res.body).toEqual({ client_id: CLIENT_ID, name: "Partner App", status: "active", allowed_origins: ["https://partner.example"], theme: {} });
    });

    it("embed-config is 404 for an unknown or malformed client_id", async () => {
      expect((await http().get("/api/clients/v1/embed-config").query({ client_id: "tc_000000000000000000000000" }).expect(404)).body.code).toBe("unknown_client");
      await http().get("/api/clients/v1/embed-config").query({ client_id: "nope" }).expect(404);
      await http().get("/api/clients/v1/embed-config").expect(404);
    });
  });
});
