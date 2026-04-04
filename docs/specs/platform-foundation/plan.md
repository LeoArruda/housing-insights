# Implementation plan: Platform foundation

**Spec**: [spec.md](./spec.md)  
**Date**: 2026-04-03

## Summary

Deliver a Bun + TypeScript API application with SQLite persistence, shared job runners exposed through CLI and daemon schedulers, connectors for Canadian public data sources (RSS + exemplar WDS/Valet), and a minimal Hono read API for health and inspection.

## Technical context

| Item | Choice |
|------|--------|
| Language | TypeScript (strict), Bun runtime |
| API framework | Hono on `Bun.serve` |
| Storage | SQLite (`bun:sqlite`, strict) |
| Validation | Zod |
| XML/RSS | fast-xml-parser |
| Testing | `bun test`, fixtures under `tests/fixtures` |
| Layout | Root workspace; `apps/api` is the runnable app; `packages/types` optional shared schemas |

## Project structure

```text
apps/api/
  package.json
  src/
    main.ts          # HTTP server entry
    cli.ts           # CLI entry
    daemon.ts        # Scheduler entry
    env.ts
    db/
      database.ts
      migrate.ts
      migrations/001_initial.sql
      repositories/
    connectors/
      http-client.ts
      statcan-rss.ts
      boc-rss.ts
      statcan-wds.ts
      boc-valet.ts
    jobs/
      registry.ts
      runners.ts
    services/
    server/
      app.ts         # Hono routes
packages/types/
  package.json
  src/index.ts
tests/
  fixtures/
```

## Idempotency rules

- **raw_payloads**: `UNIQUE(source, sha256)`; insert-or-ignore or check-before-insert.
- **job_runs**: append-only; each execution creates a new row.

## Environment variables

See `apps/api/.env.example` at repository root after scaffold.

## Complexity

Single SQLite file; no ORM—hand-written SQL + repositories to keep dependencies minimal.
