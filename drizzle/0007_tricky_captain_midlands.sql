CREATE TABLE "mod_sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mod_name" text NOT NULL,
	"buy_price" integer DEFAULT 0 NOT NULL,
	"endo_used" integer DEFAULT 0 NOT NULL,
	"sell_price" integer NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "mod_sales_created_idx" ON "mod_sales" USING btree ("created_at");