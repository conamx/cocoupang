-- 셰어인포 DB 테이블 만들기 (Supabase SQL Editor 에 전체 붙여넣고 Run)
-- 여러 번 실행해도 안전합니다.

-- 지난번 실행에서 일부만 만들어졌을 수 있는 예전 테이블 정리
DROP TABLE IF EXISTS "price_alerts" CASCADE;

CREATE TABLE IF NOT EXISTS "products" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"image" text NOT NULL,
	"category_id" text NOT NULL,
	"category_label" text NOT NULL,
	"option" text,
	"vendor_item_id" text,
	"affiliate_url" text,
	"is_rocket" boolean DEFAULT false NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"rank" integer,
	"current_price" integer NOT NULL,
	"prev_price" integer,
	"lowest_price" integer NOT NULL,
	"highest_price" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "affiliate_url" text;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "is_rocket" boolean DEFAULT false NOT NULL;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "source" text DEFAULT 'manual' NOT NULL;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "rank" integer;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "prev_price" integer;
CREATE INDEX IF NOT EXISTS "products_category_idx" ON "products" ("category_id");
CREATE INDEX IF NOT EXISTS "products_source_idx" ON "products" ("source", "updated_at");

CREATE TABLE IF NOT EXISTS "price_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
	"price" integer NOT NULL,
	"observed_at" timestamp with time zone NOT NULL
);
CREATE INDEX IF NOT EXISTS "price_history_product_idx" ON "price_history" ("product_id", "observed_at");

CREATE TABLE IF NOT EXISTS "deals" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"source" text NOT NULL,
	"category" text NOT NULL,
	"price" text,
	"thumb" text NOT NULL,
	"url" text NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"posted_at" timestamp with time zone NOT NULL
);
CREATE INDEX IF NOT EXISTS "deals_posted_idx" ON "deals" ("posted_at");

CREATE TABLE IF NOT EXISTS "posts" (
	"slug" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"category" text NOT NULL,
	"body" text NOT NULL,
	"date" timestamp with time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS "reactions" (
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"anon_id" text NOT NULL,
	"value" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	PRIMARY KEY ("target_type", "target_id", "anon_id")
);

CREATE TABLE IF NOT EXISTS "comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"nickname" text,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "comments_target_idx" ON "comments" ("target_type", "target_id", "created_at");

-- 보안: Supabase 공개 키로 테이블을 읽고 쓰지 못하게 잠금 (사이트 동작에는 영향 없음)
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "price_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "deals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "posts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "comments" ENABLE ROW LEVEL SECURITY;

-- 결과 확인용: 6개 테이블 이름이 표로 나오면 성공
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
