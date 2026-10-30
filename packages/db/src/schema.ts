/**
 * Tally drizzle schema, isolated in the shared Supabase's `tally` schema; never writes public.* or auth.*.
 * Money is numeric(12,2) read as string (never float); paid_amount and stock are trigger-maintained in SQL.
 */

import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgSchema,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const tally = pgSchema("tally");

const money = (name: string) => numeric(name, { precision: 12, scale: 2 });
const qty = (name: string) => numeric(name, { precision: 12, scale: 3 });
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

// Qore Catalog product id, e.g. QC-7K2M-9XQ4-R (Crockford base32, no I L O U).
const QID_REGEX = "^QC-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]$";

// ─── Business ────────────────────────────────────────────────────────────

export const businesses = tally.table(
  "businesses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // FK to auth.users(id) is added in the custom SQL migration (cross-schema).
    ownerUserId: uuid("owner_user_id").notNull(),
    name: text("name").notNull(),
    // Codes from Qore Catalog GET /v1/business-taxonomy.
    verticalCode: text("vertical_code").notNull(),
    subtypeCode: text("subtype_code").notNull(),
    currency: text("currency").notNull().default("NGN"),
    // Incremented by tally.next_sale_number(); the row lock serialises sales.
    saleCounter: integer("sale_counter").notNull().default(0),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("businesses_name_length", sql`char_length(name) between 1 and 120`),
    check("businesses_currency_ngn", sql`currency = 'NGN'`),
    check("businesses_sale_counter_nonneg", sql`sale_counter >= 0`),
    index("businesses_owner_idx").on(t.ownerUserId),
  ],
);

export const businessMembers = tally.table(
  "business_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    // FK to auth.users(id) is added in the custom SQL migration (cross-schema).
    userId: uuid("user_id").notNull(),
    role: text("role").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("business_members_business_user_key").on(t.businessId, t.userId),
    check("business_members_role", sql`role in ('owner', 'staff')`),
    index("business_members_user_idx").on(t.userId),
  ],
);

// ─── Inventory ───────────────────────────────────────────────────────────

export const inventoryItems = tally.table(
  "inventory_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    // Linked Qore Catalog product; null for items the catalogue doesn't know.
    coreQid: text("core_qid"),
    name: text("name").notNull(),
    variantLabel: text("variant_label"),
    sizeValue: numeric("size_value", { precision: 12, scale: 3 }),
    sizeUnit: text("size_unit"),
    packQty: integer("pack_qty").notNull().default(1),
    categoryPath: text("category_path"),
    barcode: text("barcode"),
    price: money("price").notNull(),
    cost: money("cost"),
    // Maintained by the stock_movements trigger. Never write it directly.
    quantityOnHand: qty("quantity_on_hand").notNull().default("0"),
    reorderPoint: qty("reorder_point"),
    source: text("source").notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("inventory_items_business_id_key").on(t.businessId, t.id),
    check("inventory_items_core_qid_format", sql.raw(`core_qid is null or core_qid ~ '${QID_REGEX}'`)),
    check("inventory_items_pack_qty_positive", sql`pack_qty > 0`),
    check("inventory_items_price_nonneg", sql`price >= 0`),
    check("inventory_items_cost_nonneg", sql`cost is null or cost >= 0`),
    check("inventory_items_source", sql`source in ('template', 'photo', 'manual')`),
    check("inventory_items_name_length", sql`char_length(name) between 1 and 200`),
    uniqueIndex("inventory_items_business_core_qid_key")
      .on(t.businessId, t.coreQid)
      .where(sql`core_qid is not null and archived_at is null`),
    index("inventory_items_business_name_idx").on(t.businessId, t.name),
    // One active item per barcode per business, so a scan resolves to exactly one item.
    uniqueIndex("inventory_items_business_barcode_key")
      .on(t.businessId, t.barcode)
      .where(sql`barcode is not null and archived_at is null`),
  ],
);

// ─── Sales ───────────────────────────────────────────────────────────────

export const sales = tally.table(
  "sales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    // From tally.next_sale_number(business_id).
    saleNumber: integer("sale_number").notNull(),
    status: text("status").notNull().default("completed"),
    subtotal: money("subtotal").notNull(),
    discount: money("discount").notNull().default("0"),
    total: money("total").notNull(),
    // Sum of sale_payments.amount, maintained by trigger. Never write it directly.
    paidAmount: money("paid_amount").notNull().default("0"),
    // Idempotency stamp for tally.deduct_sale_stock().
    stockDeductedAt: timestamp("stock_deducted_at", { withTimezone: true }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidReason: text("void_reason"),
    // Client-generated id so a retried request (e.g. from mobile) can't double-record.
    clientSaleId: text("client_sale_id"),
    createdBy: uuid("created_by").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("sales_business_id_key").on(t.businessId, t.id),
    unique("sales_business_sale_number_key").on(t.businessId, t.saleNumber),
    uniqueIndex("sales_business_client_sale_id_key")
      .on(t.businessId, t.clientSaleId)
      .where(sql`client_sale_id is not null`),
    check("sales_status", sql`status in ('completed', 'voided')`),
    check("sales_amounts_nonneg", sql`subtotal >= 0 and discount >= 0 and total >= 0`),
    check("sales_total_formula", sql`total = subtotal - discount`),
    check("sales_paid_nonneg", sql`paid_amount >= 0`),
    check(
      "sales_void_consistent",
      sql`(status = 'voided') = (voided_at is not null)`,
    ),
    index("sales_business_created_idx").on(t.businessId, t.createdAt.desc()),
  ],
);

export const saleItems = tally.table(
  "sale_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull(),
    saleId: uuid("sale_id").notNull(),
    itemId: uuid("item_id").notNull(),
    // Copied at the time of sale so later product edits never change receipts.
    itemName: text("item_name").notNull(),
    coreQid: text("core_qid"),
    unitPrice: money("unit_price").notNull(),
    quantity: qty("quantity").notNull(),
    lineTotal: money("line_total").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: "sale_items_sale_fk",
      columns: [t.businessId, t.saleId],
      foreignColumns: [sales.businessId, sales.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "sale_items_item_fk",
      columns: [t.businessId, t.itemId],
      foreignColumns: [inventoryItems.businessId, inventoryItems.id],
    }),
    check("sale_items_unit_price_nonneg", sql`unit_price >= 0`),
    check("sale_items_quantity_positive", sql`quantity > 0`),
    check("sale_items_line_total", sql`line_total = round(unit_price * quantity, 2)`),
    index("sale_items_sale_idx").on(t.saleId),
    index("sale_items_item_idx").on(t.businessId, t.itemId),
  ],
);

export const salePayments = tally.table(
  "sale_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull(),
    saleId: uuid("sale_id").notNull(),
    amount: money("amount").notNull(),
    // Recorded, not processed: Tally does not move money in the MVP.
    method: text("method").notNull(),
    reference: text("reference"),
    receivedBy: uuid("received_by").notNull(),
    clientPaymentId: text("client_payment_id"),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: "sale_payments_sale_fk",
      columns: [t.businessId, t.saleId],
      foreignColumns: [sales.businessId, sales.id],
    }).onDelete("cascade"),
    check("sale_payments_amount_positive", sql`amount > 0`),
    check("sale_payments_method", sql`method in ('cash', 'transfer', 'card', 'other')`),
    uniqueIndex("sale_payments_business_client_payment_id_key")
      .on(t.businessId, t.clientPaymentId)
      .where(sql`client_payment_id is not null`),
    index("sale_payments_sale_idx").on(t.saleId),
    index("sale_payments_business_created_idx").on(t.businessId, t.createdAt.desc()),
  ],
);

// ─── Stock ───────────────────────────────────────────────────────────────

export const stockMovements = tally.table(
  "stock_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull(),
    itemId: uuid("item_id").notNull(),
    type: text("type").notNull(),
    quantityDelta: qty("quantity_delta").notNull(),
    // Overwritten by the BEFORE INSERT trigger from the item's locked quantity;
    // the default only spares callers from supplying a value they can't know.
    quantityAfter: qty("quantity_after").notNull().default("0"),
    saleId: uuid("sale_id"),
    unitCost: money("unit_cost"),
    note: text("note"),
    performedBy: uuid("performed_by"),
    clientMovementId: text("client_movement_id"),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: "stock_movements_item_fk",
      columns: [t.businessId, t.itemId],
      foreignColumns: [inventoryItems.businessId, inventoryItems.id],
    }),
    foreignKey({
      name: "stock_movements_sale_fk",
      columns: [t.businessId, t.saleId],
      foreignColumns: [sales.businessId, sales.id],
    }),
    check(
      "stock_movements_type",
      sql`type in ('opening', 'restock', 'sale', 'adjustment', 'void')`,
    ),
    check("stock_movements_delta_nonzero", sql`quantity_delta <> 0`),
    check("stock_movements_unit_cost_nonneg", sql`unit_cost is null or unit_cost >= 0`),
    check(
      "stock_movements_sale_link",
      sql`(type in ('sale', 'void')) = (sale_id is not null)`,
    ),
    uniqueIndex("stock_movements_business_client_movement_id_key")
      .on(t.businessId, t.clientMovementId)
      .where(sql`client_movement_id is not null`),
    index("stock_movements_item_created_idx").on(t.businessId, t.itemId, t.createdAt.desc()),
    index("stock_movements_sale_idx").on(t.saleId).where(sql`sale_id is not null`),
  ],
);

// ─── Vision (camera recognition) ─────────────────────────────────────────
// Tally keeps its own readings and only Qore IDs + match scores from the catalogue, never names or prices.

export const visionScans = tally.table(
  "vision_scans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("open"),
    // sha256 of the uploaded bytes; the photo itself is not stored in the database.
    imageSha256: text("image_sha256").notNull(),
    imageBytes: integer("image_bytes").notNull(),
    readModel: text("read_model").notNull(),
    countModel: text("count_model").notNull(),
    catalogueAvailable: boolean("catalogue_available").notNull(),
    readMs: integer("read_ms").notNull(),
    samMs: integer("sam_ms").notNull(),
    matchMs: integer("match_ms").notNull(),
    createdBy: uuid("created_by").notNull(),
    // The partner app that ran it; null = Tally's own apps.
    clientId: uuid("client_id"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    // The merchant dropped it unconfirmed; kept read-only for audit.
    discardedAt: timestamp("discarded_at", { withTimezone: true }),
    // Another run of the same photo was confirmed; kept read-only for audit.
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    unique("vision_scans_business_id_key").on(t.businessId, t.id),
    // Clients are suspended, never deleted, so history keeps its app.
    foreignKey({ name: "vision_scans_client_fk", columns: [t.clientId], foreignColumns: [oauthClients.id] }).onDelete("restrict"),
    check("vision_scans_status", sql`status in ('open', 'confirmed', 'discarded', 'superseded')`),
    check("vision_scans_confirmed_consistent", sql`(status = 'confirmed') = (confirmed_at is not null)`),
    check("vision_scans_discarded_consistent", sql`(status = 'discarded') = (discarded_at is not null)`),
    check("vision_scans_superseded_consistent", sql`(status = 'superseded') = (superseded_at is not null)`),
    check("vision_scans_image_sha256_format", sql`image_sha256 ~ '^[0-9a-f]{64}$'`),
    index("vision_scans_business_created_idx").on(t.businessId, t.createdAt.desc()),
  ],
);

export const visionDetections = tally.table(
  "vision_detections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull(),
    scanId: uuid("scan_id").notNull(),
    // Order in the scan; with scan_id it is the catalogue feedback clientRef.
    position: integer("position").notNull(),
    // As read by Muse Spark ('' = not legible).
    brand: text("brand").notNull(),
    name: text("name").notNull(),
    pack: text("pack").notNull(),
    look: text("look").notNull(),
    confidence: text("confidence").notNull(),
    sparkCount: integer("spark_count").notNull(),
    samCount: integer("sam_count"),
    count: integer("count").notNull(),
    countSource: text("count_source").notNull(),
    // [{x1,y1,x2,y2}] on the 0–1000 grid of the uploaded image.
    boxes: jsonb("boxes").$type<{ x1: number; y1: number; x2: number; y2: number }[]>().notNull(),
    // [{qid, score, match}], best first: catalogue ids and match scores only (match is missing on older scans).
    candidates: jsonb("candidates").$type<{ qid: string; score: number; match?: "strong" | "medium" | "low" }[]>().notNull(),
    // The business's item this looks like at scan time, and how it was found.
    inventoryItemId: uuid("inventory_item_id"),
    inventoryMatch: text("inventory_match"),
    // The merchant's decision on confirm; all null until decided.
    action: text("action"),
    // Catalogue feedback outcome sent for it.
    outcome: text("outcome"),
    confirmedQid: text("confirmed_qid"),
    // The item that was restocked, restored or created.
    itemId: uuid("item_id"),
    quantity: integer("quantity"),
    decidedBy: uuid("decided_by"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    feedbackSentAt: timestamp("feedback_sent_at", { withTimezone: true }),
    // Stock-take agent: how this line was resolved (tool calls behind it); null for a quick scan.
    evidence: jsonb("evidence").$type<{ turn: number; tool: string; summary: string }[]>(),
    // Stock-take agent: why the merchant should look closely; a reopened scan picks nothing for it.
    review: text("review"),
    // What Qore Catalog's curators did with a new-item line (created, linked, dismissed) and when; null until then.
    catalogResolution: text("catalog_resolution"),
    catalogResolvedAt: timestamp("catalog_resolved_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: "vision_detections_scan_fk",
      columns: [t.businessId, t.scanId],
      foreignColumns: [visionScans.businessId, visionScans.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "vision_detections_inventory_item_fk",
      columns: [t.businessId, t.inventoryItemId],
      foreignColumns: [inventoryItems.businessId, inventoryItems.id],
    }),
    unique("vision_detections_scan_position_key").on(t.scanId, t.position),
    unique("vision_detections_business_id_key").on(t.businessId, t.id),
    check("vision_detections_position_nonneg", sql`position >= 0`),
    check("vision_detections_confidence", sql`confidence in ('high', 'medium', 'low')`),
    check("vision_detections_count_source", sql`count_source in ('sam', 'spark')`),
    check("vision_detections_counts_nonneg", sql`spark_count >= 0 and count >= 0 and (sam_count is null or sam_count >= 0)`),
    check(
      "vision_detections_inventory_match",
      sql`(inventory_item_id is null) = (inventory_match is null) and (inventory_match is null or inventory_match in ('reading', 'catalogue', 'name'))`,
    ),
    check("vision_detections_name_length", sql`char_length(name) between 1 and 200`),
    check("vision_detections_review_length", sql`review is null or char_length(review) between 1 and 500`),
    check(
      "vision_detections_catalog_resolution",
      sql`(catalog_resolution is null) = (catalog_resolved_at is null) and (catalog_resolution is null or catalog_resolution in ('created', 'linked', 'dismissed'))`,
    ),
    // The resolutions cursor is the latest resolved_at.
    index("vision_detections_catalog_resolved_idx").on(t.catalogResolvedAt),
    foreignKey({
      name: "vision_detections_item_fk",
      columns: [t.businessId, t.itemId],
      foreignColumns: [inventoryItems.businessId, inventoryItems.id],
    }),
    check("vision_detections_action", sql`action is null or action in ('restock', 'restore', 'add', 'skip')`),
    check("vision_detections_outcome", sql`outcome is null or outcome in ('accepted', 'corrected', 'new_item', 'removed')`),
    check("vision_detections_confirmed_qid_format", sql.raw(`confirmed_qid is null or confirmed_qid ~ '${QID_REGEX}'`)),
    check("vision_detections_quantity_nonneg", sql`quantity is null or quantity >= 0`),
    check(
      "vision_detections_decision_consistent",
      sql`(action is null) = (decided_at is null) and (action is null) = (outcome is null) and (action is null) = (decided_by is null)
        and (action = 'skip') = (outcome = 'removed') and (action is distinct from 'skip') = (item_id is not null or action is null)`,
    ),
  ],
);

/**
 * A stock-take agent run on one shelf photo. Its result lands as a normal vision_scan (scan_id),
 * so the merchant confirms it the same way.
 */
export const visionAgentRuns = tally.table(
  "vision_agent_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    // Set when the run saves its scan (done, or fallback to the quick scan).
    scanId: uuid("scan_id"),
    // A rerun of a stored photo: the first scan of that photo (the group's root), never a rerun's own scan.
    rerunOfScanId: uuid("rerun_of_scan_id"),
    status: text("status").notNull().default("running"),
    model: text("model").notNull(),
    turns: integer("turns").notNull().default(0),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    // Why the run ended early (budget, model error); never a key or upstream body.
    error: text("error"),
    startedBy: uuid("started_by").notNull(),
    // The partner app that ran it; null = Tally's own apps.
    clientId: uuid("client_id"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [
    unique("vision_agent_runs_business_id_key").on(t.businessId, t.id),
    foreignKey({ name: "vision_agent_runs_client_fk", columns: [t.clientId], foreignColumns: [oauthClients.id] }).onDelete("restrict"),
    foreignKey({
      name: "vision_agent_runs_scan_fk",
      columns: [t.businessId, t.scanId],
      foreignColumns: [visionScans.businessId, visionScans.id],
    }),
    foreignKey({
      name: "vision_agent_runs_rerun_of_fk",
      columns: [t.businessId, t.rerunOfScanId],
      foreignColumns: [visionScans.businessId, visionScans.id],
    }),
    index("vision_agent_runs_rerun_of_idx").on(t.businessId, t.rerunOfScanId),
    check("vision_agent_runs_status", sql`status in ('running', 'done', 'fallback', 'failed')`),
    check("vision_agent_runs_finished_consistent", sql`(status = 'running') = (finished_at is null)`),
    check("vision_agent_runs_counts_nonneg", sql`turns >= 0 and input_tokens >= 0 and output_tokens >= 0`),
    index("vision_agent_runs_business_started_idx").on(t.businessId, t.startedAt.desc()),
  ],
);

/** The run's audit trail: what the agent thought, which tools it called, what came back. */
export const visionAgentSteps = tally.table(
  "vision_agent_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull(),
    runId: uuid("run_id").notNull(),
    turn: integer("turn").notNull(),
    kind: text("kind").notNull(),
    tool: text("tool"),
    args: jsonb("args").$type<Record<string, unknown>>(),
    // Short, human-readable; never image data.
    summary: text("summary").notNull(),
    ms: integer("ms"),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: "vision_agent_steps_run_fk",
      columns: [t.businessId, t.runId],
      foreignColumns: [visionAgentRuns.businessId, visionAgentRuns.id],
    }).onDelete("cascade"),
    check("vision_agent_steps_kind", sql`kind in ('baseline', 'thought', 'tool', 'result')`),
    check("vision_agent_steps_turn_nonneg", sql`turn >= 0`),
    check("vision_agent_steps_tool_consistent", sql`(kind = 'tool') = (tool is not null)`),
    index("vision_agent_steps_run_idx").on(t.runId, t.createdAt),
  ],
);

/**
 * A branded reading the merchant confirmed as one of their items, so the next scan recognises it even when
 * Qore Catalog doesn't know the product. One reading maps to one item per business.
 */
export const inventoryItemReadings = tally.table(
  "inventory_item_readings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull(),
    itemId: uuid("item_id").notNull(),
    // Normalised "brand|name|pack" (lower-case, single spaces).
    readingKey: text("reading_key").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    foreignKey({
      name: "inventory_item_readings_item_fk",
      columns: [t.businessId, t.itemId],
      foreignColumns: [inventoryItems.businessId, inventoryItems.id],
    }).onDelete("cascade"),
    unique("inventory_item_readings_business_key").on(t.businessId, t.readingKey),
    check("inventory_item_readings_key_length", sql`char_length(reading_key) between 3 and 400`),
    index("inventory_item_readings_item_idx").on(t.businessId, t.itemId),
  ],
);

// ─── OAuth clients (Connect Tally) ───────────────────────────────────────
// Partner apps act on one business after its merchant consents; only sha256 hashes of secrets, codes and tokens are kept.

const SHA256_HEX = "^[0-9a-f]{64}$";
const OAUTH_SCOPES = "array['stocktake:write','stocktake:read','inventory:read']::text[]";

/** A partner app, registered by the CTO with apps/api/scripts/oauth-client-create.mjs. Suspended, never deleted. */
export const oauthClients = tally.table(
  "oauth_clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: text("client_id").notNull(),
    name: text("name").notNull(),
    logoUrl: text("logo_url"),
    // sha256 of the full secret; the prefix (8 chars after tcs_) recognises a key without storing it.
    secretHash: text("secret_hash").notNull(),
    secretPrefix: text("secret_prefix").notNull(),
    redirectUris: text("redirect_uris").array().notNull(),
    // The embedded stock-take's frame-ancestors.
    allowedOrigins: text("allowed_origins").array().notNull().default(sql`'{}'`),
    allowedScopes: text("allowed_scopes").array().notNull(),
    status: text("status").notNull().default("active"),
    // An abuse cap per client, separate from the merchant's plan limit.
    dailyStocktakeCap: integer("daily_stocktake_cap").notNull().default(200),
    maxConcurrentRuns: integer("max_concurrent_runs").notNull().default(3),
    theme: jsonb("theme").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("oauth_clients_client_id_key").on(t.clientId),
    check("oauth_clients_client_id_format", sql`client_id ~ '^tc_[a-z0-9]{24}$'`),
    check("oauth_clients_name_length", sql`char_length(name) between 1 and 80`),
    check("oauth_clients_logo_url_https", sql`logo_url is null or logo_url ~ '^https://'`),
    check("oauth_clients_secret_hash_format", sql.raw(`secret_hash ~ '${SHA256_HEX}'`)),
    check("oauth_clients_secret_prefix_length", sql`char_length(secret_prefix) = 8`),
    check("oauth_clients_redirect_uris_count", sql`cardinality(redirect_uris) between 1 and 10`),
    check(
      "oauth_clients_allowed_scopes",
      sql.raw(`cardinality(allowed_scopes) >= 1 and allowed_scopes <@ ${OAUTH_SCOPES}`),
    ),
    check("oauth_clients_status", sql`status in ('active', 'suspended')`),
    check("oauth_clients_limits_positive", sql`daily_stocktake_cap > 0 and max_concurrent_runs > 0`),
  ],
);

/** A single-use authorization code (PKCE S256), valid for 60 s. */
export const oauthCodes = tally.table(
  "oauth_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    codeHash: text("code_hash").notNull(),
    clientId: uuid("client_id").notNull(),
    // FK to auth.users(id) is added in the custom SQL migration (cross-schema).
    userId: uuid("user_id").notNull(),
    businessId: uuid("business_id").notNull(),
    scopes: text("scopes").array().notNull(),
    redirectUri: text("redirect_uri").notNull(),
    codeChallenge: text("code_challenge").notNull(),
    codeChallengeMethod: text("code_challenge_method").notNull().default("S256"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    unique("oauth_codes_code_hash_key").on(t.codeHash),
    foreignKey({ name: "oauth_codes_client_fk", columns: [t.clientId], foreignColumns: [oauthClients.id] }).onDelete("cascade"),
    foreignKey({ name: "oauth_codes_business_fk", columns: [t.businessId], foreignColumns: [businesses.id] }).onDelete("cascade"),
    check("oauth_codes_code_hash_format", sql.raw(`code_hash ~ '${SHA256_HEX}'`)),
    check("oauth_codes_scopes_count", sql`cardinality(scopes) >= 1`),
    check("oauth_codes_code_challenge_length", sql`char_length(code_challenge) between 43 and 128`),
    check("oauth_codes_code_challenge_method", sql`code_challenge_method = 'S256'`),
    // Expired codes are cleaned up by age.
    index("oauth_codes_expires_idx").on(t.expiresAt),
  ],
);

/** A merchant's consent: one active grant per client per business, with a rotating refresh token. */
export const oauthGrants = tally.table(
  "oauth_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").notNull(),
    // FK to auth.users(id) is added in the custom SQL migration (cross-schema).
    userId: uuid("user_id").notNull(),
    businessId: uuid("business_id").notNull(),
    scopes: text("scopes").array().notNull(),
    refreshTokenHash: text("refresh_token_hash").notNull(),
    // The token rotated out last; presenting it again is a replay, so the grant is revoked.
    previousRefreshTokenHash: text("previous_refresh_token_hash"),
    refreshExpiresAt: timestamp("refresh_expires_at", { withTimezone: true }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("oauth_grants_refresh_token_hash_key").on(t.refreshTokenHash),
    foreignKey({ name: "oauth_grants_client_fk", columns: [t.clientId], foreignColumns: [oauthClients.id] }).onDelete("cascade"),
    foreignKey({ name: "oauth_grants_business_fk", columns: [t.businessId], foreignColumns: [businesses.id] }).onDelete("cascade"),
    check("oauth_grants_scopes_count", sql`cardinality(scopes) >= 1`),
    check("oauth_grants_refresh_token_hash_format", sql.raw(`refresh_token_hash ~ '${SHA256_HEX}'`)),
    check(
      "oauth_grants_previous_refresh_token_hash_format",
      sql.raw(`previous_refresh_token_hash is null or previous_refresh_token_hash ~ '${SHA256_HEX}'`),
    ),
    uniqueIndex("oauth_grants_active_client_business_key")
      .on(t.clientId, t.businessId)
      .where(sql`revoked_at is null`),
    index("oauth_grants_business_active_idx").on(t.businessId).where(sql`revoked_at is null`),
    index("oauth_grants_user_idx").on(t.userId),
    index("oauth_grants_previous_refresh_token_idx").on(t.previousRefreshTokenHash),
  ],
);

// ─── Plans (usage limits; subscriptions are simulated) ───────────────────
// Every stock-take counts against the business's plan, whichever app started it. A business with no subscription is on 'free'.

/** A plan's limits. Rows are seeded and changed by migrations or an admin, never by the API. */
export const plans = tally.table(
  "plans",
  {
    code: text("code").primaryKey(),
    name: text("name").notNull(),
    // Display only, never revenue: subscribing is simulated and creates no payments.
    priceKoboMonthly: integer("price_kobo_monthly").notNull().default(0),
    dailyStocktakeLimit: integer("daily_stocktake_limit").notNull(),
    maxConcurrentRuns: integer("max_concurrent_runs").notNull(),
    sort: integer("sort").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  () => [
    check("plans_code", sql`code in ('free', 'pro')`),
    check("plans_name_length", sql`char_length(name) between 1 and 40`),
    check("plans_price_nonneg", sql`price_kobo_monthly >= 0`),
    check("plans_limits_positive", sql`daily_stocktake_limit > 0 and max_concurrent_runs > 0`),
  ],
);

/** A business's current plan; one row per business. */
export const businessSubscriptions = tally.table(
  "business_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull(),
    planCode: text("plan_code").notNull(),
    status: text("status").notNull().default("active"),
    simulated: boolean("simulated").notNull().default(true),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("business_subscriptions_business_id_key").on(t.businessId),
    foreignKey({ name: "business_subscriptions_business_fk", columns: [t.businessId], foreignColumns: [businesses.id] }).onDelete("cascade"),
    foreignKey({ name: "business_subscriptions_plan_fk", columns: [t.planCode], foreignColumns: [plans.code] }).onDelete("restrict"),
    check("business_subscriptions_status", sql`status in ('active', 'cancelled')`),
  ],
);

// ─── Types ───────────────────────────────────────────────────────────────

export type Business = typeof businesses.$inferSelect;
export type NewBusiness = typeof businesses.$inferInsert;
export type BusinessMember = typeof businessMembers.$inferSelect;
export type NewBusinessMember = typeof businessMembers.$inferInsert;
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type NewInventoryItem = typeof inventoryItems.$inferInsert;
export type StockMovement = typeof stockMovements.$inferSelect;
export type NewStockMovement = typeof stockMovements.$inferInsert;
export type Sale = typeof sales.$inferSelect;
export type NewSale = typeof sales.$inferInsert;
export type SaleItem = typeof saleItems.$inferSelect;
export type NewSaleItem = typeof saleItems.$inferInsert;
export type SalePayment = typeof salePayments.$inferSelect;
export type NewSalePayment = typeof salePayments.$inferInsert;
export type VisionScan = typeof visionScans.$inferSelect;
export type NewVisionScan = typeof visionScans.$inferInsert;
export type VisionDetection = typeof visionDetections.$inferSelect;
export type NewVisionDetection = typeof visionDetections.$inferInsert;
export type InventoryItemReading = typeof inventoryItemReadings.$inferSelect;
export type NewInventoryItemReading = typeof inventoryItemReadings.$inferInsert;
export type VisionAgentRun = typeof visionAgentRuns.$inferSelect;
export type NewVisionAgentRun = typeof visionAgentRuns.$inferInsert;
export type VisionAgentStep = typeof visionAgentSteps.$inferSelect;
export type NewVisionAgentStep = typeof visionAgentSteps.$inferInsert;
export type OauthClient = typeof oauthClients.$inferSelect;
export type NewOauthClient = typeof oauthClients.$inferInsert;
export type OauthCode = typeof oauthCodes.$inferSelect;
export type NewOauthCode = typeof oauthCodes.$inferInsert;
export type OauthGrant = typeof oauthGrants.$inferSelect;
export type NewOauthGrant = typeof oauthGrants.$inferInsert;
export type Plan = typeof plans.$inferSelect;
export type NewPlan = typeof plans.$inferInsert;
export type BusinessSubscription = typeof businessSubscriptions.$inferSelect;
export type NewBusinessSubscription = typeof businessSubscriptions.$inferInsert;
