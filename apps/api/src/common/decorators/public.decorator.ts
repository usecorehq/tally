import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/** Skips the global AuthGuard. Only for health checks, webhooks and client-authenticated OAuth endpoints; never money-touching routes. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
