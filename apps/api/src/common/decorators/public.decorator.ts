import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/** Skips the global SupabaseJwtGuard. Only for health checks and provider webhooks, never money-touching routes. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
