# Vision recognition (planned)

> Diagrams: [shelf scan](../diagrams/images/vision-shelf-scan-sequence.svg), [point to sell](../diagrams/images/vision-identify-sequence.svg). **Planned, not built.** Endpoint shapes may change before they ship.

The merchant points the phone camera at products and Tally recognises them. Product side (users, screens, metrics, delivery slices): [photo-to-inventory PRD](../prd-photo-to-inventory.md). There are two flows:

- **Shelf scan (photo → inventory).** Photograph a shelf or a pile of stock. Tally identifies every product in the frame and matches each one to a Qore Catalog product with an indicative ₦ price. The merchant confirms or corrects the results, and the items land in their inventory with counts. Accuracy matters more than speed here.
- **Point to sell.** Point the camera at one item to find it at the till. Speed matters most here.

Every confirmation or correction goes back to Qore Catalog as feedback with `source: "photo"`. Those labels later train an on-device model (see [Q Vision distillation](qvision-distillation.md)).

## Where each model runs

| Step | Runs on | Model |
|---|---|---|
| Barcode read | Device | `mobile_scanner` (built; see [Barcode scan](barcode-scan.md)) |
| Read the products in a photo (brand, name, pack size, rough count, box) | apps/api → Meta Model API | Muse Spark (`muse-spark-1.3`), structured JSON output |
| Count and outline each product | apps/api → Meta Model API | SAM 3.1 (`sam-3.1`), one concept prompt per product |
| Match to the catalogue, with prices | apps/api → Qore Catalog | `POST /v1/match` |
| Identify one item against the merchant's inventory | apps/api → Meta Model API | Muse Spark, closed-set prompt |
| On-device recognition | Device | Planned: a small student model distilled from Muse Spark labels and merchant confirmations |

All model calls go through apps/api. `META_MODEL_API_KEY` is server-only, like `QORE_CATALOG_API_KEY`. The mobile app and the web apps never hold it. Requests use Meta's Standard mode, so merchants' photos are not used to train Meta's models.

### Why Muse Spark first, then SAM

SAM 3.1 segments one concrete noun phrase per request. A generic prompt such as "product" is a weak concept. Cropping each object and reading it separately would cost one model call per crop and lose label resolution. So the order is:

1. One Muse Spark call reads the whole frame. It lists each distinct product with a bounding box on a 0–1000 grid. Structured output guarantees the JSON shape.
2. SAM 3.1 then counts and outlines the instances of each product. Its boxes also drive the confirm screen's overlay.

If SAM finds nothing for a product, the count falls back to Muse Spark's estimate.

## Shelf scan

1. The device scales the photo to a 1600 px long edge and encodes it as JPEG (quality ~80, about 400 KB). It sends the image as multipart.
2. The API runs Muse Spark on the image, then SAM for each product in parallel.
3. The API sends all distinct products to `POST /v1/match` in one call and keeps the top 3 candidates per product. A product the business already stocks (same Qore ID) is marked as a restock.
4. The API stores the scan and its detections, then returns them.
5. The merchant accepts, corrects, adds as their own item, or removes each detection, and sets the quantity and price.
6. On confirm:
   - A new product becomes an `inventory_items` row (`source = 'photo'`) with an `opening` stock movement.
   - A product the business already stocks gets a `restock` movement.
   - Every decision goes to Qore Catalog as feedback, keyed by the detection id. Retries are safe, and as in [onboarding](onboarding.md), a catalogue outage never fails the confirm.

## Point to sell

Latency comes from tiers. The cheapest tier that answers wins.

| Tier | What | Expected |
|---|---|---|
| 0 | Barcode on device, from the cached inventory | < 100 ms |
| 1 | `identify`: one 640 px JPEG (~80 KB), sent once the frame is steady and no barcode has been read for ~600 ms. Muse Spark (minimal reasoning) picks from the merchant's own inventory, or "none". The inventory list leads the prompt so it hits the prompt cache. | To be measured. Meta doesn't publish latency figures. |
| 2 | On-device student model | Planned |

The app shows the result as a suggestion the merchant taps to confirm. A recognised item is never added to a sale without that tap.

## API (planned)

All routes need a Supabase JWT and are for business members only.

| Route | Body | Returns |
|---|---|---|
| `POST /api/businesses/:id/vision/shelf-scans` | multipart `image` (JPEG/PNG/WebP, ≤ 4 MB) | `{ scanId, detections: [{ id, brand, name, pack, count, box, confidence, candidates: [{ qid, name, score, price }], inventoryItemId }] }` |
| `GET /api/businesses/:id/vision/shelf-scans/:scanId` | none | The same shape, plus each detection's decision |
| `POST /api/businesses/:id/vision/shelf-scans/:scanId/confirm` | `{ decisions: [{ detectionId, outcome, qid?, name?, price, quantity }] }` | `{ created, restocked, removed, invalid, feedback }` |
| `POST /api/businesses/:id/vision/identify` | multipart `image` (≤ 300 KB) | `{ match: { itemId, name, price, confidence } \| null }` |

Notes on the fields:

- `box` uses 0–1000 coordinates of the uploaded image.
- `outcome` is one of `accepted`, `corrected`, `new_item`, `removed`, as in onboarding.
- `price` is an indicative catalogue price in whole Naira. It is not a sale amount.

Errors:

| Status | When |
|---|---|
| 400 | Bad or unsupported image |
| 413 | Image too large |
| 403 | Not a member |
| 404 | Unknown business or scan |
| 503 with `Retry-After` | The model API is rate-limited |
| 502 | Model failure |
| 504 | Timeout: 20 s for a shelf scan, 4 s for identify |

## Data (planned)

Both tables live in the `tally` schema. Child rows carry `business_id` and use composite foreign keys, like the rest of the schema.

- **`vision_scans`**: business, status, image size and hash, model ids, time per stage, `created_by`.
- **`vision_detections`**: the scan; brand, name and pack size as read; Muse Spark's count and SAM's count; the box and confidence; the top candidates (jsonb); and the merchant's decision. The decision is the outcome, the confirmed Qore ID, `item_id`, quantity, and when feedback was sent.

Identify calls are not stored.

## Open questions

- **Image storage.** Training Q Vision needs the photos. The options are a Supabase Storage bucket (whose objects live outside the `tally` schema) or a separate object store. Until that's decided, images stay in memory and are discarded after the request.
- **Brand discrimination in SAM.** Can SAM tell brands apart from a branded noun phrase? If not, SAM counts the generic shape ("tin can"), and instances are assigned to products by overlap with Muse Spark's boxes.
- **Muse Spark accuracy on local packaging** needs measuring on real Nigerian shelf photos before the confirm screen is tuned.
