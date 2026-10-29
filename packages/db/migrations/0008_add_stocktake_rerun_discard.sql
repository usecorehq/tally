ALTER TABLE "tally"."vision_scans" DROP CONSTRAINT "vision_scans_status";--> statement-breakpoint
ALTER TABLE "tally"."vision_agent_runs" ADD COLUMN "rerun_of_scan_id" uuid;--> statement-breakpoint
ALTER TABLE "tally"."vision_scans" ADD COLUMN "discarded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tally"."vision_scans" ADD COLUMN "superseded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tally"."vision_agent_runs" ADD CONSTRAINT "vision_agent_runs_rerun_of_fk" FOREIGN KEY ("business_id","rerun_of_scan_id") REFERENCES "tally"."vision_scans"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vision_agent_runs_rerun_of_idx" ON "tally"."vision_agent_runs" USING btree ("business_id","rerun_of_scan_id");--> statement-breakpoint
ALTER TABLE "tally"."vision_scans" ADD CONSTRAINT "vision_scans_discarded_consistent" CHECK ((status = 'discarded') = (discarded_at is not null));--> statement-breakpoint
ALTER TABLE "tally"."vision_scans" ADD CONSTRAINT "vision_scans_superseded_consistent" CHECK ((status = 'superseded') = (superseded_at is not null));--> statement-breakpoint
ALTER TABLE "tally"."vision_scans" ADD CONSTRAINT "vision_scans_status" CHECK (status in ('open', 'confirmed', 'discarded', 'superseded'));