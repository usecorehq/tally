import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { CanActivate, ExecutionContext, ForbiddenException, INestApplication, ValidationPipe } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { BusinessesService } from "../businesses/businesses.service";
import { UsageLimitException, UsageLimitFilter } from "./billing-errors";
import { BillingController } from "./billing.controller";
import { BillingRepository, type PlanRow } from "./billing.repository";
import { BillingService } from "./billing.service";

// Real controller, service and 429 filter; the repository (SQL) and the membership lookup are mocked.
const USER = "00000000-0000-4000-8000-0000000000aa";
const BIZ = "00000000-0000-4000-8000-000000000001";
const OTHER_BIZ = "00000000-0000-4000-8000-000000000002";
const CLIENT = "00000000-0000-4000-8000-0000000000e1";

const FREE: PlanRow = { code: "free", name: "Free", priceKoboMonthly: 0, dailyStocktakeLimit: 5, maxConcurrentRuns: 1 };
const PRO: PlanRow = { code: "pro", name: "Pro", priceKoboMonthly: 1_500_000, dailyStocktakeLimit: 100, maxConcurrentRuns: 3 };

/** Stands in for the auth guard: every request is this user. */
class AsUser implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    ctx.switchToHttp().getRequest().user = { sub: USER };
    return true;
  }
}

async function app() {
  const repo = {
    activePlans: jest.fn(async () => [FREE, PRO]),
    activePlan: jest.fn(async (code: string) => [FREE, PRO].find((p) => p.code === code)),
    planFor: jest.fn(async (_b: string) => ({ plan: FREE, simulated: null as boolean | null })),
    client: jest.fn(async (_c: string) => ({ dailyStocktakeCap: 200, maxConcurrentRuns: 3 }) as { dailyStocktakeCap: number; maxConcurrentRuns: number } | undefined),
    today: jest.fn(async (_by: { businessId: string } | { clientId: string }) => ({ used: 0, running: 0, secondsToMidnight: 3600 })),
    daily: jest.fn(async (_b: string, _days: number) => [] as { date: string; stocktakes: number; scans: number }[]),
    month: jest.fn(async (_b: string) => ({ stocktakes: 0, scans: 0, inputTokens: 0, outputTokens: 0 })),
    bySource: jest.fn(async (_b: string) => [] as { clientId: string | null; name: string | null; stocktakes: number }[]),
    clientMonth: jest.fn(async (_c: string) => ({ stocktakes: 0, scans: 0 })),
    subscribe: jest.fn(async (businessId: string, planCode: string) => ({
      id: "sub-1",
      businessId,
      planCode,
      status: "active",
      simulated: true,
      startedAt: new Date("2026-10-30T09:00:00Z"),
      currentPeriodEnd: new Date("2026-11-29T09:00:00Z"),
      createdAt: new Date("2026-10-30T09:00:00Z"),
      updatedAt: new Date("2026-10-30T09:00:00Z"),
    })),
  };
  const businesses = { getForMember: jest.fn(async (_b: string, _u: string) => ({ id: BIZ, role: "owner" })) };
  const moduleRef = await Test.createTestingModule({
    controllers: [BillingController],
    providers: [
      BillingService,
      { provide: BillingRepository, useValue: repo },
      { provide: BusinessesService, useValue: businesses },
      { provide: APP_GUARD, useClass: AsUser },
      { provide: APP_FILTER, useClass: UsageLimitFilter },
    ],
  }).compile();
  const nest = moduleRef.createNestApplication({ logger: false });
  nest.setGlobalPrefix("api");
  nest.useGlobalPipes(new ValidationPipe({ transform: true }));
  await nest.init();
  return { nest, repo, businesses, service: nest.get(BillingService) };
}

describe("BillingService.limitCheck", () => {
  let ctx: Awaited<ReturnType<typeof app>>;
  beforeAll(async () => {
    ctx = await app();
  });
  afterAll(() => ctx.nest.close());
  beforeEach(() => {
    jest.clearAllMocks();
    ctx.repo.planFor.mockResolvedValue({ plan: FREE, simulated: null });
    ctx.repo.today.mockResolvedValue({ used: 0, running: 0, secondsToMidnight: 3600 });
    ctx.repo.client.mockResolvedValue({ dailyStocktakeCap: 200, maxConcurrentRuns: 3 });
  });

  const rejection = (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e as UsageLimitException);

  it("passes under the plan's daily limit", async () => {
    ctx.repo.today.mockResolvedValue({ used: 4, running: 0, secondsToMidnight: 3600 });
    await expect(ctx.service.limitCheck(BIZ, null)).resolves.toBeUndefined();
  });

  it("free at its limit: 429 plan_limit, retrying at the next Lagos midnight", async () => {
    ctx.repo.today.mockResolvedValue({ used: 5, running: 0, secondsToMidnight: 7_384 });
    const err = await rejection(ctx.service.limitCheck(BIZ, null));
    expect(err).toBeInstanceOf(UsageLimitException);
    expect(err!.getStatus()).toBe(429);
    expect(err!.retryAfterSeconds).toBe(7_384);
    expect(err!.getResponse()).toEqual({ statusCode: 429, code: "plan_limit", message: expect.stringContaining("5 stock-takes a day"), retry_after_seconds: 7_384 });
    expect(ctx.repo.today).toHaveBeenCalledWith({ businessId: BIZ });
  });

  it("pro lifts the limit", async () => {
    ctx.repo.planFor.mockResolvedValue({ plan: PRO, simulated: true });
    ctx.repo.today.mockResolvedValue({ used: 5, running: 0, secondsToMidnight: 7_384 });
    await expect(ctx.service.limitCheck(BIZ, null)).resolves.toBeUndefined();
  });

  it("a run already running on free: 429 concurrent_runs, retry in 30 s", async () => {
    ctx.repo.today.mockResolvedValue({ used: 1, running: 1, secondsToMidnight: 3600 });
    const err = await rejection(ctx.service.limitCheck(BIZ, null));
    expect(err!.getResponse()).toMatchObject({ code: "concurrent_runs", retry_after_seconds: 30 });
  });

  it("without a client, no client is looked up", async () => {
    await ctx.service.limitCheck(BIZ, null);
    expect(ctx.repo.client).not.toHaveBeenCalled();
    expect(ctx.repo.today).toHaveBeenCalledTimes(1);
  });

  it("the client cap counts the client's runs across every business", async () => {
    ctx.repo.client.mockResolvedValue({ dailyStocktakeCap: 3, maxConcurrentRuns: 3 });
    // This business has used 1 of its 5; the client has used 3 across its businesses.
    ctx.repo.today.mockImplementation(async (by) => ("clientId" in by ? { used: 3, running: 0, secondsToMidnight: 900 } : { used: 1, running: 0, secondsToMidnight: 900 }));
    const err = await rejection(ctx.service.limitCheck(OTHER_BIZ, CLIENT));
    expect(err!.getResponse()).toMatchObject({ code: "client_cap", retry_after_seconds: 900 });
    expect(ctx.repo.today).toHaveBeenCalledWith({ clientId: CLIENT });
    expect(ctx.repo.client).toHaveBeenCalledWith(CLIENT);
  });

  it("the client's own concurrency limit: 429 concurrent_runs", async () => {
    ctx.repo.planFor.mockResolvedValue({ plan: PRO, simulated: true });
    ctx.repo.client.mockResolvedValue({ dailyStocktakeCap: 200, maxConcurrentRuns: 2 });
    ctx.repo.today.mockImplementation(async (by) => ("clientId" in by ? { used: 9, running: 2, secondsToMidnight: 900 } : { used: 1, running: 0, secondsToMidnight: 900 }));
    const err = await rejection(ctx.service.limitCheck(BIZ, CLIENT));
    expect(err!.getResponse()).toMatchObject({ code: "concurrent_runs", retry_after_seconds: 30 });
  });

  it("the plan is checked before the client cap", async () => {
    ctx.repo.today.mockResolvedValue({ used: 5, running: 0, secondsToMidnight: 900 });
    const err = await rejection(ctx.service.limitCheck(BIZ, CLIENT));
    expect(err!.getResponse()).toMatchObject({ code: "plan_limit" });
    expect(ctx.repo.client).not.toHaveBeenCalled();
  });
});

describe("BillingService.clientUsage", () => {
  it("counts today as limitCheck does for the client, plus its month across businesses", async () => {
    const ctx = await app();
    ctx.repo.today.mockResolvedValue({ used: 7, running: 2, secondsToMidnight: 900 });
    ctx.repo.clientMonth.mockResolvedValue({ stocktakes: 41, scans: 9 });
    await expect(ctx.service.clientUsage(CLIENT)).resolves.toEqual({ today: { used: 7, running: 2 }, month: { stocktakes: 41, scans: 9 } });
    expect(ctx.repo.today).toHaveBeenCalledWith({ clientId: CLIENT });
    expect(ctx.repo.clientMonth).toHaveBeenCalledWith(CLIENT);
    await ctx.nest.close();
  });
});

describe("BillingController (HTTP)", () => {
  let ctx: Awaited<ReturnType<typeof app>>;
  const server = () => ctx.nest.getHttpServer();
  beforeAll(async () => {
    ctx = await app();
  });
  afterAll(() => ctx.nest.close());
  beforeEach(() => {
    jest.clearAllMocks();
    ctx.businesses.getForMember.mockResolvedValue({ id: BIZ, role: "owner" });
  });

  it("GET /plans lists the active plans in order, display fields only", async () => {
    const res = await request(server()).get("/api/plans").expect(200);
    expect(res.body).toEqual([
      { code: "free", name: "Free", price_kobo_monthly: 0, daily_stocktake_limit: 5, max_concurrent_runs: 1 },
      { code: "pro", name: "Pro", price_kobo_monthly: 1_500_000, daily_stocktake_limit: 100, max_concurrent_runs: 3 },
    ]);
  });

  it("GET usage: Lagos days from the repository, today = the last day, Tally for no client, no prices", async () => {
    ctx.repo.planFor.mockResolvedValue({ plan: PRO, simulated: true });
    ctx.repo.daily.mockResolvedValue([
      { date: "2026-10-29", stocktakes: 3, scans: 0 },
      { date: "2026-10-30", stocktakes: 0, scans: 0 },
      { date: "2026-10-31", stocktakes: 2, scans: 1 },
    ]);
    ctx.repo.month.mockResolvedValue({ stocktakes: 5, scans: 1, inputTokens: 812_000, outputTokens: 41_000 });
    ctx.repo.bySource.mockResolvedValue([
      { clientId: null, name: null, stocktakes: 4 },
      { clientId: "tc_abcdefghijklmnopqrstuvwx", name: "Partner", stocktakes: 1 },
    ]);
    const res = await request(server()).get(`/api/businesses/${BIZ}/usage?days=3`).expect(200);
    expect(ctx.businesses.getForMember).toHaveBeenCalledWith(BIZ, USER);
    expect(ctx.repo.daily).toHaveBeenCalledWith(BIZ, 3);
    expect(res.body).toEqual({
      plan: { code: "pro", name: "Pro", daily_stocktake_limit: 100, max_concurrent_runs: 3, simulated: true },
      today: { stocktakes: 2, scans: 1 },
      month: { stocktakes: 5, scans: 1, input_tokens: 812_000, output_tokens: 41_000 },
      daily: [
        { date: "2026-10-29", stocktakes: 3, scans: 0 },
        { date: "2026-10-30", stocktakes: 0, scans: 0 },
        { date: "2026-10-31", stocktakes: 2, scans: 1 },
      ],
      by_source: [
        { client_id: null, name: "Tally", stocktakes: 4 },
        { client_id: "tc_abcdefghijklmnopqrstuvwx", name: "Partner", stocktakes: 1 },
      ],
    });
    expect(JSON.stringify(res.body)).not.toMatch(/price|revenue|kobo/);
  });

  it("GET usage defaults to 30 days and accepts 1–90", async () => {
    await request(server()).get(`/api/businesses/${BIZ}/usage`).expect(200);
    expect(ctx.repo.daily).toHaveBeenCalledWith(BIZ, 30);
    await request(server()).get(`/api/businesses/${BIZ}/usage?days=0`).expect(400);
    await request(server()).get(`/api/businesses/${BIZ}/usage?days=91`).expect(400);
    await request(server()).get(`/api/businesses/not-a-uuid/usage`).expect(400);
  });

  it("GET usage is members only", async () => {
    ctx.businesses.getForMember.mockRejectedValueOnce(new ForbiddenException("Not a member of this business"));
    await request(server()).get(`/api/businesses/${BIZ}/usage`).expect(403);
    expect(ctx.repo.daily).not.toHaveBeenCalled();
  });

  it("POST subscription: the owner switches plan, simulated, for 30 days", async () => {
    const res = await request(server()).post(`/api/businesses/${BIZ}/subscription`).send({ plan_code: "pro" }).expect(200);
    expect(ctx.repo.subscribe).toHaveBeenCalledWith(BIZ, "pro");
    expect(res.body).toEqual({
      plan_code: "pro",
      status: "active",
      simulated: true,
      started_at: "2026-10-30T09:00:00.000Z",
      current_period_end: "2026-11-29T09:00:00.000Z",
    });
  });

  it("POST subscription: staff get 403 not_owner and nothing changes", async () => {
    ctx.businesses.getForMember.mockResolvedValueOnce({ id: BIZ, role: "staff" });
    const res = await request(server()).post(`/api/businesses/${BIZ}/subscription`).send({ plan_code: "pro" }).expect(403);
    expect(res.body.code).toBe("not_owner");
    expect(ctx.repo.subscribe).not.toHaveBeenCalled();
  });

  it("POST subscription: an unknown plan is 400 unknown_plan", async () => {
    const res = await request(server()).post(`/api/businesses/${BIZ}/subscription`).send({ plan_code: "enterprise" }).expect(400);
    expect(res.body).toMatchObject({ statusCode: 400, code: "unknown_plan" });
    expect(ctx.repo.subscribe).not.toHaveBeenCalled();
    await request(server()).post(`/api/businesses/${BIZ}/subscription`).send({}).expect(400);
  });
});
