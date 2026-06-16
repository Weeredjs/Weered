import { describe, it, expect } from "vitest";
import { GlobalRole } from "@prisma/client";
import { canAccessStaff, canAssignRoles } from "../../src/lib/lobbyAuth";

describe("lobbyAuth predicates", () => {
  it("canAccessStaff: SUPPORT and above, not USER", () => {
    expect(canAccessStaff(GlobalRole.SUPPORT)).toBe(true);
    expect(canAccessStaff(GlobalRole.STAFF)).toBe(true);
    expect(canAccessStaff(GlobalRole.ADMIN)).toBe(true);
    expect(canAccessStaff(GlobalRole.GOD)).toBe(true);
    expect(canAccessStaff(GlobalRole.USER)).toBe(false);
  });
  it("canAssignRoles: STAFF and above, not SUPPORT or USER", () => {
    expect(canAssignRoles(GlobalRole.STAFF)).toBe(true);
    expect(canAssignRoles(GlobalRole.ADMIN)).toBe(true);
    expect(canAssignRoles(GlobalRole.GOD)).toBe(true);
    expect(canAssignRoles(GlobalRole.SUPPORT)).toBe(false);
    expect(canAssignRoles(GlobalRole.USER)).toBe(false);
  });
});
