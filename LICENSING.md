# Licensing

Weered is **source-available**. You can read all of it, build it, run it for
yourself, and send patches. You cannot run it as a competing hosted service.
That split is intentional and the terms below are the authoritative version.

## Directory map

| Path               | License                 | Why                                                                                                                                  |
| ------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/mod/`        | **MIT**                 | The Weered Connect Minecraft mod ships on Modrinth. Mods are trusted only when they are forkable and auditable, so it is fully open. |
| `packages/shared/` | **MIT**                 | Shared TypeScript types and constants. Open so any client or third-party integration can depend on them without friction.            |
| Everything else    | **Elastic License 2.0** | The core platform: API, web, desktop, mobile, and the business logic.                                                                |

When a directory carries its own `LICENSE` file (e.g. `apps/mod/LICENSE`,
`packages/shared/LICENSE`), that file governs that directory. The root `LICENSE`
(Elastic License 2.0) governs everything not otherwise marked.

## What the Elastic License 2.0 means in practice

You **can**:

- Read, audit, and learn from the entire codebase.
- Fork it and modify it.
- Self-host your own instance for yourself or your own organization.
- Open issues and pull requests.

You **cannot**:

- Offer Weered (or a fork of it) to third parties as a hosted or managed service
  that exposes a substantial set of its features. In other words: no reselling
  Weered-as-a-service.
- Circumvent the paid-tier / license-key gating.
- Strip the copyright and license notices.

Full text: [`LICENSE`](./LICENSE) · canonical reference:
<https://www.elastic.co/licensing/elastic-license>

## Why source-available and not "open source"

The hard parts of Weered are the server-side business logic: the paper economy,
notoriety, permissions, lobby state, the API-verified tournament scoring. That
logic is the product. Making it readable is good for trust and good for anyone
who wants to learn from it. Letting a third party spin it up and sell it back is
not something we are interested in subsidizing. The Elastic License 2.0 draws
exactly that line, and it is the same line drawn by Elastic, Sentry, and others.

If your use does not fit and you want a different arrangement, email
**legal@weered.ca**.
