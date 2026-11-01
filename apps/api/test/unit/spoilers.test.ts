import { describe, it, expect } from "vitest";
import { hideSpoilers } from "../../src/lib/spoilers";

// A spoiler never reaches a notification or a push (lib/spoilers.ts).
describe("hideSpoilers", () => {
  it("shows each spoiler as [spoiler] and keeps the rest", () => {
    expect(hideSpoilers("did you see ||the ending|| and ||the twist||?")).toBe(
      "did you see [spoiler] and [spoiler]?",
    );
  });
  it("leaves lone bars and plain text alone", () => {
    expect(hideSpoilers("a || b")).toBe("a || b");
    expect(hideSpoilers("no spoilers here")).toBe("no spoilers here");
    expect(hideSpoilers("")).toBe("");
  });
  it("doesn't reach across lines", () => {
    expect(hideSpoilers("||one\ntwo||")).toBe("||one\ntwo||");
  });
});
