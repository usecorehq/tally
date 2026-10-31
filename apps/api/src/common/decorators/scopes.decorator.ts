import { SetMetadata } from "@nestjs/common";
import type { OauthScope } from "../../modules/clients/oauth";

export const SCOPES_KEY = "clientScopes";

/** Opens a route to client and embed tokens holding every listed scope; routes without it are user-only. */
export const Scopes = (...scopes: OauthScope[]) => SetMetadata(SCOPES_KEY, scopes);
