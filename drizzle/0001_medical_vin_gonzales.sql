ALTER TYPE "public"."scan_status" ADD VALUE 'paused';--> statement-breakpoint
CREATE TABLE "proxies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"label" text,
	"is_alive" boolean DEFAULT true NOT NULL,
	"fail_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp,
	"last_failed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scan_jobs" ADD COLUMN "paused_at" timestamp;--> statement-breakpoint
ALTER TABLE "weapon_scan_log" ADD COLUMN "riven_type" text;--> statement-breakpoint
ALTER TABLE "weapon_scan_log" ADD COLUMN "enabled" boolean DEFAULT true NOT NULL;