import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { doorShouldBeLocked, guestsIn, walkInsOn, WALKIN_OFFICE } from "../../src/lib/officeDoor";

// The walk-in office (2026-11-12): open while the host is free, shut behind
// the first visitor, open again when they leave. Every other consult room, and
// the walk-in office with walk-ins off or never set, stays locked.
const users = (...people: [string, boolean][]) =>
  new Map(people.map(([id, isGuest]) => [id, { id, isGuest }]));

describe("the office door rule", () => {
  let dir = "";
  afterEach(() => dir && rmSync(dir, { recursive: true, force: true }));

  it("is open only for the walk-in office, walk-ins on, no visitor in", () => {
    expect(doorShouldBeLocked(WALKIN_OFFICE, { users: users(["eceb-host", false]) }, true)).toBe(
      false,
    );
    expect(doorShouldBeLocked(WALKIN_OFFICE, null, true)).toBe(false);
    // A visitor in with the host: shut behind them.
    expect(
      doorShouldBeLocked(
        WALKIN_OFFICE,
        { users: users(["eceb-host", false], ["guest_pat", true]) },
        true,
      ),
    ).toBe(true);
    // Walk-ins off: always shut.
    expect(doorShouldBeLocked(WALKIN_OFFICE, null, false)).toBe(true);
    // Any other consult room: always shut.
    expect(doorShouldBeLocked("mtg-eceb-room2", null, true)).toBe(true);
  });

  it("counts visitors, not the host or staff", () => {
    expect(guestsIn(null)).toBe(0);
    expect(guestsIn({ users: users(["eceb-host", false], ["staff", false]) })).toBe(0);
    expect(
      guestsIn({ users: users(["guest_a", true], ["guest_b", true], ["eceb-host", false]) }),
    ).toBe(2);
  });

  it("reads the switch from the office's file, off when unset or unreadable", () => {
    dir = mkdtempSync(join(tmpdir(), "door-"));
    const f = join(dir, "office-hours.json");
    expect(walkInsOn(f)).toBe(false);
    writeFileSync(f, JSON.stringify({ open: false, schedule: null }));
    expect(walkInsOn(f)).toBe(false);
    writeFileSync(f, JSON.stringify({ open: false, walkIn: true }));
    expect(walkInsOn(f)).toBe(true);
    writeFileSync(f, "{oops");
    expect(walkInsOn(f)).toBe(false);
  });
});
