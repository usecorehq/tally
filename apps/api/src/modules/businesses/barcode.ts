/** Codes a phone scanner returns: EAN/UPC digits or Code 128-style alphanumerics. */
export const BARCODE_PATTERN = /^[0-9A-Za-z.\-]{4,64}$/;

/**
 * One stored form per product: scanners return a UPC-A (12 digits) or its EAN-13 (leading zero),
 * so 12-digit codes are stored and looked up as 13.
 */
export function normalizeBarcode(code: string): string {
  const trimmed = code.trim();
  return /^\d{12}$/.test(trimmed) ? `0${trimmed}` : trimmed;
}

/** Postgres unique_violation, whether raw or wrapped by drizzle (DrizzleQueryError.cause). */
export function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
}
