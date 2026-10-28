ALTER TABLE "tally"."vision_detections" ADD COLUMN "action" text;--> statement-breakpoint
ALTER TABLE "tally"."vision_detections" ADD COLUMN "outcome" text;--> statement-breakpoint
ALTER TABLE "tally"."vision_detections" ADD COLUMN "confirmed_qid" text;--> statement-breakpoint
ALTER TABLE "tally"."vision_detections" ADD COLUMN "item_id" uuid;--> statement-breakpoint
ALTER TABLE "tally"."vision_detections" ADD COLUMN "quantity" integer;--> statement-breakpoint
ALTER TABLE "tally"."vision_detections" ADD COLUMN "decided_by" uuid;--> statement-breakpoint
ALTER TABLE "tally"."vision_detections" ADD COLUMN "decided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tally"."vision_detections" ADD COLUMN "feedback_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tally"."vision_detections" ADD CONSTRAINT "vision_detections_item_fk" FOREIGN KEY ("business_id","item_id") REFERENCES "tally"."inventory_items"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tally"."vision_detections" ADD CONSTRAINT "vision_detections_action" CHECK (action is null or action in ('restock', 'restore', 'add', 'skip'));--> statement-breakpoint
ALTER TABLE "tally"."vision_detections" ADD CONSTRAINT "vision_detections_outcome" CHECK (outcome is null or outcome in ('accepted', 'corrected', 'new_item', 'removed'));--> statement-breakpoint
ALTER TABLE "tally"."vision_detections" ADD CONSTRAINT "vision_detections_confirmed_qid_format" CHECK (confirmed_qid is null or confirmed_qid ~ '^QC-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]$');--> statement-breakpoint
ALTER TABLE "tally"."vision_detections" ADD CONSTRAINT "vision_detections_quantity_nonneg" CHECK (quantity is null or quantity >= 0);--> statement-breakpoint
ALTER TABLE "tally"."vision_detections" ADD CONSTRAINT "vision_detections_decision_consistent" CHECK ((action is null) = (decided_at is null) and (action is null) = (outcome is null) and (action is null) = (decided_by is null)
        and (action = 'skip') = (outcome = 'removed') and (action is distinct from 'skip') = (item_id is not null or action is null));