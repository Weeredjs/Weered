import { describe, it, expect } from "vitest";
import { landingLine, bookingLine } from "../../src/vaDispatchWorker";
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
