import { describe, expect, it } from "vitest";
import { parseBarLaunch } from "../../src/lib/barLaunch";

const room = {
  users: new Map([
    ["host", {}],
    ["guest", {}],
  ]),
};
const good = {
  map: "Supreme Isthmus v2.1",
  mode: "team",
  teams: 3,
  difficulty: "hard",
  hostUserId: "host",
  hostAddress: "203.0.113.7:8452",
};

describe("parseBarLaunch", () => {
  it("accepts a valid room game and mints a password", () => {
    const cfg = parseBarLaunch(good, room);
    expect(cfg).not.toBeNull();
    expect(cfg!.teams).toBe(3);
    expect(cfg!.password).toMatch(/^[0-9a-f]{12}$/);
  });

  it("mints a fresh password every time", () => {
    expect(parseBarLaunch(good, room)!.password).not.toBe(parseBarLaunch(good, room)!.password);
  });

  it("rejects a host who is not in the room", () => {
    expect(parseBarLaunch({ ...good, hostUserId: "stranger" }, room)).toBeNull();
  });

  it("rejects map names that could break out of a start script line", () => {
    expect(parseBarLaunch({ ...good, map: "Isthmus;\n[GAME]" }, room)).toBeNull();
    expect(parseBarLaunch({ ...good, map: "" }, room)).toBeNull();
  });

  it("requires a host address except for a single-machine AI game", () => {
    expect(parseBarLaunch({ ...good, hostAddress: "" }, room)).toBeNull();
    expect(parseBarLaunch({ ...good, mode: "vs-ai", hostAddress: "" }, room)).not.toBeNull();
    expect(parseBarLaunch({ ...good, hostAddress: "bad address;" }, room)).toBeNull();
  });

  it("clamps teams to what each mode allows", () => {
    expect(parseBarLaunch({ ...good, teams: 99 }, room)!.teams).toBe(4);
    expect(parseBarLaunch({ ...good, mode: "ffa", teams: 99 }, room)!.teams).toBe(8);
    expect(parseBarLaunch({ ...good, mode: "coop-raptors", teams: 3 }, room)!.teams).toBe(1);
  });

  it("rejects unknown modes and falls back to normal difficulty", () => {
    expect(parseBarLaunch({ ...good, mode: "ranked" }, room)).toBeNull();
    expect(parseBarLaunch({ ...good, difficulty: "nightmare" }, room)!.difficulty).toBe("normal");
  });
});
