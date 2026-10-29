/**
 * Minimal Meta Model API client for the Responses endpoint (Muse Spark and SAM 3.1). Plain fetch,
 * so the key never leaves this file except in the Authorization header.
 */

export class MetaModelError extends Error {
  constructor(
    /** HTTP status, or 0 for a network failure / timeout. */
    readonly status: number,
    /** Meta's machine-readable code when present (e.g. rate_limit_exceeded, content_policy_violation). */
    readonly code: string | null,
    /** Seconds from the Retry-After header, when sent. */
    readonly retryAfter: number | null,
    message: string,
  ) {
    super(message);
    this.name = "MetaModelError";
  }

  get timedOut(): boolean {
    return this.status === 0 && this.code === "timeout";
  }
}

export type ResponsesUsage = { input_tokens?: number; output_tokens?: number; total_tokens?: number };

/** A function tool call the model asked for; answer it with a function_call_output carrying callId. */
export type ToolCall = { callId: string; name: string; arguments: string };

export type ResponsesResult = {
  /** Pass as previous_response_id to continue the conversation (tool loops). */
  id: string | null;
  status: string;
  /** All output_text parts of the message items, concatenated. */
  text: string;
  toolCalls: ToolCall[];
  /** The raw output items (reasoning, message, function_call), for stateless replay in tool loops. */
  output: Record<string, unknown>[];
  usage: ResponsesUsage | null;
};

type RawResponse = {
  id?: string;
  status?: string;
  output?: {
    type?: string;
    content?: { type?: string; text?: string }[];
    call_id?: string;
    name?: string;
    arguments?: string;
  }[];
  usage?: ResponsesUsage;
};

export class MetaModelClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  /** POST /v1/responses (non-streaming). Throws MetaModelError on any failure. */
  async respond(body: Record<string, unknown>, timeoutMs: number): Promise<ResponsesResult> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, "")}/responses`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      const name = (err as Error).name;
      const timedOut = name === "TimeoutError" || name === "AbortError";
      throw new MetaModelError(0, timedOut ? "timeout" : "network", null, timedOut ? "Model request timed out" : "Model API unreachable");
    }

    const payload = (await res.json().catch(() => null)) as
      | (RawResponse & { error?: { message?: string; code?: string | null } })
      | null;

    if (!res.ok) {
      const retryAfter = Number(res.headers.get("retry-after"));
      throw new MetaModelError(
        res.status,
        payload?.error?.code ?? null,
        Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
        payload?.error?.message ?? `Model API error ${res.status}`,
      );
    }

    const text = (payload?.output ?? [])
      .filter((item) => item.type === "message")
      .flatMap((item) => item.content ?? [])
      .filter((part) => part.type === "output_text" && typeof part.text === "string")
      .map((part) => part.text)
      .join("");

    const toolCalls = (payload?.output ?? [])
      .filter((item) => item.type === "function_call" && item.call_id && item.name)
      .map((item) => ({ callId: item.call_id!, name: item.name!, arguments: item.arguments ?? "{}" }));

    return {
      id: payload?.id ?? null,
      status: payload?.status ?? "unknown",
      text,
      toolCalls,
      output: (payload?.output ?? []) as Record<string, unknown>[],
      usage: payload?.usage ?? null,
    };
  }
}
