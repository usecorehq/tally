import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { CatalogError } from "@tally/catalog-client";

/** 503 with Retry-After; CatalogExceptionFilter writes the header. */
export class CatalogRateLimitedException extends HttpException {
  static readonly RETRY_AFTER_SECONDS = 30;
  constructor() {
    super("Catalogue busy, retry shortly", HttpStatus.SERVICE_UNAVAILABLE);
  }
}

const logger = new Logger("Catalog");

/**
 * Maps a Qore Catalog failure to a browser-safe HttpException; never exposes the key, upstream URL or raw body.
 * 400/404 pass through, 401/403 → 502 (logged), 429 → 503 + Retry-After, anything else → 502.
 */
export function toHttpException(err: unknown, notFoundMessage: string): HttpException {
  if (!(err instanceof CatalogError)) {
    logger.warn(`Catalogue request failed: ${err instanceof Error ? err.name : "unknown error"}`);
    return new BadGatewayException("Catalogue unavailable");
  }

  switch (err.status) {
    case 400:
      return new BadRequestException(validationMessage(err.body) ?? "Invalid catalogue request");
    case 404:
      return new NotFoundException(notFoundMessage);
    case 401:
    case 403:
      logger.error(`Catalogue rejected Tally's API key (${err.status}); check QORE_CATALOG_API_KEY`);
      return new BadGatewayException("Catalogue access misconfigured");
    case 429:
      logger.warn("Catalogue rate limit hit (429)");
      return new CatalogRateLimitedException();
    default:
      logger.warn(`Catalogue error ${err.status}`);
      return new BadGatewayException("Catalogue unavailable");
  }
}

/** The catalogue's `message` (string or string[]), never the whole body. */
function validationMessage(body: unknown): string | undefined {
  const message = (body as { message?: unknown } | null)?.message;
  if (typeof message === "string") return message;
  if (Array.isArray(message)) return message.filter((m) => typeof m === "string").join("; ") || undefined;
  return undefined;
}
