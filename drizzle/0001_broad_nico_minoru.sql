CREATE TABLE "pricing_tiers" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"discount_percentage" real
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "tier_prices" jsonb;