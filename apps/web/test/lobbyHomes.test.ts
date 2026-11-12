import { afterEach, describe, expect, it, vi } from "vitest";
import { cachedHome, homeOf, resetHomes, type LobbyHome } from "../lib/lobbyHomes";

// The Town Square's tags (2026-11-12): every name on screen is asked for in one
// batched request, answers are kept, and a failed request costs a minute, not
// a broken chat.
const home = (id: string): LobbyHome => ({ id, name: id, logoUrl: null, accentColor: null });

afterEach(() => {
  resetHomes();
  vi.useRealTimers();
});

describe("Town Square tags", () => {
  it("asks for every name on screen in one request, and remembers", async () => {
    const calls: string[][] = [];
    const fetcher = async (ids: string[]) => {
      calls.push(ids);
      return { kaede: home("nyan"), fan: null } as Record<string, LobbyHome | null>;
    };
    const [a, b, c, a2] = await Promise.all([
      homeOf("kaede", fetcher),
      homeOf("fan", fetcher),
      homeOf("ghost", fetcher),
      homeOf("kaede", fetcher),
    ]);
    expect(calls).toEqual([["kaede", "fan", "ghost"]]);
    expect(a?.id).toBe("nyan");
    expect(a2?.id).toBe("nyan");
    expect(b).toBeNull();
    expect(c).toBeNull();
    expect(cachedHome("kaede")?.id).toBe("nyan");
    expect(await homeOf("kaede", fetcher)).toMatchObject({ id: "nyan" });
    expect(calls).toHaveLength(1);
  });

  it("splits a crowd into batches of 50", async () => {
    const calls: number[] = [];
    const fetcher = async (ids: string[]) => {
      calls.push(ids.length);
      return {};
    };
    await Promise.all(Array.from({ length: 120 }, (_, i) => homeOf(`u${i}`, fetcher)));
    expect(calls).toEqual([50, 50, 20]);
  });

  it("shows no tag when the request fails, and asks again after a minute", async () => {
    let fail = true;
    const fetcher = async () => {
      if (fail) throw new Error("down");
      return { pat: home("chess") };
    };
    expect(await homeOf("pat", fetcher)).toBeNull();
    expect(cachedHome("pat")).toBeNull();
    fail = false;
    expect(cachedHome("pat", Date.now() + 61_000)).toBeUndefined();
    expect(await homeOf("pat", fetcher)).toMatchObject({ id: "chess" });
  });
});
