import { describe, expect, it, jest } from "@jest/globals";
import { MetaModelClient, MetaModelError } from "./meta-model.client";

const KEY = "LLM_000_not-a-real-key";

function fakeFetch(status: number, body: unknown, headers: Record<string, string> = {}) {
  return jest.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status, headers }));
}

describe("MetaModelClient.respond", () => {
  it("posts to /responses with the bearer key and joins the output text", async () => {
    const fetchImpl = fakeFetch(200, {
      status: "completed",
      output: [
        { type: "reasoning", content: [{ type: "reasoning_text", text: "thinking" }] },
        { type: "message", content: [{ type: "output_text", text: '{"a":' }, { type: "output_text", text: "1}" }] },
      ],
      usage: { input_tokens: 1400, output_tokens: 300 },
    });
    const client = new MetaModelClient("https://api.meta.ai/v1/", KEY, fetchImpl);

    const res = await client.respond({ model: "muse-spark-1.3" }, 1000);

    expect(res).toMatchObject({ id: null, status: "completed", text: '{"a":1}', toolCalls: [], usage: { input_tokens: 1400, output_tokens: 300 } });
    expect(res.output).toHaveLength(2);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://api.meta.ai/v1/responses");
    expect((init!.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
    expect(JSON.parse(init!.body as string)).toEqual({ model: "muse-spark-1.3" });
  });

  it("returns the response id and the model's function calls", async () => {
    const fetchImpl = fakeFetch(200, {
      id: "resp_1",
      status: "completed",
      output: [
        { type: "message", content: [{ type: "output_text", text: "Zooming in." }] },
        { type: "function_call", call_id: "call_a", name: "zoom", arguments: '{"line":2}' },
        { type: "function_call", call_id: "call_b", name: "search_catalogue", arguments: '{"line":3,"name":"Garri"}' },
      ],
    });
    const res = await new MetaModelClient("https://x", KEY, fetchImpl).respond({}, 1000);
    expect(res.id).toBe("resp_1");
    expect(res.text).toBe("Zooming in.");
    expect(res.toolCalls).toEqual([
      { callId: "call_a", name: "zoom", arguments: '{"line":2}' },
      { callId: "call_b", name: "search_catalogue", arguments: '{"line":3,"name":"Garri"}' },
    ]);
  });

  it("raises Meta's error code and Retry-After, without the key", async () => {
    const client = new MetaModelClient(
      "https://api.meta.ai/v1",
      KEY,
      fakeFetch(429, { error: { message: "Rate limit", type: "rate_limit_error", code: "rate_limit_exceeded" } }, { "retry-after": "7" }),
    );
    const err = await client.respond({}, 1000).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MetaModelError);
    expect(err).toMatchObject({ status: 429, code: "rate_limit_exceeded", retryAfter: 7, message: "Rate limit" });
    expect(String((err as Error).message)).not.toContain(KEY);
  });

  it("handles a non-JSON error body (e.g. 404 with no body)", async () => {
    const fetchImpl = jest.fn<typeof fetch>(async () => new Response("", { status: 404 }));
    const err = await new MetaModelClient("https://x", KEY, fetchImpl).respond({}, 1000).catch((e: unknown) => e);
    expect(err).toMatchObject({ status: 404, code: null, retryAfter: null });
  });

  it("reports a timeout as status 0 / timeout", async () => {
    const fetchImpl = jest.fn<typeof fetch>(async () => {
      throw new DOMException("The operation timed out.", "TimeoutError");
    });
    const err = (await new MetaModelClient("https://x", KEY, fetchImpl).respond({}, 1).catch((e: unknown) => e)) as MetaModelError;
    expect(err.timedOut).toBe(true);
  });

  it("reports a network failure as status 0 / network", async () => {
    const fetchImpl = jest.fn<typeof fetch>(async () => {
      throw new TypeError("fetch failed");
    });
    const err = await new MetaModelClient("https://x", KEY, fetchImpl).respond({}, 1000).catch((e: unknown) => e);
    expect(err).toMatchObject({ status: 0, code: "network", timedOut: false });
  });
});
