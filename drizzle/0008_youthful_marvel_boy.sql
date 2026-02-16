CREATE TYPE "public"."watch_event_kind" AS ENUM('owner_online', 'owner_offline', 'price_change');--> statement-breakpoint
CREATE TYPE "public"."watch_source" AS ENUM('rank_value', 'reroll_value');--> statement-breakpoint
CREATE TABLE "watch_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"watched_auction_id" uuid NOT NULL,
	"kind" "watch_event_kind" NOT NULL,
	"previous_value" text,
	"current_value" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watch_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_interval_seconds" integer DEFAULT 120 NOT NULL,
	"running" boolean DEFAULT false NOT NULL,
	"last_run_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watched_auctions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wfm_auction_id" text NOT NULL,
	"source" "watch_source" NOT NULL,
	"weapon_url_name" text NOT NULL,
	"weapon_name" text NOT NULL,
	"riven_name" text,
	"buyout_price" integer,
	"starting_price" integer,
	"owner_ign" text NOT NULL,
	"owner_status" text DEFAULT 'offline' NOT NULL,
	"wfm_auction_url" text,
	"last_owner_status" text DEFAULT 'offline' NOT NULL,
	"last_buyout_price" integer,
	"last_starting_price" integer,
	"last_checked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "watch_events" ADD CONSTRAINT "watch_events_watched_auction_id_watched_auctions_id_fk" FOREIGN KEY ("watched_auction_id") REFERENCES "public"."watched_auctions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "watch_events_watched_idx" ON "watch_events" USING btree ("watched_auction_id");--> statement-breakpoint
CREATE INDEX "watch_events_created_idx" ON "watch_events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "watched_auctions_wfm_id_idx" ON "watched_auctions" USING btree ("wfm_auction_id");--> statement-breakpoint
CREATE INDEX "watched_auctions_source_idx" ON "watched_auctions" USING btree ("source");