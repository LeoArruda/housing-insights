# Tasks: Platform foundation

**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Phase 1 — Spec and scaffold

- [x] Add `docs/specs/platform-foundation/` documents
- [x] Root `package.json` workspaces + `apps/api` + `packages/types`
- [x] TypeScript strict, `@types/bun`, scripts: `dev`, `start`, `cli`, `daemon`, `test`, `migrate`

## Phase 2 — Database

- [x] Migrations: `job_runs`, `raw_payloads` + indexes + FK
- [x] `openDatabase()`, `runMigrations()`, repositories

## Phase 3 — Jobs

- [x] Registry + runners calling connectors and repos
- [x] CLI: `job run <name>`, `job list`, `migrate`
- [x] Daemon: cron-style intervals from env (RSS hourly, API daily defaults)

## Phase 4 — Connectors

- [x] Shared HTTP client (timeout, retry, backoff)
- [x] StatCan RSS + BoC RSS parsers + Zod
- [x] StatCan WDS + BoC Valet exemplar fetch (env-driven)

## Phase 5 — Read API

- [x] Hono: `/health`, `/health/ready`, `/job-runs`, `/job-runs/:id`, `/raw-payloads`

## Phase 6 — Tests and docs

- [x] Unit tests: parsers, checksum, migration apply
- [x] Integration tests: temp DB + fixture HTTP
- [x] Update `docs/architecture.md`, README runbook
