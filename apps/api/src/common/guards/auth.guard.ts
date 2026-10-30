import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpStatus,
  Injectable,
  Logger,
  Optional,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import * as jwt from "jsonwebtoken";
import JwksRsa from "jwks-rsa";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { SCOPES_KEY } from "../decorators/scopes.decorator";
import type { AuthenticatedUser, PrincipalKind } from "../decorators/current-user.decorator";
import { CLIENT_TOKEN_AUDIENCE, EMBED_TOKEN_AUDIENCE, TOKEN_ISSUER } from "../../modules/clients/oauth";
import { GrantStatusService } from "./grant-status.service";

const CLIENT_AUDIENCES: Record<string, PrincipalKind> = { [CLIENT_TOKEN_AUDIENCE]: "client", [EMBED_TOKEN_AUDIENCE]: "embed" };

/**
 * Supabase access tokens: HS256 against the shared secret or ES256/RS256 via JWKS, alg pinned per source.
 * `aud: authenticated` is enforced so the anon/service-role keys (same secret, no aud/sub) never pass as a user.
 * Connect Tally tokens (`aud` tally-client / tally-embed) verify only with TALLY_CLIENT_JWT_SECRET, never the Supabase one.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);
  private jwksClient?: JwksRsa.JwksClient;

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    // Absent in specs that only exercise user tokens; client tokens then fail closed.
    @Optional() private readonly grants?: GrantStatusService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      params?: Record<string, string | undefined>;
      user?: AuthenticatedUser;
    }>();
    const auth = req.headers["authorization"] ?? req.headers["Authorization"];
    if (!auth || !auth.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token");
    }
    const token = auth.slice("Bearer ".length).trim();

    const clientKind = this.clientKind(token);
    if (clientKind) {
      req.user = await this.verifyClientToken(token, clientKind);
      this.authorizeClient(context, req.user, req.params?.businessId);
      return true;
    }

    const payload = await this.verifyToken(token);

    // Belt and braces on top of the audience check — API-key roles are never
    // request principals.
    if (payload.role === "anon" || payload.role === "service_role") {
      throw new UnauthorizedException("Invalid token");
    }
    if (!payload.sub) throw new UnauthorizedException("Token missing sub");

    req.user = {
      kind: "user",
      sub: String(payload.sub),
      email: payload.email as string | undefined,
      role: payload.role as string | undefined,
      aud: typeof payload.aud === "string" ? payload.aud : undefined,
      session_id: payload.session_id as string | undefined,
    };
    return true;
  }

  /** Routes by the unverified `aud`; the matching verifier then pins that audience, so a wrong guess just fails. */
  private clientKind(token: string): PrincipalKind | undefined {
    const decoded = jwt.decode(token, { json: true });
    return typeof decoded?.aud === "string" ? CLIENT_AUDIENCES[decoded.aud] : undefined;
  }

  private async verifyClientToken(token: string, kind: PrincipalKind): Promise<AuthenticatedUser> {
    const secret = this.config.get<string>("clients.jwtSecret");
    if (!secret || !this.grants) {
      this.logger.error("Connect Tally token received but TALLY_CLIENT_JWT_SECRET or GrantStatusService is missing");
      throw new UnauthorizedException("Invalid token");
    }
    const audience = kind === "embed" ? EMBED_TOKEN_AUDIENCE : CLIENT_TOKEN_AUDIENCE;
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(token, secret, { algorithms: ["HS256"], audience, issuer: TOKEN_ISSUER }) as jwt.JwtPayload;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) throw unauthorized("token_expired", "Token expired");
      this.logger.debug(`Client JWT verification failed: ${(err as Error).message}`);
      throw new UnauthorizedException("Invalid token");
    }
    const { sub, bid, cid, gid, scope } = payload as Record<string, unknown>;
    if (![sub, bid, cid, gid, scope].every((v) => typeof v === "string" && v.length > 0)) {
      throw new UnauthorizedException("Invalid token");
    }
    const principal: AuthenticatedUser = {
      kind,
      sub: sub as string,
      aud: audience,
      clientId: cid as string,
      grantId: gid as string,
      businessId: bid as string,
      scopes: (scope as string).split(" ").filter(Boolean),
    };
    const live = await this.grants.isLive({
      grantId: principal.grantId!,
      clientId: principal.clientId!,
      businessId: principal.businessId!,
      userId: principal.sub,
    });
    if (!live) throw unauthorized("grant_revoked", "This app's access was revoked");
    return principal;
  }

  /** Client and embed tokens reach only @Scopes routes, holding every scope, on their own business. */
  private authorizeClient(context: ExecutionContext, principal: AuthenticatedUser, routeBusinessId: string | undefined) {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(SCOPES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) throw forbidden("client_not_allowed", "This route is not available to connected apps");
    const missing = required.filter((s) => !principal.scopes!.includes(s));
    if (missing.length > 0) throw forbidden("insufficient_scope", `Missing scope: ${missing.join(" ")}`);
    if (routeBusinessId !== undefined && routeBusinessId !== principal.businessId) {
      throw forbidden("business_mismatch", "This token is for a different business");
    }
  }

  private async verifyToken(token: string): Promise<jwt.JwtPayload> {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded) throw new UnauthorizedException("Invalid token");
    const { alg, kid } = decoded.header;

    try {
      if (alg === "HS256") {
        const secret = this.config.get<string>("supabase.jwtSecret");
        if (!secret) {
          this.logger.error("SUPABASE_JWT_SECRET not configured");
          throw new UnauthorizedException();
        }
        return jwt.verify(token, secret, {
          algorithms: ["HS256"],
          audience: "authenticated",
        }) as jwt.JwtPayload;
      }

      if (alg === "ES256" || alg === "RS256") {
        const key = await this.getJwksKey(kid);
        return jwt.verify(token, key, {
          algorithms: ["ES256", "RS256"],
          audience: "authenticated",
        }) as jwt.JwtPayload;
      }

      // Anything else ('none' included) is not a Supabase user token.
      throw new UnauthorizedException("Invalid token");
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      this.logger.debug(`JWT verification failed (${alg}): ${(err as Error).message}`);
      throw new UnauthorizedException("Invalid token");
    }
  }

  private async getJwksKey(kid: string | undefined): Promise<string> {
    if (!this.jwksClient) {
      const supabaseUrl = this.config.get<string>("supabase.url");
      if (!supabaseUrl) {
        this.logger.error(
          "Received an asymmetrically-signed token but SUPABASE_URL is not configured — cannot resolve JWKS",
        );
        throw new UnauthorizedException("Invalid token");
      }
      this.jwksClient = new JwksRsa.JwksClient({
        jwksUri: `${supabaseUrl.replace(/\/+$/, "")}/auth/v1/.well-known/jwks.json`,
        cache: true,
        cacheMaxAge: 10 * 60 * 1000,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        timeout: 5_000,
      });
    }
    const key = await this.jwksClient.getSigningKey(kid);
    return key.getPublicKey();
  }
}

function unauthorized(code: string, message: string) {
  return new UnauthorizedException({ statusCode: HttpStatus.UNAUTHORIZED, error: "Unauthorized", message, code });
}

function forbidden(code: string, message: string) {
  return new ForbiddenException({ statusCode: HttpStatus.FORBIDDEN, error: "Forbidden", message, code });
}
