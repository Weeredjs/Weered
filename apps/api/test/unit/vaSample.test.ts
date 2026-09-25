import { describe, it, expect } from "vitest";
import { buildSampleSnapshot, distanceKm } from "../../src/lib/va/sampleSource";
import { VOCN_AIRPORTS, VOCN_FLEET } from "../../src/lib/va/vocnData";
import { vaConfigOf } from "../../src/lib/va/source";

// The sample airline is shown to a real virtual airline's staff, people who fly
// these routes nightly. The invariants below are the ones such people notice
// first when they break: a tail flying two sectors at once, a pilot in two
// places, a flight that lands and then never appears in the log. Each was
// either a real bug found while building this or the reason for a design rule.

const T0 = Date.UTC(2026, 8, 28, 17, 0); // Mon 28 Sep 2026, 19:00 CEST

describe("vOCN sample airline", () => {
  const snap = buildSampleSnapshot(T0);

  it("uses vOCN's real fleet counts and network", () => {
    const count = (f: string) => VOCN_FLEET.filter((a) => a.fleet === f).length;
    expect(count("A320-200")).toBe(18);
    expect(count("A330-200")).toBe(2);
    expect(count("A330-300")).toBe(13);
    expect(
      VOCN_AIRPORTS.filter((a) => a.region === "HUB")
        .map((a) => a.iata)
        .sort(),
    ).toEqual(["FRA", "MUC"]);
    expect(VOCN_AIRPORTS.filter((a) => a.region !== "HUB")).toHaveLength(20);
  });

  it("is deterministic: the same moment always tells the same story", () => {
    const again = buildSampleSnapshot(T0);
    expect(again.pireps.slice(0, 50)).toEqual(snap.pireps.slice(0, 50));
    expect(again.live).toEqual(snap.live);
  });

  it("files every live flight as a PIREP, same id, once it has landed", () => {
    const later = buildSampleSnapshot(T0 + 16 * 3_600_000);
    const filed = new Set(later.pireps.map((p) => p.id));
    for (const f of snap.live) expect(filed.has(f.id)).toBe(true);
  });

  it("never has a pilot or a tail on two sectors at once", () => {
    // An odd step (3h07m) so successive samples land at different times of day.
    for (let t = Date.UTC(2026, 8, 3); t < T0; t += 187 * 60_000) {
      const s = buildSampleSnapshot(t);
      const pilots = s.live.map((f) => f.pilotId);
      const tails = s.live.map((f) => f.reg);
      expect(new Set(pilots).size).toBe(pilots.length);
      expect(new Set(tails).size).toBe(tails.length);
    }
  }, 30_000);

  it("orders the log newest first and credits no time for invalidated reports", () => {
    for (let i = 1; i < snap.pireps.length; i++) {
      expect(Date.parse(snap.pireps[i - 1].filedAt)).toBeGreaterThanOrEqual(
        Date.parse(snap.pireps[i].filedAt),
      );
    }
    for (const p of snap.pireps.filter(
      (x) => x.status === "REJECTED" || x.status === "INVALIDATED",
    )) {
      expect(p.points).toBe(0);
    }
  });

  it("flies narrowbodies short and widebodies long", () => {
    const longHaul = new Set(
      VOCN_AIRPORTS.filter((a) => ["NORTH_AMERICA", "AFRICA_INDIAN_OCEAN"].includes(a.region)).map(
        (a) => a.iata,
      ),
    );
    for (const p of snap.pireps) {
      const long = longHaul.has(p.dep) || longHaul.has(p.arr);
      expect(p.fleet === "A320-200").toBe(!long);
    }
  });

  it("gives staff something real to act on", () => {
    expect(snap.applications.length).toBeGreaterThan(0);
    const d30 = T0 - 30 * 86_400_000;
    const inactive = snap.pilots.filter(
      (p) => Date.parse(p.joinedAt) < d30 && (!p.lastFlightAt || Date.parse(p.lastFlightAt) < d30),
    );
    expect(inactive.length).toBeGreaterThan(0);
  });

  it("leaves open slots in the group flight and never presets a linked pilot", () => {
    const linked = buildSampleSnapshot(T0, { pilotLinks: { "user-1": snap.pilots[0].id } });
    const slots = linked.groupFlights[0].waves.flatMap((w) => w.slots);
    expect(slots.some((s) => !s.presetPilotId)).toBe(true);
    expect(slots.some((s) => s.presetPilotId === snap.pilots[0].id)).toBe(false);
    expect(new Set(slots.map((s) => s.callsign)).size).toBe(slots.length); // fixed callsigns are unique
  });

  it("measures Frankfurt to Halifax plausibly", () => {
    const fra = VOCN_AIRPORTS.find((a) => a.iata === "FRA")!;
    const yhz = VOCN_AIRPORTS.find((a) => a.iata === "YHZ")!;
    expect(distanceKm(fra, yhz)).toBeGreaterThan(5200);
    expect(distanceKm(fra, yhz)).toBeLessThan(5500);
  });
});

describe("vaConfigOf", () => {
  it("returns null for a lobby with no airline config", () => {
    expect(vaConfigOf(null)).toBeNull();
    expect(vaConfigOf({ startgg: {} })).toBeNull();
  });
  it("drops malformed links rather than rendering them", () => {
    const cfg = vaConfigOf({
      va: {
        airline: { name: "X" },
        links: [{ label: "ok", url: "https://a" }, { label: "no url" }, null],
      },
    });
    expect(cfg?.links).toHaveLength(1);
  });
});
