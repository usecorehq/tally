export const VARIANTS = [
  "loading",
  "account",
  "business",
  "consent",
  "consent-single",
  "consent-connected",
  "consent-no-logo",
  "allow-error",
  "no-business",
  "error-client",
  "failed",
] as const;
export type Variant = (typeof VARIANTS)[number];
