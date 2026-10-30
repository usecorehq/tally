import type { StocktakeApi } from "../../stocktake/api-context";
import type { ScanView, StocktakeRun } from "../../stocktake/types";
import type { EmbedAuth } from "@/lib/embed-api";
import { DETECTIONS, OUTCOME, STEPS } from "../../design/stocktake/fixtures";

// The harness's data layer (fixture client on dev and preview deploys only): fixture data, no API calls.
// Scenarios: ok, revoked (every call answers grant_revoked), limit (runs and scans answer plan_limit).

export type MockScenario = "ok" | "revoked" | "limit";

const RUN_MS = 9_000;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function openScan(scanId: string): ScanView {
  return {
    scanId,
    status: "open",
    createdAt: new Date().toISOString(),
    confirmedAt: null,
    discardedAt: null,
    supersededAt: null,
    rerunOf: null,
    canRerun: true,
    catalogueAvailable: true,
    detections: DETECTIONS,
  };
}

export function createMockApi(scenario: MockScenario, auth: EmbedAuth): StocktakeApi {
  const runs = new Map<string, number>();
  const revoked = () => {
    auth.onAuthError("grant_revoked", "This app's access to your Tally business was removed. Reconnect it to continue.");
    return { ok: false as const, status: 401, error: "This app's access to your Tally business was removed. Reconnect it to continue." };
  };
  const limited = {
    ok: false as const,
    status: 429,
    error: "Today's stock-takes on this plan are used up.",
    limit: { code: "plan_limit" as const, retry_after_seconds: 3600 },
  };
  const start = async () => {
    await wait(700);
    if (scenario === "revoked") return revoked();
    if (scenario === "limit") return limited;
    const runId = `run-mock-${runs.size + 1}`;
    runs.set(runId, Date.now());
    return { ok: true as const, data: { runId } };
  };

  return {
    startStocktake: start,
    rerunScan: start,
    async pollStocktake(_businessId, runId) {
      if (scenario === "revoked") return revoked();
      const startedAt = runs.get(runId) ?? Date.now() - RUN_MS;
      const elapsed = Date.now() - startedAt;
      const done = elapsed >= RUN_MS;
      const steps = STEPS.slice(0, done ? STEPS.length : Math.floor((elapsed / RUN_MS) * STEPS.length));
      const scanId = `scan-${runId}`;
      const data: StocktakeRun = {
        run: { id: runId, status: done ? "done" : "running", scanId: done ? scanId : null, turns: steps.length, error: null, startedAt: new Date(startedAt).toISOString() },
        steps,
        result: done ? openScan(scanId) : null,
      };
      return { ok: true, data };
    },
    async getScan(_businessId, scanId) {
      if (scenario === "revoked") return revoked();
      return { ok: true, data: openScan(scanId) };
    },
    async discardScan() {
      await wait(400);
      return scenario === "revoked" ? revoked() : { ok: true, data: { status: "discarded" as const } };
    },
    async checkPhoto() {
      await wait(800);
      if (scenario === "revoked") return revoked();
      return {
        ok: true,
        data: { verdict: "good", issues: [], instruction: "", productsVisible: 7, labelsLegible: "most", region: null, model: "fixture", ms: 800 },
      };
    },
    async quickScan() {
      await wait(2_500);
      if (scenario === "revoked") return revoked();
      if (scenario === "limit") return limited;
      return { ok: true, data: { scanId: `scan-quick-${Date.now()}`, catalogueAvailable: true, detections: DETECTIONS } };
    },
    async confirmScan() {
      await wait(1_200);
      return scenario === "revoked" ? revoked() : { ok: true, data: OUTCOME };
    },
    async searchCatalogue() {
      return { ok: true, data: [] };
    },
    async catalogueProduct() {
      return { ok: false, status: 404, error: "Not in the fixture catalogue." };
    },
  };
}
