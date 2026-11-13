import { describe, it, expect, beforeAll, afterAll } from "vitest";
import lobbiesRoutes from "../../src/routes/lobbies";
import lobbyDesignRoutes from "../../src/routes/lobbyDesign";
import { prisma } from "../../src/lib/prisma";
import { buildTestApp, testAuthFromHeader, testToken } from "../helpers/buildTestApp";

// A lobby's address and words are held to one set of rules by the route that
// makes a lobby and the routes that edit one (lib/lobbyFields.ts, hardening
// pass 2026-11-13).
//
// The edit routes used to cut a description to 500 characters and answer
// "Saved.", and the Branding tab sends the description with every save: five
// live lobbies had been shortened mid-sentence by someone changing a colour.
// The create route checked nothing at all.
const stamp = Date.now().toString(36);
const longId = `itest-lf-long-${stamp}`;
// As long as the staff-written descriptions on the live game lobbies.
const WRITE_UP = "The lobby's write-up runs to many sentences. ".repeat(60).slice(0, 1800);
const KEYWORDS = Array.from({ length: 23 }, (_, i) => `keyword-${i}`);
const id: Record<string, string> = {};
let app: any;

beforeAll(async () => {
  for (const k of ["owner", "member", "staff"]) {
    id[k] = (
      await prisma.user.create({
        data: { usernameKey: `itest_lf_${k}_${stamp}`, name: `lf ${k}`, tier: "INDICTED" },
        select: { id: true },
      })
    ).id;
  }
  await prisma.lobby.create({
    data: {
      id: longId,
      name: "Long Write-up",
      description: WRITE_UP,
      keywords: KEYWORDS,
      ownerId: id.owner,
    },
  });
  const verify = (t: string) => testAuthFromHeader(`Bearer ${t}`);
  // The owner of the lobby in the address, as the real check would find them.
  const lobbyAdminAccess = async (req: any, reply: any) => {
    const u = testAuthFromHeader(req.headers.authorization);
    if (!u) {
      reply.code(401).send({ ok: false });
      return null;
    }
    return { lobby: { id: req.params.id }, member: { roleLevel: 5 }, user: u, overrideRole: null };
  };
  const getGlobalRole = async (uid: string) => (uid === id.staff ? "STAFF" : "USER");
  app = await buildTestApp(async (a: any) => {
    await lobbiesRoutes(a, {
      authFromHeader: testAuthFromHeader,
      verifyToken: verify,
      getGlobalRole,
      canAccessStaff: () => false,
      getLobbyRole: async () => null,
      applyWindroseReel: (x: any) => x,
      lobbyAdminAccess,
      globalAudit: async () => {},
      rooms: new Map(),
      isNameReserved: async () => false,
      awardNotoriety: async () => 0,
      send: () => {},
    } as any);
    await lobbyDesignRoutes(a, {
      authFromHeader: testAuthFromHeader,
      getGlobalRole,
      lobbyAdminAccess,
    } as any);
  });
});

afterAll(async () => {
  await app?.close();
  const users = Object.values(id);
  const owned = await prisma.lobby.findMany({
    where: { OR: [{ ownerId: { in: users } }, { id: { contains: `-lf-` } }] },
    select: { id: true },
  });
  const all = [...new Set([longId, ...owned.map((l) => l.id)])].filter((l) => l.includes(stamp));
  await prisma.lobbyAudit.deleteMany({ where: { lobbyId: { in: all } } }).catch(() => {});
  await prisma.lobbyMember.deleteMany({ where: { lobbyId: { in: all } } }).catch(() => {});
  await prisma.room.deleteMany({ where: { id: { in: all } } }).catch(() => {});
  await prisma.lobby.deleteMany({ where: { id: { in: all } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: users } } }).catch(() => {});
  await prisma.$disconnect();
});

const as = (who: string) => ({ authorization: `Bearer ${testToken(id[who])}` });
const stored = () =>
  prisma.lobby.findUnique({
    where: { id: longId },
    select: { name: true, description: true, keywords: true, accentColor: true },
  });
const brand = (payload: object) =>
  app.inject({
    method: "PATCH",
    url: `/lobbies/${longId}/admin/branding`,
    headers: as("owner"),
    payload,
  });
const create = (who: string, payload: object) =>
  app.inject({ method: "POST", url: "/lobbies", headers: as(who), payload });

describe("editing a lobby with a long write-up", () => {
  it("saves a colour and leaves the description and keywords whole", async () => {
    // What the Branding tab sends: every field, whichever one was changed.
    const r = await brand({
      name: "Long Write-up",
      description: WRITE_UP,
      accentColor: "#112233",
      logoUrl: null,
      bannerUrl: null,
      websiteUrl: null,
      keywords: KEYWORDS,
    });
    expect(r.statusCode).toBe(200);
    const now = await stored();
    expect(now?.accentColor).toBe("#112233");
    expect(now?.description).toBe(WRITE_UP);
    expect(now?.description.length).toBe(1800);
    expect(now?.keywords).toEqual(KEYWORDS);
  });

  it("refuses a description over the limit, in words, and changes nothing", async () => {
    const r = await brand({ description: "d".repeat(2001), accentColor: "#445566" });
    expect(r.statusCode).toBe(400);
    expect(r.json().error).toBe("bad_text");
    expect(r.json().message).toContain("2,000");
    const now = await stored();
    expect(now?.description).toBe(WRITE_UP);
    expect(now?.accentColor).toBe("#112233");
  });

  it("takes a link off when its box is emptied", async () => {
    expect((await brand({ websiteUrl: "https://example.org/club" })).statusCode).toBe(200);
    const linked = await prisma.lobby.findUnique({
      where: { id: longId },
      select: { websiteUrl: true },
    });
    expect(linked?.websiteUrl).toBe("https://example.org/club");
    // The web tab sends null for an emptied box, the phone app an empty string.
    for (const emptied of [null, ""]) {
      await brand({ websiteUrl: "https://example.org/club" });
      expect((await brand({ websiteUrl: emptied })).statusCode).toBe(200);
      const off = await prisma.lobby.findUnique({
        where: { id: longId },
        select: { websiteUrl: true },
      });
      expect(off?.websiteUrl, JSON.stringify(emptied)).toBeNull();
    }
  });

  it("refuses a blank name instead of saving one", async () => {
    expect((await brand({ name: "   " })).statusCode).toBe(400);
    expect((await stored())?.name).toBe("Long Write-up");
  });

  it("publishes a design without cutting the description either", async () => {
    const edited = `${WRITE_UP} And one more sentence.`;
    const r = await app.inject({
      method: "PATCH",
      url: `/lobbies/${longId}/admin/design`,
      headers: as("owner"),
      payload: { description: edited },
    });
    expect(r.statusCode).toBe(200);
    expect((await stored())?.description).toBe(edited);
    const over = await app.inject({
      method: "PATCH",
      url: `/lobbies/${longId}/admin/design`,
      headers: as("owner"),
      payload: { description: "d".repeat(2001) },
    });
    expect(over.statusCode).toBe(400);
    expect((await stored())?.description).toBe(edited);
  });
});

describe("making a lobby", () => {
  it("refuses an address the pages could not serve", async () => {
    for (const bad of ["Has Caps", "a/b", "x".repeat(41), "-lead", "a"]) {
      const r = await create("member", { id: bad, name: "Bad address" });
      expect(r.statusCode, bad).toBe(400);
      expect(r.json().error, bad).toBe("bad_address");
      expect(await prisma.lobby.findUnique({ where: { id: bad } }), bad).toBeNull();
    }
  });

  it("keeps the builder's own address from members and staff alike", async () => {
    for (const who of ["member", "staff"]) {
      const r = await create(who, { id: "create", name: "Create" });
      expect(r.statusCode, who).toBe(403);
      expect(r.json().error, who).toBe("name_reserved");
    }
    expect(await prisma.lobby.findUnique({ where: { id: "create" } })).toBeNull();
  });

  it("refuses a megabyte of words and a made-up kind", async () => {
    const lid = `itest-lf-big-${stamp}`;
    const big = await create("member", { id: lid, name: "Big", description: "d".repeat(900_000) });
    expect(big.statusCode).toBe(400);
    expect(big.json().error).toBe("bad_text");
    // The refusal is short: it does not send the megabyte back.
    expect(big.body.length).toBeLessThan(400);
    const name = await create("member", { id: lid, name: "n".repeat(101) });
    expect(name.statusCode).toBe(400);
    const kind = await create("member", { id: lid, name: "Kind", moduleType: "MADE_UP" });
    expect(kind.statusCode).toBe(400);
    expect(kind.json().error).toBe("bad_kind");
    expect(await prisma.lobby.findUnique({ where: { id: lid } })).toBeNull();
  });

  it("makes an ordinary one, with nothing sent for the description or kind", async () => {
    const lid = `itest-lf-plain-${stamp}`;
    const r = await create("member", {
      id: lid,
      name: "Plain",
      description: null,
      moduleType: null,
    });
    expect(r.statusCode).toBe(200);
    const made = await prisma.lobby.findUnique({
      where: { id: lid },
      select: { description: true, moduleType: true },
    });
    // null used to be saved as the word "null".
    expect(made).toEqual({ description: "", moduleType: "NONE" });
  });

  it("lets staff seed an address that predates the rule", async () => {
    const lid = `r/itest-lf-${stamp}`;
    const r = await create("staff", { id: lid, name: "Seeded" });
    expect(r.statusCode).toBe(200);
    expect(await prisma.lobby.findUnique({ where: { id: lid }, select: { id: true } })).toEqual({
      id: lid,
    });
  });
});
