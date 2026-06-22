# Weered — Data Sovereignty Audit

This document is the audit, not a slogan. It lists every dependency Weered relies on,
who ultimately controls it, which legal jurisdiction can compel it, and whether it
sits in the path that must be Canadian or in a tier a user opts into. We publish the
audit instead of asserting "sovereign" so the claim can be checked rather than trusted.

Last verified: 2026-06-21. Method: live inspection of the running stack (DNS, edge,
running services, environment, code-level outbound calls), plus ownership verification
of every proposed replacement against primary sources (corporate registries, filings).

## The principle

Sovereignty is not residency.

- **Residency** = where the bytes physically sit.
- **Sovereignty** = which court can compel them.

The US CLOUD Act compels disclosure based on **who controls the data, not where it sits**.
A Canadian datacentre owned by a US parent is Canadian residency with US jurisdiction.
Conversely, when you self-host, the custodian is you, so **jurisdiction follows the
compute host — the software's nationality is irrelevant.** The test that matters: no
US-parented (or otherwise foreign-controlled) entity anywhere it could be compelled to
expose user data or shut the platform off.
(Refs: BLG, "Data sovereignty and the CLOUD Act"; Government of Canada White Paper on
Data Sovereignty and Public Cloud.)

## Status

|                              |                                                                 |
| ---------------------------- | --------------------------------------------------------------- |
| Canadian ownership of Weered | ✅ yes                                                          |
| Canadian data residency      | ◑ partial (compute in Toronto, mail in Québec)                  |
| Canadian jurisdiction        | ❌ not yet — host, DNS, and several SaaS are US- or EU-parented |

We do not use the word "sovereign" as a claim until the Critical Path below is clean.

## How to read this — three tiers

1. **Critical path** — the core platform and the data users entrust to it. Must be
   Canadian jurisdiction.
2. **Opt-in / per-module** — foreign services a user or lobby chooses to turn on
   (game integrations, optional sign-in, GIF search, payments). Disclosed at the point
   of use, not stored as core identity.
3. **Unavoidable-foreign** — rails with no real substitute (push delivery, the game
   vendors themselves). Disclosed, can't be removed without dropping the feature.

---

## Critical path — current state and target

| Dependency            | Role                             | Controlled by (now)                         | Now             | Target (Canadian jurisdiction)                                                                              |
| --------------------- | -------------------------------- | ------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------- |
| **Compute (host)**    | Runs everything                  | DigitalOcean (NYSE:DOCN, Delaware)          | 🇺🇸              | **VEXXHOST**, Montréal `ca-ymq-1` (founder-owned, OpenStack, full VMs)                                      |
| **PostgreSQL**        | Database                         | Self-hosted (Docker)                        | follows host    | moves with host ✅                                                                                          |
| **Redis**             | Cache                            | Self-hosted (Docker)                        | follows host    | moves with host ✅                                                                                          |
| **LiveKit (voice)**   | Real-time voice                  | **Self-hosted** (Docker, not LiveKit Cloud) | follows host    | moves with host ✅ (use a full-VM host for WebRTC UDP)                                                      |
| **Uploads**           | Avatars, attachments             | Self-hosted (local disk, no S3/Spaces)      | follows host    | moves with host ✅                                                                                          |
| **Backups**           | pg + env dumps                   | Self-hosted (local disk, **no off-site**)   | follows host    | move with host + **off-site to VEXXHOST object storage or self-hosted MinIO**                               |
| **Edge / TLS**        | Reverse proxy, HTTPS             | **Caddy, self-hosted — no Cloudflare**      | follows host ✅ | keep (we hold the TLS keys; no Canadian CDN exists anyway)                                                  |
| **DNS**               | Authoritative nameservers        | DigitalOcean DNS                            | 🇺🇸              | **easyDNS (primary, Toronto) + CIRA D-Zone (secondary)**                                                    |
| **Email — mailboxes** | legal@/support@/noreply@         | mail.weered.ca on **OVH** (Beauharnois QC)  | 🇫🇷 EU           | **Webnames.ca or Typewire** (own stack, Canadian soil)                                                      |
| **Email — sending**   | verification/reset + Resend key  | OVH SMTP; Resend key present                | 🇫🇷/🇺🇸           | **MailChannels (Vancouver) or easyDNS easySMTP, or self-host Postfix; drop Resend**                         |
| **Error monitoring**  | Stack traces (hold user data)    | Sentry SaaS                                 | 🇺🇸              | **Self-host GlitchTip** (MIT, drop-in for Sentry SDK) on the CA host                                        |
| **Captcha**           | Bot gate on every register/login | Cloudflare Turnstile                        | 🇺🇸              | **Self-host Altcha** on the CA host                                                                         |
| **AI / LLM**          | NPC + operator commentary        | Anthropic                                   | 🇺🇸              | **Cohere North (🇨🇦) or open model on VEXXHOST GPU** — capability is fine for short flavor text; or disclose |
| **Web fonts**         | Loaded in every browser          | Google Fonts (client-side)                  | 🇺🇸              | **Self-host the font files**                                                                                |
| **Default avatars**   | Generated avatars                | DiceBear public API (client-side)           | EU/open         | **Self-host DiceBear** (open source)                                                                        |

Notes: Let's Encrypt (Caddy's CA) issues certificates only and never sees user data —
acceptable. Brave Search key is for an internal SEO tool, not the user runtime.

## Opt-in / per-module — foreign by nature, disclosed at the module

Fire only when a user or lobby enables that integration. Presence/game-state reads, not
core identity storage.

Google OAuth (US, optional — local username/password is the default) · Bungie/D2 (US) ·
Riot/LoL (US) · Steam (US) · Twitch (US) · Xbox/OpenXBL (US) · YouTube (US) ·
PUBG/Krafton (KR) · PoE/GGG (NZ) · EVE/CCP (IS) · Nexus Mods (UK) · Binance/FakeOut
(offshore) · Giphy + Tenor GIF pickers (US) · Scryfall/Moxfield/Archidekt MTG (US) ·
lichess (FR)/chess.com (US) · MLB/ESPN (US).

**Payments** belong here too: PCI data is separable from community data. Stripe (US)
is current; the clean Canadian swap is **Helcim (Calgary)** for cards + **Interac** for
e-Transfer. Either swap, or disclose that payment data alone touches Stripe.

News-feed aggregation (BBC, Google News, CNBC, Global News, CTV, etc.) is an outbound
read of public content — no user data leaves with it — so it carries no exposure.

## Unavoidable-foreign — disclosed, no substitute

| Rail                                | Why it can't move                                                                                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web push delivery (FCM / APNs)      | OS-level rails baked into Android/iOS — no Canadian substitute. Mitigation: send content-less "wake" pushes, fetch the payload over our own Canadian backend. |
| Mobile **build** (Expo EAS)         | US service, but **avoidable** — `eas build --local` / fastlane on self-hosted CI on Canadian compute (iOS just needs a Canadian-located Mac).                 |
| Desktop updater / releases (GitHub) | Releases on GitHub (US); could move to CA release hosting later.                                                                                              |
| The game vendors themselves         | Bungie/Riot/Steam/etc. are the source of truth for their own data.                                                                                            |

---

## What's already sovereignty-friendly (the good news)

Built single-box and self-hosted (for a salary-scale, one-server target). That design
makes the migration tractable:

- Postgres, Redis, and LiveKit all run **self-hosted in Docker on one host** — no
  managed-cloud lock-in to unwind. (Most Canadian hosts don't sell managed Postgres;
  we already self-host ours, so this is a non-issue.)
- The edge is **Caddy on the host with no Cloudflare proxy** — no US CDN terminating
  user TLS. (There is no clean Canadian-owned CDN, so self-hosting the edge is the
  correct answer regardless — and we already do it.)
- Uploads and backups live on the host's own disk — no separate US object store.

So the Critical Path migration is essentially: **lift-and-shift the Docker stack to a
Canadian-owned host, move DNS, swap a short list of SaaS (mail, monitoring, captcha,
AI), and self-host two client-side assets (fonts, avatars).** No re-architecture.

## Migration plan

1. **Compute → VEXXHOST** (Montréal `ca-ymq-1`). Founder-owned, no parent, OpenStack
   with full VMs (right for LiveKit's UDP/WebRTC). `docker compose` the existing
   Postgres + Redis + LiveKit + app stack across; cut DNS over.
   _Backups/alternates: AURO/Canadian Web Hosting (BC+ON), KeepSec (cheapest), PlanetHoster
   (only one with managed Postgres+S3), SaskTel (Crown-corp, strongest sovereignty, bare)._
2. **DNS → easyDNS (primary) + CIRA D-Zone (secondary).** All-Canadian, defence-in-depth.
3. **Off-site backups** → VEXXHOST object storage (Ceph/S3) or self-hosted MinIO on a
   second Canadian node. Closes the current no-off-site gap at the same time.
4. **Email** → mailboxes to **Webnames.ca or Typewire** (own stack on Canadian soil,
   not M365/Google resale); sending to **MailChannels / easyDNS easySMTP** or self-host
   Postfix; **remove the Resend key**.
5. **Monitoring** → self-host **GlitchTip** (MIT, Sentry-SDK-compatible — repoint the DSN,
   no re-instrumentation) on the VEXXHOST host. Drop Sentry SaaS.
6. **Captcha** → self-host **Altcha** on the host. Drop Turnstile.
7. **AI** → **Cohere North** (zero-ops, Canadian) or an open model via vLLM/Ollama on a
   VEXXHOST GPU (max sovereignty). Capability is a non-issue for two-sentence flavor text.
   Otherwise disclose it as a US touchpoint.
8. **Client-side** → self-host the web fonts and DiceBear avatars.
9. **Payments** (separable) → swap Stripe for **Helcim** (+ Interac), or disclose.
10. **Opt-in tier** → leave game/presence integrations as-is; surface a per-module
    disclosure where the foreign call happens.

## Avoid — Canadian-looking, foreign-controlled (the traps)

- **Residency-only (US parent):** AWS ca-central-1, Azure Canada, GCP Montréal,
  DigitalOcean, Vultr, Linode (Akamai).
- **Canadian DCs / branding, US-controlled:** Hut 8 (parent US-domiciled, Miami;
  markets "100% Canadian-owned infrastructure"), Aptum (DigitalBridge → being bought by
  SoftBank), Cologix (Stonepeak, US), Beanfield/ZEROFAIL (DigitalBridge).
- **Telco "cloud" back-door:** Bell Cloud and TELUS Cloud are Canadian-owned but
  **resell IBM/Azure/AWS** — re-importing CLOUD Act exposure. Videotron/Fibrenoire is
  connectivity only.
- **EU/foreign:** OVHcloud (French — where our mail sits today), iWeb (Dutch/Leaseweb).
- **DNS/mail traps:** Tucows/Hover (US-incorporated in PA despite Toronto HQ), MXroute
  (US); any "Canadian" host that just resells Microsoft 365 / Google Workspace.
- **Payment traps:** Nuvei (taken private by Advent, US PE), Bambora (now Shift4, US).

## Live watch items

- **Moneris** (RBC/BMO JV, Canadian today) is in advanced talks to be sold to
  **Francisco Partners (US PE)**. Not closed — re-verify before relying on it. Use
  **Helcim** instead, which is unambiguously Canadian.
- **VEXXHOST** corporate registry shows overdue annual returns + an intent-to-dissolve
  notice (administrative; the company is verifiably operating in 2026). Confirm cured —
  or request a written Canadian-ownership/sovereignty attestation — before a
  sovereignty-critical commitment. Same attestation ask applies to any founder-owned
  private (no public cap table rules out a minority foreign stake on paper).

## Claim language (gated on the migration)

Until the Critical Path is clean, the only honest claims are about ownership and
residency, plus this published audit.

After the Critical Path migration, defensible:

> "Canadian-owned, operated under Canadian jurisdiction, with no US-parented entity in
> the critical data path. No ID required."

We do not use "sovereign" as a marketing slogan before that line is true.
