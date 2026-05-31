CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "MarketDocumentType" AS ENUM ('news', 'disclosure');
CREATE TYPE "MarketEventType" AS ENUM ('price_spike', 'volume_spike', 'keyword_alert');
CREATE TYPE "MarketEventSeverity" AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE "MarketEventStatus" AS ENUM ('open', 'acknowledged', 'resolved');
CREATE TYPE "IngestionJobStatus" AS ENUM ('queued', 'running', 'succeeded', 'failed');

CREATE TABLE "stocks" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "symbol" VARCHAR(20) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "market" VARCHAR(50) NOT NULL,
  "sector" VARCHAR(120),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "stocks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "price_daily" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "stock_id" UUID NOT NULL,
  "trade_date" DATE NOT NULL,
  "open_price" DECIMAL(18,4) NOT NULL,
  "high_price" DECIMAL(18,4) NOT NULL,
  "low_price" DECIMAL(18,4) NOT NULL,
  "close_price" DECIMAL(18,4) NOT NULL,
  "volume" BIGINT NOT NULL,
  "source" VARCHAR(80),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "price_daily_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "market_documents" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "stock_id" UUID,
  "document_type" "MarketDocumentType" NOT NULL,
  "title" VARCHAR(500) NOT NULL,
  "body" TEXT NOT NULL,
  "source" VARCHAR(120) NOT NULL,
  "source_url" VARCHAR(1000) NOT NULL,
  "published_at" TIMESTAMP(3) NOT NULL,
  "content_hash" VARCHAR(128) NOT NULL,
  "embedding_status" VARCHAR(40) NOT NULL DEFAULT 'pending',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "market_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "market_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "stock_id" UUID NOT NULL,
  "event_type" "MarketEventType" NOT NULL,
  "severity" "MarketEventSeverity" NOT NULL,
  "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metric_value" DECIMAL(18,6),
  "baseline_value" DECIMAL(18,6),
  "summary" TEXT NOT NULL,
  "evidence_document_ids" JSONB NOT NULL DEFAULT '[]',
  "status" "MarketEventStatus" NOT NULL DEFAULT 'open',
  CONSTRAINT "market_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_reports" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "stock_id" UUID NOT NULL,
  "event_id" UUID,
  "prompt" TEXT NOT NULL,
  "report_body" TEXT NOT NULL,
  "source_ids" JSONB NOT NULL DEFAULT '[]',
  "model_name" VARCHAR(120) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ingestion_jobs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "job_type" VARCHAR(80) NOT NULL,
  "status" "IngestionJobStatus" NOT NULL DEFAULT 'queued',
  "parameters" JSONB,
  "started_at" TIMESTAMP(3),
  "finished_at" TIMESTAMP(3),
  "error_message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ingestion_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stocks_symbol_key" ON "stocks"("symbol");
CREATE UNIQUE INDEX "price_daily_stock_id_trade_date_key" ON "price_daily"("stock_id", "trade_date");
CREATE INDEX "price_daily_trade_date_idx" ON "price_daily"("trade_date");
CREATE INDEX "price_daily_stock_id_trade_date_idx" ON "price_daily"("stock_id", "trade_date" DESC);
CREATE UNIQUE INDEX "market_documents_content_hash_key" ON "market_documents"("content_hash");
CREATE INDEX "market_documents_stock_id_published_at_idx" ON "market_documents"("stock_id", "published_at" DESC);
CREATE INDEX "market_documents_published_at_idx" ON "market_documents"("published_at");
CREATE INDEX "market_events_stock_id_detected_at_idx" ON "market_events"("stock_id", "detected_at" DESC);
CREATE INDEX "market_events_event_type_detected_at_idx" ON "market_events"("event_type", "detected_at" DESC);
CREATE INDEX "market_events_severity_detected_at_idx" ON "market_events"("severity", "detected_at" DESC);
CREATE INDEX "ai_reports_stock_id_created_at_idx" ON "ai_reports"("stock_id", "created_at" DESC);
CREATE INDEX "ai_reports_event_id_idx" ON "ai_reports"("event_id");
CREATE INDEX "ingestion_jobs_status_created_at_idx" ON "ingestion_jobs"("status", "created_at" DESC);
CREATE INDEX "ingestion_jobs_job_type_created_at_idx" ON "ingestion_jobs"("job_type", "created_at" DESC);

ALTER TABLE "price_daily"
  ADD CONSTRAINT "price_daily_stock_id_fkey"
  FOREIGN KEY ("stock_id") REFERENCES "stocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "market_documents"
  ADD CONSTRAINT "market_documents_stock_id_fkey"
  FOREIGN KEY ("stock_id") REFERENCES "stocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "market_events"
  ADD CONSTRAINT "market_events_stock_id_fkey"
  FOREIGN KEY ("stock_id") REFERENCES "stocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_reports"
  ADD CONSTRAINT "ai_reports_stock_id_fkey"
  FOREIGN KEY ("stock_id") REFERENCES "stocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_reports"
  ADD CONSTRAINT "ai_reports_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "market_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
