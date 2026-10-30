import { ExecutionContext, HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { ThrottlerGuard, type ThrottlerModuleOptions } from "@nestjs/throttler";
import type { AuthenticatedUser } from "../decorators/current-user.decorator";
import { RATE_LIMIT_KEY, type RateLimitKey } from "../decorators/rate-limit.decorator";
import { parseBasicAuth } from "../../modules/clients/oauth";

const MINUTE_MS = 60_000;

type Req = { user?: AuthenticatedUser; headers: Record<string, string | undefined>; ip?: string };

const userOf = (ctx: ExecutionContext) => ctx.switchToHttp().getRequest<Req>().user;
const routeLimit = (ctx: ExecutionContext) => Reflect.getMetadata(RATE_LIMIT_KEY, ctx.getHandler()) as RateLimitKey | undefined;
const isClientPrincipal = (user?: AuthenticatedUser) => user?.kind === "client" || user?.kind === "embed";

/**
 * Connect Tally limits, keyed on the grant or client rather than the IP (many merchants share a partner's servers).
 * User principals are never throttled.
 */
export const throttlerOptions: ThrottlerModuleOptions = {
  throttlers: [
    {
      // One bucket per grant across every route it can reach.
      name: "grant",
      ttl: MINUTE_MS,
      limit: 60,
      skipIf: (ctx) => !isClientPrincipal(userOf(ctx)),
      getTracker: (req) => (req as Req).user!.grantId!,
      generateKey: (_ctx, tracker, name) => `${name}:${tracker}`,
    },
    {
      name: "client",
      ttl: MINUTE_MS,
      limit: 10,
      skipIf: (ctx) => routeLimit(ctx) !== "client",
      // The token endpoint is public: the Basic client_id names the client before it is authenticated.
      getTracker: (req) => {
        const r = req as Req;
        return r.user?.clientId ?? parseBasicAuth(r.headers["authorization"])?.clientId ?? r.ip ?? "unknown";
      },
    },
    {
      name: "ip",
      ttl: MINUTE_MS,
      limit: 60,
      skipIf: (ctx) => routeLimit(ctx) !== "ip",
    },
  ],
};

/** The stock throttler with the API's error body (`code: rate_limited`). */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override async throwThrottlingException(): Promise<void> {
    throw new HttpException(
      { statusCode: HttpStatus.TOO_MANY_REQUESTS, error: "Too Many Requests", message: "Too many requests, retry shortly", code: "rate_limited" },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
