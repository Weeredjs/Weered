## What & why

## Checklist
- [ ] `bash scripts/check.sh` passes (API tsc = 0, no oversized files)
- [ ] Web builds (`cd apps/web && pnpm next build`) if web changed
- [ ] Money paths stay atomic (no read-modify-write balance writes)
- [ ] API change is backwards-compatible
- [ ] No secrets committed; no `Access-Control-Allow-Origin` added in routes
