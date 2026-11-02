import { describe, it, expect } from "vitest";
import { normalizeRoomId } from "../../src/lib/roomState";

// Red team 2026-11-01, finding 28: a room whose id started "lobby:" skipped its
// password and lock, and anyone sitting in one heard that lobby's broadcasts.
// No client uses the form and no room has it, so it is no room at all now.
describe("normalizeRoomId and the retired lobby: form", () => {
  it("refuses lobby:<id>, however it is encoded", () => {
    expect(normalizeRoomId("lobby:gta6")).toBe("");
    expect(normalizeRoomId("lobby%3Agta6")).toBe("");
    expect(normalizeRoomId("lobby%253Agta6")).toBe("");
    expect(normalizeRoomId("  lobby:gta6  ")).toBe("");
  });

  it("leaves real room ids alone", () => {
    expect(normalizeRoomId("lobby")).toBe("lobby");
    expect(normalizeRoomId("gta6")).toBe("gta6");
    expect(normalizeRoomId("gta6-lfg")).toBe("gta6-lfg");
    expect(normalizeRoomId("my-lobby:notes")).toBe("my-lobby:notes");
    expect(normalizeRoomId("@ops")).toBe("@ops");
  });
});
