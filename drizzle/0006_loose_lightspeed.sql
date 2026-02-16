CREATE TABLE "investment_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "scan_status" DEFAULT 'running' NOT NULL,
	"trigger" "scan_trigger" DEFAULT 'manual' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"total_items" integer DEFAULT 0 NOT NULL,
	"found_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"paused_at" timestamp,
	"error_message" text,
	"failed_items" jsonb DEFAULT '[]'::jsonb
);
--> statement-breakpoint
CREATE TABLE "investment_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"investment_job_id" uuid,
	"item_url_name" text NOT NULL,
	"endo_cost_r0_to_r10" integer DEFAULT 0 NOT NULL,
	"level_price_plat" real DEFAULT 0 NOT NULL,
	"buy_price_r0_48h" integer,
	"sell_price_r10_48h" integer,
	"pnl_pct_48h" real,
	"volume_r10_48h" integer,
	"buy_price_r0_90d" integer,
	"sell_price_r10_90d" integer,
	"pnl_pct_90d" real,
	"volume_r10_90d" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tracked_deals" ALTER COLUMN "seller_ign" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "investment_snapshots" ADD CONSTRAINT "investment_snapshots_investment_job_id_investment_jobs_id_fk" FOREIGN KEY ("investment_job_id") REFERENCES "public"."investment_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "investment_jobs_status_idx" ON "investment_jobs" USING btree ("status","started_at");--> statement-breakpoint
CREATE INDEX "investment_snapshots_item_idx" ON "investment_snapshots" USING btree ("item_url_name");--> statement-breakpoint
CREATE INDEX "investment_snapshots_created_idx" ON "investment_snapshots" USING btree ("created_at");