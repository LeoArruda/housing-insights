# Housing Insights — Web operations console

Vue 3 + Vite + TypeScript SPA for operators and viewers. Product spec: [docs/specs/web-ops-console/spec.md](../../docs/specs/web-ops-console/spec.md).

## Requirements

- [Bun](https://bun.sh) 1.x

## Setup

From **repository root**:

```bash
bun install
```

Create `apps/web/.env` (optional):

```bash
# Base URL for API requests (Vite dev server proxies /api to this target by default — see vite.config.ts)
VITE_API_BASE_URL=http://127.0.0.1:3000
```

## Scripts

From `apps/web`:

| Script | Purpose |
|--------|---------|
| `bun run dev` | Vite dev server (default port from Vite) |
| `bun run build` | `vue-tsc` + production build |
| `bun run preview` | Preview production build |
| `bun run typecheck` | Typecheck only |
| `bun test` | Unit tests under `test/` |

## Auth (v1)

The login screen stores the Bearer token in `sessionStorage`. Use the same value as `DASHBOARD_OPERATOR_KEY` or `DASHBOARD_VIEWER_KEY` on the API when dashboard auth is enabled. If neither API key is set, the API accepts requests without auth (local dev). See `apps/api/.env.example`.

## Related docs

- PRD: [docs/prds/prd-web-ops-console.md](../../docs/prds/prd-web-ops-console.md)
- Verification log: [docs/specs/web-ops-console/verification.md](../../docs/specs/web-ops-console/verification.md)
