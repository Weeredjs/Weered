# Security Policy

## Reporting a vulnerability
Email **security@weered.ca** (or **support@weered.ca**) with details and steps to
reproduce. Please do not open a public issue for security reports.

We aim to acknowledge reports within a few days. Responsible disclosure is
appreciated — give us a reasonable window to ship a fix before any public detail.

## Posture (summary)
- Auth: httpOnly + Secure + SameSite session cookies, bcrypt, fail-closed JWT secret.
- OAuth handled server-side; no secrets exposed to clients.
- Edge CORS allowlist (Caddy); per-route + global rate limiting.
- SSRF guard on client-influenced fetches; outbound calls are timeout-bounded.
- Secrets live only in server-side env (never committed).
- Sensitive actions (economy, moderation) write to an audit log / immutable ledger.
