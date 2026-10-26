import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/**
 * Skip the global SupabaseJwtGuard on the decorated route or controller.
 * Reserved for: health checks and provider webhooks. Do NOT use for anything
 * money-touching.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
