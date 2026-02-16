ALTER TABLE "watched_auctions" ADD COLUMN IF NOT EXISTS "endo_per_plat" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "watched_auctions" ADD COLUMN IF NOT EXISTS "endo_value" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "watched_auctions" ADD COLUMN IF NOT EXISTS "re_rolls" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "watched_auctions" ADD COLUMN IF NOT EXISTS "mastery_level" integer;--> statement-breakpoint
ALTER TABLE "watched_auctions" ADD COLUMN IF NOT EXISTS "auction_created_at" timestamp;--> statement-breakpoint
ALTER TABLE "watched_auctions" ADD COLUMN IF NOT EXISTS "auction_updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "watched_auctions" ADD COLUMN IF NOT EXISTS "seller_last_seen_at" timestamp;