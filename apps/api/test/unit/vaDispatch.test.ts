import { describe, it, expect } from "vitest";
import { landingLine, bookingLine, landingsToAnnounce } from "../../src/vaDispatchWorker";
import { buildSampleSnapshot } from "../../src/lib/va/sampleSource";
import type { VaPirep } from "../../src/lib/va/types";

const base: VaPirep = {
  id: "x",
  pilotId: "OCN1024",
  pilotName: "Florian Nowak",
  callsign: "OCN1016",
  flightNumber: "4Y 1016",
  dep: "FRA",
  arr: "ACE",
  fleet: "A320-200",
  reg: "D-AOCA",
  blockMinutes: 252,
  airborneMinutes: 230,
  landingRateFpm: -98,
  gForce: 1.13,
  fuelKg: 11000,
  points: 300,
  network: "VATSIM",
  simulator: "MSFS 2024",
  status: "ACCEPTED",
  filedAt: new Date().toISOString(),
};

describe("Dispatch lines", () => {
  it("praises a soft landing by first name", () => {
    expect(landingLine(base, "Lanzarote")).toBe(
      "OCN1016 on blocks at Lanzarote (ACE) after 4:12. -98 fpm. Butter, Florian.",
    );
  });
  it("grades firmer landings without mocking anyone", () => {
    expect(landingLine({ ...base, landingRateFpm: -210 }, "Lanzarote")).toMatch(
      /-210 fpm, nicely done\.$/,
    );
    expect(landingLine({ ...base, landingRateFpm: -330 }, "Lanzarote")).toMatch(
      /-330 fpm, a positive one\.$/,
    );
  });
  it("sends hard or flagged landings to review rather than to a joke", () => {
    expect(landingLine({ ...base, landingRateFpm: -520 }, "Lanzarote")).toMatch(
      /with staff for review\.$/,
    );
    expect(landingLine({ ...base, status: "AWAITING_REVIEW" }, "Lanzarote")).toMatch(
      /with staff for review\.$/,
    );
  });
  it("announces a booking with the slot's real callsign, gate and wave", () => {
    const snap = buildSampleSnapshot(Date.UTC(2026, 8, 28, 17));
    const slot = snap.groupFlights[0].waves[0].slots[0];
    const line = bookingLine(snap, snap.groupFlights[0].key, slot.key, "Kevin", 24);
    expect(line).toContain(slot.callsign);
    expect(line).toContain(`gate ${slot.gate}`);
    expect(line).toContain("just went to Kevin. 24 of 40 slots booked");
  });
  it("says nothing about a slot it cannot find", () => {
    const snap = buildSampleSnapshot(Date.UTC(2026, 8, 28, 17));
    expect(bookingLine(snap, "no-such-flight", "X", "Kevin", 1)).toBeNull();
  });
});

// Found 2026-09-27: every report is PROCESSING for its first two minutes and the
// worker runs each minute, so marking reports seen on first sight meant landings
// were remembered before they could be announced. Dispatch posted once in two days.
describe("which landings Dispatch announces", () => {
  const at = (ms: number) => new Date(ms).toISOString();

  it("announces a landing once, after it leaves PROCESSING", () => {
    const t0 = Date.parse("2026-09-27T12:00:00Z");
    const seen = new Set<string>();
    const report = (status: VaPirep["status"]) => [{ ...base, id: "p1", status, filedAt: at(t0) }];
    expect(landingsToAnnounce(report("PROCESSING"), seen, t0 + 30_000)).toEqual([]);
    expect(landingsToAnnounce(report("PROCESSING"), seen, t0 + 90_000)).toEqual([]);
    expect(landingsToAnnounce(report("ACCEPTED"), seen, t0 + 150_000).map((p) => p.id)).toEqual([
      "p1",
    ]);
    expect(landingsToAnnounce(report("ACCEPTED"), seen, t0 + 210_000)).toEqual([]);
  });

  it("never announces a report older than fifteen minutes", () => {
    const t0 = Date.parse("2026-09-27T12:00:00Z");
    const old = [{ ...base, id: "p2", filedAt: at(t0 - 20 * 60_000) }];
    expect(landingsToAnnounce(old, new Set(), t0)).toEqual([]);
  });

  it("over hours of the real sample airline, announces every landing (the old rule announced none)", () => {
    const start = Date.parse("2026-09-26T06:00:00Z");
    const end = start + 6 * 3_600_000;
    const seen = new Set<string>();
    const oldSeen = new Set<string>();
    const announced = new Set<string>();
    let oldAnnounced = 0;
    landingsToAnnounce(buildSampleSnapshot(start).pireps, seen, start); // the primed first pass
    for (const p of buildSampleSnapshot(start).pireps) oldSeen.add(p.id);
    for (let t = start + 60_000; t <= end; t += 60_000) {
      const pireps = buildSampleSnapshot(t).pireps;
      for (const p of landingsToAnnounce(pireps, seen, t)) announced.add(p.id);
      // The previous rule, for comparison.
      const fresh = pireps.filter(
        (p) => !oldSeen.has(p.id) && t - Date.parse(p.filedAt) < 15 * 60_000,
      );
      for (const p of pireps.slice(0, 400)) oldSeen.add(p.id);
      oldAnnounced += fresh.filter((p) => p.status !== "PROCESSING").length;
    }
    const landed = buildSampleSnapshot(end + 5 * 60_000).pireps.filter((p) => {
      const f = Date.parse(p.filedAt);
      return f > start && f <= end - 3 * 60_000;
    });
    expect(landed.length).toBeGreaterThan(0);
    for (const p of landed) expect(announced.has(p.id), p.id).toBe(true);
    expect(oldAnnounced).toBe(0);
  });
});
