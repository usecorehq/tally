import { describe, expect, it, jest } from "@jest/globals";
import type { MetaModelClient, ResponsesResult } from "../meta-model.client";
import { indexInventory } from "../inventory-match";
import type { ShelfProduct } from "../shelf-reader";
import { runStocktakeAgent, STOCKTAKE_MODEL, type AgentStep } from "./stocktake-agent";
import { StocktakeSession } from "./stocktake-session";

const product: ShelfProduct = {
  brand: "",
  name: "Garri",
  pack: "",
  look: "white bag",
  count: 3,
  boxes: [{ x1: 10, y1: 10, x2: 300, y2: 400 }],
  confidence: "low",
};

/** A scripted model: each turn returns the next canned response. */
function scripted(turns: Partial<ResponsesResult>[]) {
  const respond = jest.fn(async (_body: Record<string, unknown>, _ms: number): Promise<ResponsesResult> => {
    const t = turns.shift();
    if (!t) throw new Error("no more scripted turns");
    const base = { id: `resp_${respond.mock.calls.length}`, status: "completed", text: "", toolCalls: [], usage: { input_tokens: 100, output_tokens: 10 }, ...t };
    // The raw output the loop replays: an encrypted reasoning item plus the calls.
    const output = [
      { type: "reasoning", summary: [], encrypted_content: `enc_${respond.mock.calls.length}` },
      ...base.toolCalls.map((c) => ({ type: "function_call", call_id: c.callId, name: c.name, arguments: c.arguments })),
    ];
    return { output, ...base };
  });
  return { client: { respond } as unknown as MetaModelClient, respond };
}

const newSession = () =>
  new StocktakeSession([product], [{ ref: "0", query: { brand: null, name: "", pack: null }, parsedPack: null, candidates: [] }], new Map(), indexInventory([], []), {
    searchCatalogue: async () => [],
    countUnits: async () => [],
    zoom: async () => "data:image/webp;base64,AAAA",
  });

describe("runStocktakeAgent", () => {
  it("replays the conversation statelessly, runs a turn's tool calls together, and stops on submit", async () => {
    const { client, respond } = scripted([
      {
        text: "Line 0 is unclear; zooming and searching.",
        toolCalls: [
          { callId: "c1", name: "zoom", arguments: '{"line":0}' },
          { callId: "c2", name: "search_catalogue", arguments: '{"line":0,"name":"Garri"}' },
        ],
      },
      {
        toolCalls: [
          { callId: "c3", name: "record_line", arguments: '{"line":0,"brand":"Golden Penny","name":"Garri","pack":"1kg","unresolved_reason":"not in catalogue"}' },
          { callId: "c4", name: "submit_stocktake", arguments: "{}" },
        ],
      },
    ]);
    const steps: AgentStep[] = [];
    const bodies: (Record<string, unknown> & { input: Record<string, unknown>[] })[] = [];
    respond.mockImplementation(((impl) => async (body: Record<string, unknown>, ms: number) => {
      bodies.push(JSON.parse(JSON.stringify(body)));
      return impl(body, ms);
    })(respond.getMockImplementation()!));
    const session = newSession();
    const outcome = await runStocktakeAgent({ client, session, photo: "data:image/jpeg;base64,PHOTO", onStep: async (s) => void steps.push(s) });

    expect(outcome).toEqual({ end: "submitted", turns: 2, usage: { input: 200, output: 20 } });
    // Bodies are snapshotted per call: the history array keeps growing after each turn.
    const [first, second] = bodies;
    expect(first).toMatchObject({ model: STOCKTAKE_MODEL, parallel_tool_calls: true, reasoning: { effort: "low" }, store: false, include: ["reasoning.encrypted_content"] });
    expect(first!.previous_response_id).toBeUndefined();
    expect(first!.input).toHaveLength(1);
    expect(JSON.stringify(first!.input)).toContain("data:image/jpeg;base64,PHOTO");
    // Turn 2 re-sends: the user message, turn 1's reasoning + calls, then their outputs.
    expect(second!.input.map((i) => i.type)).toEqual(["message", "reasoning", "function_call", "function_call", "function_call_output", "function_call_output"]);
    expect(second!.input[1]).toMatchObject({ encrypted_content: "enc_1" });
    expect(second!.input.filter((i) => i.type === "function_call_output").map((i) => i.call_id)).toEqual(["c1", "c2"]);
    expect(second!.input[4]!.output).toEqual([
      { type: "input_text", text: "Close-up of line 0:" },
      { type: "input_image", image_url: "data:image/webp;base64,AAAA" },
    ]);
    expect(steps.map((s) => `${s.turn}:${s.kind}:${s.tool ?? ""}`)).toEqual(["1:thought:", "1:tool:zoom", "1:tool:search_catalogue", "2:tool:record_line", "2:tool:submit_stocktake"]);
    expect(session.detections()[0]).toMatchObject({ brand: "Golden Penny", name: "Garri", pack: "1kg" });
  });

  it("ends when the model stops calling tools", async () => {
    const { client } = scripted([{ text: "All lines look right." }]);
    expect((await runStocktakeAgent({ client, session: newSession(), photo: "x", onStep: async () => undefined })).end).toBe("ended");
  });

  it("stops at the turn budget", async () => {
    const zoom = { toolCalls: [{ callId: "z", name: "zoom", arguments: '{"line":0}' }] };
    const { client, respond } = scripted([zoom, zoom, zoom]);
    const outcome = await runStocktakeAgent({ client, session: newSession(), photo: "x", onStep: async () => undefined, budget: { maxTurns: 2 } });
    expect(outcome).toMatchObject({ end: "budget", turns: 2 });
    expect(respond).toHaveBeenCalledTimes(2);
  });

  it("stops at the time budget before starting another turn", async () => {
    let clock = 0;
    const zoom = { toolCalls: [{ callId: "z", name: "zoom", arguments: '{"line":0}' }] };
    const { client, respond } = scripted([zoom, zoom]);
    const now = () => (clock += 100_000);
    const outcome = await runStocktakeAgent({ client, session: newSession(), photo: "x", onStep: async () => undefined, now });
    expect(outcome.end).toBe("budget");
    expect(respond).toHaveBeenCalledTimes(1);
  });

  it("a model error propagates (the service falls back to the quick scan)", async () => {
    const { client } = scripted([]);
    await expect(runStocktakeAgent({ client, session: newSession(), photo: "x", onStep: async () => undefined })).rejects.toThrow("no more scripted turns");
  });
});
