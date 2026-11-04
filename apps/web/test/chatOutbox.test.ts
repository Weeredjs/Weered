import { afterEach, describe, expect, it, vi } from "vitest";
import { holdChat, releaseChat, type HeldChat } from "../lib/chatOutbox";

// Chat sent during a deploy's restart waits and goes out once the room is back,
// instead of vanishing (James 2026-11-03).
const env = (roomId: string, body: string) => ({ type: "chat:send", roomId, body });

describe("chat outbox", () => {
  afterEach(() => vi.useRealTimers());

  it("sends what a room held, in order, once it is back; other rooms keep theirs", () => {
    const box = { current: [] as HeldChat[] };
    holdChat(box, env("lobby", "first"));
    holdChat(box, env("gta6", "elsewhere"));
    holdChat(box, env("lobby", "second"));
    const sent: string[] = [];
    expect(releaseChat(box, "lobby", (raw) => sent.push(JSON.parse(raw).body))).toBe(2);
    expect(sent).toEqual(["first", "second"]);
    expect(box.current.map((h) => h.roomId)).toEqual(["gta6"]);
    expect(releaseChat(box, "lobby", () => sent.push("again"))).toBe(0);
  });

  it("keeps twenty at most and lets a minute-old message go", () => {
    vi.useFakeTimers();
    const box = { current: [] as HeldChat[] };
    for (let i = 0; i < 25; i++) holdChat(box, env("lobby", `m${i}`));
    expect(box.current).toHaveLength(20);
    expect(box.current[0].env.body).toBe("m5");
    vi.advanceTimersByTime(61_000);
    expect(releaseChat(box, "lobby", () => {})).toBe(0);
    expect(box.current).toHaveLength(0);
  });

  it("survives the socket dropping again mid-send", () => {
    const box = { current: [] as HeldChat[] };
    holdChat(box, env("lobby", "x"));
    expect(
      releaseChat(box, "lobby", () => {
        throw new Error("closed");
      }),
    ).toBe(0);
  });
});
