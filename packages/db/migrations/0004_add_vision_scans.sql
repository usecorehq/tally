CREATE TABLE "tally"."inventory_item_readings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"reading_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_item_readings_business_key" UNIQUE("business_id","reading_key"),
	CONSTRAINT "inventory_item_readings_key_length" CHECK (char_length(reading_key) between 3 and 400)
);
--> statement-breakpoint
CREATE TABLE "tally"."vision_detections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"scan_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"brand" text NOT NULL,
	"name" text NOT NULL,
	"pack" text NOT NULL,
	"look" text NOT NULL,
	"confidence" text NOT NULL,
	"spark_count" integer NOT NULL,
	"sam_count" integer,
	"count" integer NOT NULL,
	"count_source" text NOT NULL,
	"boxes" jsonb NOT NULL,
	"candidates" jsonb NOT NULL,
	"inventory_item_id" uuid,
	"inventory_match" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vision_detections_scan_position_key" UNIQUE("scan_id","position"),
	CONSTRAINT "vision_detections_business_id_key" UNIQUE("business_id","id"),
	CONSTRAINT "vision_detections_position_nonneg" CHECK (position >= 0),
	CONSTRAINT "vision_detections_confidence" CHECK (confidence in ('high', 'medium', 'low')),
	CONSTRAINT "vision_detections_count_source" CHECK (count_source in ('sam', 'spark')),
	CONSTRAINT "vision_detections_counts_nonneg" CHECK (spark_count >= 0 and count >= 0 and (sam_count is null or sam_count >= 0)),
	CONSTRAINT "vision_detections_inventory_match" CHECK ((inventory_item_id is null) = (inventory_match is null) and (inventory_match is null or inventory_match in ('reading', 'catalogue', 'name'))),
	CONSTRAINT "vision_detections_name_length" CHECK (char_length(name) between 1 and 200)
);
--> statement-breakpoint
CREATE TABLE "tally"."vision_scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"image_sha256" text NOT NULL,
	"image_bytes" integer NOT NULL,
	"read_model" text NOT NULL,
	"count_model" text NOT NULL,
	"catalogue_available" boolean NOT NULL,
	"read_ms" integer NOT NULL,
	"sam_ms" integer NOT NULL,
	"match_ms" integer NOT NULL,
	"created_by" uuid NOT NULL,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vision_scans_business_id_key" UNIQUE("business_id","id"),
	CONSTRAINT "vision_scans_status" CHECK (status in ('open', 'confirmed')),
	CONSTRAINT "vision_scans_confirmed_consistent" CHECK ((status = 'confirmed') = (confirmed_at is not null)),
	CONSTRAINT "vision_scans_image_sha256_format" CHECK (image_sha256 ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "tally"."inventory_item_readings" ADD CONSTRAINT "inventory_item_readings_item_fk" FOREIGN KEY ("business_id","item_id") REFERENCES "tally"."inventory_items"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tally"."vision_detections" ADD CONSTRAINT "vision_detections_scan_fk" FOREIGN KEY ("business_id","scan_id") REFERENCES "tally"."vision_scans"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tally"."vision_detections" ADD CONSTRAINT "vision_detections_inventory_item_fk" FOREIGN KEY ("business_id","inventory_item_id") REFERENCES "tally"."inventory_items"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tally"."vision_scans" ADD CONSTRAINT "vision_scans_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "tally"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inventory_item_readings_item_idx" ON "tally"."inventory_item_readings" USING btree ("business_id","item_id");--> statement-breakpoint
CREATE INDEX "vision_scans_business_created_idx" ON "tally"."vision_scans" USING btree ("business_id","created_at" DESC NULLS LAST);