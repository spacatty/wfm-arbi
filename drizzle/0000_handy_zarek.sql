CREATE TYPE "public"."scan_status" AS ENUM('running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."scan_trigger" AS ENUM('manual', 'auto');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'user');--> statement-breakpoint
CREATE TYPE "public"."weapon_tier" AS ENUM('hot', 'warm', 'cold');--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "app_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "riven_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wfm_auction_id" text NOT NULL,
	"weapon_url_name" text NOT NULL,
	"weapon_name" text NOT NULL,
	"re_rolls" integer DEFAULT 0 NOT NULL,
	"mod_rank" integer DEFAULT 0 NOT NULL,
	"buyout_price" integer,
	"starting_price" integer,
	"attributes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"owner_ign" text NOT NULL,
	"owner_status" text DEFAULT 'offline' NOT NULL,
	"owner_reputation" integer DEFAULT 0 NOT NULL,
	"polarity" text,
	"mastery_level" integer DEFAULT 8 NOT NULL,
	"endo_value" integer DEFAULT 0 NOT NULL,
	"endo_per_plat" real DEFAULT 0 NOT NULL,
	"is_liquid" boolean DEFAULT false NOT NULL,
	"is_direct_sell" boolean DEFAULT false NOT NULL,
	"platform" text DEFAULT 'pc' NOT NULL,
	"scan_job_id" uuid,
	"riven_name" text,
	"wfm_auction_url" text,
	"spotted_at" timestamp DEFAULT now() NOT NULL,
	"gone_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scan_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "scan_status" DEFAULT 'running' NOT NULL,
	"trigger" "scan_trigger" DEFAULT 'auto' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"total_weapons" integer DEFAULT 0 NOT NULL,
	"found_deals" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"whisper_template" text DEFAULT '/w {ign} Hi! I want to buy your [{riven_name}] listed for {price}p. (warframe.market)',
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "weapon_scan_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"weapon_url_name" text NOT NULL,
	"weapon_name" text DEFAULT '' NOT NULL,
	"last_scanned_at" timestamp,
	"auction_count" integer DEFAULT 0 NOT NULL,
	"liquid_count" integer DEFAULT 0 NOT NULL,
	"median_price" real,
	"median_endo_per_plat" real,
	"tier" "weapon_tier" DEFAULT 'warm' NOT NULL,
	"consecutive_empty" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "weapon_scan_log_weapon_url_name_unique" UNIQUE("weapon_url_name")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "riven_snapshots_auction_idx" ON "riven_snapshots" USING btree ("wfm_auction_id");--> statement-breakpoint
CREATE INDEX "riven_snapshots_liquid_idx" ON "riven_snapshots" USING btree ("endo_per_plat") WHERE is_liquid = true;--> statement-breakpoint
CREATE INDEX "riven_snapshots_weapon_idx" ON "riven_snapshots" USING btree ("weapon_url_name","spotted_at");--> statement-breakpoint
CREATE INDEX "scan_jobs_status_idx" ON "scan_jobs" USING btree ("status","started_at");