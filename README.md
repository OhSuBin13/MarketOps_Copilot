# MarketOps Copilot

MarketOps Copilot is a backend-first MVP for capital market data ingestion, event detection, and evidence-based AI report generation. Week 1 establishes the executable API server, first database schema, Docker Compose runtime, and initial OpenAPI documentation.

## Week 1 Deliverables

- Executable Nest.js backend server
- PostgreSQL schema draft managed by Prisma
- Initial Swagger/OpenAPI documentation

## Local Setup

```bash
npm install
npm run prisma:generate
npm run dev
```

The API runs on `http://localhost:3000`.

- Health: `http://localhost:3000/ops/health`
- Metrics placeholder: `http://localhost:3000/ops/metrics`
- Swagger UI: `http://localhost:3000/docs`
- OpenAPI JSON: `http://localhost:3000/docs-json`

## Docker Compose

```bash
docker compose up --build
```

The compose stack starts PostgreSQL, Redis, and the API. The API container runs Prisma migrations before starting the Nest server.

## Environment

Copy `.env.example` to `.env` for local development.

```env
PORT=3000
DATABASE_URL=postgresql://marketops:marketops@localhost:5432/marketops?schema=public
REDIS_URL=redis://localhost:6379
DART_API_KEY=
```

`DART_API_KEY` is required only when OpenDART disclosure ingestion is enabled.

## Database Draft

The first schema is in `apps/api/prisma/schema.prisma` and includes:

- `stocks`
- `price_daily`
- `market_documents`
- `market_events`
- `ai_reports`
- `ingestion_jobs`

The first migration is included under `apps/api/prisma/migrations`.

## Initial API Surface

- `GET /stocks`
- `GET /stocks/:id`
- `GET /stocks/:id/prices?from=&to=`
- `GET /events?severity=&type=&from=&to=`
- `GET /events/:id`
- `POST /reports`
- `GET /reports/:id`
- `POST /ingestion/jobs`
- `GET /ops/health`
- `GET /ops/metrics`

## Data Ingestion

`POST /ingestion/jobs` now creates a persisted job, runs the requested ingestion synchronously, and updates the job to `succeeded` or `failed`. Re-running the same job is idempotent for stored rows:

- Stocks are upserted by `symbol`.
- Daily OHLCV prices are upserted by `(stockId, tradeDate)`.
- News and disclosure documents are upserted by `contentHash`.

Supported public sources:

- Daily prices: Stooq CSV endpoint (`https://stooq.com/q/d/l/`)
- News: Google News RSS search (`https://news.google.com/rss/search`)
- Disclosures: OpenDART disclosure search (`https://opendart.fss.or.kr/api/list.json`, requires `DART_API_KEY`)

Price ingestion example:

```bash
curl -X POST http://localhost:3000/ingestion/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "jobType": "price_daily",
    "parameters": {
      "stocks": [
        {
          "symbol": "005930",
          "name": "Samsung Electronics",
          "market": "KRX",
          "stooqSymbol": "005930.KR"
        }
      ],
      "from": "2026-05-01",
      "to": "2026-05-30"
    }
  }'
```

News and disclosure ingestion example:

```bash
curl -X POST http://localhost:3000/ingestion/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "jobType": "market_documents",
    "parameters": {
      "stocks": [
        {
          "symbol": "005930",
          "name": "Samsung Electronics",
          "market": "KRX",
          "dartCorpCode": "00126380",
          "newsQuery": "삼성전자"
        }
      ],
      "from": "2026-05-01",
      "to": "2026-05-30",
      "includeNews": true,
      "includeDisclosures": true,
      "limit": 20
    }
  }'
```

If `dartCorpCode` is omitted, OpenDART pages are filtered by the returned `stock_code`; for wider date windows, pass `dartCorpCode` for more precise disclosure collection.

## Verification

```bash
npm run lint
npm test
npm run build
npm run prisma:validate
```
