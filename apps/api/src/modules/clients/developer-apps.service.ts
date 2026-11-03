import { BadRequestException, ConflictException, HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { OAUTH_CLIENT_SCOPES, newClientId, newClientSecret, originProblem, redirectUriProblem, type schema } from "@tally/db";
import { BillingService } from "../billing/billing.service";
import { ClientsRepository } from "./clients.repository";
import { CLIENT_ID } from "./oauth";

type Params = Record<string, unknown>;

/** Apps one Qorelly user may register; suspended ones count, since they are never deleted. */
export const MAX_APPS_PER_OWNER = 10;
const MAX_URIS = 10;

export type DeveloperApp = {
  client_id: string;
  name: string;
  logo_url: string | null;
  status: string;
  redirect_uris: string[];
  allowed_origins: string[];
  scopes: string[];
  secret_prefix: string;
  daily_stocktake_cap: number;
  max_concurrent_runs: number;
  created_at: Date;
  updated_at: Date;
};

/** Self-served Connect Tally apps. Only the owner sees or changes an app; the secret is returned once, at create or rotate. */
@Injectable()
export class DeveloperAppsService {
  constructor(
    private readonly repo: ClientsRepository,
    private readonly billing: BillingService,
  ) {}

  async list(userId: string): Promise<DeveloperApp[]> {
    return (await this.repo.listOwnedClients(userId)).map(toApp);
  }

  async get(userId: string, clientId: string): Promise<DeveloperApp> {
    return toApp(await this.owned(userId, clientId));
  }

  async create(userId: string, body: Params): Promise<DeveloperApp & { client_secret: string }> {
    const values = {
      name: checkName(body.name),
      logoUrl: checkLogo(body.logo_url ?? null),
      redirectUris: checkRedirectUris(body.redirect_uris),
      allowedOrigins: checkOrigins(body.allowed_origins ?? []),
      allowedScopes: checkScopes(body.scopes),
    };
    if ((await this.repo.countOwnedClients(userId)) >= MAX_APPS_PER_OWNER) {
      throw new ConflictException({
        statusCode: HttpStatus.CONFLICT,
        error: "Conflict",
        message: `You can register up to ${MAX_APPS_PER_OWNER} apps`,
        code: "app_limit",
      });
    }
    const { secret, secretHash, secretPrefix } = newClientSecret();
    // Caps are left to their column defaults, as for the CTO's script without --cap.
    const row = await this.repo.insertClient({ ...values, clientId: newClientId(), ownerUserId: userId, secretHash, secretPrefix });
    return { ...toApp(row), client_secret: secret };
  }

  async update(userId: string, clientId: string, body: Params): Promise<DeveloperApp> {
    const app = await this.active(userId, clientId);
    const values: Parameters<ClientsRepository["updateClient"]>[1] = {};
    if (body.name !== undefined) values.name = checkName(body.name);
    if (body.logo_url !== undefined) values.logoUrl = checkLogo(body.logo_url);
    if (body.redirect_uris !== undefined) values.redirectUris = checkRedirectUris(body.redirect_uris);
    if (body.allowed_origins !== undefined) values.allowedOrigins = checkOrigins(body.allowed_origins);
    if (Object.keys(values).length === 0) throw invalid("Nothing to change: send name, logo_url, redirect_uris or allowed_origins");
    return toApp(await this.repo.updateClient(app.id, values));
  }

  /** The old secret fails from the next token call: clients are authenticated against the stored hash each time. */
  async rotateSecret(userId: string, clientId: string): Promise<DeveloperApp & { client_secret: string }> {
    const app = await this.active(userId, clientId);
    const { secret, secretHash, secretPrefix } = newClientSecret();
    const row = await this.repo.updateClient(app.id, { secretHash, secretPrefix });
    return { ...toApp(row), client_secret: secret };
  }

  /** Final for the owner. Revoking the grants ends live access tokens within the guard's 60 s cache. */
  async suspend(userId: string, clientId: string): Promise<DeveloperApp> {
    const app = await this.owned(userId, clientId);
    if (app.status === "suspended") return toApp(app);
    const now = new Date();
    const row = await this.repo.transaction(async (tx) => {
      await tx.revokeClientGrants(app.id, now);
      return tx.suspendClient(app.id, now);
    });
    return toApp(row);
  }

  async activity(userId: string, clientId: string) {
    const app = await this.owned(userId, clientId);
    const [activeGrants, usage] = await Promise.all([this.repo.countActiveGrants(app.id), this.billing.clientUsage(app.id)]);
    return {
      client_id: app.clientId,
      active_grants: activeGrants,
      // `used` counts stock-takes and quick scans, as the daily cap does.
      today: usage.today,
      month: usage.month,
      caps: { daily_stocktake_cap: app.dailyStocktakeCap, max_concurrent_runs: app.maxConcurrentRuns },
    };
  }

  /** Someone else's app is a 404, like a missing one, so client ids can't be probed. */
  private async owned(userId: string, clientId: string): Promise<schema.OauthClient> {
    const app = CLIENT_ID.test(clientId) ? await this.repo.findClient(clientId) : undefined;
    if (!app || app.ownerUserId !== userId) {
      throw new NotFoundException({ statusCode: HttpStatus.NOT_FOUND, error: "Not Found", message: "No such app", code: "app_not_found" });
    }
    return app;
  }

  private async active(userId: string, clientId: string): Promise<schema.OauthClient> {
    const app = await this.owned(userId, clientId);
    if (app.status !== "active") {
      throw new ConflictException({ statusCode: HttpStatus.CONFLICT, error: "Conflict", message: "This app is suspended", code: "app_suspended" });
    }
    return app;
  }
}

function toApp(c: schema.OauthClient): DeveloperApp {
  return {
    client_id: c.clientId,
    name: c.name,
    logo_url: c.logoUrl,
    status: c.status,
    redirect_uris: c.redirectUris,
    allowed_origins: c.allowedOrigins,
    scopes: c.allowedScopes,
    secret_prefix: c.secretPrefix,
    daily_stocktake_cap: c.dailyStocktakeCap,
    max_concurrent_runs: c.maxConcurrentRuns,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

function invalid(message: string) {
  return new BadRequestException({ statusCode: HttpStatus.BAD_REQUEST, error: "Bad Request", message, code: "invalid_app" });
}

function checkName(value: unknown): string {
  const name = typeof value === "string" ? value.trim() : "";
  if (name.length < 1 || name.length > 80) throw invalid("name must be 1–80 characters");
  return name;
}

function checkLogo(value: unknown): string | null {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || redirectUriProblem(value)) throw invalid("logo_url must be an https URL");
  return value;
}

function stringList(value: unknown, field: string, min: number): string[] {
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) throw invalid(`${field} must be a list of strings`);
  const list = [...new Set(value.map((v: string) => v.trim()))];
  if (list.length < min || list.length > MAX_URIS) throw invalid(`${field} takes ${min}–${MAX_URIS} entries`);
  return list;
}

function checkRedirectUris(value: unknown): string[] {
  const uris = stringList(value, "redirect_uris", 1);
  for (const uri of uris) {
    const problem = redirectUriProblem(uri);
    if (problem) throw invalid(`redirect_uris: ${problem}`);
  }
  return uris;
}

function checkOrigins(value: unknown): string[] {
  const origins = stringList(value, "allowed_origins", 0);
  for (const origin of origins) {
    const problem = originProblem(origin);
    if (problem) throw invalid(`allowed_origins: ${problem}`);
  }
  return origins;
}

function checkScopes(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) throw invalid(`scopes must list at least one of ${OAUTH_CLIENT_SCOPES.join(", ")}`);
  const unknown = value.filter((s) => !(OAUTH_CLIENT_SCOPES as readonly unknown[]).includes(s));
  if (unknown.length > 0) throw invalid(`Unknown scope ${String(unknown[0])}; allowed: ${OAUTH_CLIENT_SCOPES.join(", ")}`);
  return OAUTH_CLIENT_SCOPES.filter((s) => value.includes(s));
}
