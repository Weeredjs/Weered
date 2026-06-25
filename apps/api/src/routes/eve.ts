import { log, swallow } from "../lib/logger";
import type { FastifyInstance } from "fastify";
import { fetchWithTimeout } from "../lib/fetchWithTimeout";
import { prisma } from "../lib/prisma";
import { signOAuthState, verifyOAuthState } from "../lib/oauthState";

const ESI_USER_AGENT = "Weered/1.0 (james@weered.ca)";
const ESI_BASE = "https://esi.evetech.net/latest";
const OAUTH_BASE = "https://login.eveonline.com/v2/oauth";
const ZKILL_BASE = "https://zkillboard.com/api";

const EVE_SCOPES = [
  "publicData",
  "esi-location.read_location.v1",
  "esi-location.read_ship_type.v1",
  "esi-location.read_online.v1",
  "esi-skills.read_skills.v1",
  "esi-skills.read_skillqueue.v1",
  "esi-killmails.read_killmails.v1",
].join(" ");

const EVE_CLIENT_ID = process.env.EVE_CLIENT_ID || "";
const EVE_CLIENT_SECRET = process.env.EVE_CLIENT_SECRET || "";
const SITE_URL = process.env.SITE_URL || "https://weered.ca";
const API_URL = process.env.API_URL || "https://api.weered.ca";

function decodeJwtSub(jwt: string): string | null {
  try {
    const parts = jwt.split(".");
    if (parts.length < 2) return null;
    const json = Buffer.from(parts[1], "base64url").toString("utf-8");
    const claims = JSON.parse(json);
    const sub: string = claims?.sub || "";
    const m = sub.match(/CHARACTER:EVE:(\d+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

async function esiGet<T = any>(path: string): Promise<T | null> {
  try {
    const r = await fetchWithTimeout(`${ESI_BASE}${path}`, {
      headers: { "User-Agent": ESI_USER_AGENT, Accept: "application/json" },
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

async function zkillGet<T = any>(path: string): Promise<T | null> {
  try {
    const r = await fetchWithTimeout(`${ZKILL_BASE}${path}`, {
      headers: { "User-Agent": ESI_USER_AGENT, Accept: "application/json" },
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

async function esiAuthedGet<T = any>(path: string, token: string): Promise<T | null> {
  try {
    const r = await fetchWithTimeout(`${ESI_BASE}${path}`, {
      headers: {
        "User-Agent": ESI_USER_AGENT,
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

async function esiResolveNames(
  ids: number[],
): Promise<Record<number, { name: string; category: string }>> {
  const unique = Array.from(new Set(ids.filter((n) => typeof n === "number" && n > 0)));
  if (unique.length === 0) return {};
  try {
    const r = await fetchWithTimeout(`${ESI_BASE}/universe/names/`, {
      method: "POST",
      headers: {
        "User-Agent": ESI_USER_AGENT,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(unique),
    });
    if (!r.ok) return {};
    const rows: Array<{ id: number; name: string; category: string }> = await r.json();
    const out: Record<number, { name: string; category: string }> = {};
    for (const row of rows) out[row.id] = { name: row.name, category: row.category };
    return out;
  } catch {
    return {};
  }
}

type Opts = {
  authFromHeader: (h?: string) => { id: string } | null;
  awardNotoriety: (userId: string, action: string) => Promise<number | null>;
};

export default async function eveRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, awardNotoriety } = opts;

  app.get("/auth/eve", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ error: "Login first" });
    if (!EVE_CLIENT_ID) return reply.code(500).send({ error: "EVE OAuth not configured" });

    const state = signOAuthState(u.id);
    const redirectUri = `${API_URL}/auth/eve/callback`;
    const url = `${OAUTH_BASE}/authorize?response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&client_id=${EVE_CLIENT_ID}&scope=${encodeURIComponent(EVE_SCOPES)}&state=${state}`;
    return reply.redirect(url);
  });

  app.get("/auth/eve/callback", async (req, reply) => {
    const code = String((req as any).query?.code || "");
    const state = String((req as any).query?.state || "");
    if (!code) return reply.code(400).send({ error: "Missing code" });

    const userId = verifyOAuthState(state);
    if (!userId) return reply.code(400).send({ error: "Invalid state" });

    try {
      const basic = Buffer.from(`${EVE_CLIENT_ID}:${EVE_CLIENT_SECRET}`).toString("base64");
      const tokenRes = await fetchWithTimeout(`${OAUTH_BASE}/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${basic}`,
          Host: "login.eveonline.com",
        },
        body: new URLSearchParams({ grant_type: "authorization_code", code }),
      });
      const tokens = await tokenRes.json();
      if (!tokens.access_token) {
        log.error("[eve oauth] token error", tokens);
        return reply.redirect(`${SITE_URL}/lobby/eve?eve=error`);
      }

      const characterId = decodeJwtSub(tokens.access_token);
      if (!characterId) return reply.redirect(`${SITE_URL}/lobby/eve?eve=jwt_error`);

      const charInfo: any = await esiGet(`/characters/${characterId}/`);
      const corpId = charInfo?.corporation_id || null;
      const allianceId = charInfo?.alliance_id || null;
      const [corpInfo, allianceInfo]: any = await Promise.all([
        corpId ? esiGet(`/corporations/${corpId}/`) : Promise.resolve(null),
        allianceId ? esiGet(`/alliances/${allianceId}/`) : Promise.resolve(null),
      ]);

      const card = {
        characterId,
        characterName: charInfo?.name || "Capsuleer",
        corpId,
        corpName: corpInfo?.name || null,
        corpTicker: corpInfo?.ticker || null,
        allianceId,
        allianceName: allianceInfo?.name || null,
        allianceTicker: allianceInfo?.ticker || null,
        securityStatus: charInfo?.security_status ?? null,
        birthday: charInfo?.birthday || null,
      };

      await prisma.userGameAccount.upsert({
        where: { userId_gameType: { userId, gameType: "EVE" } },
        update: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || null,
          tokenExpiry: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
          externalId: String(characterId),
          displayName: card.characterName,
          platform: "pc",
          cardData: card,
          cardCachedAt: new Date(),
        },
        create: {
          userId,
          gameType: "EVE",
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || null,
          tokenExpiry: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
          externalId: String(characterId),
          displayName: card.characterName,
          platform: "pc",
          cardData: card,
          cardCachedAt: new Date(),
        },
      });

      awardNotoriety(userId, "EVE_LINKED").catch(swallow);
      return reply.redirect(`${SITE_URL}/lobby/eve?eve=success`);
    } catch (e) {
      log.error("[eve oauth callback]", e);
      return reply.redirect(`${SITE_URL}/lobby/eve?eve=error`);
    }
  });

  app.get("/eve/me", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const acct = await prisma.userGameAccount.findFirst({
      where: { userId: u.id, gameType: "EVE" },
    });
    if (!acct) return reply.send({ ok: true, linked: false });
    return reply.send({
      ok: true,
      linked: true,
      character: acct.cardData,
      cachedAt: acct.cardCachedAt,
    });
  });

  app.get("/eve/me/live", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const acct = await prisma.userGameAccount.findFirst({
      where: { userId: u.id, gameType: "EVE" },
    });
    if (!acct?.accessToken) return reply.send({ ok: true, linked: false });

    const characterId = acct.externalId;
    const token = acct.accessToken;
    const [loc, ship, online, queue]: any = await Promise.all([
      esiAuthedGet(`/characters/${characterId}/location/`, token),
      esiAuthedGet(`/characters/${characterId}/ship/`, token),
      esiAuthedGet(`/characters/${characterId}/online/`, token),
      esiAuthedGet(`/characters/${characterId}/skillqueue/`, token),
    ]);

    const idsToResolve: number[] = [];
    if (loc?.solar_system_id) idsToResolve.push(loc.solar_system_id);
    if (ship?.ship_type_id) idsToResolve.push(ship.ship_type_id);
    const activeSkill = Array.isArray(queue) && queue.length ? queue[0] : null;
    if (activeSkill?.skill_id) idsToResolve.push(activeSkill.skill_id);
    const names = await esiResolveNames(idsToResolve);

    return reply.send({
      ok: true,
      linked: true,
      live: {
        online: online?.online ?? null,
        lastLogin: online?.last_login || null,
        lastLogout: online?.last_logout || null,
        loginCount: online?.logins ?? null,
        system: loc?.solar_system_id
          ? { id: loc.solar_system_id, name: names[loc.solar_system_id]?.name || null }
          : null,
        ship: ship?.ship_type_id
          ? {
              id: ship.ship_type_id,
              name: names[ship.ship_type_id]?.name || null,
              customName: ship?.ship_name || null,
            }
          : null,
        trainingSkill: activeSkill
          ? {
              id: activeSkill.skill_id,
              name: names[activeSkill.skill_id]?.name || null,
              finishedLevel: activeSkill.finished_level,
              finishDate: activeSkill.finish_date || null,
              startDate: activeSkill.start_date || null,
            }
          : null,
        queueLength: Array.isArray(queue) ? queue.length : 0,
      },
    });
  });

  app.get("/eve/search/character", async (req, reply) => {
    const q = String((req as any).query?.q || "").trim();
    if (!q) return reply.send({ ok: true, results: [] });
    try {
      const r = await fetchWithTimeout(`${ESI_BASE}/universe/ids/`, {
        method: "POST",
        headers: {
          "User-Agent": ESI_USER_AGENT,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify([q]),
      });
      if (!r.ok) return reply.send({ ok: true, results: [] });
      const data: any = await r.json();
      const matches = Array.isArray(data?.characters) ? data.characters : [];
      return reply.send({ ok: true, results: matches.slice(0, 10) });
    } catch {
      return reply.send({ ok: true, results: [] });
    }
  });

  app.get("/eve/character/:id", async (req, reply) => {
    const id = String((req as any).params?.id || "");
    const info: any = await esiGet(`/characters/${id}/`);
    if (!info) return reply.code(404).send({ ok: false, error: "not_found" });
    const corpId = info.corporation_id || null;
    const allianceId = info.alliance_id || null;
    const [corpInfo, allianceInfo]: any = await Promise.all([
      corpId ? esiGet(`/corporations/${corpId}/`) : Promise.resolve(null),
      allianceId ? esiGet(`/alliances/${allianceId}/`) : Promise.resolve(null),
    ]);
    return reply.send({
      ok: true,
      character: {
        id,
        name: info.name,
        securityStatus: info.security_status,
        corpId,
        corpName: corpInfo?.name,
        corpTicker: corpInfo?.ticker,
        allianceId,
        allianceName: allianceInfo?.name,
        allianceTicker: allianceInfo?.ticker,
        birthday: info.birthday,
      },
    });
  });

  app.get("/eve/kills/character/:id", async (req, reply) => {
    const id = String((req as any).params?.id || "");
    const data: any[] = (await zkillGet(`/characterID/${id}/`)) || [];
    return reply.send({ ok: true, kills: data.slice(0, 25) });
  });

  app.get("/eve/kills/recent", async (_req, reply) => {
    const linked = await prisma.userGameAccount.findMany({
      where: { gameType: "EVE" },
      select: { externalId: true, displayName: true },
      take: 50,
    });
    const ids: string[] = linked.map((l: any) => l.externalId).filter(Boolean);
    if (ids.length === 0) return reply.send({ ok: true, kills: [] });

    const chunks: any[] = [];
    for (const id of ids.slice(0, 20)) {
      const k: any[] = (await zkillGet(`/characterID/${id}/`)) || [];
      for (const row of k.slice(0, 3)) chunks.push({ ...row, _characterId: id });
    }
    return reply.send({ ok: true, kills: chunks.slice(0, 30) });
  });

  let _globalKillsCache: { at: number; data: any[] } | null = null;
  app.get("/eve/kills/global", async (_req, reply) => {
    if (_globalKillsCache && Date.now() - _globalKillsCache.at < 60_000) {
      return reply.send({ ok: true, kills: _globalKillsCache.data, cached: true });
    }
    const raw: any[] = (await zkillGet(`/kills/nullsec/`)) || [];
    const top = (Array.isArray(raw) ? raw : [])
      .filter((k: any) => k?.killmail_id && k?.zkb?.hash)
      .sort((a: any, b: any) => (b.zkb?.totalValue || 0) - (a.zkb?.totalValue || 0))
      .slice(0, 15);
    const details = await Promise.all(
      top.map(async (k: any) => {
        const d: any = await esiGet(`/killmails/${k.killmail_id}/${k.zkb.hash}/`);
        return d ? { k, d } : null;
      }),
    );
    const valid = details.filter(Boolean) as Array<{ k: any; d: any }>;
    const idSet: number[] = [];
    for (const { d } of valid) {
      if (d.victim?.ship_type_id) idSet.push(d.victim.ship_type_id);
      if (d.victim?.character_id) idSet.push(d.victim.character_id);
      if (d.victim?.corporation_id) idSet.push(d.victim.corporation_id);
      if (d.solar_system_id) idSet.push(d.solar_system_id);
    }
    const names = await esiResolveNames(idSet);
    const kills = valid.map(({ k, d }) => ({
      killId: k.killmail_id,
      value: k.zkb?.totalValue || 0,
      points: k.zkb?.points || 0,
      solo: !!k.zkb?.solo,
      npc: !!k.zkb?.npc,
      time: d.killmail_time || null,
      system: d.solar_system_id ? names[d.solar_system_id]?.name || `#${d.solar_system_id}` : null,
      shipTypeId: d.victim?.ship_type_id || null,
      ship: d.victim?.ship_type_id ? names[d.victim.ship_type_id]?.name || null : null,
      victimName: d.victim?.character_id ? names[d.victim.character_id]?.name || null : null,
      victimCorp: d.victim?.corporation_id ? names[d.victim.corporation_id]?.name || null : null,
      attackers: Array.isArray(d.attackers) ? d.attackers.length : 0,
    }));
    _globalKillsCache = { at: Date.now(), data: kills };
    return reply.send({ ok: true, kills });
  });

  app.get("/eve/corp/:id", async (req, reply) => {
    const id = String((req as any).params?.id || "");
    const info: any = await esiGet(`/corporations/${id}/`);
    if (!info) return reply.code(404).send({ ok: false, error: "not_found" });
    return reply.send({
      ok: true,
      corp: {
        id,
        name: info.name,
        ticker: info.ticker,
        memberCount: info.member_count,
        allianceId: info.alliance_id || null,
        ceoId: info.ceo_id || null,
      },
    });
  });

  app.get("/eve/alliance/:id", async (req, reply) => {
    const id = String((req as any).params?.id || "");
    const info: any = await esiGet(`/alliances/${id}/`);
    if (!info) return reply.code(404).send({ ok: false, error: "not_found" });
    return reply.send({
      ok: true,
      alliance: {
        id,
        name: info.name,
        ticker: info.ticker,
        executorCorpId: info.executor_corporation_id || null,
        dateFounded: info.date_founded || null,
      },
    });
  });

  app.get("/eve/sovereignty/campaigns", async (_req, reply) => {
    const camps: any[] = (await esiGet(`/sovereignty/campaigns/`)) || [];
    if (!Array.isArray(camps) || camps.length === 0) return reply.send({ ok: true, campaigns: [] });
    const ids: number[] = [];
    for (const c of camps) {
      if (c.solar_system_id) ids.push(c.solar_system_id);
      if (c.defender_id) ids.push(c.defender_id);
    }
    const names = await esiResolveNames(ids);
    const out = camps
      .map((c: any) => ({
        campaignId: c.campaign_id,
        system: { id: c.solar_system_id, name: names[c.solar_system_id]?.name || null },
        defender: c.defender_id
          ? { id: c.defender_id, name: names[c.defender_id]?.name || null }
          : null,
        eventType: c.event_type,
        startTime: c.start_time || null,
        defenderScore: typeof c.defender_score === "number" ? c.defender_score : null,
        attackersScore: typeof c.attackers_score === "number" ? c.attackers_score : null,
      }))
      .sort((a: any, b: any) => (String(a.startTime) < String(b.startTime) ? -1 : 1))
      .slice(0, 40);
    return reply.send({ ok: true, campaigns: out });
  });

  const MARKET_WATCH: { id: number; name: string }[] = [
    { id: 34, name: "Tritanium" },
    { id: 35, name: "Pyerite" },
    { id: 36, name: "Mexallon" },
    { id: 37, name: "Isogen" },
    { id: 38, name: "Nocxium" },
    { id: 39, name: "Zydrine" },
    { id: 40, name: "Megacyte" },
    { id: 11399, name: "Morphite" },
  ];
  app.get("/eve/market/signals", async (_req, reply) => {
    try {
      const types = MARKET_WATCH.map((w) => w.id).join(",");
      const r = await fetchWithTimeout(
        `https://market.fuzzwork.co.uk/aggregates/?region=10000002&types=${types}`,
        {
          headers: { "User-Agent": ESI_USER_AGENT, Accept: "application/json" },
        },
      );
      if (!r.ok) return reply.send({ ok: true, items: [], region: "Jita / The Forge" });
      const data: any = await r.json();
      const items = MARKET_WATCH.map((w) => {
        const d = data[String(w.id)];
        if (!d) return null;
        const buy = d.buy?.max ? Number(d.buy.max) : null;
        const sell = d.sell?.min ? Number(d.sell.min) : null;
        return { id: w.id, name: w.name, buy, sell };
      }).filter(Boolean);
      return reply.send({ ok: true, items, region: "Jita / The Forge" });
    } catch {
      return reply.send({ ok: true, items: [], region: "Jita / The Forge" });
    }
  });

  app.get("/eve/live/pulse", async (_req, reply) => {
    const [status, kills, jumps, incursions]: any = await Promise.all([
      esiGet(`/status/`),
      esiGet(`/universe/system_kills/`),
      esiGet(`/universe/system_jumps/`),
      esiGet(`/incursions/`),
    ]);
    const killArr: any[] = Array.isArray(kills) ? kills : [];
    const jumpArr: any[] = Array.isArray(jumps) ? jumps : [];
    const totalShipKills = killArr.reduce((s, k) => s + (k.ship_kills || 0), 0);
    const totalPodKills = killArr.reduce((s, k) => s + (k.pod_kills || 0), 0);
    const topDanger = [...killArr]
      .sort((a, b) => (b.ship_kills || 0) - (a.ship_kills || 0))
      .slice(0, 8);
    const topBusy = [...jumpArr]
      .sort((a, b) => (b.ship_jumps || 0) - (a.ship_jumps || 0))
      .slice(0, 8);
    const names = await esiResolveNames([
      ...topDanger.map((s) => s.system_id),
      ...topBusy.map((s) => s.system_id),
    ]);
    return reply.send({
      ok: true,
      players: status?.players ?? null,
      totalShipKills,
      totalPodKills,
      incursions: Array.isArray(incursions) ? incursions.length : 0,
      dangerous: topDanger.map((s) => ({
        id: s.system_id,
        name: names[s.system_id]?.name || null,
        shipKills: s.ship_kills || 0,
        podKills: s.pod_kills || 0,
      })),
      busiest: topBusy.map((s) => ({
        id: s.system_id,
        name: names[s.system_id]?.name || null,
        jumps: s.ship_jumps || 0,
      })),
    });
  });

  app.get("/eve/fw/leaderboard", async (_req, reply) => {
    const lb: any = await esiGet(`/fw/leaderboards/characters/`);
    const weekly: any[] = Array.isArray(lb?.kills?.last_week) ? lb.kills.last_week : [];
    const allTime: any[] = Array.isArray(lb?.kills?.active_total) ? lb.kills.active_total : [];
    const rows = (weekly.length ? weekly : allTime).filter((r: any) => r.character_id).slice(0, 10);
    const names = await esiResolveNames(rows.map((r: any) => r.character_id));
    return reply.send({
      ok: true,
      period: weekly.length ? "last week" : "all-time",
      pilots: rows.map((r: any) => ({
        id: r.character_id,
        name: names[r.character_id]?.name || `Pilot #${r.character_id}`,
        kills: r.amount,
      })),
    });
  });

  app.get("/eve/news", async (_req, reply) => {
    try {
      const r = await fetchWithTimeout(
        `https://news.google.com/rss/search?q=%22EVE+Online%22+when:7d&hl=en-US&gl=US&ceid=US:en`,
        { headers: { "User-Agent": ESI_USER_AGENT, Accept: "application/xml" } },
      );
      if (!r.ok) return reply.send({ ok: true, items: [] });
      const xml = await r.text();
      const items: Array<{ title: string; link: string; pubDate: string; source: string }> = [];
      const itemRe = /<item>([\s\S]*?)<\/item>/g;
      const pick = (block: string, tag: string) => {
        const mm = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(block);
        return mm ? mm[1].replaceAll(/<!\[CDATA\[|\]\]>/g, "").trim() : "";
      };
      let m: RegExpExecArray | null;
      while ((m = itemRe.exec(xml)) && items.length < 15) {
        const block = m[1];
        const title = pick(block, "title");
        if (!title) continue;
        items.push({
          title,
          link: pick(block, "link"),
          pubDate: pick(block, "pubDate"),
          source: pick(block, "source"),
        });
      }
      return reply.send({ ok: true, items });
    } catch {
      return reply.send({ ok: true, items: [] });
    }
  });
}
