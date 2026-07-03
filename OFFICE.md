# The Office (ECEB walk-in office + in-room Fathom plan module)

A live video consult room on the Weered platform, used by East Coast Employee
Benefits and demoed as the client-facing surface of Fathom (the benefits-broker
product Scotia Blue licenses). Two parts:

1. **Walk-in office** — a togglable open/closed "office hours" surface. When open, a
   visitor on eastcoastemployeebenefits.com can knock and drop into the advisor's
   foyer. When closed, they see hours and a way to book.
2. **In-room Fathom module** — inside the consult, the advisor pulls up a client's
   real plan of record from the Fathom engine, adjusts the renewal levers, applies
   the change (new plan version), sends an amendment notice to the carrier, and
   presents the plan live to the client's screen.

Everything below is live in production. Nothing here needs a build step for the API
(it runs `.ts` directly via tsx); the web app needs `next build`.

---

## 1. Operating it (James)

**Your control page** (bookmark it — the host token is baked into the link, ~30 days):

    https://office.eastcoastemployeebenefits.com/api/office/control?t=<hostJWT>

From it: flip the office **Open/Closed**, toggle **Auto schedule** (opens 9 / closes 5,
Mon–Fri Atlantic; your manual flips between boundaries stick), and watch the
**Reception desk** (who just walked in). The page reads status live and pings on a new
arrival while it's open in a tab.

**Enter the office as host** (to actually run a consult):

    https://office.eastcoastemployeebenefits.com/foyer?host=<hostJWT>

**Mint a fresh host token** (they expire; the control link's is ~30 days):

    ssh root@142.93.148.29
    bash /opt/weered/scripts/host-link.sh <hours>     # grab the host= value from the printed URL

**A consult, start to finish:**

- Open the office (control page). The badge on eastcoastemployeebenefits.com goes green.
- A visitor clicks **Knock & enter** on that badge → they land in your foyer and knock.
- You (in the office as host) see the knock → **Admit**. They join the consult.
- **◧ Client plan** → pick **ECEB book** (your real clients) or **Demo book** (the Scotia
  demo tenant, fully-loaded plans) → search → open a client.
- **✎ Adjust plan**: pick a benefit + lever + value → Add → **Apply to plan of record**
  (creates a new version with the before/after) or **Send to carrier** (email + effective
  date gate before anything goes out).
- **▶ Present to room**: the client's screen shows exactly what you're presenting, live.
  Applying a change updates their view within ~2s. **Stop presenting** (or closing the
  tab / hitting Hide) clears it.

---

## 2. Architecture

**Two origins, one shared secret.** The office runs on `office.eastcoastemployeebenefits.com`
(this Weered droplet, Fastify + tsx). The Fathom engine runs on
`agent.eastcoastemployeebenefits.com` (separate Next.js app on Vercel). The engine's
httpOnly session cookie can't cross origins, so the Weered API **self-mints a scoped
office token** and calls the engine server-side. The client's browser never holds an
engine token.

- **Office token**: HS256 JWT, `typ:"office"`, `iss:"abb-office"`, `aud:"engine-api"`,
  claims `{tenantId, brokerId, meetingId:null, scope:["office:read"|"office:write"]}`,
  10-min TTL. Signed with **`OFFICE_TOKEN_SECRET`**, which must be identical on the Weered
  API and the engine (Vercel `abb-prototype` production env). It is deliberately NOT the
  engine's `SESSION_SECRET` (that stays engine-only). The engine verifies it with jose in
  `web/lib/auth/officeToken.ts` and gates routes on the scope.
- **Book**: `?book=eceb` (default → real ECEB tenant) or `?book=demo` (Scotia demo tenant).
  `bookConfig()` maps the book to `{tenantId, brokerId}` from env; it accepts only those
  two literals (anything else is rejected — see the plan gate).
- **Proxy**: the Weered API mints the token and forwards to the engine. All plan traffic
  is `office.eceb/api/office/plan/*` → Weered API → `agent.eceb/api/...`.

---

## 3. Endpoints (all in `apps/api/src/routes/auth.ts`)

| Route                                   | Who                            | What                                                                  |
| --------------------------------------- | ------------------------------ | --------------------------------------------------------------------- |
| `GET /office/status`                    | public                         | `{open, schedule, note, auto}` — drives the site badge + control page |
| `POST /office/set`                      | host                           | flip open/schedule/note/auto                                          |
| `POST /office/walkin`                   | public (20/10min)              | while open, mints a 1-use foyer invite so a visitor can enter         |
| `GET /office/waiting`                   | host                           | recent walk-in arrivals (reception desk)                              |
| `GET /office/control`                   | public (inert without a token) | serves the bookmarkable control page HTML                             |
| `GET /office/plan/employers?book=&q=`   | host                           | client picker (proxied, tenant-scoped)                                |
| `GET /office/plan/employer/:id?book=`   | host                           | full client detail + current plan + field spec                        |
| `PATCH /office/plan/employer/:id?book=` | host (20/min)                  | apply a change-set → new plan version                                 |
| `POST /office/plan/amend?book=`         | host (6/min)                   | send an amendment notice to the carrier (engine Resend)               |
| `POST /office/plan/present`             | host                           | present a plan snapshot to the room                                   |
| `GET /office/plan/presented`            | host OR **admitted** guest     | poll what's being presented                                           |

Host gating = `authFromHeader` + `(u as any).host`. Book + tenant are validated in
`planGate` (unknown book → 400; the selected book's tenant/broker env must be set → else 503).

---

## 4. Admission + isolation model (the privacy boundary)

The office room (`mtg-eceb-office`) is **locked**. The flow:

    visitor knocks (foyer) → host Admits → guest joins the office room → guest is in room.users

`handlePresence` (`sockets/presence.ts`) sends an unadmitted guest to `room.knocks`/`room.pending`
and returns _without_ `doJoin`; `room:admit` (`sockets/roomMod.ts`) is mod-only and is the only
path that runs `doJoin` for a pending guest. So:

> **A guest is in `room.users` if and only if the host admitted them.** That is the
> privacy boundary for the whole consult (roster, chat, voice) — a guest cannot self-join.

**Presented-plan isolation** builds on exactly that invariant. `GET /office/plan/presented`
gates a **guest** read on live office-room admission:

    rooms.get(`${scope.office}-office`).users.has(u.id)   // u.id = token sub

A waiting-room or stale-token guest is not in `room.users`, so they get `data:null`. The
shared office scope (`mtg-eceb`) is NOT the isolation boundary; admission is. `rooms` is
injected into `authRoutes` opts from `index.ts`. Additionally, `/office/plan/present`
projects the snapshot server-side to a display-only whitelist (name, carrier, policy,
renewal, lives, premium, benefitDesign, version, fields) so no ids/engine internals ever
reach a guest. **Verified end to end on real sockets 2026-07-03**: unadmitted guest → null,
admitted guest → sees the plan.

---

## 5. Config + state

**`apps/api/.env`** (Weered API):

    OFFICE_TOKEN_SECRET=<shared with engine Vercel>
    FATHOM_ENGINE_URL=https://agent.eastcoastemployeebenefits.com
    ECEB_TENANT_ID=cmpviie4p0000u8501mh9zcop
    ECEB_BROKER_ID=cmpviiefq0002u85067pgnoyp
    DEMO_TENANT_ID=cmr1g6qg20000u8ismw7ous4n
    DEMO_BROKER_ID=cmr1g6r230002u8is1fl5k7o5

**State files** (droplet, gitignored — runtime state, not code):

    /opt/weered/office-hours.json     # {open, schedule, note, auto}
    /opt/weered/office-waiting.json   # recent arrivals (name+at, 30-min pruned)

**The ECEB-site badge**: WordPress mu-plugin `wp-content/mu-plugins/eceb-office.php`.
It reads `/office/status` server-side (no CORS) and its "Knock & enter" hits a same-origin
WP REST proxy that calls `/office/walkin`, then redirects to `office.eceb/foyer?invite=`.

**The demo login** (for showing Fathom): `agent.eastcoastemployeebenefits.com/login`,
`demo@scotiablue.com` (password in the engine repo `web/prisma/seed-demo.ts`). Handed out
on sales calls, never published.

---

## 6. Operating / deploy notes (footguns)

- **API changes** (`auth.ts`, `index.ts`): edit in place, `pm2 restart weered-api`. tsx runs
  `.ts` directly — a **syntax** error crashes the process on restart (type errors are ignored
  at runtime but caught by `scripts/check.sh`). Always run `bash scripts/check.sh` before a
  restart when you touch these.
- **`office-control.html`** is read live per-request by the `/office/control` route from
  `/opt/weered/office-control.html`. Edit = just `scp` the file; **no restart**.
- **Guest allowlist**: `index.ts` `GUEST_ALLOWED_PATHS` is deny-by-default. Any new
  guest-readable route MUST be added there or it returns `403 guest_forbidden`.
- **Web changes** (`foyer/page.tsx`, `foyer/PlanModule.tsx`): `pnpm next build` is the type
  gate; only restart `weered-web` after a clean build, else the old build keeps serving.
- **Carrier sends are real**: `/office/plan/amend` emails the address in the request body via
  the engine's Resend. On the **demo book**, use a throwaway address. The engine dedupes sends
  on a payload hash, so a retry is a no-op, not a second email.

---

## 7. Troubleshooting

- **Badge stuck / status wrong** → `curl https://office.eastcoastemployeebenefits.com/api/office/status`.
  If that's right but the site badge is stale, the WP page cache is holding it (purge WP-Optimize).
- **Client sees nothing after being admitted** → they must be in `mtg-eceb-office`.users (admitted,
  not just in the foyer). Confirm the host actually clicked Admit.
- **Plan proxy 503 `engine_not_configured`** → the selected book's tenant/broker env is unset.
- **Plan proxy 400 `unknown_book`** → `?book=` was something other than `eceb`/`demo`.
- **Amend 400 `invalid_amendment`** → missing employerId/planId/version/changes/effectiveDate or a
  malformed carrier email.

See also (memory): `project_eceb_walkin_office`, `project_fathom_in_room_module`,
`project_fathom_naming`. Engine side: the ubep repo `docs/office-cross-origin-auth.md`.
