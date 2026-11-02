import { describe, it, expect, beforeAll, afterAll } from "vitest";
import guestJoinRoutes from "../../src/routes/guestJoin";
import { cleanDisplayName } from "../../src/lib/displayName";
import { prisma } from "../../src/lib/prisma";
import { buildTestApp } from "../helpers/buildTestApp";

// Hardening 2026-11-02: a guest's typed name, and the name on a new Google or
// Discord account, skipped every rule a username follows. A guest could come in
// as the Operator or "Weered Support", or hide a name behind direction-flipping
// characters.
const stamp = Date.now().toString(36);
const LOBBY = `itest-gname-${stamp}`;
let owner = "";
let token = "";
let app: any;

beforeAll(async () => {
  owner = (
    await prisma.user.create({
      data: { usernameKey: `itest_gname_${stamp}`, name: "owner" },
      select: { id: true },
    })
  ).id;
  await prisma.lobby.create({ data: { id: LOBBY, name: "Names", ownerId: owner } });
  token = (
    await prisma.invite.create({
      data: { type: "GUEST", targetId: LOBBY, createdBy: owner, maxUses: 10 },
    })
  ).token;
  app = await buildTestApp((a: any) =>
    guestJoinRoutes(a, { JWT_SECRET: "weered-integration-test-secret" }),
  );
});

afterAll(async () => {
  await app?.close();
  await prisma.invite.deleteMany({ where: { targetId: LOBBY } }).catch(() => {});
  await prisma.user
    .deleteMany({ where: { OR: [{ id: owner }, { isGuest: true, name: "Quinn Gname" }] } })
    .catch(() => {});
  await prisma.lobby.deleteMany({ where: { id: LOBBY } }).catch(() => {});
  await prisma.$disconnect();
});

const join = (name: string) =>
  app.inject({ method: "POST", url: "/auth/guest-lobby", payload: { inviteToken: token, name } });

describe("names nobody chose through the username rules", () => {
  it("a guest can't come in as Weered or the Operator", async () => {
    for (const name of ["Weered Support", "the weered team", "Op\u200Berator", "OPERATOR"]) {
      const r = await join(name);
      expect(r.statusCode).toBe(400);
      expect(r.json().error).toBe("name_reserved");
    }
  });

  it("invisible and direction-flipping characters come out", async () => {
    const r = await join("\u202EQuinn\u200B Gname\u2066");
    expect(r.statusCode).toBe(200);
    expect(r.json().user.name).toBe("Quinn Gname");
  });

  it("a Google or Discord profile name follows the same rule", async () => {
    expect(await cleanDisplayName("Weered Staff")).toBeNull();
    expect(await cleanDisplayName("Operator")).toBeNull();
    expect(await cleanDisplayName("Ann\u200B  Lee")).toBe("Ann Lee");
    expect(await cleanDisplayName(undefined)).toBe("");
  });
});
