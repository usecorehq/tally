# Vision recognition

> Diagrams: [shelf scan](../diagrams/images/vision-shelf-scan-sequence.svg), [point to sell](../diagrams/images/vision-identify-sequence.svg), [stock-take history](../diagrams/images/stocktake-history-sequence.svg).
>
> **Built:** shelf-scan recognition (Muse Spark reads the photo, SAM 3.1 counts the units, Qore Catalog matches), the check against the merchant's own inventory, storing each scan, confirm → inventory + feedback, point-to-sell identify (tier 1), product crops (R2) sent to Qore Catalog as pictures, and stock-take history (every scan reopenable at its own URL in apps/mp). **Planned:** an on-device model. Planned endpoint shapes may change before they ship.

The merchant points the phone camera at products and Tally recognises them. Product side (users, screens, metrics, delivery slices): [photo-to-inventory PRD](../prd-photo-to-inventory.md). There are two flows. Stock-taking can also run as an agent; see [Stock-take agent](stocktake-agent.md).

On the web, the merchant portal's `/stocktake` page runs the shelf scan from an uploaded or captured photo (see [Web stock-take](#web-stock-take-apps-mp)).

- **Shelf scan (photo → inventory).** Photograph a shelf or a pile of stock. Tally identifies every product in the frame and matches each one to a Qore Catalog product with an indicative ₦ price. The merchant confirms or corrects the results, and the items land in their inventory with counts. Accuracy matters more than speed here.
- **Point to sell.** Point the camera at one item to find it at the till. Speed matters most here.

Every confirmation or correction goes back to Qore Catalog as feedback with `source: "photo"`. Qore Catalog uses those labels for recognition training (see [Q Vision](qvision-distillation.md)).

## Where each model runs

| Step | Runs on | Model |
|---|---|---|
| Barcode read | Device | `mobile_scanner` (built; see [Barcode scan](barcode-scan.md)) |
| Read the products in a photo (brand, name, pack size, rough count, box) | apps/api → Meta Model API | Muse Spark (`muse-spark-1.3`), structured JSON output |
| Count each product's units | apps/api → Meta Model API | SAM 3.1 (`sam-3.1`), one concept prompt per distinct look |
| Match to the catalogue, with prices | apps/api → Qore Catalog | `POST /v1/match` |
| Identify one item at the till | apps/api → Meta Model API, then Tally | Muse Spark (minimal reasoning) reads the label; Tally matches it to the merchant's items |
| On-device recognition | Device | Planned: a model provided by Qore Catalog, trained on Muse Spark labels and merchant confirmations |

All model calls go through apps/api. `META_MODEL_API_KEY` is server-only, like `QORE_CATALOG_API_KEY`. The mobile app and the web apps never hold it. Requests use Meta's Standard mode, so merchants' photos are not used to train Meta's models.

### Why Muse Spark first, then SAM

SAM 3.1 segments one concrete noun phrase per request. A generic prompt such as "product" is a weak concept. Cropping each object and reading it separately would cost one model call per crop and lose label resolution. So the order is:

1. One Muse Spark call reads the whole frame. It lists each distinct product with one bounding box per visible unit, on a 0–1000 grid; the count is the number of boxes (Meta's grounding guide: pointing at every instance before counting beats asking for a number). Structured output guarantees the JSON shape.
2. SAM 3.1 then counts the units. SAM matches what a pack looks like, not its brand text: "Diplomat toothpaste" found nothing on a toothpaste shelf, while "green box" found the Diplomat Aloe boxes. So Spark also gives each product a two-word `look` (one colour + one container: "red box", "yellow bucket"). SAM runs once per distinct look, in parallel with the catalogue match. Each SAM instance counts for the product with that look whose Spark boxes it sits among (within one unit's width). Instances on a unit Spark gave to a different-looking product, or near no product with that look, are dropped.

If SAM finds nothing for a product, or its request fails, the count stays Muse Spark's. A SAM failure never fails the scan.

**Measured.** Five photos of Nigerian shops; true counts are hand counts from zoomed crops.

| Product | Spark alone | With SAM | Hand count |
|---|---|---|---|
| Close-Up boxes, stacked | 14 | 29 | ~45 |
| Tomato paste tins | 4 | 18 | 25+ |
| Mother custard buckets | 6 | 7 | ~7 |

- **Where SAM works, it's far closer:** single-colour rigid packs (boxes, tins, buckets, bottles) in dense stacks, where Spark gives up early.
- **Where SAM finds nothing,** Spark's count stands: soft packs such as sachets, pouches and bread bags, and two-colour phrases, which return zero.
- **Known over-count risk:** neighbouring products with the same look (several white toothpaste brands on one shelf) can take each other's units. The merchant confirms every count.

## Shelf scan

1. The device scales the photo to a 1600 px long edge and encodes it as JPEG (quality ~80, about 400 KB). It sends the image as multipart.
2. The API runs Muse Spark on the image, then SAM for each product in parallel.
3. The API sends all distinct products to `POST /v1/match` in one call and keeps the plausible candidates per product. It then checks the business's own inventory (see below).
4. The API stores the scan and its detections, then returns them.
5. For each detection the merchant picks an action and sets the quantity: restock the matching item, restore an item they removed, add it to the store (from a catalogue candidate or as a new item, with name and price prefilled), or skip it.
6. On confirm (one transaction):
   - `add` creates the merchant's copy (`source = 'photo'`, with the Qore ID when picked from the catalogue) and an `opening` stock movement. It never duplicates an active item with the same Qore ID or name: that item is restocked instead. The catalogue picture is not copied; it is shown from Qore Catalog by Qore ID.
   - `restock` adds a `restock` movement. With a `qid`, a hand-typed item is linked to that product so later scans match exactly.
   - `restore` un-archives the item (keeping its name, price and history), then restocks it.
   - Every non-skip decision remembers the reading for that item (`inventory_item_readings`), when the reading has a brand. "Cooking oil" or "bucket" alone could be any product, so unbranded readings are never remembered or matched.
   - Then every decided line goes to Qore Catalog as `source: "photo"` feedback, clientRef `<scanId>:<position>`. After that feedback is sent, each line confirmed with a Qore ID has its crop uploaded to `POST /v1/images` (`view: on_shelf`, same clientRef as `feedbackClientRef`). See "Product crops" below. As in [onboarding](onboarding.md), a catalogue outage never undoes the stock changes; unsent feedback goes out on the next confirm of the scan.
   - Retries are safe: decided detections are left alone, and stock movements are keyed by detection id.

### Web stock-take (apps/mp)

`/stocktake` in the merchant portal (built) runs the same flow from a browser, so the shelf scan doesn't need the mobile app:

1. Pick one of the user's businesses (`GET /api/businesses`).
2. Upload or capture a photo (`<input capture="environment">` opens the rear camera on phones). The browser scales it to at most a 2560 px long edge and re-encodes it as JPEG (quality 0.8), applying EXIF rotation. A photo under 1500 px on its long edge gets a warning before the scan: products on a whole shelf are likely too small to read. Each picked photo is also **checked**: in the browser at once (blur, darkness, glare on a 320 px copy), then by Muse Spark through `POST …/vision/photo-check` on a 1024 px copy (about 4–5 s). The verdict (good, usable, retake), the issues, one instruction and a dashed box around the most readable area show under the photo, with **Retake photo** on a retake. It is advice only: the merchant can always start the scan, and a failed check shows nothing.
3. **Start stock-take** runs the [agent](stocktake-agent.md): `POST …/stocktakes`, then the page moves to the run's own URL, `/stocktake/history/<runId>`, which polls `GET …/stocktakes/:runId` every 1.5 s and shows the step trace as it grows. **Quick scan** calls `POST …/shelf-scans`, waits, then moves to `/stocktake/history/<scanId>`.
4. The review table has one row per undecided detection, `review` lines first: the reading, an editable count, the product (opens the picker; pre-filled by the rules in [Showing a line](#showing-a-line-clients)), the store status, and the action (restock, restore, add with name and price prefilled, or skip). A thumbnail of each product is cut from the local photo by its largest box, or is the stored crop when this browser doesn't have the photo. A restock line names the store item (`inventoryItemName`). **Coverage:** the photo is split into a 3 × 3 grid; when two or more cells have no counted unit, they are shaded and a warning names them ("Nothing was read in parts of this photo…"), so a missed shelf is never silent.
5. Confirm sends every row to `…/shelf-scans/:scanId/confirm` and shows the outcome: created, restocked, restored, skipped, invalid lines with their reasons, and the feedback sent.

#### Stock-take history (built)

Every stock-take is its own session with its own URL (`?business=<id>` picks the business), like a chat history:

- **Sidebar:** on every stock-take page the sidebar shows **Take new stock** and **Recents**: the newest 30 from `GET …/vision/stocktakes`, each titled by the products read (`preview`, e.g. "Peak, Milo, Indomie") over when it ran ("Today, 10:14", "28 Oct, 22:33"; Lagos time), with a dot for running, ready to review or failed. It refreshes on navigation, after a confirm, and every 5 s while one is running. Phones, which have no sidebar, use the **History** button.
- **`/stocktake/history`** lists them all, grouped by day: title, when it ran (above the status, in the same format), status (running, ready to review, confirmed, failed, or nothing found), line count, and once confirmed how many were added, restocked, restored or skipped.
- **`/stocktake/history/<id>`** (a run id or a quick scan's id; the page tries the run first) loads the session from the API, so a refresh or a link restores it: a running run resumes polling, an open scan opens the review table, a confirmed scan opens a read-only list of each line's decision and when it was made, and a failed run says why.
- **The photo is kept with the stock-take.** The API stores it in R2, and a reopened scan returns a short-lived `photoUrl`, so any device sees the photo with its outlines, including on a confirmed stock-take. The page also keeps a copy in IndexedDB per session (the newest 30) so it shows at once. Only scans from before photos were kept show each line's crop instead.
- **Lines confirmed earlier** (a confirm that left some lines invalid) are not shown again; only the undecided ones are confirmed.
- **Rerun** (on any stock-take whose photo was kept, until a run of that photo moves stock) runs the agent again on the stored photo and opens the new run; while it runs, the page shows the stored photo (`photoUrl` on the run). Reruns are grouped under the photo's first scan: nested under it in history ("Rerun", each with its own status and URL), and flat in Recents with a "Rerun ·" label.
- **Only one run of a photo is confirmed.** Confirming any of them makes the others **superseded**: read-only, kept for audit.
- **Discard** (review screen, and the bin on a history row that is ready to review) asks first, then makes the scan **discarded**: read-only, kept, and no longer "ready to review". A discarded stock-take can still be rerun.

- **Calls:** every call is a server action (`apps/mp/app/stocktake/actions.ts`) that uses the session's Supabase token. The browser never sees the token, and the Meta key stays in apps/api. Server actions accept up to 5 MB (`experimental.serverActions.bodySizeLimit`).
- **States:** 503 "not configured" or rate-limited, 413, 504, a `failed` run, and a `fallback` run ("the agent couldn't finish; showing the first pass") each get their own message. Polling stops after 5 failed polls in a row, with a retry; the API itself marks a run that ran past its deadline `failed`. History and sessions each have loading, failed (retry) and empty states, all previewed at `/design/stocktake`.

## Point to sell

Latency comes from tiers. The cheapest tier that answers wins.

| Tier | What | Expected |
|---|---|---|
| 0 | Barcode on device, from the cached inventory | < 100 ms |
| 1 (built) | `identify`: one 640 px JPEG (~80 KB), sent once the frame is steady and no barcode has been read for ~600 ms. Muse Spark (minimal reasoning) reads the label. Tally matches it to the merchant's items: a remembered reading, then brand + name. Qore Catalog is asked only when nothing in store matches. | 1.3–3.0 s for the label read; about 0.5–1 s more when the catalogue is asked |
| 2 | On-device student model | Planned: the only way under 1 s |

- **Why read the label instead of asking Spark to pick from the item list:** measured on a 640 px Close-Up photo, picking from a 20-item list took 3.3–6.2 s and mostly answered "none". Reading the label took 2.4–3.0 s and got the brand every time.
- **It learns:** the first time a product is identified it usually needs the catalogue and a "Is this your X?" tap. Once the merchant confirms (`identify/confirm`, or a shelf-scan confirm), the reading is remembered. Live, Close-Up went from 3.7 s via the catalogue, asking first, to 2.7 s via the remembered reading, sure, with no catalogue call.
- **The tap is always required:** the app shows the result as a suggestion, and a recognised item is never added to a sale without the merchant's tap.

## API

All routes need a Supabase JWT and are for business members only (403 otherwise; membership is checked before any model call).

### `POST /api/businesses/:id/vision/shelf-scans` (built)

Multipart, one field `image`: JPEG, PNG or WebP (checked by content, not by the declared type), at most 4 MB. Send it at up to a 2560 px long edge: on a full shelf, packs are often only 50–100 px wide at 1000 px, too small for a crop Qore Catalog accepts. Returns 200:

```json
{
  "scanId": "9b1e…",
  "model": "muse-spark-1.3",
  "countModel": "sam-3.1",
  "catalogueAvailable": true,
  "cropsStored": 9,
  "timings": { "readMs": 12800, "samMs": 5100, "matchMs": 1300, "totalMs": 17900 },
  "detections": [
    {
      "id": "3f0c2b9e-…",
      "brand": "Peak",
      "name": "Full Cream Milk Powder",
      "pack": "400g",
      "look": "white box",
      "count": 9,
      "countSource": "sam",
      "sparkCount": 6,
      "samCount": 9,
      "boxes": [{ "x1": 102, "y1": 210, "x2": 180, "y2": 395 }],
      "confidence": "high",
      "inventoryItemId": null,
      "inventoryMatch": null,
      "candidates": [
        {
          "qid": "QC-7K2M-9XQ4-R",
          "name": "Peak Full Cream Milk Powder",
          "brand": "Peak",
          "variantLabel": null,
          "size": { "value": 400, "unit": "g" },
          "packQty": 1,
          "score": 0.94,
          "price": { "median": 4500, "min": 4200, "max": 5100 },
          "inventoryItemId": null,
          "match": "strong",
          "image": null
        }
      ]
    }
  ]
}
```

- `brand` and `pack` are `""` when the label isn't legible. `confidence` is `high` (label clearly legible), `medium` (partly) or `low` (inferred from shape or colour).
- `count` is SAM's when SAM found at least half of Spark's units (`countSource: "sam"`), else Spark's. SAM matches a look, not a label, so on a busy shelf it can miss most of a product. When SAM found some but under half, Spark's count and boxes stay and the line gets `review: "Counts disagree: read N, SAM found M. Check the count."`. Both raw counts are returned; `samCount` is `null` when SAM didn't run for the product (more than 20 distinct looks, or the SAM request failed). `boxes`: one per counted unit, at most 50 products per photo.
- `timings`: `samMs` and `matchMs` run in parallel after `readMs`.
- `candidates`: up to 3 plausible matches, best first. When a brand was read, only products of that brand count. Without one, the name must match on meaning: `/v1/match` `signals.text` ≥ 0.50. Measured on 92 unbranded reads after Qore Catalog added semantic search, this keeps 58 of 61 right-type matches and 1 of 31 wrong ones. Unbranded matches are always suggestions (`inventoryNeedsConfirm`), never sure. `/v1/match` always returns its nearest products, so without this filter a brand the catalogue lacks comes back as another brand's lookalike. Empty means the catalogue doesn't have it: the merchant adds it as their own item. `price` is `null` when the catalogue has no price.
- `candidates[].match`: how well the candidate fits what was read, from the catalogue's match signals:
  - `strong`: the brand and size both agree with the label;
  - `medium`: the brand agrees (the size doesn't, or wasn't read), or no brand was read but the name matches well (text ≥ 0.7);
  - `low`: it passed the filter above, but only just.
- `candidates[].image`: the catalogue's approved picture `{ url, width, height }`, or `null` until a curator approves one, which is the case for all products today. Show the line's crop or a placeholder instead.

#### Showing a line (clients)

- **Pre-fill by the top candidate's `match`:**
  - `strong`: pre-fill its name and price.
  - `medium`: pre-fill, but ask "Is this your item?". Scans stored before match strengths were saved have no `match`: treat it as medium.
  - `low`: **don't pre-fill.** Nothing is picked: the merchant must choose a product or "New item" before confirming. The name is the label's reading (e.g. "Blue box") with no price; the low suggestions appear only in the picker. Live, an unbranded "Blue box" otherwise pre-filled a hair dye at ₦11,499.
  - **A `review` reason overrides the match: pre-fill nothing.** The agent couldn't confirm the line. Live, an unreadable "Cooking Oil" pre-picked Dax Hair Pomade and was confirmed as is.
  - No candidates: a new item named from the label.
- **Don't pre-choose a restock or restore you're not sure of.** When the line asks "Is this your item?" (`inventoryNeedsConfirm`), or has a `review` reason and wasn't matched by a branded reading the merchant already confirmed, start with no action: the merchant picks Restock, Add or Skip, and confirm waits for it ("N to choose"). Live, an unidentified "Cooking Oil" came pre-set to restock the store's Devon Kings 10l with 17 units.
  - A restock of a hand-typed item (`inventoryMatch: "name"`) needs no pick; a pick only links the item to the Qore ID.
- **Product picker** (tapping a line's product; built in apps/mp, `product-picker.tsx`):
  - **Suggested:** the line's `candidates`, each with its image or the crop, name, size or variant, ~₦ median and a match pill. The current pick is selected.
  - **Other sizes of the selected product:** `GET /api/catalog/products/:qid` returns `variants: [{ qid, variantLabel, packQty }]`. A variant carries no price, so fetch the chosen variant the same way for its price. Picking another size fixes the most common error: right product, wrong size.
  - **Search the catalogue:** `GET /api/catalog/products?q=…&limit=10`, debounced.
  - **New item (not in catalogue):** no Qore ID.
- **On confirm:** send `add` with the picked `qid` (or none for a new item), or `restock`, as before. The server derives the feedback: the top suggestion kept is `accepted`, any other product (another size, a search result) is `corrected`, and no Qore ID is `new_item`.
- `inventoryItemId` (on a candidate): the business's active item linked to that Qore ID.
- `catalogueAvailable: false`: Qore Catalog failed; detections come back without candidates rather than failing the scan.
- `scanId` and detection `id`s are stored: confirm uses them. Only the photo's sha256 is kept, not the photo.
- **Does the merchant already have it?** Tally answers this against the business's own items; Qore Catalog never sees merchant inventory. The detection's `inventoryItemId`, `inventoryItemName` (the item's name, with its variant), `inventoryMatch`, `inventoryItemArchived` and `inventoryNeedsConfirm` are set by the first rule that applies:
  1. `reading`: the camera read exactly this before and the merchant confirmed it as this item. Works for products the catalogue doesn't know.
  2. `catalogue`: an active item is linked to one of the plausible candidates' Qore IDs. It is "in stock" only when that candidate agrees on both brand and size (`/v1/match` `signals.brand = 1` and `signals.size = 1`); an unbranded read always asks. Otherwise `inventoryNeedsConfirm: true` ("Is this your Peak Milk 400g?"): a Peak 900g on the shelf must not restock the merchant's Peak 400g. A size-agreeing candidate beats a better-scored one that doesn't. Never create a duplicate.
  3. `catalogue` with `inventoryItemArchived: true`: only an item the merchant removed has that Qore ID. Show "You removed X. Restore?"; restoring keeps their name, price and history. The same size rule sets `inventoryNeedsConfirm`.
  4. `name`: a hand-typed item (no Qore ID) whose name contains the brand and name read off the pack. Always `inventoryNeedsConfirm: true`: show "Is this your X?". This needs a legible brand, exactly one such item and no conflicting pack size. Confirming it links the item to the Qore ID, so later scans match exactly.
  5. `null`: not in store. Offer the catalogue candidates ("Add to my store"), or a new item named from the label when there are none.
- An empty shelf returns `detections: []`.

### `POST /api/businesses/:id/vision/photo-check` (built)

Before a scan. Multipart, one field `image`: JPEG, PNG or WebP, at most 1 MB (send about 1024 px). One Muse Spark call with minimal reasoning; nothing is stored. Returns 200:

```json
{ "verdict": "retake", "issues": ["angled", "too_far", "cut_off"], "instruction": "Stand straight in front of one shelf and take photo facing it.",
  "productsVisible": 200, "labelsLegible": "some", "region": { "x1": 380, "y1": 280, "x2": 1000, "y2": 980 }, "model": "muse-spark-1.3", "ms": 4700 }
```

- `verdict`: `good`, `usable` (some products will be lost) or `retake` (most can't be read). `issues`, worst first: `not_shelf`, `too_far`, `too_close`, `angled`, `blurry`, `dark`, `glare`, `obstructed`, `cut_off`. `region`: the area with the most readable products, or null.
- Advice only: never block a scan on it. Measured on two stored photos: 3.8–4.7 s, about 1.1k tokens in and 0.4k out. Too slow to run on every camera frame; check once after capture.
- 401 / 403 membership, 400 no or bad image, 413 over 1 MB, 503 / 504 / 502 as identify.

### `POST /api/businesses/:id/vision/identify` (built)

Point-to-sell. Multipart, one field `image`: JPEG, PNG or WebP, at most 1 MB. Send about a 640 px long edge (JPEG ~80 KB). Nothing is stored. Returns 200:

```json
{
  "model": "muse-spark-1.3",
  "reading": { "brand": "Closeup", "name": "Toothpaste", "pack": "130g" },
  "match": {
    "itemId": "2c9f…",
    "name": "Close-Up Toothpaste 130g",
    "price": "3000.00",
    "quantityOnHand": "14.000",
    "inventoryMatch": "reading",
    "archived": false,
    "needsConfirm": false
  },
  "candidates": [],
  "catalogueAvailable": true,
  "timings": { "readMs": 2600, "matchMs": 0, "totalMs": 2600 }
}
```

- **`reading`:** what Spark read off the label. `null` when nothing was legible; then `match` is `null` and the catalogue isn't asked.
- **`match`:** the merchant's item, found with the same rules as a shelf scan (see "Does the merchant already have it?" above). It is `null` when the product isn't in store.
  - `needsConfirm: true` means ask "Is this your X?" first.
  - `archived: true` means offer to restore it.
  - `quantityOnHand` is `null` for an archived item.
- **`candidates`:** up to 3 plausible catalogue products, filled only when nothing in store matched, so the merchant can add it.
- **Errors:** the same as shelf scan. 413 is above 1 MB; the timeout (504) is 10 s.

### `POST /api/businesses/:id/vision/identify/confirm` (built)

`{ "reading": <identify's reading, unchanged>, "itemId": "…" }` remembers that reading for that active item, so the next identify recognises it from the reading with no catalogue call. Call it when the merchant confirms a suggestion or picks the right item. Returns `{ itemId, readingKey }`, where `readingKey` is null when the reading has no brand (too vague to remember); 404 when the item isn't an active item of this business.

### `GET /api/businesses/:id/vision/shelf-scans/:scanId` (built)

A stored scan, reopened, so a client can finish or show it later. 404 when the scan isn't this business's.

```json
{
  "scanId": "…", "status": "open", "createdAt": "…", "confirmedAt": null,
  "model": "muse-spark-1.3", "countModel": "sam-3.1", "catalogueAvailable": true, "candidateDetails": true,
  "detections": [
    {
      "id": "…", "position": 0, "brand": "Peak", "name": "Full Cream Milk Powder", "pack": "400g", "count": 6, "…": "as in POST shelf-scans",
      "candidates": [{ "qid": "QC-7K2M-9XQ4-R", "score": 0.94, "match": "strong", "name": "Peak Full Cream Milk Powder", "price": { "median": 4500, "min": 4200, "max": 5100 }, "inventoryItemId": "2c9f…" }],
      "review": null, "evidence": null,
      "cropUrl": "https://…r2.cloudflarestorage.com/…/tally/crops/<scanId>/0.webp?X-Amz-…",
      "decision": { "action": "restock", "itemId": "2c9f…", "itemName": "Peak Milk 400g", "quantity": 6, "confirmedQid": "QC-7K2M-9XQ4-R", "decidedAt": "…" }
    }
  ]
}
```

- **Candidates:** Tally stores Qore IDs, scores and (since migration `0007`) `match` only. Names, prices and images are fetched again from Qore Catalog by Qore ID (cached 10 minutes, a merged product followed once). A lookup that fails leaves just `qid` and `score`, and `candidateDetails` is false.
- **Store state is as of now:** `inventoryItemArchived` and each candidate's `inventoryItemId` come from today's inventory, so an item removed since the scan offers restore. `inventoryNeedsConfirm` follows the scan-time rule (reading: sure; name: ask; catalogue: sure only when that candidate's `match` is `strong`).
- **`review`** is stored (migration `0007`), so a reopened agent scan still picks nothing on a flagged line.
- **`cropUrl`:** a presigned R2 link valid for an hour, or null when R2 isn't configured. It 404s when no crop was stored (box too small).
- **`decision`:** null until the line is confirmed.

### `GET /api/businesses/:id/vision/stocktakes?limit=` (built)

Stock-take history: the business's stock-take runs and quick scans (scans no run points at), newest first. `limit` 1–100, default 30.

```json
[
  { "id": "5b0e…", "kind": "stocktake", "runId": "5b0e…", "scanId": "9a41…", "status": "confirmed", "fallback": false,
    "startedAt": "…", "confirmedAt": "…", "error": null, "lines": 8, "decided": { "add": 2, "restock": 5, "restore": 0, "skip": 1 },
    "preview": ["Peak", "Milo", "Indomie"] }
]
```

- `status`: `running`, `review` (the scan is open), `confirmed`, `discarded`, `superseded`, or `failed` (`error` says why). Runs past their deadline are marked failed before the list is read.
- **Grouped like threads:** a rerun appears in its root's `reruns` (oldest first), not at the top level; `rerunOf` is the root's scan id. Groups sort by their newest run, so a fresh rerun brings its group to the top.
- `preview`: up to 3 distinct products read (brand, else name), in scan order; the entry's title.
- `lines` is null while running or when the run failed. `decided` counts lines by the action the merchant chose: an `add` lands as a restock when the item already exists, so it can differ from the confirm response's `created`.
- Open an entry with `GET …/stocktakes/:runId` (a run) or `GET …/shelf-scans/:scanId` (a quick scan).

### `POST /api/businesses/:id/vision/shelf-scans/:scanId/rerun` (built)

Runs the stock-take agent again on the scan's stored photo (`tally/scans/<scanId>.jpg`). Returns `202 { runId, status: "running", rerunOf }`; poll `GET …/stocktakes/:runId` as for a new one. Same membership check and deadlines.

- `rerunOf` is the group's root, the photo's first scan, whichever run you rerun. The new run stores it in `vision_agent_runs.rerun_of_scan_id`, and its own scan stores the photo again under its own id.
- **409** when no photo was kept (scans from before photos were stored, or R2 off), or when a run of this photo has already moved stock (confirmed, or any line decided). Take new stock instead.
- A rerun that finishes after a sibling moved stock saves its scan as `superseded` straight away.
- The reopened scan says whether it can be rerun: `canRerun` (photo stored, group not settled), plus `rerunOf`, `discardedAt` and `supersededAt`.

### `POST /api/businesses/:id/vision/shelf-scans/:scanId/discard` (built)

Drops an open scan: `status: "discarded"`, `discarded_at` set, everything else kept. Returns `{ status, discardedAt }`, the same again on a repeat. **409** when it is confirmed or superseded. Lines confirmed earlier (a partial confirm) stay applied.

### `POST /api/businesses/:id/vision/shelf-scans/:scanId/confirm` (built)

```json
{
  "decisions": [
    { "detectionId": "…", "action": "restock", "itemId": "…", "quantity": 6 },
    { "detectionId": "…", "action": "restock", "itemId": "…", "qid": "QC-7K2M-9XQ4-R", "quantity": 2 },
    { "detectionId": "…", "action": "restore", "itemId": "…", "quantity": 4 },
    { "detectionId": "…", "action": "add", "qid": "QC-7K2M-9XQ4-R", "name": "Peak Milk 400g", "price": "4500", "quantity": 12 },
    { "detectionId": "…", "action": "add", "name": "Lady B Custard 2kg", "price": "6800", "quantity": 3 },
    { "detectionId": "…", "action": "skip" }
  ]
}
```

- **`action`:**
  - `restock`: needs `itemId`, an active item. Usually the detection's `inventoryItemId`; with `qid` on a hand-typed item it also links the item.
  - `restore`: needs `itemId`, an archived item.
  - `add`: needs `name` and `price` (Naira string). Add `qid` when the merchant picked a catalogue candidate.
  - `skip`: nothing else.
- **`quantity`:** whole units to add, required unless `skip`; `0` changes no stock.
- **Limits:** 1–50 decisions per request.
- **Returns 200** `{ created, restocked, restored, skipped, alreadyDecided, invalid: [{ detectionId, reason }], scanConfirmed, feedback }`.
  - A decision that can't apply is listed in `invalid` and the others still apply. Reasons include: item archived, item not archived, linked to another product, another active item already has that product or barcode, not in this scan.
  - `scanConfirmed` is true once every detection is decided.
  - `feedback` is `{ sent, recorded, duplicates }`, or `{ sent: 0, error }` when Qore Catalog was down.
  - `images` is `{ uploaded, skipped, failed }`: crops sent to Qore Catalog for lines confirmed with a Qore ID.
  - `superseded`: how many other runs of the same photo this confirm made read-only. Once a scan has a decided line, its still-open siblings become `superseded`, in the same transaction (the whole group is locked).
- **Errors:** 400 for an invalid body, 403 for a non-member, 404 for an unknown scan, 409 when the scan is discarded or superseded, or another run of this photo is already confirmed. A retried confirm on a confirmed scan still returns 200 with `alreadyDecided`.

### Removing an item (built)

`DELETE /api/businesses/:id/inventory/:itemId` archives the item; nothing is ever deleted. It keeps its Qore ID, name, price and stock history, so a later scan of the same product offers to restore it. 404 when no active item has that id.

### Notes on the fields

- Boxes use 0–1000 coordinates of the uploaded image.
- Feedback `outcome` is derived from the action: the top candidate confirmed is `accepted`, another Qore ID is `corrected`, no Qore ID is `new_item`, and `skip` is `removed`.
- `price` is an indicative catalogue price in whole Naira. It is not a sale amount.

Errors:

| Status | When |
|---|---|
| 400 | No `image` field, not a JPEG/PNG/WebP, unreadable, or rejected by the model's content policy |
| 413 | Image too large |
| 403 | Not a member |
| 404 | Unknown business or scan |
| 503 with `Retry-After` | The model API is rate-limited, or `META_MODEL_API_KEY` is not set (no header) |
| 502 | Model failure |
| 504 | Timeout: 45 s for a shelf scan, 4 s for identify (planned) |

Measured on photos of Nigerian shops (Oct 2026): the Muse Spark read takes 8–24 s, then SAM takes 3–6 s and the catalogue match about 1–3 s, in parallel. The whole scan takes about 12–30 s. Read time grows with the number of units in the frame, because Spark writes one box per unit. Show progress on the device rather than blocking.

## Shelf sweep (experimental)

**Status: built for the benchmark only. No route uses it and there is no switch yet.** On dense shelves each product is only a few dozen pixels in the single Spark read, so products get missed or merged. The stock-take agent only zooms into lines the first pass found, so it never recovers a product the read missed. The sweep (`src/modules/vision/shelf-sweep.ts`) reads the shelf the way a person counts one: row by row, left to right.

1. **Layout:** one Spark call on a 1024 px copy returns shelf rows (horizontal bands) and, when a row holds more than about 12 products, bays (vertical sections), on the 0–1000 grid. Bands become contiguous cuts from 0 to 1000, so nothing between them goes unread. The layout is capped at 6 rows, 3 bays and 12 cells. If the call fails or returns no usable rows, the sweep uses a fixed 3 × 2 grid.
2. **Sweep:** each cell is cut from the full-resolution, EXIF-rotated upload. Its crop extends 10% of the cell's size past each edge, so neighbouring crops share 20%. Each cell is scaled to a 1024–2048 px long edge and read with the quick scan's prompt and schema, unchanged. Up to 4 cells are read at a time and results are kept in reading order. Each cell call has a 45 s timeout, and the whole sweep has an 80 s deadline. Cells that haven't started by the deadline are marked unreadable.
3. **Stitch:** cell boxes are mapped back onto the photo's grid. A unit belongs to the cell whose own area (without the overlap) holds its centre, so a unit seen in two overlapping crops is counted once. If that cell couldn't be read, its neighbours' overlap supplies the unit. Products with the same normalised brand and name (an unread brand or pack matches any) merge across cells: their boxes combine and duplicates (IoU > 0.5) drop. Any two products' near-identical boxes (IoU > 0.8) go to the more confident reading. Each product keeps the cells that saw it.
4. **Coverage:** every cell ends as `read`, `empty` or `unreadable`, with a line like "Row 2, left: 4 products (11 units)". `sweepSteps` turns the layout and these lines into `baseline` trace steps for when a stock-take uses the sweep. The sweep fails only when no cell could be read.
5. **Then the usual pipeline:** SAM counting (the half-of-Spark agreement rule still applies), the catalogue match, the store match and the agent all run unchanged on the stitched products.

**Cost and time:** the sweep makes 1 + cells Spark calls (up to 13), against 1 for the single read. Token counts are summed across all of them. With SAM and the catalogue match, it is designed to fit the stock-take's 120 s first-pass deadline. To compare it with the single read, run `vision-benchmark.mjs --sweep` (see the apps/api README). It gets a DB-configured switch only if those numbers justify one.

## Product crops

When a scan is stored, Tally cuts one crop per detection (its largest box, 6% margin, at most 640 px, WebP) from the photo while it is still in memory. The crop shows the product, never the whole shelf or the people in it. It is stored in Cloudflare R2 (bucket `tally-media`) at `tally/crops/<scanId>/<position>.webp`.

**The shelf photo** is stored with the scan at `tally/scans/<scanId>.jpg`, kept for good as the stock-take's audit record: upright, at most 2560 px, JPEG, with all metadata (EXIF, GPS) removed. Only members of the business get it, through a presigned link on reopen (`photoUrl`, an hour). Storing it is best-effort: the scan response reports `photoStored`, and a failure never fails the scan.

- **Size:** crops down to a 48 px short side are stored in R2 for Tally's own dataset. Only crops with a short side of 160 px or more are uploaded to Qore Catalog, which rejects smaller ones; the check runs on the stored crop at confirm time.
- **Lines with a Qore ID:** on confirm, after the line's feedback is sent, Tally reads the crop back and uploads it as a candidate picture of the confirmed product. A curator approves or rejects it in Qore Catalog. Approved pictures come back on products as `image.url`.
- **New items:** lines confirmed as a new item (no Qore ID) or skipped send nothing.
- **Best-effort:** a crop or upload failure never fails the scan or the confirm. The scan response reports `cropsStored`; confirm reports `images: { uploaded, skipped, failed, skippedBy: { noProduct, noCrop, tooSmall } }`.
- **Logged:** each scan logs how many crops were stored and how many boxes were too small to store. Each confirm logs every line that sent nothing and why (no catalogue product, no stored crop, under 160 px), and every rejected upload with Qore Catalog's status and message (never the key), then a one-line total.
- **Resolution decides it:** a product is a crop only if its box is at least 48 px in the photo, and a catalogue picture only if it is at least 160 px. On a ~1000 px photo most shelf products are smaller than that, so no picture is sent. apps/mp sends up to 2560 px; the mobile app sends up to 1600 px.
- **Credentials:** R2 keys are server-only (`R2_*` in apps/api, token scoped to the bucket). Not Supabase Storage, which would write to the shared project's `storage` schema. Clients only get short-lived presigned URLs: a reopened scan's `cropUrl` and `photoUrl` (an hour). Without `R2_*`, crops and the photo are skipped and everything else works.

## Data

Migration `0004_add_vision_scans`, all in the `tally` schema. Child rows carry `business_id` and use composite foreign keys, like the rest of the schema. Tally keeps its own readings and only Qore IDs + match scores from the catalogue: no catalogue names or prices. How these tables relate, and who writes what: [vision schema](vision-schema.md).

- **`vision_scans`** (built): business, status (`open`, `confirmed`), the photo's sha256 and size, model ids, time per stage, `created_by`.
- **`vision_detections`** (built): the scan and position; brand, name, pack and look as read; Spark's and SAM's counts; boxes and confidence; candidates as `[{qid, score, match}]`; the item it looks like and how it was found; the `review` reason (an agent's verdict and/or a count disagreement; migration `0007_add_detection_review`). The merchant's decision (migration `0005_add_vision_decisions`): action, feedback outcome, confirmed Qore ID, item, quantity, who decided and when, and when feedback was sent.
- **`inventory_item_readings`** (written on confirm, branded readings only): `brand|name|pack` as read → the merchant's item. One reading maps to one item per business.

Identify calls are not stored; only a confirmed reading is (`inventory_item_readings`).

## Try it

`apps/api/scripts/vision-smoke.mjs` runs the built read + match code on local photos (no database) and prints each product, its top match, timings and token use. It spends Meta Model API credit:

```bash
pnpm --filter @tally/api build
node --env-file=apps/api/.env apps/api/scripts/vision-smoke.mjs shelf1.jpg shelf2.jpg
```

## Open questions

- **Image storage.** Recognition training (in Qore Catalog) needs the photos. The options are a Supabase Storage bucket (whose objects live outside the `tally` schema) or a separate object store. Until that's decided, images stay in memory and are discarded after the request.
- **Brand discrimination in SAM.** Can SAM tell brands apart from a branded noun phrase? If not, SAM counts the generic shape ("tin can"), and instances are assigned to products by overlap with Muse Spark's boxes.
- **Muse Spark accuracy on local packaging** needs measuring on real Nigerian shelf photos before the confirm screen is tuned.
