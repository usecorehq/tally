import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, ne, notExists, schema, sql } from "@tally/db";
import { TALLY_DB, type TallyDb } from "../../drizzle/drizzle.module";

const { businessSubscriptions, oauthClients, plans, visionAgentRuns, visionScans } = schema;

/** Midnight in Lagos (UTC+1, no DST), `days` days before today's; 0 = the start of today. */
const lagosDayStart = (days = 0) =>
  sql`(date_trunc('day', now() at time zone 'Africa/Lagos') - make_interval(days => ${days}::int)) at time zone 'Africa/Lagos'`;
const lagosMonthStart = sql`date_trunc('month', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos'`;
const lagosDate = (col: typeof visionScans.createdAt | typeof visionAgentRuns.startedAt) =>
  sql<string>`to_char(${col} at time zone 'Africa/Lagos', 'YYYY-MM-DD')`;

/** A run lost to a restart stays "running" until read; past this it no longer holds a concurrency slot (STALE_RUN_MS). */
const RUNNING_FOR_AT_MOST = sql`interval '300 seconds'`;

/** Runs that gave the merchant something: a failed run is on Tally, not on the plan. */
const counted = ne(visionAgentRuns.status, "failed");
/** Quick scans: scans no run points at (a run's own scan is the run). Stored only on success. */
const quickScan = notExists(
  sql`(select 1 from ${visionAgentRuns} r where r.business_id = ${visionScans.businessId} and r.scan_id = ${visionScans.id})`,
);

export type PlanRow = Pick<schema.Plan, "code" | "name" | "priceKoboMonthly" | "dailyStocktakeLimit" | "maxConcurrentRuns">;

@Injectable()
export class UsageRepository {
  constructor(@Inject(TALLY_DB) private readonly db: TallyDb) {}

  async activePlans(): Promise<PlanRow[]> {
    return this.db
      .select({
        code: plans.code,
        name: plans.name,
        priceKoboMonthly: plans.priceKoboMonthly,
        dailyStocktakeLimit: plans.dailyStocktakeLimit,
        maxConcurrentRuns: plans.maxConcurrentRuns,
      })
      .from(plans)
      .where(eq(plans.active, true))
      .orderBy(asc(plans.sort), asc(plans.code));
  }

  async activePlan(code: string): Promise<PlanRow | undefined> {
    const rows = await this.activePlans();
    return rows.find((p) => p.code === code);
  }

  /** The business's plan: its active, unexpired subscription's, else 'free'. `simulated` is null without a subscription. */
  async planFor(businessId: string): Promise<{ plan: PlanRow; simulated: boolean | null }> {
    const [sub] = await this.db
      .select({
        code: plans.code,
        name: plans.name,
        priceKoboMonthly: plans.priceKoboMonthly,
        dailyStocktakeLimit: plans.dailyStocktakeLimit,
        maxConcurrentRuns: plans.maxConcurrentRuns,
        simulated: businessSubscriptions.simulated,
      })
      .from(businessSubscriptions)
      .innerJoin(plans, eq(plans.code, businessSubscriptions.planCode))
      .where(
        and(
          eq(businessSubscriptions.businessId, businessId),
          eq(businessSubscriptions.status, "active"),
          sql`${businessSubscriptions.currentPeriodEnd} > now()`,
        ),
      );
    if (sub) {
      const { simulated, ...plan } = sub;
      return { plan, simulated };
    }
    const [free] = await this.db
      .select({
        code: plans.code,
        name: plans.name,
        priceKoboMonthly: plans.priceKoboMonthly,
        dailyStocktakeLimit: plans.dailyStocktakeLimit,
        maxConcurrentRuns: plans.maxConcurrentRuns,
      })
      .from(plans)
      .where(eq(plans.code, "free"));
    if (!free) throw new Error("The 'free' plan is missing from tally.plans");
    return { plan: free, simulated: null };
  }

  async client(clientId: string): Promise<Pick<schema.OauthClient, "dailyStocktakeCap" | "maxConcurrentRuns"> | undefined> {
    const [row] = await this.db
      .select({ dailyStocktakeCap: oauthClients.dailyStocktakeCap, maxConcurrentRuns: oauthClients.maxConcurrentRuns })
      .from(oauthClients)
      .where(eq(oauthClients.id, clientId));
    return row;
  }

  /**
   * Today's (Lagos) stock-takes + quick scans and running runs, for a business or for a client across businesses,
   * plus the seconds to the next Lagos midnight.
   */
  async today(by: { businessId: string } | { clientId: string }): Promise<{ used: number; running: number; secondsToMidnight: number }> {
    const runOwner = "businessId" in by ? eq(visionAgentRuns.businessId, by.businessId) : eq(visionAgentRuns.clientId, by.clientId);
    const scanOwner = "businessId" in by ? eq(visionScans.businessId, by.businessId) : eq(visionScans.clientId, by.clientId);
    const [row] = await this.db
      .select({
        runs: sql<number>`count(*) filter (where ${counted} and ${visionAgentRuns.startedAt} >= ${lagosDayStart()})::int`,
        running: sql<number>`count(*) filter (where ${visionAgentRuns.status} = 'running' and ${visionAgentRuns.startedAt} > now() - ${RUNNING_FOR_AT_MOST})::int`,
        scans: sql<number>`(select count(*) from ${visionScans} where ${scanOwner} and ${visionScans.createdAt} >= ${lagosDayStart()} and ${quickScan})::int`,
        secondsToMidnight: sql<number>`ceil(extract(epoch from ${lagosDayStart(-1)} - now()))::int`,
      })
      .from(visionAgentRuns)
      // Only today's and running rows matter; the (business_id, started_at) index serves the business case.
      .where(and(runOwner, sql`(${visionAgentRuns.startedAt} >= ${lagosDayStart()} or ${visionAgentRuns.status} = 'running')`));
    return { used: row!.runs + row!.scans, running: row!.running, secondsToMidnight: row!.secondsToMidnight };
  }

  /** Stock-takes and quick scans per Lagos day for the last `days` days (today included), oldest first, gaps filled. */
  async daily(businessId: string, days: number): Promise<{ date: string; stocktakes: number; scans: number }[]> {
    const from = lagosDayStart(days - 1);
    const [runs, scans, dates] = await Promise.all([
      this.db
        .select({ date: lagosDate(visionAgentRuns.startedAt), n: sql<number>`count(*)::int` })
        .from(visionAgentRuns)
        .where(and(eq(visionAgentRuns.businessId, businessId), counted, sql`${visionAgentRuns.startedAt} >= ${from}`))
        .groupBy(sql`1`),
      this.db
        .select({ date: lagosDate(visionScans.createdAt), n: sql<number>`count(*)::int` })
        .from(visionScans)
        .where(and(eq(visionScans.businessId, businessId), quickScan, sql`${visionScans.createdAt} >= ${from}`))
        .groupBy(sql`1`),
      this.db.execute<{ date: string }>(
        sql`select to_char(d, 'YYYY-MM-DD') as date from generate_series((${from}) at time zone 'Africa/Lagos', now() at time zone 'Africa/Lagos', interval '1 day') d`,
      ),
    ]);
    const runsBy = new Map(runs.map((r) => [r.date, r.n]));
    const scansBy = new Map(scans.map((r) => [r.date, r.n]));
    return [...dates].map(({ date }) => ({ date, stocktakes: runsBy.get(date) ?? 0, scans: scansBy.get(date) ?? 0 }));
  }

  /** This Lagos month: stock-takes, quick scans and the runs' tokens. */
  async month(businessId: string): Promise<{ stocktakes: number; scans: number; inputTokens: number; outputTokens: number }> {
    const [runs] = await this.db
      .select({
        stocktakes: sql<number>`count(*) filter (where ${counted})::int`,
        // Tokens of every run, failed ones included: they were spent.
        inputTokens: sql<number>`coalesce(sum(${visionAgentRuns.inputTokens}), 0)::bigint`.mapWith(Number),
        outputTokens: sql<number>`coalesce(sum(${visionAgentRuns.outputTokens}), 0)::bigint`.mapWith(Number),
      })
      .from(visionAgentRuns)
      .where(and(eq(visionAgentRuns.businessId, businessId), sql`${visionAgentRuns.startedAt} >= ${lagosMonthStart}`));
    const [scans] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(visionScans)
      .where(and(eq(visionScans.businessId, businessId), quickScan, sql`${visionScans.createdAt} >= ${lagosMonthStart}`));
    return { stocktakes: runs!.stocktakes, scans: scans!.n, inputTokens: runs!.inputTokens, outputTokens: runs!.outputTokens };
  }

  /** This Lagos month's stock-takes by the app that started them; clientId null = Tally's own apps. */
  async bySource(businessId: string): Promise<{ clientId: string | null; name: string | null; stocktakes: number }[]> {
    return this.db
      .select({ clientId: oauthClients.clientId, name: oauthClients.name, stocktakes: sql<number>`count(*)::int` })
      .from(visionAgentRuns)
      .leftJoin(oauthClients, eq(oauthClients.id, visionAgentRuns.clientId))
      .where(and(eq(visionAgentRuns.businessId, businessId), counted, sql`${visionAgentRuns.startedAt} >= ${lagosMonthStart}`))
      .groupBy(oauthClients.clientId, oauthClients.name)
      .orderBy(sql`count(*) desc`);
  }

  /** One row per business: replaced on every subscribe. Simulated: no payment is taken or recorded. */
  async subscribe(businessId: string, planCode: string): Promise<schema.BusinessSubscription> {
    const values = {
      planCode,
      status: "active",
      simulated: true,
      startedAt: sql`now()`,
      currentPeriodEnd: sql`now() + interval '30 days'`,
      updatedAt: sql`now()`,
    };
    const [row] = await this.db
      .insert(businessSubscriptions)
      .values({ businessId, ...values })
      .onConflictDoUpdate({ target: businessSubscriptions.businessId, set: values })
      .returning();
    return row!;
  }
}
