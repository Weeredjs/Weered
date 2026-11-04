import { describe, expect, it } from "vitest";
import { sanitizeLayout } from "../lib/lobbyLayout";

// A lobby's Card size and its logo as the floating symbol (James 2026-11-04):
// saved in the layout, which the API stores as sent, so the page's sanitiser
// is what stands between a bad value and the lobby.
describe("card size and the logo symbol, cleaned", () => {
  it("keeps small and large, and leaves medium (the default) unset", () => {
    expect(sanitizeLayout({ cards: "s" })?.cards).toBe("s");
    expect(sanitizeLayout({ cards: "l" })?.cards).toBe("l");
    expect(sanitizeLayout({ cards: "m" })?.cards).toBeUndefined();
    expect(sanitizeLayout({ cards: "huge" })?.cards).toBeUndefined();
  });

  it("floats the logo only when it is plainly asked for", () => {
    expect(
      sanitizeLayout({ theme: { effect: "symbol", symbolLogo: true } })?.theme.symbolLogo,
    ).toBe(true);
    expect(sanitizeLayout({ theme: { symbolLogo: "yes" } })?.theme.symbolLogo).toBeUndefined();
  });
});
