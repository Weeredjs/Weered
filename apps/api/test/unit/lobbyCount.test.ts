import { describe, expect, it } from "vitest";
import { lobbyOnlineCount } from "../../src/lib/lobbyCount";

const room = (lobbyId: string | undefined, ids: string[]) => ({
  lobbyId,
  users: new Map(ids.map((id) => [id, { name: id }])),
});

describe("lobbyOnlineCount", () => {
  it("counts everyone in any of the lobby's rooms, once, never The Operator", () => {
    const rooms = new Map<string, any>([
      ["division2", room("division2", ["a"])],
      ["division2-raid", room("division2", ["b", "a"])],
      ["destiny2", room("destiny2", ["operator"])],
      ["lobby", room(undefined, ["c"])],
    ]);
    expect(lobbyOnlineCount(rooms, "division2")).toBe(2);
    expect(lobbyOnlineCount(rooms, "destiny2")).toBe(0);
    // A lobby's front room is keyed by its id even without lobbyId set.
    expect(lobbyOnlineCount(rooms, "lobby")).toBe(1);
    expect(lobbyOnlineCount(rooms, "windrose")).toBe(0);
  });

  it("reads rooms whose people are a Set of ids", () => {
    const rooms = new Map<string, any>([["poker", { users: new Set(["x", "y"]) }]]);
    expect(lobbyOnlineCount(rooms, "poker")).toBe(2);
  });
});
