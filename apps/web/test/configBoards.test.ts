import { describe, it, expect } from "vitest";
import { readBoard } from "../components/ConfigBoards";

// Board specs come from a lobby's moduleConfig, which is operator-entered JSON.
// A malformed board must render as nothing rather than throw the whole module
// panel away, so every shape below has to come back null instead of exploding.
describe("readBoard — operator JSON is untrusted", () => {
  it("reads a well-formed board", () => {
    const b = readBoard({
      title: "Ligas Rankeadas",
      season: "Temporada 2026",
      columns: ["#", "Piloto"],
      rows: [["1", "Piloto 01"]],
    });
    expect(b?.title).toBe("Ligas Rankeadas");
    expect(b?.season).toBe("Temporada 2026");
    expect(b?.columns).toEqual(["#", "Piloto"]);
    expect(b?.rows).toEqual([["1", "Piloto 01"]]);
  });

  it("returns null for junk instead of throwing", () => {
    for (const bad of [null, undefined, 5, "nope", [], {}, { columns: [] }, { rows: [] }]) {
      expect(readBoard(bad)).toBeNull();
    }
  });

  it("returns null when columns exist but there are no rows, and vice versa", () => {
    expect(readBoard({ columns: ["#"], rows: [] })).toBeNull();
    expect(readBoard({ columns: [], rows: [["1"]] })).toBeNull();
  });

  it("rejects a rows value that is not a grid of strings", () => {
    // A single flat array, or cells that are numbers, would render as garbage
    // or crash the row mapper. Both must be refused.
    expect(readBoard({ columns: ["#"], rows: ["1", "2"] })).toBeNull();
    expect(readBoard({ columns: ["#"], rows: [[1, 2]] })).toBeNull();
    expect(readBoard({ columns: ["#"], rows: [null] })).toBeNull();
  });

  it("drops non-string column headers rather than rendering undefined", () => {
    const b = readBoard({ columns: ["#", 7, "Piloto"], rows: [["1", "x"]] });
    expect(b?.columns).toEqual(["#", "Piloto"]);
  });

  it("ignores a title or blurb of the wrong type", () => {
    const b = readBoard({ title: 5, blurb: {}, columns: ["#"], rows: [["1"]] });
    expect(b?.title).toBeUndefined();
    expect(b?.blurb).toBeUndefined();
  });

  it("is not fooled by an array, which is technically an object", () => {
    expect(readBoard([{ columns: ["#"], rows: [["1"]] }])).toBeNull();
  });
});
