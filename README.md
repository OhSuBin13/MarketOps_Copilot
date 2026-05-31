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
```

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

Week 1 endpoints return documented placeholder responses. Data ingestion, real DB-backed reads, event detection, Redis caching, and AI report generation are planned for later MVP weeks.

## Verification

```bash
npm run lint
npm test
npm run build
npm run prisma:validate
```
