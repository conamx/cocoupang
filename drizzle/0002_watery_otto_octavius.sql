ALTER TABLE "price_alerts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "price_alerts" CASCADE;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "affiliate_url" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "is_rocket" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "rank" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "prev_price" integer;--> statement-breakpoint
CREATE INDEX "products_source_idx" ON "products" USING btree ("source","updated_at");