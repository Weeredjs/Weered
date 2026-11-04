import { describe, expect, it } from "vitest";
import { noun, plural } from "../lib/plural";

describe("plural", () => {
  it("says one room, two rooms", () => {
    expect(plural(1, "room")).toBe("1 room");
    expect(plural(2, "room")).toBe("2 rooms");
    expect(plural(0, "member")).toBe("0 members");
  });

  it("takes the plural for irregular words", () => {
    expect(plural(1, "lobby", "lobbies")).toBe("1 lobby");
    expect(plural(3, "lobby", "lobbies")).toBe("3 lobbies");
  });

  it("reads a missing count as zero", () => {
    expect(plural(undefined, "player")).toBe("0 players");
    expect(plural(null, "player")).toBe("0 players");
  });

  it("gives just the word for a count drawn on its own", () => {
    expect(noun(1, "viewer")).toBe("viewer");
    expect(noun(1234, "viewer")).toBe("viewers");
    expect(noun(undefined, "room")).toBe("rooms");
    expect(noun(1, "online", "online")).toBe("online");
  });
});
