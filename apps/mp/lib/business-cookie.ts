// The business the merchant last worked in. Only an id, so the browser may write it too.
export const BUSINESS_COOKIE = "tally-business";
export const BUSINESS_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Client side: remember the business the merchant is looking at. */
export function rememberBusiness(id: string) {
  document.cookie = `${BUSINESS_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=${BUSINESS_COOKIE_MAX_AGE}; samesite=lax`;
}
