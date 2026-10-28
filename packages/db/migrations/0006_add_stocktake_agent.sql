CREATE TABLE "tally"."vision_agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"scan_id" uuid,
	"status" text DEFAULT 'running' NOT NULL,
	"model" text NOT NULL,
	"turns" integer DEFAULT 0 NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"error" text,
	"started_by" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "vision_agent_runs_business_id_key" UNIQUE("business_id","id"),
	CONSTRAINT "vision_agent_runs_status" CHECK (status in ('running', 'done', 'fallback', 'failed')),
	CONSTRAINT "vision_agent_runs_finished_consistent" CHECK ((status = 'running') = (finished_at is null)),
	CONSTRAINT "vision_agent_runs_counts_nonneg" CHECK (turns >= 0 and input_tokens >= 0 and output_tokens >= 0)
);
--> statement-breakpoint
CREATE TABLE "tally"."vision_agent_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"turn" integer NOT NULL,
	"kind" text NOT NULL,
	"tool" text,
	"args" jsonb,
	"summary" text NOT NULL,
	"ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vision_agent_steps_kind" CHECK (kind in ('baseline', 'thought', 'tool', 'result')),
	CONSTRAINT "vision_agent_steps_turn_nonneg" CHECK (turn >= 0),
	CONSTRAINT "vision_agent_steps_tool_consistent" CHECK ((kind = 'tool') = (tool is not null))
);
--> statement-breakpoint
ALTER TABLE "tally"."vision_detections" ADD COLUMN "evidence" jsonb;--> statement-breakpoint
ALTER TABLE "tally"."vision_agent_runs" ADD CONSTRAINT "vision_agent_runs_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "tally"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tally"."vision_agent_runs" ADD CONSTRAINT "vision_agent_runs_scan_fk" FOREIGN KEY ("business_id","scan_id") REFERENCES "tally"."vision_scans"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tally"."vision_agent_steps" ADD CONSTRAINT "vision_agent_steps_run_fk" FOREIGN KEY ("business_id","run_id") REFERENCES "tally"."vision_agent_runs"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vision_agent_runs_business_started_idx" ON "tally"."vision_agent_runs" USING btree ("business_id","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "vision_agent_steps_run_idx" ON "tally"."vision_agent_steps" USING btree ("run_id","created_at");