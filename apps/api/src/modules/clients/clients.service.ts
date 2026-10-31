import {
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { schema } from "@tally/db";
import * as jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import type { AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { isUniqueViolation } from "../businesses/barcode";
import { ClientsRepository } from "./clients.repository";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  CLIENT_ID,
  CLIENT_TOKEN_AUDIENCE,
  CODE_TTL_SECONDS,
  EMBED_TOKEN_AUDIENCE,
  OAUTH_SCOPES,
  OAuthError,
  type OauthScope,
  PKCE_CHALLENGE,
  PKCE_VERIFIER,
  REFRESH_TTL_MS,
  SESSION_TOKEN_TTL_SECONDS,
  TOKEN_ISSUER,
  UUID,
  hexEqual,
  isNonEmptyString,
  parseBasicAuth,
  parseScope,
  pkceS256,
  randomToken,
  sha256Hex,
} from "./oauth";

type Params = Record<string, unknown>;

export type TokenResponse = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
  business_id: string;
};

const invalidGrant = () => new OAuthError("invalid_grant", "The code or refresh token is invalid, expired or already used");
// Compared against when the client_id is unknown, so a miss costs the same as a wrong secret.
const DUMMY_HASH = "0".repeat(64);

@Injectable()
export class ClientsService {
  constructor(
    private readonly repo: ClientsRepository,
    private readonly config: ConfigService,
  ) {}

  async authorizeInfo(userId: string, query: Params) {
    const { client, scopes } = await this.checkAuthorizeRequest(query);
    return {
      client: { client_id: client.clientId, name: client.name, logo_url: client.logoUrl },
      scopes: scopes.map((scope) => ({ scope, description: OAUTH_SCOPES[scope] })),
      businesses: await this.repo.ownedBusinesses(userId, client.id),
    };
  }

  async createCode(userId: string, body: Params): Promise<{ code: string; expires_in: number }> {
    const { client, scopes } = await this.checkAuthorizeRequest(body);
    if (body.code_challenge_method !== "S256") {
      throw new OAuthError("invalid_request", "code_challenge_method must be S256");
    }
    if (!isNonEmptyString(body.code_challenge) || !PKCE_CHALLENGE.test(body.code_challenge)) {
      throw new OAuthError("invalid_request", "code_challenge must be a base64url SHA-256 (43 chars)");
    }
    if (!isNonEmptyString(body.business_id) || !UUID.test(body.business_id)) {
      throw new OAuthError("invalid_request", "business_id must be a uuid");
    }
    if (!(await this.repo.isOwner(body.business_id, userId))) throw notOwner();

    const code = randomToken();
    await this.repo.insertCode({
      codeHash: sha256Hex(code),
      clientId: client.id,
      userId,
      businessId: body.business_id,
      scopes,
      redirectUri: body.redirect_uri as string,
      codeChallenge: body.code_challenge,
      codeChallengeMethod: "S256",
      expiresAt: new Date(Date.now() + CODE_TTL_SECONDS * 1000),
    });
    return { code, expires_in: CODE_TTL_SECONDS };
  }

  async token(authorization: string | undefined, body: Params): Promise<TokenResponse> {
    // Checked before any write, so a misconfigured API never burns a code.
    const secret = this.jwtSecret();
    const client = await this.authenticateClient(authorization);
    if (body.grant_type === "authorization_code") return this.exchangeCode(client, body, secret);
    if (body.grant_type === "refresh_token") return this.refresh(client, body, secret);
    if (!isNonEmptyString(body.grant_type)) throw new OAuthError("invalid_request", "grant_type is required");
    throw new OAuthError("unsupported_grant_type", "grant_type must be authorization_code or refresh_token");
  }

  /** RFC 7009: once the client is authenticated, an unknown or foreign token is still a 200. */
  async revoke(authorization: string | undefined, body: Params): Promise<Record<string, never>> {
    const client = await this.authenticateClient(authorization);
    if (isNonEmptyString(body.token)) await this.repo.revokeByRefreshHash(client.id, sha256Hex(body.token), new Date());
    return {};
  }

  async listGrants(userId: string, businessId: string) {
    if (!(await this.repo.isOwner(businessId, userId))) throw notOwner();
    const grants = await this.repo.listActiveGrants(businessId);
    return grants.map((g) => ({
      id: g.id,
      client: { client_id: g.client.clientId, name: g.client.name, logo_url: g.client.logoUrl },
      business_id: g.businessId,
      scopes: g.scopes,
      created_at: g.createdAt,
      last_used_at: g.lastUsedAt,
    }));
  }

  async revokeGrant(userId: string, grantId: string): Promise<void> {
    const grant = await this.repo.findGrant(grantId);
    if (!grant) throw new NotFoundException(`No grant ${grantId}`);
    if (!(await this.repo.isOwner(grant.businessId, userId))) throw notOwner();
    if (!grant.revokedAt) await this.repo.revokeGrant(grant.id, new Date());
  }

  async me(principal: AuthenticatedUser) {
    assertClient(principal);
    const [client, business] = await Promise.all([
      this.repo.findClientById(principal.clientId!),
      this.repo.findBusiness(principal.businessId!),
    ]);
    if (!client || !business) throw new NotFoundException("The connected client or business no longer exists");
    return { client_id: client.clientId, business, scopes: principal.scopes ?? [] };
  }

  /** An embed token carries the access token's grant and scopes; only a client server may mint one. */
  createSession(principal: AuthenticatedUser) {
    assertClient(principal);
    const secret = this.jwtSecret();
    const scope = (principal.scopes ?? []).join(" ");
    const sessionToken = jwt.sign(
      { bid: principal.businessId, cid: principal.clientId, gid: principal.grantId, scope },
      secret,
      {
        algorithm: "HS256",
        issuer: TOKEN_ISSUER,
        audience: EMBED_TOKEN_AUDIENCE,
        subject: principal.sub,
        expiresIn: SESSION_TOKEN_TTL_SECONDS,
        jwtid: randomUUID(),
      },
    );
    const { exp } = jwt.decode(sessionToken, { json: true })!;
    return { session_token: sessionToken, expires_at: new Date(exp! * 1000).toISOString(), business_id: principal.businessId! };
  }

  /** Non-secret fields the embed page needs to check parent_origin and set frame-ancestors. */
  async embedConfig(clientId: unknown) {
    const client = isNonEmptyString(clientId) && CLIENT_ID.test(clientId) ? await this.repo.findClient(clientId) : undefined;
    if (!client) throw new NotFoundException({ statusCode: HttpStatus.NOT_FOUND, error: "Not Found", message: "Unknown client", code: "unknown_client" });
    return {
      client_id: client.clientId,
      name: client.name,
      status: client.status,
      allowed_origins: client.allowedOrigins,
      theme: client.theme,
    };
  }

  /**
   * Client and redirect_uri are checked before anything else and both fail as invalid_client,
   * because the consent page only redirects back for the errors raised after them.
   */
  private async checkAuthorizeRequest(params: Params): Promise<{ client: schema.OauthClient; scopes: OauthScope[] }> {
    const { client_id, redirect_uri, scope } = params;
    const client = isNonEmptyString(client_id) ? await this.repo.findClient(client_id) : undefined;
    if (!client || client.status !== "active") throw new OAuthError("invalid_client", "Unknown or suspended client");
    if (!isNonEmptyString(redirect_uri) || !client.redirectUris.includes(redirect_uri)) {
      throw new OAuthError("invalid_client", "redirect_uri is not registered for this client");
    }
    if (!isNonEmptyString(scope)) throw new OAuthError("invalid_request", "scope is required");
    const scopes = parseScope(scope);
    if (!scopes || scopes.some((s) => !client.allowedScopes.includes(s))) {
      throw new OAuthError("invalid_scope", "scope must be a non-empty subset of the client's allowed scopes");
    }
    return { client, scopes };
  }

  private async authenticateClient(authorization: string | undefined): Promise<schema.OauthClient> {
    const creds = parseBasicAuth(authorization);
    const client = creds ? await this.repo.findClient(creds.clientId) : undefined;
    const matches = hexEqual(creds ? sha256Hex(creds.secret) : DUMMY_HASH, client?.secretHash ?? DUMMY_HASH);
    if (!creds || !client || !matches || client.status !== "active") {
      throw new OAuthError("invalid_client", "Client authentication failed", HttpStatus.UNAUTHORIZED);
    }
    return client;
  }

  private async exchangeCode(client: schema.OauthClient, body: Params, secret: string): Promise<TokenResponse> {
    const { code, redirect_uri, code_verifier } = body;
    if (!isNonEmptyString(code) || !isNonEmptyString(redirect_uri) || !isNonEmptyString(code_verifier)) {
      throw new OAuthError("invalid_request", "code, redirect_uri and code_verifier are required");
    }
    if (!PKCE_VERIFIER.test(code_verifier)) throw new OAuthError("invalid_request", "code_verifier is malformed");

    const refreshToken = randomToken();
    const now = new Date();
    const grant = await this.repo
      .transaction(async (tx) => {
        const row = await tx.lockCode(sha256Hex(code));
        if (
          !row ||
          row.clientId !== client.id ||
          row.redirectUri !== redirect_uri ||
          row.usedAt ||
          row.expiresAt.getTime() <= now.getTime() ||
          pkceS256(code_verifier) !== row.codeChallenge
        ) {
          throw invalidGrant();
        }
        await tx.markCodeUsed(row.id, now);
        // Reconnecting replaces the old grant, keeping one active grant per client and business.
        await tx.revokeActiveGrant(client.id, row.businessId, now);
        return tx.insertGrant({
          clientId: client.id,
          userId: row.userId,
          businessId: row.businessId,
          scopes: row.scopes,
          refreshTokenHash: sha256Hex(refreshToken),
          refreshExpiresAt: new Date(now.getTime() + REFRESH_TTL_MS),
          lastUsedAt: now,
        });
      })
      .catch((err: unknown) => {
        // A concurrent reconnect won the partial unique index; this code is spent either way.
        throw isUniqueViolation(err) ? invalidGrant() : err;
      });
    return this.issue(grant, refreshToken, secret);
  }

  private async refresh(client: schema.OauthClient, body: Params, secret: string): Promise<TokenResponse> {
    if (!isNonEmptyString(body.refresh_token)) throw new OAuthError("invalid_request", "refresh_token is required");
    const hash = sha256Hex(body.refresh_token);
    const next = randomToken();
    const now = new Date();

    // Returns null instead of throwing so a replay's revocation commits.
    const grant = await this.repo.transaction(async (tx) => {
      const current = await tx.lockGrantByRefreshHash(hash);
      if (current) {
        if (current.clientId !== client.id || current.revokedAt || current.refreshExpiresAt.getTime() <= now.getTime()) {
          return null;
        }
        return tx.rotateRefresh(current.id, {
          refreshTokenHash: sha256Hex(next),
          previousRefreshTokenHash: hash,
          refreshExpiresAt: new Date(now.getTime() + REFRESH_TTL_MS),
          lastUsedAt: now,
        });
      }
      const replayed = await tx.lockGrantByPreviousHash(hash);
      if (replayed && replayed.clientId === client.id && !replayed.revokedAt) await tx.revokeGrant(replayed.id, now);
      return null;
    });
    if (!grant) throw invalidGrant();
    return this.issue(grant, next, secret);
  }

  private issue(grant: schema.OauthGrant, refreshToken: string, secret: string): TokenResponse {
    const scope = grant.scopes.join(" ");
    const accessToken = jwt.sign({ bid: grant.businessId, cid: grant.clientId, gid: grant.id, scope }, secret, {
      algorithm: "HS256",
      issuer: TOKEN_ISSUER,
      audience: CLIENT_TOKEN_AUDIENCE,
      subject: grant.userId,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      jwtid: randomUUID(),
    });
    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      refresh_token: refreshToken,
      scope,
      business_id: grant.businessId,
    };
  }

  private jwtSecret(): string {
    const secret = this.config.get<string>("clients.jwtSecret");
    if (!secret) throw new ServiceUnavailableException("Connect Tally is not configured on this server");
    return secret;
  }
}

function assertClient(principal: AuthenticatedUser) {
  if (principal.kind !== "client") {
    throw new ForbiddenException({
      statusCode: HttpStatus.FORBIDDEN,
      error: "Forbidden",
      message: "Needs a Connect Tally access token",
      code: "client_token_required",
    });
  }
}

function notOwner() {
  return new ForbiddenException({
    statusCode: HttpStatus.FORBIDDEN,
    error: "Forbidden",
    message: "Only the business owner can manage connected apps",
    code: "not_owner",
  });
}
