CREATE TABLE "endo_arb_deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wfm_auction_id" text NOT NULL,
	"weapon_url_name" text NOT NULL,
	"weapon_name" text NOT NULL,
	"re_rolls" integer DEFAULT 0 NOT NULL,
	"mod_rank" integer DEFAULT 0 NOT NULL,
	"mastery_level" integer DEFAULT 8 NOT NULL,
	"buyout_price" integer,
	"starting_price" integer,
	"attributes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"owner_ign" text NOT NULL,
	"owner_status" text DEFAULT 'offline' NOT NULL,
	"owner_reputation" integer DEFAULT 0 NOT NULL,
	"polarity" text,
	"endo_value" integer DEFAULT 0 NOT NULL,
	"endo_per_plat" real DEFAULT 0 NOT NULL,
	"is_direct_sell" boolean DEFAULT false NOT NULL,
	"platform" text DEFAULT 'pc' NOT NULL,
	"scan_job_id" uuid,
	"riven_name" text,
	"wfm_auction_url" text,
	"auction_created_at" timestamp,
	"auction_updated_at" timestamp,
	"spotted_at" timestamp DEFAULT now() NOT NULL,
	"gone_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "endo_arb_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "scan_status" DEFAULT 'running' NOT NULL,
	"trigger" "scan_trigger" DEFAULT 'auto' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"total_weapons" integer DEFAULT 0 NOT NULL,
	"found_deals" integer DEFAULT 0 NOT NULL,
	"min_re_rolls" integer DEFAULT 50 NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"paused_at" timestamp,
	"error_message" text
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "whisper_template" SET DEFAULT '/w {ign} Hi! I want to buy your {weapon_name} {riven_name} listed for {price}p';--> statement-breakpoint
CREATE UNIQUE INDEX "endo_arb_deals_auction_idx" ON "endo_arb_deals" USING btree ("wfm_auction_id");--> statement-breakpoint
CREATE INDEX "endo_arb_deals_epp_idx" ON "endo_arb_deals" USING btree ("endo_per_plat");--> statement-breakpoint
CREATE INDEX "endo_arb_deals_weapon_idx" ON "endo_arb_deals" USING btree ("weapon_url_name","spotted_at");--> statement-breakpoint
CREATE INDEX "endo_arb_jobs_status_idx" ON "endo_arb_jobs" USING btree ("status","started_at");