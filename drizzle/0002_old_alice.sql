CREATE TABLE "riven_attributes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wfm_id" text NOT NULL,
	"url_name" text NOT NULL,
	"effect" text NOT NULL,
	"group" text DEFAULT 'default' NOT NULL,
	"prefix" text,
	"suffix" text,
	"units" text,
	"positive_is_negative" boolean DEFAULT false NOT NULL,
	"negative_only" boolean DEFAULT false NOT NULL,
	"search_only" boolean DEFAULT false NOT NULL,
	"exclusive_to" text,
	CONSTRAINT "riven_attributes_wfm_id_unique" UNIQUE("wfm_id"),
	CONSTRAINT "riven_attributes_url_name_unique" UNIQUE("url_name")
);
--> statement-breakpoint
ALTER TABLE "weapon_scan_log" ADD COLUMN "icon" text;--> statement-breakpoint
ALTER TABLE "weapon_scan_log" ADD COLUMN "thumb" text;