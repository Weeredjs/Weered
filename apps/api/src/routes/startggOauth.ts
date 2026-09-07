// start.gg organiser OAuth (tier 5).
//
// Tiers 1-4 read start.gg with OUR application token: public data only, and
// rate-limited across every lobby at once. This lets a tournament organiser
// authorise Weered against THEIR account instead, which is what unlocks
// anything private or write-shaped later — their own unpublished tournaments,
// and eventually reporting sets back.
//
// The grant is stored in its own table, never in Lobby.moduleConfig: that field
// is serialised by the public GET /lobbies/:id, so a token there would be
// published to anyone who opened the lobby.
//
// BLOCKED ON REGISTRATION. start.gg issues client credentials from
// https://start.gg/admin/profile/developer/applications. Until
// STARTGG_OAUTH_CLIENT_ID and STARTGG_OAUTH_CLIENT_SECRET are set, every route
// here answers 503 and says so rather than half-working.
import type { FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { fetchWithTimeout } from "../lib/fetchWithTimeout";
import { hasLobbyPerm } from "../lib/lobbyPerms";

type Opts = {
  lobbyAdminAccess: (req: any, reply: any, minLevel?: number) => Promise<any>;
  jwtSecret: string;
};

const AUTHORIZE = "https://start.gg/oauth/authorize";
const TOKEN = "https://api.start.gg/oauth/access_token";
const REFRESH = "https://api.start.gg/oauth/refresh";

/** What we ask an organiser for. Kept to identity for now: asking for more than
 *  the product uses is how an authorisation screen loses a cautious TO. */
const SCOPES = "user.identity";

const CLIENT_ID = () => process.env.STARTGG_OAUTH_CLIENT_ID || "";
const CLIENT_SECRET = () => process.env.STARTGG_OAUTH_CLIENT_SECRET || "";
const REDIRECT = () =>
  process.env.STARTGG_OAUTH_REDIRECT || "https://api.weered.ca/startgg/oauth/callback";
const SITE = () => process.env.SITE_BASE || "https://weered.ca";

function configured(): boolean {
  return !!CLIENT_ID() && !!CLIENT_SECRET();
}

export default async function startggOauthRoutes(app: FastifyInstance, opts: Opts) {
  const { lobbyAdminAccess, jwtSecret } = opts;

  // Begin the flow. Admin-only, and the lobby it is for travels in a SIGNED
  // state parameter — the callback arrives from start.gg with no session, so
  // state is the only thing tying it back to a lobby and an authorised admin.
  // Short-lived for the same reason a CSRF token is.
  app.get("/lobbies/:id/startgg/oauth/start", async (req, reply) => {
    if (!configured())
      return reply.code(503).send({
        ok: false,
        error: "oauth_not_configured",
        message: "Weered has no start.gg application credentials yet.",
      });
    const ctx = await lobbyAdminAccess(req, reply, 4);
    if (!ctx) return;
    if (
      !hasLobbyPerm(
        ctx.member?.roleLevel ?? (ctx.overrideRole ? 5 : 1),
        "edit_branding",
        ctx.overrideRole,
      )
    ) {
      return reply.code(403).send({ ok: false, error: "no_permission" });
    }
    const state = jwt.sign({ lobbyId: ctx.lobby.id, by: ctx.user?.id || null }, jwtSecret, {
      expiresIn: "10m",
    });
    const url =
      `${AUTHORIZE}?response_type=code` +
      `&client_id=${encodeURIComponent(CLIENT_ID())}` +
      `&scope=${encodeURIComponent(SCOPES)}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT())}` +
      `&state=${encodeURIComponent(state)}`;
    return reply.send({ ok: true, url });
  });

  // start.gg sends the organiser back here. No session on this request, so the
  // signed state is the whole of the authorisation check.
  app.get("/startgg/oauth/callback", async (req, reply) => {
    if (!configured()) return reply.code(503).send({ ok: false, error: "oauth_not_configured" });
    const q: any = (req as any).query || {};
    const code = String(q.code || "");
    const rawState = String(q.state || "");
    if (!code || !rawState) return reply.code(400).send({ ok: false, error: "missing_code" });

    let state: any;
    try {
      state = jwt.verify(rawState, jwtSecret);
    } catch {
      return reply.code(400).send({ ok: false, error: "bad_state" });
    }
    const lobbyId = String(state?.lobbyId || "");
    if (!lobbyId) return reply.code(400).send({ ok: false, error: "bad_state" });

    let tok: any = null;
    try {
      const r = await fetchWithTimeout(
        TOKEN,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            grant_type: "authorization_code",
            client_id: CLIENT_ID(),
            client_secret: CLIENT_SECRET(),
            code,
            scope: SCOPES,
            redirect_uri: REDIRECT(),
          }),
        },
        15_000,
      );
      tok = await r.json().catch(() => null);
      if (!r.ok || !tok?.access_token) {
        return reply.code(502).send({ ok: false, error: "exchange_failed" });
      }
    } catch {
      return reply.code(502).send({ ok: false, error: "startgg_unavailable" });
    }

    const expiresAt =
      typeof tok.expires_in === "number" ? new Date(Date.now() + tok.expires_in * 1000) : null;
    const data = {
      lobbyId,
      scope: String(tok.scope || SCOPES),
      accessToken: String(tok.access_token),
      refreshToken: tok.refresh_token ? String(tok.refresh_token) : null,
      expiresAt,
      grantedById: state?.by || null,
    };
    await prisma.startggAuth.upsert({ where: { lobbyId }, create: data, update: data });

    // Land the organiser back where they started rather than on a JSON blob.
    return reply.redirect(
      `${SITE()}/lobby/${encodeURIComponent(lobbyId)}/admin?startgg=linked`,
      302,
    );
  });

  // Is this lobby authorised, and by whom. Never returns the token itself.
  app.get("/lobbies/:id/startgg/oauth", async (req, reply) => {
    const ctx = await lobbyAdminAccess(req, reply, 4);
    if (!ctx) return;
    const row = await prisma.startggAuth.findUnique({ where: { lobbyId: ctx.lobby.id } });
    return reply.send({
      ok: true,
      configured: configured(),
      linked: !!row,
      scope: row?.scope || null,
      userSlug: row?.userSlug || null,
      expiresAt: row?.expiresAt || null,
    });
  });

  // Revoke locally. start.gg has no revocation endpoint documented, so this
  // drops our copy — say that plainly rather than implying it is revoked there.
  app.delete("/lobbies/:id/startgg/oauth", async (req, reply) => {
    const ctx = await lobbyAdminAccess(req, reply, 4);
    if (!ctx) return;
    await prisma.startggAuth.deleteMany({ where: { lobbyId: ctx.lobby.id } });
    return reply.send({
      ok: true,
      linked: false,
      note: "Weered has forgotten the grant. Remove Weered from your start.gg account settings to revoke it there too.",
    });
  });
}

/**
 * A lobby's organiser token, refreshed when it is close to expiry.
 *
 * Returns null when the lobby has no grant, so callers fall back to the
 * application token and public data — an expired organiser grant must degrade
 * to tier 1 behaviour, never to an error.
 */
export async function organiserToken(lobbyId: string): Promise<string | null> {
  const row = await prisma.startggAuth.findUnique({ where: { lobbyId } }).catch(() => null);
  if (!row) return null;
  const soon = Date.now() + 24 * 60 * 60 * 1000;
  if (!row.expiresAt || row.expiresAt.getTime() > soon) return row.accessToken;
  if (!row.refreshToken || !configured()) return row.accessToken;

  try {
    const r = await fetchWithTimeout(
      REFRESH,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "refresh_token",
          refresh_token: row.refreshToken,
          scope: row.scope || SCOPES,
          client_id: CLIENT_ID(),
          client_secret: CLIENT_SECRET(),
          redirect_uri: REDIRECT(),
        }),
      },
      15_000,
    );
    const j: any = await r.json().catch(() => null);
    if (!r.ok || !j?.access_token) return row.accessToken;
    await prisma.startggAuth.update({
      where: { lobbyId },
      data: {
        accessToken: String(j.access_token),
        refreshToken: j.refresh_token ? String(j.refresh_token) : row.refreshToken,
        expiresAt:
          typeof j.expires_in === "number" ? new Date(Date.now() + j.expires_in * 1000) : null,
      },
    });
    return String(j.access_token);
  } catch {
    return row.accessToken;
  }
}
