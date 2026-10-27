CREATE TABLE "tally"."business_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_members_business_user_key" UNIQUE("business_id","user_id"),
	CONSTRAINT "business_members_role" CHECK (role in ('owner', 'staff'))
);
--> statement-breakpoint
CREATE TABLE "tally"."businesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"vertical_code" text NOT NULL,
	"subtype_code" text NOT NULL,
	"currency" text DEFAULT 'NGN' NOT NULL,
	"sale_counter" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "businesses_name_length" CHECK (char_length(name) between 1 and 120),
	CONSTRAINT "businesses_currency_ngn" CHECK (currency = 'NGN'),
	CONSTRAINT "businesses_sale_counter_nonneg" CHECK (sale_counter >= 0)
);
--> statement-breakpoint
CREATE TABLE "tally"."inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"core_qid" text,
	"name" text NOT NULL,
	"variant_label" text,
	"size_value" numeric(12, 3),
	"size_unit" text,
	"pack_qty" integer DEFAULT 1 NOT NULL,
	"category_path" text,
	"barcode" text,
	"price" numeric(12, 2) NOT NULL,
	"cost" numeric(12, 2),
	"quantity_on_hand" numeric(12, 3) DEFAULT '0' NOT NULL,
	"reorder_point" numeric(12, 3),
	"source" text NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_items_business_id_key" UNIQUE("business_id","id"),
	CONSTRAINT "inventory_items_core_qid_format" CHECK (core_qid is null or core_qid ~ '^QC-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]$'),
	CONSTRAINT "inventory_items_pack_qty_positive" CHECK (pack_qty > 0),
	CONSTRAINT "inventory_items_price_nonneg" CHECK (price >= 0),
	CONSTRAINT "inventory_items_cost_nonneg" CHECK (cost is null or cost >= 0),
	CONSTRAINT "inventory_items_source" CHECK (source in ('template', 'photo', 'manual')),
	CONSTRAINT "inventory_items_name_length" CHECK (char_length(name) between 1 and 200)
);
--> statement-breakpoint
CREATE TABLE "tally"."sale_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"sale_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"item_name" text NOT NULL,
	"core_qid" text,
	"unit_price" numeric(12, 2) NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"line_total" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sale_items_unit_price_nonneg" CHECK (unit_price >= 0),
	CONSTRAINT "sale_items_quantity_positive" CHECK (quantity > 0),
	CONSTRAINT "sale_items_line_total" CHECK (line_total = round(unit_price * quantity, 2))
);
--> statement-breakpoint
CREATE TABLE "tally"."sale_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"sale_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"method" text NOT NULL,
	"reference" text,
	"received_by" uuid NOT NULL,
	"client_payment_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sale_payments_amount_positive" CHECK (amount > 0),
	CONSTRAINT "sale_payments_method" CHECK (method in ('cash', 'transfer', 'card', 'other'))
);
--> statement-breakpoint
CREATE TABLE "tally"."sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"sale_number" integer NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"discount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"paid_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"stock_deducted_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"void_reason" text,
	"client_sale_id" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_business_id_key" UNIQUE("business_id","id"),
	CONSTRAINT "sales_business_sale_number_key" UNIQUE("business_id","sale_number"),
	CONSTRAINT "sales_status" CHECK (status in ('completed', 'voided')),
	CONSTRAINT "sales_amounts_nonneg" CHECK (subtotal >= 0 and discount >= 0 and total >= 0),
	CONSTRAINT "sales_total_formula" CHECK (total = subtotal - discount),
	CONSTRAINT "sales_paid_nonneg" CHECK (paid_amount >= 0),
	CONSTRAINT "sales_void_consistent" CHECK ((status = 'voided') = (voided_at is not null))
);
--> statement-breakpoint
CREATE TABLE "tally"."stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"type" text NOT NULL,
	"quantity_delta" numeric(12, 3) NOT NULL,
	"quantity_after" numeric(12, 3) DEFAULT '0' NOT NULL,
	"sale_id" uuid,
	"unit_cost" numeric(12, 2),
	"note" text,
	"performed_by" uuid,
	"client_movement_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_movements_type" CHECK (type in ('opening', 'restock', 'sale', 'adjustment', 'void')),
	CONSTRAINT "stock_movements_delta_nonzero" CHECK (quantity_delta <> 0),
	CONSTRAINT "stock_movements_unit_cost_nonneg" CHECK (unit_cost is null or unit_cost >= 0),
	CONSTRAINT "stock_movements_sale_link" CHECK ((type in ('sale', 'void')) = (sale_id is not null))
);
--> statement-breakpoint
ALTER TABLE "tally"."business_members" ADD CONSTRAINT "business_members_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "tally"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tally"."inventory_items" ADD CONSTRAINT "inventory_items_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "tally"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tally"."sale_items" ADD CONSTRAINT "sale_items_sale_fk" FOREIGN KEY ("business_id","sale_id") REFERENCES "tally"."sales"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tally"."sale_items" ADD CONSTRAINT "sale_items_item_fk" FOREIGN KEY ("business_id","item_id") REFERENCES "tally"."inventory_items"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tally"."sale_payments" ADD CONSTRAINT "sale_payments_sale_fk" FOREIGN KEY ("business_id","sale_id") REFERENCES "tally"."sales"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tally"."sales" ADD CONSTRAINT "sales_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "tally"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tally"."stock_movements" ADD CONSTRAINT "stock_movements_item_fk" FOREIGN KEY ("business_id","item_id") REFERENCES "tally"."inventory_items"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tally"."stock_movements" ADD CONSTRAINT "stock_movements_sale_fk" FOREIGN KEY ("business_id","sale_id") REFERENCES "tally"."sales"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "business_members_user_idx" ON "tally"."business_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "businesses_owner_idx" ON "tally"."businesses" USING btree ("owner_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_items_business_core_qid_key" ON "tally"."inventory_items" USING btree ("business_id","core_qid") WHERE core_qid is not null and archived_at is null;--> statement-breakpoint
CREATE INDEX "inventory_items_business_name_idx" ON "tally"."inventory_items" USING btree ("business_id","name");--> statement-breakpoint
CREATE INDEX "inventory_items_business_barcode_idx" ON "tally"."inventory_items" USING btree ("business_id","barcode") WHERE barcode is not null;--> statement-breakpoint
CREATE INDEX "sale_items_sale_idx" ON "tally"."sale_items" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "sale_items_item_idx" ON "tally"."sale_items" USING btree ("business_id","item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sale_payments_business_client_payment_id_key" ON "tally"."sale_payments" USING btree ("business_id","client_payment_id") WHERE client_payment_id is not null;--> statement-breakpoint
CREATE INDEX "sale_payments_sale_idx" ON "tally"."sale_payments" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "sale_payments_business_created_idx" ON "tally"."sale_payments" USING btree ("business_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "sales_business_client_sale_id_key" ON "tally"."sales" USING btree ("business_id","client_sale_id") WHERE client_sale_id is not null;--> statement-breakpoint
CREATE INDEX "sales_business_created_idx" ON "tally"."sales" USING btree ("business_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "stock_movements_business_client_movement_id_key" ON "tally"."stock_movements" USING btree ("business_id","client_movement_id") WHERE client_movement_id is not null;--> statement-breakpoint
CREATE INDEX "stock_movements_item_created_idx" ON "tally"."stock_movements" USING btree ("business_id","item_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "stock_movements_sale_idx" ON "tally"."stock_movements" USING btree ("sale_id") WHERE sale_id is not null;