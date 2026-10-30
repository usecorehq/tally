import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { BusinessesService } from "../businesses/businesses.service";
import { UsageLimitException } from "./usage-errors";
import { UsageRepository } from "./usage.repository";

/** Seconds a client waits when every run slot is busy: about a quarter of a stock-take. */
const CONCURRENCY_RETRY_SECONDS = 30;

@Injectable()
export class UsageService {
  constructor(
    private readonly repo: UsageRepository,
    private readonly businesses: BusinessesService,
  ) {}

  /**
   * Before a stock-take run, rerun or quick scan: the business's plan, then the partner app's own cap. 429 when over.
   * Not atomic: two starts at the same moment can both pass and overshoot by one. Accepted for v1 (no locks).
   */
  async limitCheck(businessId: string, clientId: string | null): Promise<void> {
    const [{ plan }, business] = await Promise.all([this.repo.planFor(businessId), this.repo.today({ businessId })]);
    if (business.used >= plan.dailyStocktakeLimit) {
      throw new UsageLimitException(
        "plan_limit",
        `The ${plan.name} plan allows ${plan.dailyStocktakeLimit} stock-takes a day. It resets at midnight.`,
        business.secondsToMidnight,
      );
    }
    if (business.running >= plan.maxConcurrentRuns) {
      throw new UsageLimitException("concurrent_runs", "Too many stock-takes are running for this business. Wait for one to finish.", CONCURRENCY_RETRY_SECONDS);
    }
    if (!clientId) return;

    const [client, usage] = await Promise.all([this.repo.client(clientId), this.repo.today({ clientId })]);
    if (!client) return;
    if (usage.used >= client.dailyStocktakeCap) {
      throw new UsageLimitException("client_cap", "This app has reached its daily stock-take limit. It resets at midnight.", usage.secondsToMidnight);
    }
    if (usage.running >= client.maxConcurrentRuns) {
      throw new UsageLimitException("concurrent_runs", "This app has too many stock-takes running. Wait for one to finish.", CONCURRENCY_RETRY_SECONDS);
    }
  }

  async plans() {
    const rows = await this.repo.activePlans();
    return rows.map((p) => ({
      code: p.code,
      name: p.name,
      price_kobo_monthly: p.priceKoboMonthly,
      daily_stocktake_limit: p.dailyStocktakeLimit,
      max_concurrent_runs: p.maxConcurrentRuns,
    }));
  }

  /** Counts only: plan prices never appear here, and nothing is revenue. */
  async usage(businessId: string, userId: string, days: number) {
    await this.businesses.getForMember(businessId, userId);
    const [{ plan, simulated }, daily, month, bySource] = await Promise.all([
      this.repo.planFor(businessId),
      this.repo.daily(businessId, days),
      this.repo.month(businessId),
      this.repo.bySource(businessId),
    ]);
    const today = daily[daily.length - 1] ?? { stocktakes: 0, scans: 0 };
    return {
      plan: {
        code: plan.code,
        name: plan.name,
        daily_stocktake_limit: plan.dailyStocktakeLimit,
        max_concurrent_runs: plan.maxConcurrentRuns,
        simulated: simulated ?? false,
      },
      today: { stocktakes: today.stocktakes, scans: today.scans },
      month: { stocktakes: month.stocktakes, scans: month.scans, input_tokens: month.inputTokens, output_tokens: month.outputTokens },
      daily,
      by_source: bySource.map((s) => ({ client_id: s.clientId, name: s.clientId ? (s.name ?? "Unknown app") : "Tally", stocktakes: s.stocktakes })),
    };
  }

  /** Simulated: switches the plan at once, takes no payment and records no revenue. Owners only. */
  async subscribe(businessId: string, userId: string, planCode: string) {
    const business = await this.businesses.getForMember(businessId, userId);
    if (business.role !== "owner") {
      throw new ForbiddenException({ statusCode: 403, error: "Forbidden", message: "Only the business owner can change the plan", code: "not_owner" });
    }
    const plan = await this.repo.activePlan(planCode);
    if (!plan) {
      throw new BadRequestException({ statusCode: 400, error: "Bad Request", message: `No plan '${planCode}'`, code: "unknown_plan" });
    }
    const sub = await this.repo.subscribe(businessId, plan.code);
    return {
      plan_code: sub.planCode,
      status: sub.status,
      simulated: true as const,
      started_at: sub.startedAt,
      current_period_end: sub.currentPeriodEnd,
    };
  }
}
