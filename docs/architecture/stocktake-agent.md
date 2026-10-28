# Stock-take agent

> Diagram: [stock-take agent](../diagrams/images/stocktake-agent-sequence.svg). Part of [vision recognition](vision-recognition.md).
>
> **Built:** the agent loop, its tools, async runs with a step trace, fallback to the quick scan, and verification with refusal and escalation. **Planned:** measuring the agent against the quick scan to decide the default (see [Planned](#planned)).

Tally has two ways to read a shelf photo, chosen by what the merchant is doing:

| | Quick scan (`shelf-scans`) | Stock-take agent (`stocktakes`) |
|---|---|---|
| Shape | A fixed pipeline: Muse Spark reads, SAM counts, Qore Catalog matches | An agent: Muse Spark plans, calls tools, looks again, until every line is settled |
| Time | ~15–30 s, in one request | ~1 minute (first pass + agent), in the background |
| Use | A fast look; the agent's first pass and fallback | Stock-taking, where accuracy matters more than speed |

Point-to-sell stays a fixed pipeline ([identify](vision-recognition.md#point-to-sell)): a loop of model turns would be too slow at the till.

## How a run works

1. `POST …/vision/stocktakes` checks membership and the image, creates a `vision_agent_runs` row, and returns `202 { runId }`. The rest runs in the API process in the background.
2. **First pass:** the quick scan's analysis (Muse Spark read, SAM counts, catalogue match, store check), stored as the `baseline` step. It is the agent's checklist and its fallback.
3. **Agent loop** (Muse Spark 1.3, low reasoning, Responses API tool calling). The model sees the photo and a checklist of the first-pass lines, with `CHECK` on lines that need attention: low confidence, no catalogue match, or a store match to confirm. Each turn it may call several tools at once; Tally runs them in parallel (except `submit_stocktake`, which runs last), returns the results, and asks again.
4. The loop ends when the model calls `submit_stocktake` and it is accepted, the model stops calling tools, or the budget runs out (12 turns or 150 s). Lines the agent never recorded keep the first-pass result, flagged for the merchant (`review`).
5. The result is saved as a normal scan (`vision_scans` + `vision_detections`, each line with its `evidence`), crops go to R2 as for a quick scan, and the run is marked `done`. The merchant confirms it with the usual [`…/shelf-scans/:scanId/confirm`](vision-recognition.md); that confirm is the human sign-off.
6. If the agent errors, the run is `fallback`: the first-pass result is saved instead, so the merchant always gets a scan. If the first pass itself fails, the run is `failed`.

### Tools

Every tool wraps code the quick scan already uses (`stocktake/stocktake-session.ts`):

| Tool | What it does | Limits |
|---|---|---|
| `zoom(line, box?)` | Returns a close-up of the line's product **as an image** (tool results can carry images), cut from the photo in memory | 20 per run |
| `search_catalogue(line, brand, name, pack)` | Qore Catalog `/v1/match`, plausibility-filtered; retry with other wording | 3 per line |
| `find_in_store(line)` | The merchant's own items, with the shared [inventory rules](vision-recognition.md) | — |
| `count_units(line, look)` | SAM 3.1 count for a look like "red box"; only used if `record_line` says `use_counted` | 2 per line |
| `record_line(line, brand, name, pack, qid?, unresolved_reason?, use_counted?)` | The line's conclusion: the label **as printed**, the matched Qore ID, or why it is unresolved | — |
| `submit_stocktake()` | Ends the run | — |

### Verification

The pattern from Meta's agent workshop: checks run inside the tools at fixed points, so the model cannot skip them. A refusal comes back as text the model can act on. Repeated refusals escalate to a person instead of looping.

| When | Check | On failure |
|---|---|---|
| `record_line` | Qore ID was returned for this line (by the first pass or one of its searches) | Refused with the reason |
| `record_line` | A `CHECK` line, or a changed label, was zoomed into first (waived once the zoom budget is spent) | Refused: "zoom into it first" |
| `record_line` | The matched product's brand agrees with the brand read ("Close-Up" = "closeup") | Refused: pick a product of that brand or leave qid empty |
| `record_line` | The matched product's size agrees with the pack read, within 5% (units convert: 0.4kg = 400g) | Refused: pick the matching size or leave qid empty |
| `record_line` | `use_counted` has a `count_units` result | Refused |
| 3 refusals on a line | | **Escalated:** the line is recorded unresolved with `review: "Escalated after 3 refused records: …"` |
| `submit_stocktake` | Every line is recorded | Refused, listing the open lines; on the third try it ends with those lines `review: "Not reviewed by the agent: first-pass result."` |
| Confirm | The merchant reviews every line | The human sign-off |

### Other guardrails

- **No invented products:** `record_line` refuses a Qore ID that wasn't returned for that line, by the first pass or one of its searches.
- **"In stock" is decided by the same rules everywhere:** the final store match is recomputed with `inventory-match.ts`, the same rules the quick scan and identify use, not taken from the model's word.
- **Label, not catalogue:** readings must be what's printed on the pack. The merchant sees them, and they are what the catalogue learns from.
- **Counts:** a SAM count replaces the first-pass count only when the agent asks for it, after comparing.
- **Tool budgets** stop runaway loops; errors come back to the model as text it can act on, never as exceptions.
- **No server copy:** the photo travels with `store: false` and stateless encrypted reasoning replay, Meta's recommended path for agents. `previous_response_id` (server-stored history) failed on a live run with "referenced response not found or expired".

## API

All routes need a Supabase JWT and are for business members only.

### `POST /api/businesses/:id/vision/stocktakes`

Multipart `image`, with the same rules as `shelf-scans`: JPEG/PNG/WebP, ≤ 4 MB, ~1600 px. Returns `202 { "runId": "…", "status": "running" }`. Errors are the same as `shelf-scans`, and 503 when `META_MODEL_API_KEY` isn't set.

### `GET /api/businesses/:id/vision/stocktakes/:runId`

Poll every 1–2 s.

```json
{
  "run": { "id": "…", "status": "running", "scanId": null, "turns": 0, "inputTokens": 0, "outputTokens": 0, "error": null },
  "steps": [
    { "turn": 0, "kind": "baseline", "tool": null, "summary": "First pass: 12 products", "ms": 23692 },
    { "turn": 1, "kind": "thought", "tool": null, "summary": "Zooming into the unclear labels.", "ms": 4216 },
    { "turn": 1, "kind": "tool", "tool": "zoom", "summary": "zoomed 814,569,943,724", "ms": 66 }
  ],
  "result": null
}
```

- `run.status`: `running`, `done`, `fallback` (the agent stopped; `result` is the first pass) or `failed` (`error` says why; also used for a run interrupted by an API restart).
- `steps`: the trace so far. The app can show it live ("Reading the top shelf…"), and it is the audit trail.
- On the web, apps/mp's `/stocktake` page polls every 1.5 s and shows the trace as progress (see [Web stock-take](vision-recognition.md#web-stock-take-apps-mp)).
- `result`: once finished, the scan in the `shelf-scans` shape (`scanId`, `detections`, …), each detection with `evidence: [{ turn, tool, summary }]` and `review`: `null`, or why the merchant should look closely (escalated, or never reviewed by the agent). Show `review` lines first. While the result is fresh (an hour) candidates carry names and prices; later it comes from the stored scan, where candidates are Qore IDs + scores only.

## Data

Migration `0006_add_stocktake_agent`:

- **`vision_agent_runs`**: business, status, model, turns, input/output tokens, error, who started it, when it started and finished, and the resulting `scan_id`.
- **`vision_agent_steps`**: one row per step (`baseline`, `thought`, `tool`), with turn, tool, arguments, a short summary (never image data) and time.
- **`vision_detections.evidence`**: the tool calls behind each line of an agent scan; null for a quick scan.

## Measured (Oct 2026, staging catalogue)

| Photo | First pass | Agent | Turns | Tokens in / out | What changed |
|---|---|---|---|---|---|
| Provision store, 9 lines | 20 s | 35 s | 8 (budget) | 83k / 3k | Brands read on unbranded lines (Allday prawn crackers, Granitas pap); the catalogue has none of the custards, so those were recorded unresolved |
| Toothpaste shelf, 12 lines | 24 s | 39 s | 6 (submitted) | 81k / 7k | "Red" (a Dabur toothpaste) was matched to a red wine; the agent read "Dabur · RED" and dropped the match. "MYMY · MYMY" and "Colgate · Colgate" became "MYMY · Herbal" and "Colgate · Mouthwash" |
| Same shelf, with verification | 31 s | 60 s | 8 (submitted, no refusals) | 90k / 5k | Also dropped "Milk Teeth" → Aquafresh: the agent read Macleans on the pack. Zooming before changing a label adds turns |

At Muse Spark's Standard pricing, a run costs about $0.12 on top of the first pass. Most of that is input: the photo and history are re-sent every turn, so the agent batches tool calls rather than taking many small turns. (A turn with the photo took 5–19 s in an early probe.)

To compare the agent with the quick scan on your own photos with hand-counted truth, see [Vision benchmark](../../apps/api/README.md#vision-benchmark).

## Running it

- **No separate service:** the agent is TypeScript in `apps/api` (`modules/vision/stocktake/`). It calls the Meta Model API over HTTPS, like the rest of the vision module, and needs the same env (`META_MODEL_API_KEY`, `QORE_CATALOG_*`, optionally `R2_*`).
- **Host:** runs live in the API process, so the API must run on a long-lived host (a container or VM), not short-lived serverless functions. A job queue is the fix when there is more than one API instance.
- **Every run ends.** Each phase is raced against a deadline (`STOCKTAKE_DEADLINES` in `vision.service.ts`), so a hung model call or a database connection that never comes can't leave a run `running`:

  | Phase | Deadline | On timeout |
  |---|---|---|
  | First pass | 120 s | `failed`: "First pass failed: First pass took longer than 120 s" |
  | Whole run (the agent gets what the first pass left) | 240 s | `fallback` to the first pass: "Agent stopped: Run deadline reached" |
  | Each result or status write | 20 s, status write tried 3 times | `failed`: "Could not save the result: …" |
  | Restart, or a status write that never landed | — | On boot, and when the run is read, a run still `running` after 5 minutes is marked `failed` ("Interrupted: the API restarted during the run") |

- **Database connections:** the Supabase pooler is shared with other Qorelly projects, and the session-mode pool is 15 clients. A Tally process holding idle session-mode connections can starve a background run of a connection. The API should connect through the **transaction pooler** (port `6543`), and the client keeps at most 5 connections and closes idle ones after 20 s (`packages/db/src/client.ts`).

## Planned

- **Measure it against the quick scan** on real shop photos (recall, counts against hand counts, time, cost) to decide whether the agent becomes the default for stock-taking.
- **Speed:** reasoning `minimal` for the tool turns, and fewer re-sent images (only the zooms from the last turn) to cut the per-turn re-send.
