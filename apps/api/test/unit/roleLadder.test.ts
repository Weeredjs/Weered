import { describe, it, expect } from "vitest";
import { mayActOn, mayGiveRole, rolesToGive } from "../../src/lib/roleLadder";

// One ladder (ops audit 2026-11-01): "→ STAFF" was offered to STAFF and ADMIN
// but refused; a non-GOD could make ADMIN, which has the same powers.
describe("the staff ladder", () => {
  it("lets only GOD make or remove staff", () => {
    expect(rolesToGive("GOD")).toEqual(["USER", "SUPPORT", "STAFF", "ADMIN", "GOD"]);
    expect(rolesToGive("ADMIN")).toEqual(["USER", "SUPPORT"]);
    expect(rolesToGive("STAFF")).toEqual(["USER", "SUPPORT"]);
    expect(rolesToGive("SUPPORT")).toEqual([]);
    expect(rolesToGive("USER")).toEqual([]);
  });

  it("acts only on people below you; STAFF and ADMIN share a rung", () => {
    expect(mayActOn("STAFF", "SUPPORT")).toBe(true);
    expect(mayActOn("STAFF", "ADMIN")).toBe(false);
    expect(mayActOn("ADMIN", "STAFF")).toBe(false);
    expect(mayActOn("SUPPORT", "USER")).toBe(true);
    expect(mayActOn("SUPPORT", "SUPPORT")).toBe(false);
    expect(mayActOn("GOD", "GOD")).toBe(true);
  });

  it("checks the person and the role together", () => {
    expect(mayGiveRole("STAFF", "USER", "SUPPORT")).toBe(true);
    expect(mayGiveRole("STAFF", "USER", "ADMIN")).toBe(false);
    expect(mayGiveRole("ADMIN", "STAFF", "USER")).toBe(false);
    expect(mayGiveRole("GOD", "ADMIN", "STAFF")).toBe(true);
    expect(mayGiveRole("STAFF", "USER", "nonsense")).toBe(false);
  });
});
