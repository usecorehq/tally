CREATE TABLE "tally"."business_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"plan_code" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"simulated" boolean DEFAULT true NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_subscriptions_business_id_key" UNIQUE("business_id"),
	CONSTRAINT "business_subscriptions_status" CHECK (status in ('active', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "tally"."plans" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"price_kobo_monthly" integer DEFAULT 0 NOT NULL,
	"daily_stocktake_limit" integer NOT NULL,
	"max_concurrent_runs" integer NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_code" CHECK (code in ('free', 'pro')),
	CONSTRAINT "plans_name_length" CHECK (char_length(name) between 1 and 40),
	CONSTRAINT "plans_price_nonneg" CHECK (price_kobo_monthly >= 0),
	CONSTRAINT "plans_limits_positive" CHECK (daily_stocktake_limit > 0 and max_concurrent_runs > 0)
);
--> statement-breakpoint
ALTER TABLE "tally"."business_subscriptions" ADD CONSTRAINT "business_subscriptions_business_fk" FOREIGN KEY ("business_id") REFERENCES "tally"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tally"."business_subscriptions" ADD CONSTRAINT "business_subscriptions_plan_fk" FOREIGN KEY ("plan_code") REFERENCES "tally"."plans"("code") ON DELETE restrict ON UPDATE no action;