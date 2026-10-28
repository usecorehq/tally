/**
 * Minimal Meta Model API client: the Responses endpoint only, which serves both
 * Muse Spark and SAM 3.1. Plain fetch, like @tally/catalog-client, so the key
 * never leaves this file except in the Authorization header.
 *
 * Docs: https://dev.meta.ai/docs/protocols/responses, https://dev.meta.ai/docs/error-handling
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

export type ResponsesResult = {
  status: string;
  /** All output_text parts of the message items, concatenated. */
  text: string;
  usage: ResponsesUsage | null;
};

type RawResponse = {
  status?: string;
  output?: { type?: string; content?: { type?: string; text?: string }[] }[];
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

    return { status: payload?.status ?? "unknown", text, usage: payload?.usage ?? null };
  }
}
