import { describe, expect, it } from "vitest";
import { MEMBER_FLOOR, memberLabel, showMembers } from "../lib/socialProof";

describe("socialProof", () => {
  it("hides small and missing counts", () => {
    expect(showMembers(0)).toBe(false);
    expect(showMembers(4)).toBe(false);
    expect(showMembers(undefined)).toBe(false);
    expect(showMembers("x")).toBe(false);
    expect(memberLabel(MEMBER_FLOOR - 1)).toBe("");
  });
  it("shows counts at the floor and above", () => {
    expect(showMembers(MEMBER_FLOOR)).toBe(true);
    expect(memberLabel(1204)).toBe(`${(1204).toLocaleString()} members`);
  });
});
