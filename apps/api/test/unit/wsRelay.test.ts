import { describe, it, expect, beforeEach } from "vitest";
import { handleCanvasRelay } from "../../src/sockets/canvas";

// D&D / map relay: broadcasts table events (initiative/roll/token-move/fog) to
// the room except the sender, member-gated; returns false for unrelated types.
let sent: any[];
function mkRoom() {
  return { roomId: "r1", users: new Map<string, any>(), sockets: new Set<any>() };
}
const opts = () => ({ send: (ws: any, m: any) => sent.push({ ws, m }) });
beforeEach(() => {
  sent = [];
});

describe("ws handleCanvasRelay - tabletop relay", () => {
  it("relays a dnd:roll to peers (not the sender) and reports handled", () => {
    const room = mkRoom();
    room.users.set("alice", {});
    const me = { user: { id: "alice" } };
    const peer = { user: { id: "bob" } };
    room.sockets.add(me);
    room.sockets.add(peer);
    const handled = handleCanvasRelay(
      me,
      { type: "dnd:roll", die: 20, value: 17 },
      { room, roomId: "r1" },
      opts(),
    );
    expect(handled).toBe(true);
    expect(sent.length).toBe(1);
    expect(sent[0].ws).toBe(peer);
    expect(sent[0].m).toMatchObject({ type: "dnd:roll", value: 17, _from: "alice" });
  });

  it("ignores a non-member (handled, but nothing relayed)", () => {
    const room = mkRoom(); // alice not a member
    room.sockets.add({ user: { id: "bob" } });
    const handled = handleCanvasRelay(
      { user: { id: "alice" } },
      { type: "map:fog-clear" },
      { room, roomId: "r1" },
      opts(),
    );
    expect(handled).toBe(true);
    expect(sent.length).toBe(0);
  });

  it("returns false for an unrelated message type", () => {
    const room = mkRoom();
    room.users.set("alice", {});
    const handled = handleCanvasRelay(
      { user: { id: "alice" } },
      { type: "chat:send" },
      { room, roomId: "r1" },
      opts(),
    );
    expect(handled).toBe(false);
    expect(sent.length).toBe(0);
  });
});
