ALTER TABLE "watched_auctions" ADD COLUMN "endo_per_plat" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "watched_auctions" ADD COLUMN "endo_value" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "watched_auctions" ADD COLUMN "re_rolls" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "watched_auctions" ADD COLUMN "mastery_level" integer;--> statement-breakpoint
ALTER TABLE "watched_auctions" ADD COLUMN "auction_created_at" timestamp;--> statement-breakpoint
ALTER TABLE "watched_auctions" ADD COLUMN "auction_updated_at" timestamp;
