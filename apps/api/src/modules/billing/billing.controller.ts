import { Body, Controller, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser, type AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { BusinessParams } from "../businesses/businesses.dto";
import { SubscribeBody, UsageQuery } from "./billing.dto";
import { BillingService } from "./billing.service";

@ApiTags("billing")
@ApiBearerAuth("bearer")
@Controller()
export class BillingController {
  constructor(private readonly usage: BillingService) {}

  @Get("plans")
  @ApiOperation({ summary: "The plans a business can be on, in display order. Prices are for display only." })
  @ApiOkResponse({
    schema: {
      example: [
        { code: "free", name: "Free", price_kobo_monthly: 0, daily_stocktake_limit: 5, max_concurrent_runs: 1 },
        { code: "pro", name: "Pro", price_kobo_monthly: 1500000, daily_stocktake_limit: 100, max_concurrent_runs: 3 },
      ],
    },
  })
  plans() {
    return this.usage.plans();
  }

  @Get("businesses/:businessId/usage")
  @ApiOperation({
    summary:
      "The business's plan and its stock-takes and quick scans: today, this month (with the agent's tokens), per day for the last `days` days (1–90, default 30) and by app. Days are Lagos days. Members only.",
  })
  @ApiOkResponse({
    schema: {
      example: {
        plan: { code: "free", name: "Free", daily_stocktake_limit: 5, max_concurrent_runs: 1, simulated: false },
        today: { stocktakes: 2, scans: 1 },
        month: { stocktakes: 14, scans: 6, input_tokens: 812000, output_tokens: 41000 },
        daily: [{ date: "2026-10-30", stocktakes: 2, scans: 1 }],
        by_source: [{ client_id: null, name: "Tally", stocktakes: 14 }],
      },
    },
  })
  usageFor(@CurrentUser() user: AuthenticatedUser, @Param() { businessId }: BusinessParams, @Query() { days }: UsageQuery) {
    return this.usage.usage(businessId, user.sub, days ?? 30);
  }

  @Post("businesses/:businessId/subscription")
  @HttpCode(200)
  @ApiOperation({
    summary: "Switch the business's plan (simulated: no payment is taken). Owner only; 400 code unknown_plan for a plan that isn't offered.",
  })
  @ApiOkResponse({
    schema: {
      example: { plan_code: "pro", status: "active", simulated: true, started_at: "2026-10-30T09:00:00.000Z", current_period_end: "2026-11-29T09:00:00.000Z" },
    },
  })
  subscribe(@CurrentUser() user: AuthenticatedUser, @Param() { businessId }: BusinessParams, @Body() body: SubscribeBody) {
    return this.usage.subscribe(businessId, user.sub, body.plan_code);
  }
}
