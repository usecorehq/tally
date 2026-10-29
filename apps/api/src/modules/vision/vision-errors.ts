import {
  ArgumentsHost,
  BadGatewayException,
  BadRequestException,
  Catch,
  ExceptionFilter,
  GatewayTimeoutException,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";
import { MetaModelError } from "./meta-model.client";

/** 503 with Retry-After; VisionExceptionFilter writes the header. */
export class VisionRateLimitedException extends HttpException {
  constructor(readonly retryAfterSeconds: number) {
    super("Recognition busy, retry shortly", HttpStatus.SERVICE_UNAVAILABLE);
  }
}

/** Adds Retry-After to the model API's 503; the body matches Nest's default shape. */
@Catch(VisionRateLimitedException)
export class VisionExceptionFilter implements ExceptionFilter {
  catch(exception: VisionRateLimitedException, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    res
      .status(exception.getStatus())
      .setHeader("Retry-After", String(exception.retryAfterSeconds))
      .json({ statusCode: exception.getStatus(), message: exception.message });
  }
}

const logger = new Logger("Vision");

/**
 * Maps a Meta Model API failure to a client-safe HttpException; never echoes the key or upstream body.
 * Only image/content-policy 400s are the caller's fault; timeout → 504, 429 → 503, the rest → 502.
 */
export function toVisionHttpException(err: unknown): HttpException {
  if (!(err instanceof MetaModelError)) {
    logger.warn(`Recognition failed: ${err instanceof Error ? err.message : "unknown error"}`);
    return new BadGatewayException("Recognition failed");
  }
  if (err.timedOut) return new GatewayTimeoutException("Recognition timed out");
  switch (err.status) {
    case 400:
      if (err.code === "content_policy_violation") return new BadRequestException("Image was rejected by the model's content policy");
      if (/image/i.test(err.message)) return new BadRequestException("Image could not be read");
      logger.error(`Model API rejected the request (400): ${err.message}`);
      return new BadGatewayException("Recognition failed");
    case 401:
    case 403:
      logger.error(`Model API rejected Tally's key (${err.status}); check META_MODEL_API_KEY`);
      return new BadGatewayException("Recognition misconfigured");
    case 429:
      logger.warn("Model API rate limit hit (429)");
      return new VisionRateLimitedException(err.retryAfter ?? 10);
    default:
      logger.warn(`Model API error ${err.status || err.code}`);
      return new BadGatewayException("Recognition failed");
  }
}
