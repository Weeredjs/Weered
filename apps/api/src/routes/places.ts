import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { swallow } from "../lib/logger";

// Your place (James 2026-10-30: "like a vibe coded my space ... People walk in
// and just exist ... weered at subdomains everywhere"). Every member can have
// one place: a lobby of their own, free, unlisted, at weered.ca/u/<label> and
// <label>.weered.ca. Underneath it's an ordinary lobby (rooms, chat, voice,
// Design mode, Describe it); what marks it is the id, "u-" + its label.
//
//   GET  /places/mine          the caller's place, or null
//   POST /places/mine          make it (once): {layout?, accentColor?}
//   GET  /places/of/:userId    someone's place, for their profile
//
// <label>.weered.ca is answered by /domains/check and /domains/resolve
// (routes/lobbyDesign.ts), through placeForHost below.

export const PLACE_PREFIX = "u-";
/** A member's place. Places are text only (no voice, video or screen share:
 *  that's what lobbies are for, James 2026-10-31) and their owner says who
 *  gets in. */
export const isPlaceId = (id: unknown): boolean =>
  typeof id === "string" && id.startsWith(PLACE_PREFIX);
const LAYOUT_MAX = 48_000;
/** Weered's own subdomains, and words that would read as Weered's: never a place. */
const SYSTEM_LABELS = new Set([
  "www",
  "api",
  "ws",
  "livekit",
  "mail",
  "smtp",
  "imap",
  "pop",
  "mx",
  "ns1",
  "ns2",
  "ns3",
  "ns4",
  "app",
  "admin",
  "staff",
  "office",
  "docs",
  "status",
  "cdn",
  "static",
  "media",
  "assets",
  "dev",
  "test",
  "staging",
  "beta",
  "blog",
  "help",
  "support",
  "ftp",
  "meet",
  "lobby",
  "home",
  "login",
  "auth",
  "u",
  "weered",
  "operator",
  "official",
  "security",
]);

/** A name as a place's label: lowercase letters, digits and hyphens, 2–30 long. */
export function placeLabel(name: string): string {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30)
    .replace(/-$/, "");
}

/** The place a <label>.weered.ca host would be, or null when it can't be one. */
export function placeIdForHost(host: string): string | null {
  const m = /^([a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?)\.weered\.ca$/.exec(
    String(host || "").toLowerCase(),
  );
  if (!m || SYSTEM_LABELS.has(m[1])) return null;
  return PLACE_PREFIX + m[1];
}

const placeCache = new Map<string, { ok: boolean; at: number }>();
/** The lobby id for a place host, if that place exists (cached a minute). */
export async function placeForHost(host: string): Promise<string | null> {
  const id = placeIdForHost(host);
  if (!id) return null;
  const hit = placeCache.get(id);
  if (hit && Date.now() - hit.at < 60_000) return hit.ok ? id : null;
  const row = await prisma.lobby.findUnique({ where: { id }, select: { id: true } });
  placeCache.set(id, { ok: !!row, at: Date.now() });
  if (placeCache.size > 5000) placeCache.clear();
  return row ? id : null;
}

// ── Who can come in ─────────────────────────────────────────────────────
// Kept in the place's moduleConfig (a place has no game module, so it's free),
// with joinMode set to match: OPEN for anyone, APPROVAL for the rest, so a path
// that only reads joinMode still makes a stranger knock rather than walk in.
//   anyone   open to everyone with the link
//   friends  the owner's friends walk in; nobody else
//   ask      people knock (a join request); the owner lets them in
//   me       closed: only the owner
export const PLACE_GATES = ["anyone", "friends", "ask", "me"] as const;
export type PlaceGate = (typeof PLACE_GATES)[number];

export function gateOf(l: { moduleConfig?: unknown } | null | undefined): PlaceGate {
  const g = (l?.moduleConfig as any)?.gate;
  return PLACE_GATES.includes(g) ? g : "anyone";
}

export async function areFriends(a: string, b: string): Promise<boolean> {
  if (!a || !b || a === b) return false;
  const fr = await prisma.friendRequest
    .findFirst({
      where: {
        status: "ACCEPTED",
        OR: [
          { fromId: a, toId: b },
          { fromId: b, toId: a },
        ],
      },
      select: { id: true },
    })
    .catch(() => null);
  return !!fr;
}

/** May this user be inside this place (its chat, its rooms)? Staff always;
 *  the owner always; then the gate: anyone, a friend (friends), a member who
 *  was let in (ask). Fails closed on a lookup error. */
export async function canEnterPlace(
  user: { id?: string; guest?: boolean; globalRole?: string } | null | undefined,
  lobbyId: string,
): Promise<boolean> {
  try {
    const lobby = await prisma.lobby.findUnique({
      where: { id: lobbyId },
      select: { ownerId: true, moduleConfig: true },
    });
    if (!lobby) return false;
    const gate = gateOf(lobby);
    if (gate === "anyone") return true;
    if (!user?.id || user.guest) return false;
    if (user.id === lobby.ownerId) return true;
    if (["STAFF", "ADMIN", "GOD"].includes(String(user.globalRole || ""))) return true;
    if (gate === "me") return false;
    if (gate === "friends") return areFriends(user.id, String(lobby.ownerId || ""));
    const m = await prisma.lobbyMember.findUnique({
      where: { lobbyId_userId: { lobbyId, userId: user.id } },
      select: { id: true },
    });
    return !!m;
  } catch {
    return false;
  }
}

function view(l: { id: string; name: string; moduleConfig?: unknown }) {
  const label = l.id.slice(PLACE_PREFIX.length);
  return {
    id: l.id,
    name: l.name,
    label,
    path: `/u/${label}`,
    host: `${label}.weered.ca`,
    gate: gateOf(l),
  };
}

async function placeOf(userId: string) {
  return prisma.lobby.findFirst({
    where: { ownerId: userId, id: { startsWith: PLACE_PREFIX } },
    select: { id: true, name: true, moduleConfig: true },
    orderBy: { createdAt: "asc" },
  });
}

type Opts = { authFromHeader: (h?: string) => { id: string; name: string } | null };

export default async function placesRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader } = opts;

  app.get("/places/mine", async (req, reply) => {
    const u = authFromHeader((req.headers as any).authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const p = await placeOf(u.id);
    return reply.send({ ok: true, place: p ? view(p) : null });
  });

  // Who can come in: the owner's one switch (components/PlaceGate.tsx).
  app.patch(
    "/places/mine/gate",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const u = authFromHeader((req.headers as any).authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      const gate = String(((req as any).body || {}).gate || "") as PlaceGate;
      if (!PLACE_GATES.includes(gate))
        return reply.code(400).send({ ok: false, error: "bad_gate" });
      const p = await placeOf(u.id);
      if (!p) return reply.code(404).send({ ok: false, error: "no_place" });
      const cfg =
        p.moduleConfig && typeof p.moduleConfig === "object" ? (p.moduleConfig as any) : {};
      await prisma.lobby.update({
        where: { id: p.id },
        data: { moduleConfig: { ...cfg, gate }, joinMode: gate === "anyone" ? "OPEN" : "APPROVAL" },
      });
      return reply.send({ ok: true, gate });
    },
  );

  app.get("/places/of/:userId", async (req, reply) => {
    const userId = String((req.params as any).userId || "").slice(0, 64);
    const p = userId ? await placeOf(userId) : null;
    reply.header("Cache-Control", "public, max-age=60");
    return reply.send({ ok: true, place: p ? view(p) : null });
  });

  app.post(
    "/places/mine",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const u = authFromHeader((req.headers as any).authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      const have = await placeOf(u.id);
      if (have) return reply.send({ ok: true, place: view(have), created: false });

      const me = await prisma.user.findUnique({
        where: { id: u.id },
        select: { name: true, usernameKey: true, bio: true, isGuest: true },
      });
      if (!me || (me as any).isGuest)
        return reply.code(403).send({ ok: false, error: "members_only" });

      let label = placeLabel(me.usernameKey || me.name);
      if (label.length < 2) label = `member-${u.id.slice(-6).toLowerCase()}`;
      if (SYSTEM_LABELS.has(label)) label = `${label}-place`;
      // A label already taken (two names that clean up the same): number it.
      let id = PLACE_PREFIX + label;
      for (let i = 2; i < 60; i++) {
        if (!(await prisma.lobby.findUnique({ where: { id }, select: { id: true } }))) break;
        id = `${PLACE_PREFIX}${label.slice(0, 26)}-${i}`;
      }

      const body: any = (req as any).body || {};
      let layout: any = undefined;
      if (body.layout && typeof body.layout === "object" && !Array.isArray(body.layout)) {
        const raw = JSON.stringify(body.layout);
        if (raw.length <= LAYOUT_MAX) layout = JSON.parse(raw);
      }
      const accent =
        typeof body.accentColor === "string" && /^#[0-9a-f]{6}$/i.test(body.accentColor)
          ? body.accentColor
          : null;
      const name = `${me.name}'s place`.slice(0, 48);
      try {
        const lobby = await prisma.lobby.create({
          data: {
            id,
            name,
            description: String(me.bio || "").slice(0, 160),
            ownerId: u.id,
            moduleType: "NONE",
            verified: false,
            unlisted: true,
            accentColor: accent,
            // Text only: talking happens in lobbies (isPlaceId, below).
            enabledModules: [],
            ...(layout ? { layout } : {}),
          } as any,
          select: { id: true, name: true },
        });
        await prisma.lobbyMember
          .upsert({
            where: { lobbyId_userId: { lobbyId: lobby.id, userId: u.id } },
            update: { roleLevel: 5, role: "OWNER" },
            create: {
              lobbyId: lobby.id,
              userId: u.id,
              name: me.name || "",
              roleLevel: 5,
              role: "OWNER",
            },
          })
          .catch(swallow);
        placeCache.delete(lobby.id);
        return reply.send({ ok: true, place: view(lobby), created: true });
      } catch (e) {
        swallow(e);
        // Two tabs at once: the other one made it.
        const again = await placeOf(u.id);
        if (again) return reply.send({ ok: true, place: view(again), created: false });
        return reply.code(500).send({ ok: false, error: "place_failed" });
      }
    },
  );
}
