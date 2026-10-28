# Vision recognition

> Diagrams: [shelf scan](../diagrams/images/vision-shelf-scan-sequence.svg), [point to sell](../diagrams/images/vision-identify-sequence.svg).
>
> **Built:** shelf-scan recognition (Muse Spark reads the photo, SAM 3.1 counts the units, Qore Catalog matches), the check against the merchant's own inventory, storing each scan, confirm → inventory + feedback, and point-to-sell identify (tier 1). **Planned:** crops in R2 and their upload to Qore Catalog, and an on-device model. Planned endpoint shapes may change before they ship.

The merchant points the phone camera at products and Tally recognises them. There are two flows:

- **Shelf scan (photo → inventory).** Photograph a shelf or a pile of stock. Tally identifies every product in the frame and matches each one to a Qore Catalog product with an indicative ₦ price. The merchant confirms or corrects the results, and the items land in their inventory with counts. Accuracy matters more than speed here.
- **Point to sell.** Point the camera at one item to find it at the till. Speed matters most here.

Every confirmation or correction goes back to Qore Catalog as feedback with `source: "photo"`. Those labels later train an on-device model (see [Q Vision distillation](qvision-distillation.md)).

## Where each model runs

| Step | Runs on | Model |
|---|---|---|
| Barcode read | Device | `mobile_scanner` (built; see [Barcode scan](barcode-scan.md)) |
| Read the products in a photo (brand, name, pack size, rough count, box) | apps/api → Meta Model API | Muse Spark (`muse-spark-1.3`), structured JSON output |
| Count each product's units | apps/api → Meta Model API | SAM 3.1 (`sam-3.1`), one concept prompt per distinct look |
| Match to the catalogue, with prices | apps/api → Qore Catalog | `POST /v1/match` |
| Identify one item at the till | apps/api → Meta Model API, then Tally | Muse Spark (minimal reasoning) reads the label; Tally matches it to the merchant's items |
| On-device recognition | Device | Planned: a small student model distilled from Muse Spark labels and merchant confirmations |

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
   - Every non-skip decision remembers the reading for that item (`inventory_item_readings`).
   - Then every decided line goes to Qore Catalog as `source: "photo"` feedback, clientRef `<scanId>:<position>`. As in [onboarding](onboarding.md), a catalogue outage never undoes the stock changes; unsent feedback goes out on the next confirm of the scan.
   - Retries are safe: decided detections are left alone, and stock movements are keyed by detection id.

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

Multipart, one field `image`: JPEG, PNG or WebP (checked by content, not by the declared type), at most 4 MB. Send it at about a 1600 px long edge. Returns 200:

```json
{
  "scanId": "9b1e…",
  "model": "muse-spark-1.3",
  "countModel": "sam-3.1",
  "catalogueAvailable": true,
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
          "inventoryItemId": null
        }
      ]
    }
  ]
}
```

- `brand` and `pack` are `""` when the label isn't legible. `confidence` is `high` (label clearly legible), `medium` (partly) or `low` (inferred from shape or colour).
- `count` is SAM's when SAM found this product's units (`countSource: "sam"`), else Spark's. Both raw counts are returned; `samCount` is `null` when SAM didn't run for the product (more than 20 distinct looks, or the SAM request failed). `boxes`: one per counted unit, at most 50 products per photo.
- `timings`: `samMs` and `matchMs` run in parallel after `readMs`.
- `candidates`: up to 3 plausible matches, best first. When a brand was read, only products of that brand count. Without one, the name must match on meaning: `/v1/match` `signals.text` ≥ 0.50. Measured on 92 unbranded reads after Qore Catalog added semantic search, this keeps 58 of 61 right-type matches and 1 of 31 wrong ones. Unbranded matches are always suggestions (`inventoryNeedsConfirm`), never sure. `/v1/match` always returns its nearest products, so without this filter a brand the catalogue lacks comes back as another brand's lookalike. Empty means the catalogue doesn't have it: the merchant adds it as their own item. `price` is `null` when the catalogue has no price.
- `inventoryItemId` (on a candidate): the business's active item linked to that Qore ID.
- `catalogueAvailable: false`: Qore Catalog failed; detections come back without candidates rather than failing the scan.
- `scanId` and detection `id`s are stored: confirm uses them. Only the photo's sha256 is kept, not the photo.
- **Does the merchant already have it?** Tally answers this against the business's own items; Qore Catalog never sees merchant inventory. The detection's `inventoryItemId`, `inventoryMatch`, `inventoryItemArchived` and `inventoryNeedsConfirm` are set by the first rule that applies:
  1. `reading`: the camera read exactly this before and the merchant confirmed it as this item. Works for products the catalogue doesn't know.
  2. `catalogue`: an active item is linked to one of the plausible candidates' Qore IDs. It is "in stock" only when that candidate agrees on both brand and size (`/v1/match` `signals.brand = 1` and `signals.size = 1`); an unbranded read always asks. Otherwise `inventoryNeedsConfirm: true` ("Is this your Peak Milk 400g?"): a Peak 900g on the shelf must not restock the merchant's Peak 400g. A size-agreeing candidate beats a better-scored one that doesn't. Never create a duplicate.
  3. `catalogue` with `inventoryItemArchived: true`: only an item the merchant removed has that Qore ID. Show "You removed X. Restore?"; restoring keeps their name, price and history. The same size rule sets `inventoryNeedsConfirm`.
  4. `name`: a hand-typed item (no Qore ID) whose name contains the brand and name read off the pack. Always `inventoryNeedsConfirm: true`: show "Is this your X?". This needs a legible brand, exactly one such item and no conflicting pack size. Confirming it links the item to the Qore ID, so later scans match exactly.
  5. `null`: not in store. Offer the catalogue candidates ("Add to my store"), or a new item named from the label when there are none.
- An empty shelf returns `detections: []`.

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

`{ "reading": <identify's reading, unchanged>, "itemId": "…" }` remembers that reading for that active item, so the next identify recognises it from the reading with no catalogue call. Call it when the merchant confirms a suggestion or picks the right item. Returns `{ itemId, readingKey }`; 404 when the item isn't an active item of this business.

### `GET /api/businesses/:id/vision/shelf-scans/:scanId` (built)

The stored scan with its detections in position order: what was read, the counts, boxes, `candidates` as `[{ qid, score }]` (no names or prices; fetch them from `GET /api/catalog/products/:qid`), the inventory match, and each decision (`action`, `outcome`, `confirmedQid`, `itemId`, `quantity`, `decidedAt`, `feedbackSentAt`). 404 when the scan isn't this business's.

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
- **Errors:** 400 for an invalid body, 403 for a non-member, 404 for an unknown scan.

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

## Data

Migration `0004_add_vision_scans`, all in the `tally` schema. Child rows carry `business_id` and use composite foreign keys, like the rest of the schema. Tally keeps its own readings and only Qore IDs + match scores from the catalogue: no catalogue names or prices.

- **`vision_scans`** (built): business, status (`open`, `confirmed`), the photo's sha256 and size, model ids, time per stage, `created_by`.
- **`vision_detections`** (built): the scan and position; brand, name, pack and look as read; Spark's and SAM's counts; boxes and confidence; candidates as `[{qid, score}]`; the item it looks like and how it was found. The merchant's decision (migration `0005_add_vision_decisions`): action, feedback outcome, confirmed Qore ID, item, quantity, who decided and when, and when feedback was sent.
- **`inventory_item_readings`** (written on confirm): `brand|name|pack` as read → the merchant's item. One reading maps to one item per business.

Identify calls are not stored; only a confirmed reading is (`inventory_item_readings`).

## Try it

`apps/api/scripts/vision-smoke.mjs` runs the built read + match code on local photos (no database) and prints each product, its top match, timings and token use. It spends Meta Model API credit:

```bash
pnpm --filter @tally/api build
node --env-file=apps/api/.env apps/api/scripts/vision-smoke.mjs shelf1.jpg shelf2.jpg
```

## Open questions

- **Image storage.** Training Q Vision needs the photos. The options are a Supabase Storage bucket (whose objects live outside the `tally` schema) or a separate object store. Until that's decided, images stay in memory and are discarded after the request.
- **Brand discrimination in SAM.** Can SAM tell brands apart from a branded noun phrase? If not, SAM counts the generic shape ("tin can"), and instances are assigned to products by overlap with Muse Spark's boxes.
- **Muse Spark accuracy on local packaging** needs measuring on real Nigerian shelf photos before the confirm screen is tuned.
