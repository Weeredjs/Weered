import { describe, expect, it } from "vitest";
import { toTurns } from "../../src/lib/operatorDm";

const OP = "op";
describe("toTurns", () => {
  it("drops the welcome DM that opens the thread and answers the member", () => {
    expect(
      toTurns(
        [
          { fromId: OP, body: "Welcome" },
          { fromId: "u", body: "poo" },
        ],
        OP,
      ),
    ).toEqual([{ role: "user", content: "poo" }]);
  });
  it("merges runs from the same side and keeps alternation", () => {
    const t = toTurns(
      [
        { fromId: "u", body: "hi" },
        { fromId: "u", body: "you there?" },
        { fromId: OP, body: "Yes." },
        { fromId: "u", body: "how do lobbies work" },
      ],
      OP,
    );
    expect(t.map((x) => x.role)).toEqual(["user", "assistant", "user"]);
    expect(t[0].content).toBe("hi\n\nyou there?");
  });
  it("returns nothing when the last word is already the Operator's", () => {
    expect(
      toTurns(
        [
          { fromId: "u", body: "hi" },
          { fromId: OP, body: "Hey." },
        ],
        OP,
      ),
    ).toEqual([]);
  });
  it("skips empty bodies", () => {
    expect(toTurns([{ fromId: "u", body: "  " }], OP)).toEqual([]);
  });
});
