import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../../src/lib/prisma";
import { hydrateGlobalRole } from "../../src/lib/lobbyAuth";
import { discordStandIn, googleStandIn, onStandInName } from "../../src/lib/standInName";

// James 2026-11-02: signed in with Discord, closed the window on the username
// step, and stayed "d_20972329" for good: nothing ever asked again. The socket's
// auth:ok now carries needsUsername for such an account.
const stamp = Date.now().toString();
const discordId = `9${stamp}`;
const googleId = `1${stamp}${stamp}`;
const ids: string[] = [];

beforeAll(async () => {
  for (const data of [
    { usernameKey: discordStandIn(discordId), name: "d_half", discordId },
    { usernameKey: googleStandIn(googleId), name: "g_half", googleId },
    { usernameKey: `itest_picked_${stamp}`, name: "picked", discordId: `8${stamp}` },
  ])
    ids.push((await prisma.user.create({ data, select: { id: true } })).id);
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
  await prisma.$disconnect();
});

describe("the username step after a Google or Discord sign-up", () => {
  it("is still owed by an account on its stand-in name", async () => {
    const [discord, google, picked] = await Promise.all(
      ids.map((id) => hydrateGlobalRole({ id, name: "x" } as any)),
    );
    expect((discord as any).needsUsername).toBe(true);
    expect((google as any).needsUsername).toBe(true);
    expect((picked as any).needsUsername).toBe(false);
  });

  it("only the account's own provider id makes a stand-in", () => {
    expect(onStandInName({ usernameKey: discordStandIn("123"), discordId: "123" })).toBe(true);
    expect(onStandInName({ usernameKey: discordStandIn("123"), discordId: "456" })).toBe(false);
    expect(onStandInName({ usernameKey: "d_123", discordId: null })).toBe(false);
    expect(onStandInName({ usernameKey: "g_123456789012", googleId: "123456789012345" })).toBe(
      true,
    );
    expect(onStandInName({ usernameKey: "james", googleId: "123456789012345" })).toBe(false);
  });
});
