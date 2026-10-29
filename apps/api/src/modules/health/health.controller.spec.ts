import { describe, expect, it, jest } from "@jest/globals";
import { ConfigService } from "@nestjs/config";
import { CatalogService } from "../catalog/catalog.service";
import { HealthController } from "./health.controller";

const config = { getOrThrow: (k: string) => ({ "catalog.baseUrl": "https://catalog.test", "catalog.apiKey": "qc_test_not_real" })[k] } as unknown as ConfigService;

function setup(whoAmI: () => Promise<unknown>) {
  const catalog = new CatalogService(config);
  const spy = jest.spyOn(catalog.client, "whoAmI").mockImplementation(whoAmI as never);
  jest.spyOn(catalog.client, "health").mockResolvedValue({ status: "ok", db: "up" } as never);
  return { health: new HealthController(catalog), spy };
}

describe("HealthController", () => {
  it("reports a key Qore Catalog accepts, cached between probes", async () => {
    const { health, spy } = setup(async () => ({ name: "tally staging", prefix: "THVM", scopes: [], expiresAt: null, createdAt: "" }));
    const res = await health.check();
    expect(res.catalog).toEqual({ status: "ok", db: "up", key: "valid" });
    await health.check();
    expect(spy).toHaveBeenCalledTimes(1);
    // Nothing about the key itself is exposed.
    expect(JSON.stringify(res)).not.toMatch(/THVM|tally staging|qc_test/);
  });

  it.each([401, 403])("reports a revoked key (%i) as rejected", async (status) => {
    const { health } = setup(async () => Promise.reject(Object.assign(new Error("Catalog GET /v1/keys/me failed"), { status })));
    expect((await health.check()).catalog.key).toBe("rejected");
  });

  it("an outage is unknown, not rejected, and is asked again next time", async () => {
    const { health, spy } = setup(async () => Promise.reject(Object.assign(new Error("down"), { status: 503 })));
    expect((await health.check()).catalog.key).toBe("unknown");
    await health.check();
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
