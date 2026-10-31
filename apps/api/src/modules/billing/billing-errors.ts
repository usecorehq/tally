import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import type { Response } from "express";

export type LimitCode = "plan_limit" | "client_cap" | "concurrent_runs";

/** 429 for a plan, client or concurrency limit; UsageLimitFilter adds Retry-After. */
export class UsageLimitException extends HttpException {
  constructor(
    readonly code: LimitCode,
    message: string,
    readonly retryAfterSeconds: number,
  ) {
    super({ statusCode: HttpStatus.TOO_MANY_REQUESTS, code, message, retry_after_seconds: retryAfterSeconds }, HttpStatus.TOO_MANY_REQUESTS);
  }
}

/** Global (BillingModule's APP_FILTER), so vision routes get the header without a filter of their own. */
@Catch(UsageLimitException)
export class UsageLimitFilter implements ExceptionFilter {
  catch(exception: UsageLimitException, host: ArgumentsHost) {
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(exception.getStatus())
      .setHeader("Retry-After", String(exception.retryAfterSeconds))
      .json(exception.getResponse());
  }
}
