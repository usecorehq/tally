# Vision schema

> Diagram: [vision tables (ERD)](../diagrams/images/vision-schema-erd.svg). Part of [vision recognition](vision-recognition.md) and the [stock-take agent](stocktake-agent.md). The whole schema: [database](database.md).

How the camera tables in the `tally` schema relate, who writes each row, and which links are foreign keys versus plain values. Migrations `0004_add_vision_scans`, `0005_add_vision_decisions` and `0006_add_stocktake_agent`; source of truth is `packages/db/src/schema.ts`.

## The shape in one paragraph

A **scan** (`vision_scans`) is one shelf photo. Each product found in it is a **detection** (`vision_detections`). The merchant's decision is stored on the detection itself and, when it touches stock, writes to `inventory_items` and `stock_movements` like any other stock change. Confirming also saves a **reading** (`inventory_item_readings`), so the next scan recognises the product even if Qore Catalog doesn't know it. A **stock-take run** (`vision_agent_runs`) is the agent working on one photo. Its **steps** (`vision_agent_steps`) are the trace, and its result is a normal scan, which the merchant confirms like a quick scan.

## Tables

| Table | One row is | Parent | Written by |
|---|---|---|---|
| `vision_scans` | One shelf photo: sha256 and size (never the photo), model ids, time per stage, `open` → `confirmed` | `businesses` | `POST …/vision/shelf-scans`, or a stock-take run when it saves its result |
| `vision_detections` | One product in a scan: what Muse Spark read, Spark and SAM counts, boxes, catalogue candidates, the store match, and then the merchant's decision | `vision_scans` | Inserted with its scan; decision columns set by `POST …/shelf-scans/:scanId/confirm` |
| `inventory_item_readings` | "The camera read `brand\|name\|pack`, and the merchant said it is this item" | `inventory_items` | Scan confirm (every non-skip line with a brand) and `POST …/vision/identify/confirm` |
| `vision_agent_runs` | One stock-take: status, model, turns, tokens, error, the resulting scan | `businesses` | `POST …/vision/stocktakes` creates it; the background run updates it |
| `vision_agent_steps` | One step of a run: `baseline` (first pass), `thought` or `tool` with its arguments and a short summary | `vision_agent_runs` | The background run, as it goes |

Identify calls (point to sell) write nothing until the merchant confirms, and then only a reading.

## Relationships

### Foreign keys (enforced)

| From | To | Cardinality | On delete | Meaning |
|---|---|---|---|---|
| `vision_scans.business_id` | `businesses` | many → one | cascade | The shop the photo belongs to |
| `vision_detections (business_id, scan_id)` | `vision_scans` | many → one | cascade | Products found in the photo; `(scan_id, position)` is unique |
| `vision_detections (business_id, inventory_item_id)` | `inventory_items` | many → zero or one | no action | **Looks like:** the merchant's item it matched at scan time, with `inventory_match` saying how (`reading`, `catalogue`, `name`) |
| `vision_detections (business_id, item_id)` | `inventory_items` | many → zero or one | no action | **Decided as:** the item that was restocked, restored or created on confirm. Null for `skip` and until decided |
| `inventory_item_readings (business_id, item_id)` | `inventory_items` | many → one | cascade | Readings that point at this item; `(business_id, reading_key)` is unique, so one reading maps to one item |
| `vision_agent_runs.business_id` | `businesses` | many → one | cascade | The shop the stock-take is for |
| `vision_agent_runs (business_id, scan_id)` | `vision_scans` | zero or one → zero or one | no action | The run's result. Null while running and for a failed run; set on `done` and on `fallback` (the quick scan) |
| `vision_agent_steps (business_id, run_id)` | `vision_agent_runs` | many → one | cascade | The trace |

`inventory_item_id` and `item_id` are often the same item, but not always. The merchant can pick a different item, add a new one, or restore an archived one.

### Soft links (values, not foreign keys)

| Value | Points at | Why it isn't a foreign key |
|---|---|---|
| `vision_detections.candidates[].qid`, `confirmed_qid` | A Qore Catalog product | It lives in another service. Tally keeps Qore IDs and match scores only, never catalogue names or prices |
| `stock_movements.client_movement_id = 'vision:<detection id>'` | The detection that moved stock | It is the idempotency key, so a retried confirm can't move stock twice. The detection's `item_id` + `quantity` say the same thing from the other side |
| `<scan_id>:<position>` | The detection, as Qore Catalog's feedback `clientRef` | Sent to `/v1/feedback` and `/v1/images` so retries dedupe on the catalogue side |
| `tally/crops/<scan_id>/<position>.webp` | The detection's crop in R2 | Object storage; the key is derived, not stored. See [product crops](vision-recognition.md#product-crops) |
| `vision_scans.image_sha256` | The uploaded photo | The photo itself is never stored, only its hash and size |
| `created_by`, `started_by`, `decided_by` | `auth.users` | Audit columns only. Membership is checked by the API on every call; only `businesses` and `business_members` carry the cross-schema key to `auth.users` |

## Tenancy: every child carries `business_id`

Children carry `business_id` and point at their parent with a **composite** key `(business_id, parent_id)` → the parent's `unique (business_id, id)`. So a detection can't reference another shop's scan or item, even through a bug in the API. The same rule applies to the rest of the schema.

## Lifecycle

```
quick scan    POST shelf-scans
              → vision_scans (open) + vision_detections (inventory_item_id set where the store matched)

stock-take    POST stocktakes
              → vision_agent_runs (running)
              → vision_agent_steps …  (baseline, then thought / tool per turn)
              → vision_scans + vision_detections (with evidence)  ─┐
              → vision_agent_runs.scan_id, status done | fallback ◄┘  (or failed, no scan)

confirm       POST shelf-scans/:scanId/confirm, one transaction
              per line: restock | restore → inventory_items (link Qore ID / unarchive) + stock_movements (restock)
                        add             → inventory_items (source photo) + stock_movements (opening)
                                          (or a restock if an active item already has that Qore ID or name)
                        skip            → nothing
              → vision_detections decision columns
              → inventory_item_readings upsert (every non-skip line with a brand)
              → vision_scans confirmed once no line is undecided
              after commit, best-effort: catalogue feedback → feedback_sent_at, crop uploads

identify      POST identify/confirm → inventory_item_readings upsert (with a brand)
```

The next scan checks the store before the catalogue: first `inventory_item_readings` (`inventory_match = reading`, branded readings only), then items linked to a candidate's Qore ID (`catalogue`), then hand-typed item names (`name`). That's why confirming once makes the same product show as **In store** next time.

## What the database enforces

- **Scan status:** `open` or `confirmed`, and `confirmed_at` is set exactly when confirmed. `image_sha256` is 64 hex characters.
- **Detection:** `position >= 0` and unique per scan. `confidence` is `high`, `medium` or `low`. `count_source` is `sam` or `spark`. Counts are not negative. The name is 1 to 200 characters.
- **Match:** `inventory_item_id` and `inventory_match` are both set or both null.
- **Decision:** `action`, `outcome`, `decided_by` and `decided_at` are all set or all null. `skip` ⇔ `removed`. Every decision except `skip` has an `item_id`. `confirmed_qid` matches the Qore ID format.
- **Run:** status is `running`, `done`, `fallback` or `failed`, and `finished_at` is null exactly while running. Turns and tokens are not negative.
- **Step:** `tool` is set exactly when `kind = 'tool'`. The check also allows `result`, which nothing writes today.
- **Reading:** the key is 3 to 400 characters and unique per business.

## Deleting

- **A business:** removes everything above with it (cascade).
- **A scan:** removes its detections. It is refused while a run still points at it.
- **A run:** removes its steps.
- **An item:** items are archived, not deleted, so detections keep pointing at them. Hard-deleting one is refused while a detection references it, and its readings go with it.
- **A detection:** stock movements aren't touched. The ledger is append-only.
