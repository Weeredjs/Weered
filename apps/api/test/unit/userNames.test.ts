import { describe, it, expect } from "vitest";
import { displayName } from "../../src/lib/userNames";

// Messages store the author's name AT SEND TIME. Resolving live by userId is
// what makes a rename appear across all history — but the stored copy still has
// a job, because a deleted account has no User row left to resolve against.
// The precedence between the two is the whole fix, so it is pinned here.
describe("displayName — live name vs the copy stored on the message", () => {
  it("prefers the live name over the stale copy stored at send time", () => {
    const live = new Map([["u1", "Fairtale"]]);
    expect(displayName(live, "u1", "Erik Johannes Jung")).toBe("Fairtale");
  });

  it("falls back to the stored copy when the account is gone", () => {
    // Deleted user: no row to resolve. History must still read sensibly rather
    // than turning into a wall of "?".
    expect(displayName(new Map(), "u-deleted", "Someone Who Left")).toBe("Someone Who Left");
  });

  it("falls back when the id is missing entirely (system/bot messages)", () => {
    expect(displayName(new Map(), null, "The Operator")).toBe("The Operator");
    expect(displayName(new Map(), undefined, "The Operator")).toBe("The Operator");
  });

  it("ends at ? rather than blank when there is nothing at all", () => {
    // A blank name would render as an empty author, which reads as broken.
    expect(displayName(new Map(), null, null)).toBe("?");
    expect(displayName(new Map(), "u1", "")).toBe("?");
    expect(displayName(new Map(), "u1", undefined)).toBe("?");
  });

  it("does not let an empty resolved name mask a good stored one", () => {
    // resolveUserNames never stores empty strings, but if it ever did, the
    // stored copy is still better than nothing.
    const live = new Map([["u1", ""]]);
    expect(displayName(live, "u1", "Old Name")).toBe("Old Name");
  });

  it("resolves each author independently in a mixed backlog", () => {
    const live = new Map([
      ["u1", "Fairtale"],
      ["u2", "weered"],
    ]);
    const rows = [
      { userId: "u1", userName: "Erik Johannes Jung" },
      { userId: "u2", userName: "weered" },
      { userId: "u3", userName: "Departed Member" },
    ];
    expect(rows.map((r) => displayName(live, r.userId, r.userName))).toEqual([
      "Fairtale",
      "weered",
      "Departed Member",
    ]);
  });
});
