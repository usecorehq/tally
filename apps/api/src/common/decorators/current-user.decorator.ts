import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export type PrincipalKind = "user" | "client" | "embed";

/**
 * The request principal. `sub` is the shared Qorelly auth.users id for every kind (for client and embed, the
 * merchant who consented); the client fields are set only for Connect Tally tokens.
 */
export interface AuthenticatedUser {
  kind: PrincipalKind;
  sub: string;
  email?: string;
  role?: string;
  aud?: string;
  session_id?: string;
  /** oauth_clients.id */
  clientId?: string;
  grantId?: string;
  /** The token's business; routes with :businessId must match it. */
  businessId?: string;
  scopes?: string[];
  [key: string]: unknown;
}

export type Principal = AuthenticatedUser;

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser | undefined => {
    const req = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    return req.user;
  },
);
