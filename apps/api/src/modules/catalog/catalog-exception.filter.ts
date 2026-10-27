import { ArgumentsHost, Catch, ExceptionFilter } from "@nestjs/common";
import type { Response } from "express";
import { CatalogRateLimitedException } from "./catalog-errors";

/** Adds Retry-After to the catalogue's 503; the body matches Nest's default shape. */
@Catch(CatalogRateLimitedException)
export class CatalogExceptionFilter implements ExceptionFilter {
  catch(exception: CatalogRateLimitedException, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    res
      .status(exception.getStatus())
      .setHeader("Retry-After", String(CatalogRateLimitedException.RETRY_AFTER_SECONDS))
      .json({ statusCode: exception.getStatus(), message: exception.message });
  }
}
