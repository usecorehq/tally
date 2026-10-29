# Barcode scan

Scan a product's barcode to find it in the merchant's own inventory while counting stock. Lookups go to the business's inventory, not to Qore Catalog: it's instant for anything the merchant stocks, including products the catalogue doesn't know.

Built: the API. Next: the mobile scanner, which caches the inventory on the device so a scan resolves without a network round trip.

## Routes (Supabase JWT, members only)

| Route | Does |
|---|---|
| `GET /api/businesses/:id/inventory/barcode/:code` | The active item with this barcode; 404 `No item with barcode <code>` |
| `PUT /api/businesses/:id/inventory/:itemId/barcode` `{ barcode }` | Link a barcode to an item; `null` unlinks. 409 when another active item already has it |

`code` / `barcode`: 4–64 letters, digits, dots or dashes (EAN/UPC and Code 128-style codes).

## Rules

- **One item per barcode.** A unique index on `(business_id, barcode)` among active items (migration `0003_inventory_barcode_unique`), so a scan always resolves to exactly one item.
- **UPC-A = EAN-13.** Scanners return the same product as 12 or 13 digits (a leading zero). 12-digit codes are stored and looked up as 13 (`normalizeBarcode`), so either form finds the item.
- **Unknown barcode → link once.** The first scan of a product returns 404; the app lets the merchant pick the item, then every later scan is instant.

## Not yet

- Qore Catalog stores GTINs (`core_products.gtin`) but its v1 API has no lookup by barcode, and its feedback contract has no barcode field — so an unknown barcode can't be identified from the catalogue yet, and links don't teach the catalogue. Both need a qore-catalog change.
- Lookup latency is ~0.7 s against the staging database (membership check + lookup); the mobile app caches inventory to avoid it while counting.
