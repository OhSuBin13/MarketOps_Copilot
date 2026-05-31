# Repository Guidelines

## Project Structure & Module Organization

This is an npm workspace monorepo with the current application in `apps/api`. The API is a NestJS service: runtime code lives in `apps/api/src`, feature modules live under `apps/api/src/modules`, shared DTOs and enums live under `apps/api/src/common`, and Prisma database files live in `apps/api/prisma`. Tests are in `apps/api/test` and use `*.spec.ts` naming. Local infrastructure is defined in `docker-compose.yml`.

## Build, Test, and Development Commands

Use Node.js `>=22` and npm `>=11`.

- `npm install`: install root workspace dependencies.
- `npm run dev`: run the Nest API in watch mode at `http://localhost:3000`.
- `npm run build`: generate Prisma client and compile the API.
- `npm run lint`: run ESLint against API source and tests.
- `npm test`: run Jest tests with `--runInBand`.
- `npm run prisma:validate`: validate `apps/api/prisma/schema.prisma`.
- `npm run prisma:generate`: regenerate the Prisma client.
- `docker compose up --build`: start PostgreSQL, Redis, and the API container.

## Coding Style & Naming Conventions

Write TypeScript using the existing NestJS patterns. Use two-space indentation, double quotes, semicolons, and explicit exported classes such as `StocksService`, `StocksController`, and `StocksModule`. Name files in kebab case by Nest role, for example `stocks.service.ts`, `events.controller.ts`, and `create-report.dto.ts`. Keep DTOs in `dto` folders and shared cross-module types in `src/common`.

## Testing Guidelines

Jest with `ts-jest` is configured by `apps/api/jest.config.js`; test files must match `*.spec.ts`. Prefer focused service and controller tests that cover response shape, query handling, and error behavior. Run `npm test` before submitting changes, and run `npm run lint` when editing TypeScript.

## Commit & Pull Request Guidelines

Use Conventional Commits for new history:

- `feat: add report creation endpoint`
- `fix: handle missing stock id`
- `test: add stocks service coverage`
- `docs: update API setup guide`
- `chore: refresh dependencies`

Keep subjects imperative, lowercase after the type, and under 72 characters. Use an optional scope when it clarifies ownership, for example `feat(api): add event filters` or `fix(prisma): correct relation mapping`. Pull requests must include a short summary, linked issue when applicable, affected endpoints or schema changes, and verification commands run (`npm test`, `npm run lint`, `npm run build`). Include screenshots only for Swagger or UI-visible changes.

## Security & Configuration Tips

Copy `.env.example` to `.env` for local development. Do not commit real secrets, credentials, generated `dist` output, `node_modules`, or coverage artifacts. Keep local defaults aligned with the README: PostgreSQL on `localhost:5432` and Redis on `localhost:6379`.
