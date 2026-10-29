/**
 * Stock-take agent loop on Meta's Responses API: plan, call tools in parallel, observe, until submit or budget.
 * Stateless encrypted replay (store: false) keeps no copy of the photo at Meta, but makes turns slow: batch calls.
 */
import type { MetaModelClient, ResponsesUsage } from "../meta-model.client";
import { STOCKTAKE_INSTRUCTIONS, STOCKTAKE_TOOLS, type StocktakeSession } from "./stocktake-session";

export const STOCKTAKE_MODEL = "muse-spark-1.3";
export const STOCKTAKE_BUDGET = { maxTurns: 12, deadlineMs: 150_000, turnTimeoutMs: 60_000 } as const;

export type AgentStep = {
  turn: number;
  kind: "thought" | "tool" | "result";
  tool?: string;
  args?: Record<string, unknown>;
  summary: string;
  ms?: number;
};

export type AgentOutcome = {
  /** submitted: the model called submit_stocktake; ended: it stopped calling tools; budget: turns or time ran out. */
  end: "submitted" | "ended" | "budget";
  turns: number;
  usage: { input: number; output: number };
};

export async function runStocktakeAgent(opts: {
  client: MetaModelClient;
  session: StocktakeSession;
  /** The shelf photo as a data URL. */
  photo: string;
  onStep: (step: AgentStep) => Promise<void>;
  budget?: Partial<typeof STOCKTAKE_BUDGET>;
  now?: () => number;
}): Promise<AgentOutcome> {
  const { client, session, photo, onStep } = opts;
  const budget = { ...STOCKTAKE_BUDGET, ...opts.budget };
  const now = opts.now ?? Date.now;
  const started = now();
  const usage = { input: 0, output: 0 };
  const add = (u: ResponsesUsage | null) => {
    usage.input += u?.input_tokens ?? 0;
    usage.output += u?.output_tokens ?? 0;
  };

  const base = {
    model: STOCKTAKE_MODEL,
    instructions: STOCKTAKE_INSTRUCTIONS,
    tools: STOCKTAKE_TOOLS,
    parallel_tool_calls: true,
    reasoning: { effort: "low" },
    max_output_tokens: 6000,
    store: false,
    include: ["reasoning.encrypted_content"],
  };
  const history: unknown[] = [
    {
      type: "message",
      role: "user",
      content: [
        { type: "input_text", text: `${session.checklist()}\n\nResolve the CHECK lines, record every line, then submit.` },
        { type: "input_image", image_url: photo },
      ],
    },
  ];

  for (let turn = 1; turn <= budget.maxTurns; turn++) {
    if (now() - started > budget.deadlineMs) return { end: "budget", turns: turn - 1, usage };

    const t0 = now();
    const res = await client.respond({ ...base, input: history }, budget.turnTimeoutMs);
    add(res.usage);
    // Replay the model's own turn (encrypted reasoning, message, function calls) before the tool results.
    history.push(...res.output.filter((item) => ["reasoning", "message", "function_call"].includes(String(item.type))));
    if (res.text.trim()) await onStep({ turn, kind: "thought", summary: res.text.trim().slice(0, 500), ms: now() - t0 });
    if (res.toolCalls.length === 0) return { end: "ended", turns: turn, usage };

    const run = async (call: (typeof res.toolCalls)[number]) => {
      const c0 = now();
      const result = await session.execute(call.name, call.arguments, turn);
      await onStep({ turn, kind: "tool", tool: call.name, args: safeArgs(call.arguments), summary: result.summary, ms: now() - c0 });
      return { type: "function_call_output", call_id: call.callId, output: result.output };
    };
    // A turn's calls run together, except submit: it must see the lines recorded in the same turn.
    const outputs = await Promise.all(res.toolCalls.filter((c) => c.name !== "submit_stocktake").map(run));
    for (const call of res.toolCalls.filter((c) => c.name === "submit_stocktake")) outputs.push(await run(call));
    if (session.submitted) return { end: "submitted", turns: turn, usage };
    history.push(...outputs);
  }
  return { end: "budget", turns: budget.maxTurns, usage };
}

function safeArgs(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
