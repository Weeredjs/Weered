import { describe, it, expect, vi } from "vitest";

// People arriving together at a room that isn't in memory yet (everyone
// reconnecting after a deploy) must all land in the same room. Each used to
// build its own copy, and the last one stored replaced the rest, so the
// earlier arrivals sat alone and never saw anyone else (found 2026-10-31).
vi.mock("../../src/lib/prisma", () => {
  const slow = async () => {
    await new Promise((r) => setTimeout(r, 15));
    return null;
  };
  const model = new Proxy({}, { get: () => slow });
  return { prisma: new Proxy({}, { get: () => model }) };
});
const { ensureRoomLoaded, rooms } = await import("../../src/lib/roomState");

describe("loading a room", () => {
  it("people arriving together all get the same room", async () => {
    const got = await Promise.all(
      Array.from({ length: 6 }, () => ensureRoomLoaded("arrive-together")),
    );
    expect(new Set(got).size).toBe(1);
    expect(rooms.get("arrive-together")).toBe(got[0]);
  });

  it("a later arrival gets the one already loaded", async () => {
    const first = await ensureRoomLoaded("later-one");
    expect(await ensureRoomLoaded("later-one")).toBe(first);
  });
});
