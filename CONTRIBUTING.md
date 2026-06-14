# Contributing to Weered

Closed-source, but these are the conventions the codebase actually enforces.

## Golden rules
- **Business logic lives in the API.** Permissions, scoring, the paper economy,
  lobby state — all server-side (`apps/api`). Clients render and submit; they
  never decide. See [`DEVELOPMENT.md`](./DEVELOPMENT.md).
- **API stays backwards-compatible.** Add `field_v2` next to `field`; don't break
  old mobile/desktop clients.
- **Shared types go in `packages/shared`** when used by 2+ clients.

## Before you push
Run the guardrails — the same gate the deploy runs:
```bash
bash scripts/check.sh        # API tsc --noEmit must be 0; no source file > 1500 lines
pnpm -w lint                 # eslint (advisory)
```
Deploys go through `bash scripts/deploy.sh`, which re-runs the guardrails, builds
the web app, restarts PM2, and smoke-tests. It aborts if the guardrails fail.

## Conventions
- **Commits:** Conventional Commits — `feat(scope):`, `fix(scope):`, `chore:`,
  `docs:`, `perf:`, `harden:`.
- **Prisma:** use `pnpm prisma db push`, never `migrate deploy`. Never
  `prisma generate --no-engine`.
- **CORS** is handled at the Caddy edge — never add `@fastify/cors` or
  `Access-Control-Allow-Origin` headers in routes.
- **Money paths** (Paper, FakeOut, poker): all balance mutations must be atomic
  (`{ increment }` / guarded `updateMany` / `$transaction`) — never
  read-modify-write.
- **Outbound HTTP** to third parties uses `lib/fetchWithTimeout` (never naked `fetch`).

## Layout
See [`DEVELOPMENT.md`](./DEVELOPMENT.md) for the monorepo layout, release cadence,
deploy procedures, and common gotchas. Ops/disaster-recovery: [`RUNBOOK.md`](./RUNBOOK.md).
