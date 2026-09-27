import { describe, expect, it } from "vitest";
import { isOfficeRoom, officeOf, scopeAllows } from "../../src/lib/officeRooms";

// "mtg" is both the office prefix and the Magic: The Gathering lobby. These pin
// the line between them (found 2026-09-27).
describe("office rooms", () => {
  it("knows the ECEB consult rooms", () => {
    for (const id of ["mtg-eceb", "mtg-eceb-office", "mtg-eceb-foyer", "mtg-eceb-client-7"]) {
      expect(isOfficeRoom(id), id).toBe(true);
    }
  });

  it("leaves the Magic lobby's rooms alone", () => {
    for (const id of [
      "mtg",
      "mtg-library",
      "mtg-brew",
      "mtg-cube",
      "mtg-commander",
      "mtg-going-first",
    ]) {
      expect(isOfficeRoom(id), id).toBe(false);
    }
    expect(officeOf("mtg-ecebx")).toBeNull(); // a prefix, not a namespace
  });

  it("keeps a guest of the Magic lobby out of every consult room", () => {
    expect(scopeAllows("mtg", "mtg-library")).toBe(true);
    expect(scopeAllows("mtg", "mtg-eceb-office")).toBe(false);
    expect(scopeAllows("mtg", "mtg-eceb-foyer")).toBe(false);
  });

  it("lets an office guest into that office only", () => {
    expect(scopeAllows("mtg-eceb", "mtg-eceb-foyer")).toBe(true);
    expect(scopeAllows("mtg-eceb", "mtg-eceb-office")).toBe(true);
    expect(scopeAllows("mtg-eceb", "mtg-library")).toBe(false);
    expect(scopeAllows("mtg-eceb", "vocn-arrivals")).toBe(false);
    expect(scopeAllows("mtg-eceb-office", "mtg-eceb-office")).toBe(true);
    expect(scopeAllows("mtg-eceb-office", "mtg-eceb-foyer")).toBe(false);
  });

  it("refuses an empty scope", () => {
    expect(scopeAllows("", "mtg-eceb-office")).toBe(false);
    expect(scopeAllows("", "")).toBe(false);
  });
});
