import { describe, it, expect } from "vitest";
import { pickHomes, shownInSquare } from "../../src/lib/lobbyHomes";
import { indexNowBody, indexNowEnabled, INDEXNOW_KEY, lobbyUrl } from "../../src/lib/indexNow";

// The Town Square's tags (2026-11-12): a name carries the lobby that person is
// from, and the tag is a door. Owned first, then highest rank, newest on a tie.
const L = (id: string, name = id) => ({ id, name, logoUrl: null, accentColor: null });

describe("where someone's from", () => {
  it("never tags the square itself, a member's place or a Reddit mirror", () => {
    expect(shownInSquare("lobby")).toBe(false);
    expect(shownInSquare("u-donkey")).toBe(false);
    expect(shownInSquare("r/all")).toBe(false);
    expect(shownInSquare("destiny2")).toBe(true);
  });

  it("prefers a lobby they own (the busiest), then their highest rank, then the newest", () => {
    const homes = pickHomes(
      ["kaede", "mod", "fan", "nobody"],
      [
        { ...L("nyan", "Nyan Sakura Lounge"), ownerId: "kaede", members: 4 },
        { ...L("tiny"), ownerId: "kaede", members: 1 },
        { ...L("u-kaede"), ownerId: "kaede", members: 9 },
      ],
      [
        { userId: "kaede", roleLevel: 1, joinedAt: 9, lobby: L("chess") },
        { userId: "mod", roleLevel: 1, joinedAt: 50, lobby: L("poker") },
        { userId: "mod", roleLevel: 3, joinedAt: 10, lobby: L("destiny2", "Destiny 2") },
        { userId: "fan", roleLevel: 1, joinedAt: 10, lobby: L("chess") },
        { userId: "fan", roleLevel: 1, joinedAt: 20, lobby: L("windrose") },
        { userId: "fan", roleLevel: 1, joinedAt: 99, lobby: L("lobby") },
      ],
    );
    expect(homes.kaede?.name).toBe("Nyan Sakura Lounge");
    expect(homes.mod?.id).toBe("destiny2");
    expect(homes.fan?.id).toBe("windrose");
    expect(homes.nobody).toBeNull();
  });
});

describe("IndexNow", () => {
  it("is off unless the env turns it on", () => {
    expect(indexNowEnabled({})).toBe(false);
    expect(indexNowEnabled({ INDEXNOW: "1" })).toBe(false);
    expect(indexNowEnabled({ INDEXNOW: "on" })).toBe(true);
  });

  it("sends weered.ca pages only, each once, with the public key", () => {
    const b = indexNowBody([
      lobbyUrl("nyan-sakura-lounge"),
      lobbyUrl("nyan-sakura-lounge"),
      "https://evil.example/x",
      lobbyUrl("r/all"),
    ]);
    expect(b.host).toBe("weered.ca");
    expect(b.key).toBe(INDEXNOW_KEY);
    expect(b.keyLocation).toBe(`https://weered.ca/${INDEXNOW_KEY}.txt`);
    expect(b.urlList).toEqual([
      "https://weered.ca/lobby/nyan-sakura-lounge",
      "https://weered.ca/lobby/r%2Fall",
    ]);
  });
});
