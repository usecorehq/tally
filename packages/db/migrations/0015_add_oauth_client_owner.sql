ALTER TABLE "tally"."oauth_clients" ADD COLUMN "owner_user_id" uuid;--> statement-breakpoint
CREATE INDEX "oauth_clients_owner_idx" ON "tally"."oauth_clients" USING btree ("owner_user_id");