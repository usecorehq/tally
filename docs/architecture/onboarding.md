# Onboarding

> Diagram: [onboarding sequence](../diagrams/images/onboarding-sequence.svg)

A merchant creates a business by picking a Qore Catalog sub-type, then turns that sub-type's template into a starter inventory. Every keep/swap/add/remove decision goes back to Qore Catalog as feedback, which is how the catalogue learns what Nigerian shops actually stock.

Built: the API (`apps/api/src/modules/businesses`). Planned: the mp and mobile screens.

## Routes (all need a Supabase JWT)

| Route | Does |
|---|---|
| `POST /api/businesses` `{ name, subtypeCode }` | `subtypeCode` must exist in `GET /api/catalog/verticals` (else 422); stores its vertical; caller becomes `owner` |
| `GET /api/businesses` | Businesses the caller belongs to, with `role` |
| `GET /api/businesses/:id` | One business; 404 unknown, 403 not a member |
| `GET /api/businesses/:id/inventory` | Inventory by name (members only) |
| `POST /api/businesses/:id/inventory/starter` `{ items[] }` | Apply the template step (1–200 items); returns `{ created, skipped, removed, invalid, feedback }` |

## Starter items

Each item carries a client-generated `clientRef`, the template item's name, and an `outcome`:

| Outcome | Stocked as | Feedback to Qore Catalog |
|---|---|---|
| `accepted` | the suggested product (`suggestedQid`, or `qid`) | `suggestedQid` (or `confirmedQid`) |
| `corrected` | the product the merchant picked (`qid`) | `suggestedQid` + `confirmedQid` |
| `new_item` | the merchant's own name, no Qore ID | `confirmedName` |
| `removed` | nothing | the decision only |

Kept items need `name` and `price` (₦, up to 2 decimals, as a string); `openingQuantity` records an `opening` stock movement. Items that don't fit these rules come back in `invalid` and are skipped; the rest still apply.

The mapping lives in one pure function, `planStarterInventory` (`starter-inventory.ts`), with unit tests for every row above.

## Safe to retry

Mobile networks drop requests, so resending the same body changes nothing:

- an item already linked to the same Qore ID (or, without one, with the same name) is `skipped`, not duplicated;
- opening movements are keyed `starter:<clientRef>`;
- Qore Catalog dedupes feedback by `clientRef` (a retry reports `duplicates`).

## Feedback is best-effort

Inventory is saved first, in one transaction; feedback is sent afterwards. A catalogue outage returns `feedback: { sent: 0, error }` instead of failing onboarding.

- Batches of up to 100 (the catalogue's limit). The catalogue validates a batch as a whole, so a rejected batch (400) is resent item by item — one bad item can't drop the rest.
- `unitPriceNgn` is sent in whole Naira and `quantity` only when it's a whole number: the catalogue validates both as integers. The inventory keeps the exact price.

## Performance

`GET …/templates?suggestions=N` takes ~5 s the first time per sub-type (then cached for 10 minutes here and an hour in the catalogue): show a loading state, or load the plain template (~0.5 s) first. A starter request with a handful of items takes ~2–4 s on staging (one transaction, then feedback).
