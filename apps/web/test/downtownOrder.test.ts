import { describe, expect, it } from "vitest";
import { downtownOrder } from "../lib/downtownOrder";
import { joinLine } from "../components/LobbyJoinBar";

// Downtown's first rows show the range of the town, not ten games (2026-11-12).
const L = (id: string, members: number, extra: Record<string, unknown> = {}) => ({
  id,
  pinned: true,
  onlineCount: 0,
  _count: { members },
  ...extra,
});

describe("Downtown's order", () => {
  it("puts the Town Square first and weaves the front row into the rest", () => {
    const order = downtownOrder([
      L("windrose", 9),
      L("destiny2", 4),
      L("study-hall", 2, { featured: true }),
      L("dnd", 4),
      L("lobby", 9),
      L("cowork", 0, { featured: true }),
      L("member-built", 30, { pinned: false }),
    ]).map((l) => l.id);
    // Square, then front row and the rest one for one; built-ins before
    // member-built within the rest, as before.
    expect(order).toEqual([
      "lobby",
      "study-hall",
      "windrose",
      "cowork",
      "destiny2",
      "dnd",
      "member-built",
    ]);
  });

  it("is the old order when nothing is in the front row, and lifts whoever is on", () => {
    const order = downtownOrder([L("a", 1), L("b", 5), L("c", 2, { onlineCount: 3 })]).map(
      (l) => l.id,
    );
    expect(order).toEqual(["c", "b", "a"]);
  });
});

// The slim bar that replaced the "Unlock the experience" wall.
describe("the join bar's line", () => {
  const base = { lobbyId: "nyan", lobbyName: "Nyan Sakura Lounge", themeable: false };
  it("asks plainly, and says when an account is needed", () => {
    expect(joinLine({ ...base, signedIn: false, canJoin: true })).toBe(
      "You're looking round Nyan Sakura Lounge. Join free to chat and drop into voice.",
    );
    expect(joinLine({ ...base, signedIn: true, canJoin: true })).toBe(
      "You're looking round Nyan Sakura Lounge. Join to chat and drop into voice.",
    );
    // A lobby with its own way in: the bar only offers the account.
    expect(joinLine({ ...base, signedIn: false, canJoin: false })).toBe(
      "You're looking round Nyan Sakura Lounge. Make a free account to chat and drop into voice.",
    );
  });
  it("uses the lobby's own words and mentions its look", () => {
    expect(
      joinLine({
        lobbyId: "cowork",
        lobbyName: "Co-Work",
        signedIn: true,
        canJoin: true,
        themeable: true,
      }),
    ).toBe(
      "You're looking round Co-Work. Join to take part in the sprint, post on the day board and sit in Deep Work, and get the full Co-Work look.",
    );
  });
});
