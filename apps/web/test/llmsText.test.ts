import { describe, expect, it } from "vitest";
import { firstSentence, llmsText, lobbyLines } from "../lib/llmsText";

// /llms.txt is how AI assistants learn what Weered is (2026-11-12).
describe("llms.txt", () => {
  it("lists public lobbies with a link and their first sentence", () => {
    const lines = lobbyLines([
      { id: "chess", name: "Chess", description: "Chess community lobby. Bullet, blitz, rapid." },
      { id: "r/all", name: "r/all", description: "Reddit firehose." },
      { id: "lobby", name: "The Lobby", description: "General hangout." },
      { id: "nameless" },
    ]);
    expect(lines).toEqual(["- [Chess](https://weered.ca/lobby/chess): Chess community lobby."]);
  });

  it("keeps a long description to one short line", () => {
    const s = firstSentence("word ".repeat(80));
    expect(s.length).toBeLessThanOrEqual(160);
    expect(s.endsWith("…")).toBe(true);
    expect(firstSentence("Line one is\nstill line one. Two.")).toBe("Line one is still line one.");
    // Under 20 characters, a full stop isn't trusted as the end (St., vs.).
    expect(firstSentence("Vs. the world, together.")).toBe("Vs. the world, together.");
  });

  it("says what Weered is, the plans, and still reads without the lobby list", () => {
    const t = llmsText([]);
    expect(t.startsWith("# Weered\n")).toBe(true);
    expect(t).toContain("one shared town");
    for (const plan of ["Innocent, free", "$6 a month", "$14 a month", "$25 a month"])
      expect(t).toContain(plan);
    expect(t).toContain("sitemap.xml");
  });
});
