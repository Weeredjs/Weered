import { describe, it, expect } from "vitest";
import { isAtBottom, AT_BOTTOM_SLOP } from "../lib/useStickToBottom";

// This predicate decides whether a chat follows new messages or leaves the
// reader alone. Both failure directions are silent, so they are pinned here.
describe("isAtBottom", () => {
  it("is true when scrolled exactly to the bottom", () => {
    expect(isAtBottom(400, 600, 1000)).toBe(true);
  });

  it("tolerates being a hair short — sub-pixel rounding and a clipped last row", () => {
    expect(isAtBottom(400 - AT_BOTTOM_SLOP + 1, 600, 1000)).toBe(true);
  });

  it("is false once the reader has genuinely scrolled up", () => {
    // Just beyond the slop: reading history, must not be yanked down.
    expect(isAtBottom(400 - AT_BOTTOM_SLOP - 1, 600, 1000)).toBe(false);
    expect(isAtBottom(0, 600, 5000)).toBe(false);
  });

  it("treats a list shorter than its viewport as at the bottom", () => {
    // Nothing to scroll. Without the guard the arithmetic goes negative and a
    // short room would read as 'scrolled up', so it would never auto-follow.
    expect(isAtBottom(0, 600, 200)).toBe(true);
    expect(isAtBottom(0, 600, 600)).toBe(true);
  });

  it("handles the empty list without dividing the world by zero", () => {
    expect(isAtBottom(0, 0, 0)).toBe(true);
  });

  it("stays true when content grows by less than the slop beneath the reader", () => {
    // An avatar resolving adds a few px. The reader should still be following.
    expect(isAtBottom(400, 600, 1000 + AT_BOTTOM_SLOP - 1)).toBe(true);
  });

  it("goes false when a large embed loads and pushes content well below", () => {
    expect(isAtBottom(400, 600, 1000 + AT_BOTTOM_SLOP + 200)).toBe(false);
  });
});
