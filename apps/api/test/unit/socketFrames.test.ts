import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ID_MAX,
  ROOM_LIST_MAX,
  idsAreShort,
  openFrame,
  roomForOneMore,
} from "../../src/lib/socketFrames";
import { safeJson } from "../../src/lib/roomState";
import { handleCanvasRelay } from "../../src/sockets/canvas";

// What a frame on the chat socket may carry (fan-out audit, 2026-11-13).

describe("opening a frame", () => {
  it("opens a client's payload once and keeps the outer type", () => {
    expect(openFrame({ type: "chat:send", payload: { roomId: "r", body: "hi" } })).toEqual({
      type: "chat:send",
      roomId: "r",
      body: "hi",
    });
  });

  it("never lets a payload name the type, and drops a payload inside a payload", () => {
    const forged = {
      type: "dnd:roll",
      payload: { type: "x", payload: { type: "chat:new", msg: { body: "Sign in again" } } },
    };
    const o = safeJson(JSON.stringify(forged));
    expect(o.type).toBe("dnd:roll");
    expect(o.payload).toBeUndefined();
    expect(o.msg).toBeUndefined();
  });

  it("a relayed dice frame reaches the others with its own type and no payload", () => {
    const sent: any[] = [];
    const me = { user: { id: "a" } };
    const other = { user: { id: "b" } };
    const room: any = { sockets: new Set([me, other]), users: new Map([["a", {}]]) };
    const msg = safeJson(
      JSON.stringify({
        type: "dnd:roll",
        roomId: "r",
        payload: { payload: { type: "staff:banned" }, dice: "1d20" },
      }),
    );
    handleCanvasRelay(me, msg, { room, roomId: "r" }, { send: (_s: any, m: any) => sent.push(m) });
    expect(sent).toHaveLength(1);
    expect(sent[0].type).toBe("dnd:roll");
    expect(sent[0].payload).toBeUndefined();
    expect(sent[0]._from).toBe("a");
  });
});

describe("ids in a frame", () => {
  it("passes ordinary ids and refuses long or odd ones", () => {
    expect(idsAreShort({ type: "mod:mute", roomId: "lobby:destiny2", userId: "cmvx1234" })).toBe(
      true,
    );
    expect(idsAreShort({ type: "chat:send", body: "x".repeat(4000) })).toBe(true);
    expect(idsAreShort({ type: "room:deny", userId: "x".repeat(ID_MAX + 1) })).toBe(false);
    expect(idsAreShort({ type: "mod:ban", userId: { id: "a" } })).toBe(false);
    expect(idsAreShort({ type: "dm:react", msgId: 42 })).toBe(true);
  });

  it("a room's lists stop growing at their ceiling", () => {
    const list = new Set(Array.from({ length: ROOM_LIST_MAX }, (_, i) => "u" + i));
    expect(roomForOneMore(list, "new")).toBe(false);
    expect(roomForOneMore(list, "u3")).toBe(true);
    expect(roomForOneMore(new Set(), "new")).toBe(true);
  });
});

describe("the dispatcher", () => {
  const src = readFileSync(join(__dirname, "..", "..", "src", "index.ts"), "utf8");
  const handler = src.slice(src.indexOf('ws.on("message"'));

  it("checks ids before any handler", () => {
    expect(handler.indexOf("idsAreShort(msg)")).toBeGreaterThan(0);
    expect(handler.indexOf("idsAreShort(msg)")).toBeLessThan(handler.indexOf("handleAuthHello("));
  });

  it("refuses a second sign-in as someone else on the same socket", () => {
    const hello = handler.slice(handler.indexOf('if (msg.type === "auth:hello") {'));
    expect(hello.indexOf("identity_change")).toBeGreaterThan(0);
    expect(hello.indexOf("identity_change")).toBeLessThan(hello.indexOf("handleAuthHello("));
  });
});
