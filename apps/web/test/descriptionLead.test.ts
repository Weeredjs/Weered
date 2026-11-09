import { describe, expect, it } from "vitest";
import { descriptionLead } from "../lib/descriptionLead";

describe("descriptionLead", () => {
  it("keeps a short description whole", () => {
    expect(descriptionLead("General hangout. Everyone starts here.")).toBe(
      "General hangout. Everyone starts here.",
    );
  });

  it("stops before the sentences that read like our notes", () => {
    const lol =
      "League of Legends community lobby. Ranked Solo/Duo duos, Flex 5-stacks, Clash team coordination, ARAM lobbies, and theorycraft for off-meta builds. Weered's LFG is built for the Riot ecosystem's actual gaps. Riot has friend lists.";
    expect(descriptionLead(lol)).toBe(
      "League of Legends community lobby. Ranked Solo/Duo duos, Flex 5-stacks, Clash team coordination, ARAM lobbies, and theorycraft for off-meta builds.",
    );
  });

  it("cuts one over-long sentence at a word", () => {
    const out = descriptionLead("word ".repeat(80).trim());
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(201);
  });

  it("is empty for nothing", () => {
    expect(descriptionLead(null)).toBe("");
  });
});
