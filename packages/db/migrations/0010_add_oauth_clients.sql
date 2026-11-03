CREATE TABLE "tally"."oauth_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" text NOT NULL,
	"name" text NOT NULL,
	"logo_url" text,
	"secret_hash" text NOT NULL,
	"secret_prefix" text NOT NULL,
	"redirect_uris" text[] NOT NULL,
	"allowed_origins" text[] DEFAULT '{}' NOT NULL,
	"allowed_scopes" text[] NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"daily_stocktake_cap" integer DEFAULT 200 NOT NULL,
	"max_concurrent_runs" integer DEFAULT 3 NOT NULL,
	"theme" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_clients_client_id_key" UNIQUE("client_id"),
	CONSTRAINT "oauth_clients_client_id_format" CHECK (client_id ~ '^tc_[a-z0-9]{24}$'),
	CONSTRAINT "oauth_clients_name_length" CHECK (char_length(name) between 1 and 80),
	CONSTRAINT "oauth_clients_logo_url_https" CHECK (logo_url is null or logo_url ~ '^https://'),
	CONSTRAINT "oauth_clients_secret_hash_format" CHECK (secret_hash ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "oauth_clients_secret_prefix_length" CHECK (char_length(secret_prefix) = 8),
	CONSTRAINT "oauth_clients_redirect_uris_count" CHECK (cardinality(redirect_uris) between 1 and 10),
	CONSTRAINT "oauth_clients_allowed_scopes" CHECK (cardinality(allowed_scopes) >= 1 and allowed_scopes <@ array['stocktake:write','stocktake:read','inventory:read']::text[]),
	CONSTRAINT "oauth_clients_status" CHECK (status in ('active', 'suspended')),
	CONSTRAINT "oauth_clients_limits_positive" CHECK (daily_stocktake_cap > 0 and max_concurrent_runs > 0)
);
--> statement-breakpoint
CREATE TABLE "tally"."oauth_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code_hash" text NOT NULL,
	"client_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"business_id" uuid NOT NULL,
	"scopes" text[] NOT NULL,
	"redirect_uri" text NOT NULL,
	"code_challenge" text NOT NULL,
	"code_challenge_method" text DEFAULT 'S256' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_codes_code_hash_key" UNIQUE("code_hash"),
	CONSTRAINT "oauth_codes_code_hash_format" CHECK (code_hash ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "oauth_codes_scopes_count" CHECK (cardinality(scopes) >= 1),
	CONSTRAINT "oauth_codes_code_challenge_length" CHECK (char_length(code_challenge) between 43 and 128),
	CONSTRAINT "oauth_codes_code_challenge_method" CHECK (code_challenge_method = 'S256')
);
--> statement-breakpoint
CREATE TABLE "tally"."oauth_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"business_id" uuid NOT NULL,
	"scopes" text[] NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"previous_refresh_token_hash" text,
	"refresh_expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_grants_refresh_token_hash_key" UNIQUE("refresh_token_hash"),
	CONSTRAINT "oauth_grants_scopes_count" CHECK (cardinality(scopes) >= 1),
	CONSTRAINT "oauth_grants_refresh_token_hash_format" CHECK (refresh_token_hash ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "oauth_grants_previous_refresh_token_hash_format" CHECK (previous_refresh_token_hash is null or previous_refresh_token_hash ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "tally"."vision_agent_runs" ADD COLUMN "client_id" uuid;--> statement-breakpoint
ALTER TABLE "tally"."vision_scans" ADD COLUMN "client_id" uuid;--> statement-breakpoint
ALTER TABLE "tally"."oauth_codes" ADD CONSTRAINT "oauth_codes_client_fk" FOREIGN KEY ("client_id") REFERENCES "tally"."oauth_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tally"."oauth_codes" ADD CONSTRAINT "oauth_codes_business_fk" FOREIGN KEY ("business_id") REFERENCES "tally"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tally"."oauth_grants" ADD CONSTRAINT "oauth_grants_client_fk" FOREIGN KEY ("client_id") REFERENCES "tally"."oauth_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tally"."oauth_grants" ADD CONSTRAINT "oauth_grants_business_fk" FOREIGN KEY ("business_id") REFERENCES "tally"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "oauth_codes_expires_idx" ON "tally"."oauth_codes" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_grants_active_client_business_key" ON "tally"."oauth_grants" USING btree ("client_id","business_id") WHERE revoked_at is null;--> statement-breakpoint
CREATE INDEX "oauth_grants_business_active_idx" ON "tally"."oauth_grants" USING btree ("business_id") WHERE revoked_at is null;--> statement-breakpoint
CREATE INDEX "oauth_grants_user_idx" ON "tally"."oauth_grants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "oauth_grants_previous_refresh_token_idx" ON "tally"."oauth_grants" USING btree ("previous_refresh_token_hash");--> statement-breakpoint
ALTER TABLE "tally"."vision_agent_runs" ADD CONSTRAINT "vision_agent_runs_client_fk" FOREIGN KEY ("client_id") REFERENCES "tally"."oauth_clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tally"."vision_scans" ADD CONSTRAINT "vision_scans_client_fk" FOREIGN KEY ("client_id") REFERENCES "tally"."oauth_clients"("id") ON DELETE restrict ON UPDATE no action;