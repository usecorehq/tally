import { SetMetadata } from "@nestjs/common";

export const RATE_LIMIT_KEY = "rateLimit";
export type RateLimitKey = "client" | "ip";

/** Adds a route to a named throttler in app.module (per client, or per IP for public routes). */
export const RateLimit = (key: RateLimitKey) => SetMetadata(RATE_LIMIT_KEY, key);
