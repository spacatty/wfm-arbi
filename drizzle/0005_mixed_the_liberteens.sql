CREATE TYPE "public"."tracked_deal_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TABLE "tracked_deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text DEFAULT 'rank_value' NOT NULL,
	"weapon_url_name" text NOT NULL,
	"weapon_name" text NOT NULL,
	"riven_name" text,
	"re_rolls" integer DEFAULT 0 NOT NULL,
	"mod_rank" integer DEFAULT 0 NOT NULL,
	"mastery_level" integer DEFAULT 8 NOT NULL,
	"buy_price" integer NOT NULL,
	"endo_value" integer DEFAULT 0 NOT NULL,
	"endo_per_plat" real DEFAULT 0 NOT NULL,
	"attributes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"polarity" text,
	"seller_ign" text NOT NULL,
	"wfm_auction_url" text,
	"platform" text DEFAULT 'pc' NOT NULL,
	"status" "tracked_deal_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"archived_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "tracked_income" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tracked_deal_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tracked_income" ADD CONSTRAINT "tracked_income_tracked_deal_id_tracked_deals_id_fk" FOREIGN KEY ("tracked_deal_id") REFERENCES "public"."tracked_deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tracked_deals_status_idx" ON "tracked_deals" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "tracked_income_deal_idx" ON "tracked_income" USING btree ("tracked_deal_id");