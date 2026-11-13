import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mayAct, withinBudget } from "../../src/lib/roomGate";
import { makeEmptyRoom } from "../../src/lib/roomState";
import { handleYoutube } from "../../src/sockets/roomMedia";

// Mute and chat lock hold on every path, not just new messages (red team
// 2026-11-01, finding 11), and the watch-together relay is small and paced
// (finding 12).
function room() {
  const r: any = makeEmptyRoom("r1");
  r.users.set("a", { id: "a" });
  r.users.set("m", { id: "m" });
  r.mods.add("m");
  return r;
}

describe("who may act in a room", () => {
  it("is someone here, not banned, not muted", () => {
    const r = room();
    expect(mayAct(r, { id: "a" })).toBe(true);
    expect(mayAct(r, { id: "stranger" })).toBe(false);
    r.muted.add("a");
    expect(mayAct(r, { id: "a" })).toBe(false);
    r.muted.delete("a");
    r.banned.add("a");
    expect(mayAct(r, { id: "a" })).toBe(false);
  });

  it("keeps a locked chat to its moderators", () => {
    const r = room();
    r.chatLocked = true;
    expect(mayAct(r, { id: "a" }, { chat: true })).toBe(false);
    expect(mayAct(r, { id: "m" }, { chat: true })).toBe(true);
    // A lock is about chat: the canvas and blocks aren't chat.
    expect(mayAct(r, { id: "a" })).toBe(true);
  });

  it("counts a socket's messages per window", () => {
    const ws: any = {};
    let n = 0;
    for (let i = 0; i < 20; i++) if (withinBudget(ws, "x", 12, 2000)) n++;
    expect(n).toBe(12);
  });

  it("every message a socket sends is counted, before anything looks at its kind", () => {
    // The dispatcher lives in index.ts, which starts the server when loaded, so
    // this reads it: the overall allowance comes first in the message handler,
    // ahead of the sign-in branch and of every per-kind handler.
    const src = readFileSync(join(__dirname, "..", "..", "src", "index.ts"), "utf8");
    const handler = src.slice(src.indexOf('ws.on("message"'));
    const overall = handler.indexOf('withinBudget(ws, "all"');
    const signIn = handler.indexOf('if (msg.type === "auth:hello") {');
    expect(overall).toBeGreaterThan(0);
    expect(signIn).toBeGreaterThan(overall);
  });
});

describe("the watch-together relay", () => {
  const run = (r: any, ws: any, msg: any) => {
    const out: any[] = [];
    handleYoutube(ws, msg, { room: r, roomId: "r1" }, { send: (_s: any, m: any) => out.push(m) });
    return out;
  };

  it("passes on only the move, small", () => {
    const r = room();
    const other = { user: { id: "m" } };
    r.sockets.add(other);
    const ws = { user: { id: "a" } };
    const out = run(r, ws, {
      type: "youtube:load",
      videoId: "dQw4w9WgXcQ",
      junk: "x".repeat(1000),
    });
    expect(out).toEqual([
      { type: "youtube:load", roomId: "r1", _from: "a", videoId: "dQw4w9WgXcQ" },
    ]);
  });

  it("drops unknown kinds, the muted, and a flood", () => {
    const r = room();
    r.sockets.add({ user: { id: "m" } });
    expect(run(r, { user: { id: "a" } }, { type: "youtube:anything", blob: "x" })).toEqual([]);
    r.muted.add("a");
    expect(run(r, { user: { id: "a" } }, { type: "youtube:play", position: 3 })).toEqual([]);
    r.muted.delete("a");
    const ws = { user: { id: "a" } };
    let sent = 0;
    for (let i = 0; i < 40; i++) sent += run(r, ws, { type: "youtube:pause", position: i }).length;
    expect(sent).toBe(12);
  });
});
