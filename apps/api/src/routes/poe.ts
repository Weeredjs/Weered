import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import crypto from "node:crypto";

const POE_CLIENT_ID     = process.env.POE_CLIENT_ID     || "";
const POE_CLIENT_SECRET = process.env.POE_CLIENT_SECRET || "";
const POE_CONTACT       = process.env.POE_CONTACT_EMAIL || "oauth@weered.ca";
const SITE_URL          = process.env.SITE_URL          || "https://weered.ca";
const API_URL           = process.env.API_URL           || "https://api.weered.ca";

const OAUTH_AUTHORIZE = "https://www.pathofexile.com/oauth/authorize";
const OAUTH_TOKEN     = "https://www.pathofexile.com/oauth/token";
const POE_API         = "https://api.pathofexile.com";
const POE_REDIRECT      = process.env.POE_REDIRECT_URI || "https://weered.ca/auth/poe/callback";

const POE_SCOPES = "account:characters";

function userAgent(): string {
  const id = POE_CLIENT_ID || "weered";
  return `OAuth ${id}/1.0.0 (contact: ${POE_CONTACT})`;
}

function b64url(buf: Buffer): string { return buf.toString("base64url"); }

async function poeAuthedGet<T = any>(path: string, token: string): Promise<T | null> {
  try {
    const r = await fetch(`${POE_API}${path}`, {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": userAgent(), Accept: "application/json" },
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch { return null; }
}

async function poeFetch(path: string, token: string): Promise<{ status: number; body: any }> {
  try {
    const r = await fetch(`${POE_API}${path}`, {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": userAgent(), Accept: "application/json" },
    });
    const body = await r.json().catch(() => null);
    return { status: r.status, body };
  } catch { return { status: 0, body: null }; }
}

async function ensureToken(acct: any): Promise<string | null> {
  if (!acct) return null;
  const exp = acct.tokenExpiry ? new Date(acct.tokenExpiry).getTime() : 0;
  if (acct.accessToken && exp > Date.now() + 60_000) return acct.accessToken;
  if (!acct.refreshToken || !POE_CLIENT_ID || !POE_CLIENT_SECRET) return acct.accessToken || null;
  try {
    const form = new URLSearchParams({
      client_id: POE_CLIENT_ID,
      client_secret: POE_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: acct.refreshToken,
    });
    const r = await fetch(OAUTH_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": userAgent(), Accept: "application/json" },
      body: form.toString(),
    });
    const t: any = await r.json().catch(() => ({}));
    if (!t.access_token) return acct.accessToken || null;
    await (prisma as any).userGameAccount.update({
      where: { id: acct.id },
      data: {
        accessToken: t.access_token,
        refreshToken: t.refresh_token || acct.refreshToken,
        tokenExpiry: t.expires_in ? new Date(Date.now() + t.expires_in * 1000) : null,
      },
    });
    return t.access_token;
  } catch { return acct.accessToken || null; }
}

const pkceStore = new Map<string, { userId: string; verifier: string; exp: number }>();
function putPkce(state: string, userId: string, verifier: string) {
  pkceStore.set(state, { userId, verifier, exp: Date.now() + 10 * 60_000 });
  if (pkceStore.size > 500) {
    for (const [k, v] of pkceStore) if (v.exp < Date.now()) pkceStore.delete(k);
  }
}
function takePkce(state: string): { userId: string; verifier: string } | null {
  const v = pkceStore.get(state);
  if (!v) return null;
  pkceStore.delete(state);
  if (v.exp < Date.now()) return null;
  return { userId: v.userId, verifier: v.verifier };
}

const POE_SERVICE_SCOPES = "service:leagues service:leagues:ladder service:cxapi";
let _appToken: { token: string; exp: number } | null = null;
async function getAppToken(): Promise<string | null> {
  if (_appToken && _appToken.exp > Date.now()) return _appToken.token;
  if (!POE_CLIENT_ID || !POE_CLIENT_SECRET) return null;
  try {
    const form = new URLSearchParams({
      client_id: POE_CLIENT_ID, client_secret: POE_CLIENT_SECRET,
      grant_type: "client_credentials", scope: POE_SERVICE_SCOPES,
    });
    const r = await fetch(OAUTH_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": userAgent(), Accept: "application/json" },
      body: form.toString(),
    });
    const t: any = await r.json().catch(() => ({}));
    if (!t.access_token) return null;
    const ttlMs = (typeof t.expires_in === "number" ? t.expires_in : 3000) * 1000;
    _appToken = { token: t.access_token, exp: Date.now() + Math.max(60_000, ttlMs - 60_000) };
    return t.access_token;
  } catch { return null; }
}

async function serviceGet(path: string): Promise<{ status: number; body: any }> {
  const token = await getAppToken();
  if (!token) return { status: 0, body: null };
  try {
    const r = await fetch(`${POE_API}${path}`, {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": userAgent(), Accept: "application/json" },
    });
    const body = await r.json().catch(() => null);
    return { status: r.status, body };
  } catch { return { status: 0, body: null }; }
}

let _leaguesCache: { data: any[]; exp: number } | null = null;
const _ladderCache = new Map<string, { data: any; exp: number }>();
const _cxCache = new Map<string, { data: any; exp: number }>();
let _cxStatic: { map: Record<string, { name: string; icon: string }>; exp: number } | null = null;

// GGG public trade static data: maps currency codes (chaos/divine/...) -> name + icon.
async function currencyStatic(): Promise<Record<string, { name: string; icon: string }>> {
  if (_cxStatic && _cxStatic.exp > Date.now()) return _cxStatic.map;
  const map: Record<string, { name: string; icon: string }> = {};
  try {
    const r = await fetch("https://www.pathofexile.com/api/trade/data/static", {
      headers: { "User-Agent": userAgent(), Accept: "application/json" },
    });
    const j: any = await r.json().catch(() => null);
    for (const cat of (j?.result || [])) {
      for (const e of (cat.entries || [])) {
        if (e && e.id && e.text) map[e.id] = { name: e.text, icon: e.image || "" };
      }
    }
  } catch {}
  _cxStatic = { map, exp: Date.now() + 24 * 3600_000 };
  return map;
}
const _charCache = new Map<string, { data: any; exp: number }>();

type Opts = {
  authFromHeader: (h?: string) => { id: string } | null;
  awardNotoriety: (userId: string, action: string) => Promise<number | null>;
};

export default async function poeRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, awardNotoriety } = opts;

  app.get("/auth/poe", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization || (req as any).query?.token);
    if (!u) return reply.code(401).send({ error: "unauthorized" });
    if (!POE_CLIENT_ID || !POE_CLIENT_SECRET) return reply.code(500).send({ error: "PoE OAuth not configured" });

    const state = b64url(crypto.randomBytes(24));
    const verifier = b64url(crypto.randomBytes(48));
    const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
    putPkce(state, u.id, verifier);

    const redirectUri = POE_REDIRECT;
    const url = `${OAUTH_AUTHORIZE}?client_id=${encodeURIComponent(POE_CLIENT_ID)}`
      + `&response_type=code`
      + `&scope=${encodeURIComponent(POE_SCOPES)}`
      + `&state=${encodeURIComponent(state)}`
      + `&redirect_uri=${encodeURIComponent(redirectUri)}`
      + `&code_challenge=${encodeURIComponent(challenge)}`
      + `&code_challenge_method=S256`;
    return reply.redirect(url);
  });

  app.get("/auth/poe/callback", async (req, reply) => {
    const code  = String((req as any).query?.code  || "");
    const state = String((req as any).query?.state || "");
    const err   = String((req as any).query?.error || "");
    if (err) return reply.redirect(`${SITE_URL}/lobby/poe?poe=denied`);
    const pk = takePkce(state);
    if (!pk || !code) return reply.redirect(`${SITE_URL}/lobby/poe?poe=error`);
    const userId = pk.userId;

    try {
      const redirectUri = POE_REDIRECT;
      const form = new URLSearchParams({
        client_id: POE_CLIENT_ID,
        client_secret: POE_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        scope: POE_SCOPES,
        code_verifier: pk.verifier,
      });
      const tokenRes = await fetch(OAUTH_TOKEN, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": userAgent(), Accept: "application/json" },
        body: form.toString(),
      });
      const tokens: any = await tokenRes.json().catch(() => ({}));
      if (!tokens.access_token) {
        console.error("[poe oauth] token error", tokens);
        return reply.redirect(`${SITE_URL}/lobby/poe?poe=error`);
      }

      const profile: any = await poeAuthedGet("/profile", tokens.access_token);
      const uuid  = profile?.uuid || tokens.sub || tokens.username || null;
      const name  = profile?.name || tokens.username || "Exile";
      const realm = profile?.realm || "pc";
      if (!uuid) return reply.redirect(`${SITE_URL}/lobby/poe?poe=profile_error`);

      const card = { uuid, name, realm, linkedAt: new Date().toISOString() };

      await (prisma as any).userGameAccount.upsert({
        where: { userId_gameType: { userId, gameType: "POE" } },
        update: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || null,
          tokenExpiry: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
          externalId: String(uuid),
          displayName: name,
          platform: realm,
          cardData: card,
          cardCachedAt: new Date(),
        },
        create: {
          userId, gameType: "POE",
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || null,
          tokenExpiry: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
          externalId: String(uuid),
          displayName: name,
          platform: realm,
          cardData: card,
          cardCachedAt: new Date(),
        },
      });

      awardNotoriety(userId, "POE_LINKED").catch(() => {});
      return reply.redirect(`${SITE_URL}/lobby/poe?poe=success`);
    } catch (e) {
      console.error("[poe oauth callback]", e);
      return reply.redirect(`${SITE_URL}/lobby/poe?poe=error`);
    }
  });

  app.get("/poe/me", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const acct = await (prisma as any).userGameAccount.findFirst({ where: { userId: u.id, gameType: "POE" } });
    if (!acct) return reply.send({ ok: true, linked: false });
    return reply.send({ ok: true, linked: true, account: acct.cardData, cachedAt: acct.cardCachedAt });
  });

  app.get("/poe/me/characters", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const acct = await (prisma as any).userGameAccount.findFirst({ where: { userId: u.id, gameType: "POE" } });
    if (!acct) return reply.send({ ok: true, linked: false, characters: [] });

    const card: any = acct.cardData || {};
    const cachedAt = card.charsCachedAt ? new Date(card.charsCachedAt).getTime() : 0;
    if (Array.isArray(card.characters) && Date.now() - cachedAt < 5 * 60_000) {
      return reply.send({ ok: true, linked: true, characters: card.characters, cached: true });
    }

    const accountName = acct.displayName || "";
    let chars: any[] = [];
    let forbidden = false;
    for (const realm of ["pc", "xbox", "sony"]) {
      const qs = new URLSearchParams({ accountName, realm }).toString();
      try {
        const r = await fetch(`https://www.pathofexile.com/character-window/get-characters?${qs}`, {
          headers: { "User-Agent": userAgent(), Accept: "application/json" },
        });
        const body: any = await r.json().catch(() => null);
        if (Array.isArray(body)) { if (body.length) { chars = body; break; } }
        else if (body?.error?.code === 6) forbidden = true;
      } catch { }
    }

    if (chars.length === 0) {
      const token = await ensureToken(acct);
      if (token) {
        const res = await poeFetch("/character", token);
        if (Array.isArray(res.body?.characters)) chars = res.body.characters;
      }
    }

    if (chars.length === 0 && forbidden) {
      return reply.send({ ok: true, linked: true, private: true, characters: card.characters || [] });
    }
    await (prisma as any).userGameAccount.update({
      where: { id: acct.id },
      data: { cardData: { ...card, characters: chars, charsCachedAt: new Date().toISOString() } },
    }).catch(() => {});
    return reply.send({ ok: true, linked: true, characters: chars });
  });

  app.delete("/poe/me", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    await (prisma as any).userGameAccount.deleteMany({ where: { userId: u.id, gameType: "POE" } });
    return reply.send({ ok: true });
  });

  app.get("/poe/leagues", async (_req, reply) => {
    if (_leaguesCache && _leaguesCache.exp > Date.now()) {
      return reply.send({ ok: true, leagues: _leaguesCache.data, cached: true });
    }
    const { status, body } = await serviceGet("/league?type=main&realm=pc");
    if (status !== 200) return reply.send({ ok: true, leagues: _leaguesCache?.data || [] });
    const arr: any[] = Array.isArray(body) ? body : (body?.leagues || []);
    const leagues = arr.map((l: any) => ({
      id: l.id,
      realm: l.realm || "pc",
      description: l.description || "",
      current: !!(l.category && l.category.current),
    }));
    _leaguesCache = { data: leagues, exp: Date.now() + 60 * 60_000 };
    return reply.send({ ok: true, leagues });
  });

  app.get("/poe/ladder", async (req, reply) => {
    const league = String(((req as any).query?.league) || "Standard").slice(0, 60);
    const hit = _ladderCache.get(league);
    if (hit && hit.exp > Date.now()) return reply.send({ ok: true, league, cached: true, ...hit.data });
    const { status, body } = await serviceGet(`/league/${encodeURIComponent(league)}/ladder?realm=pc&limit=50`);
    if (status !== 200) {
      return reply.send({ ok: true, league, total: 0, entries: [], error: status === 404 ? "no_ladder" : "unavailable" });
    }
    const entriesRaw: any[] = (body && body.ladder && body.ladder.entries) || [];
    const entries = entriesRaw.map((e: any) => ({
      rank: e.rank,
      dead: !!e.dead,
      name: e.character?.name || "",
      level: e.character?.level ?? null,
      cls: e.character?.class || "",
      experience: e.character?.experience ?? null,
      account: e.account?.name || "",
      challenges: e.account?.challenges?.completed ?? null,
      twitch: e.account?.twitch?.name || null,
    }));
    const data = { total: (body && body.ladder && body.ladder.total) ?? entries.length, entries };
    _ladderCache.set(league, { data, exp: Date.now() + 5 * 60_000 });
    return reply.send({ ok: true, league, ...data });
  });

  // Official Currency Exchange economy (service:cxapi). Pulls the latest
  // completed hourly digest, normalizes every chaos-paired market to a chaos
  // price + volume, enriches names/icons. Cached 30 min (data is hourly).
  app.get("/poe/economy", async (req, reply) => {
    const league = String(((req as any).query?.league) || "Standard").slice(0, 60);
    const hit = _cxCache.get(league);
    if (hit && hit.exp > Date.now()) return reply.send({ ok: true, league, cached: true, ...hit.data });

    const baseHour = Math.floor(Date.now() / 3600000) * 3600;
    let body: any = null, asOf = 0;
    for (const h of [baseHour - 3600, baseHour - 7200, baseHour - 10800]) {
      const res = await serviceGet(`/currency-exchange/${h}`);
      if (res.status === 200 && res.body && res.body.markets) { body = res.body; asOf = h; break; }
    }
    if (!body) return reply.send({ ok: true, league, currencies: [], divineChaos: 0, error: "unavailable" });

    const statics = await currencyStatic();
    const mid = (lo: any, hi: any, k: string) => ((Number(lo && lo[k]) || 0) + (Number(hi && hi[k]) || 0)) / 2;
    const byCur: Record<string, { id: string; chaos: number; volume: number }> = {};
    for (const m of body.markets) {
      if (m.league !== league) continue;
      const parts = String(m.market_id || "").split("|");
      if (parts.length !== 2 || parts.indexOf("chaos") === -1) continue;
      const other = parts[0] === "chaos" ? parts[1] : parts[0];
      if (other === "chaos") continue;
      const rc = mid(m.lowest_ratio, m.highest_ratio, "chaos");
      const ro = mid(m.lowest_ratio, m.highest_ratio, other);
      if (!rc || !ro) continue;
      const chaos = rc / ro;
      const volume = Number(m.volume_traded && m.volume_traded.chaos) || 0;
      if (!byCur[other] || volume > byCur[other].volume) byCur[other] = { id: other, chaos, volume };
    }
    const divineChaos = byCur["divine"] ? byCur["divine"].chaos : 0;
    const currencies = Object.values(byCur).map((c) => ({
      id: c.id,
      name: (statics[c.id] && statics[c.id].name) || (c.id.charAt(0).toUpperCase() + c.id.slice(1)),
      icon: (statics[c.id] && statics[c.id].icon) || "",
      chaos: Math.round(c.chaos * 100) / 100,
      divine: divineChaos ? Math.round((c.chaos / divineChaos) * 1000) / 1000 : null,
      volume: c.volume,
    })).sort((a, b) => b.chaos - a.chaos);
    const data = { asOf: new Date(asOf * 1000).toISOString(), divineChaos: Math.round(divineChaos * 100) / 100, currencies };
    _cxCache.set(league, { data, exp: Date.now() + 30 * 60_000 });
    return reply.send({ ok: true, league, ...data });
  });

  app.get("/poe/character", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const name = String((req as any).query?.name || "");
    const realm = String((req as any).query?.realm || "pc");
    if (!name) return reply.code(400).send({ ok: false, error: "name_required" });
    const acct = await (prisma as any).userGameAccount.findFirst({ where: { userId: u.id, gameType: "POE" } });
    if (!acct) return reply.send({ ok: true, linked: false, items: [] });
    const accountName = acct.displayName || "";

    const cacheKey = `${accountName}|${realm}|${name}`;
    const hit = _charCache.get(cacheKey);
    if (hit && hit.exp > Date.now()) return reply.send({ ok: true, cached: true, ...hit.data });

    const qs = new URLSearchParams({ accountName, character: name, realm }).toString();
    try {
      const r = await fetch(`https://www.pathofexile.com/character-window/get-items?${qs}`, {
        headers: { "User-Agent": userAgent(), Accept: "application/json" },
      });
      if (r.status !== 200) {
        return reply.send({ ok: true, items: [], error: r.status === 403 ? "private" : "unavailable" });
      }
      const body: any = await r.json().catch(() => null);
      const items = ((body && body.items) || []).map((it: any) => ({
        name: it.name || "",
        typeLine: it.typeLine || it.baseType || "",
        slot: it.inventoryId || "",
        frame: it.frameType ?? 0,
        icon: it.icon || "",
        w: it.w || 1,
        h: it.h || 1,
        corrupted: !!it.corrupted,
        ilvl: it.ilvl ?? null,
      }));
      const data = {
        character: { name, realm, class: body?.character?.class || "", level: body?.character?.level ?? null },
        items,
      };
      _charCache.set(cacheKey, { data, exp: Date.now() + 5 * 60_000 });
      return reply.send({ ok: true, ...data });
    } catch {
      return reply.send({ ok: true, items: [], error: "fetch_failed" });
    }
  });
}
