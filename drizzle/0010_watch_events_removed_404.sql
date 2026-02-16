ALTER TYPE "public"."watch_event_kind" ADD VALUE 'removed_404';--> statement-breakpoint
ALTER TABLE "watch_events" DROP CONSTRAINT "watch_events_watched_auction_id_watched_auctions_id_fk";
--> statement-breakpoint
ALTER TABLE "watch_events" ALTER COLUMN "watched_auction_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "watch_events" ADD COLUMN "weapon_name" text;--> statement-breakpoint
ALTER TABLE "watch_events" ADD COLUMN "owner_ign" text;--> statement-breakpoint
ALTER TABLE "watch_events" ADD COLUMN "riven_name" text;--> statement-breakpoint
ALTER TABLE "watch_events" ADD CONSTRAINT "watch_events_watched_auction_id_watched_auctions_id_fk" FOREIGN KEY ("watched_auction_id") REFERENCES "public"."watched_auctions"("id") ON DELETE set null ON UPDATE no action;